import { randomBytes, randomInt } from 'node:crypto';
import type { Prisma, User } from '@prisma/client';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { env } from '../../config/env';
import { emailService } from '../../lib/email/email.service';
import { smsService } from '../../lib/sms/sms.service';
import { decrypt, encrypt } from '../../lib/encryption';
import { logger } from '../../lib/logger';
import { verifyPassword } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import { generateOpaqueToken, hashToken } from '../../lib/tokens';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../../utils/errors';
import { recordAudit } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.types';
import { notify } from '../notifications/notifications.service';

// Allow ±1 time-step (±30s) of clock drift between server and authenticator.
authenticator.options = { window: 1 };

const BACKUP_CODE_COUNT = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
const EMAIL_OTP_MAX_ATTEMPTS = 5;
const SMS_OTP_TTL_MS = 10 * 60 * 1000;
const PHONE_VERIFICATION_TTL_MS = 10 * 60 * 1000;
const TOTP_CODE_PATTERN = /^\d{6}$/;

/** Six-digit numeric one-time code, zero-padded. */
function generateNumericCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Masks a phone number for display, keeping only the last two digits. */
function maskPhone(phone: string): string {
  return phone.length <= 2 ? phone : `${'•'.repeat(phone.length - 2)}${phone.slice(-2)}`;
}

async function requireUser(userId: string): Promise<User> {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new NotFoundError('Account not found');
  return user;
}

function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const hex = randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars
    return `${hex.slice(0, 5)}-${hex.slice(5, 10)}`;
  });
}

/** Replaces a user's backup codes (within a transaction) and returns the raw set. */
async function replaceBackupCodes(userId: string, tx: Prisma.TransactionClient): Promise<string[]> {
  const codes = generateBackupCodes();
  await tx.backupCode.deleteMany({ where: { userId } });
  await tx.backupCode.createMany({
    data: codes.map((code) => ({ userId, codeHash: hashToken(normalizeCode(code)) })),
  });
  return codes;
}

function normalizeCode(code: string): string {
  return code.replace(/\s|-/g, '').toUpperCase();
}

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

/**
 * Begins enrollment: generates a TOTP secret, stores it encrypted (still
 * disabled), and returns provisioning data for the authenticator app.
 */
export async function setupTwoFactor(userId: string): Promise<TwoFactorSetup> {
  const user = await requireUser(userId);
  if (user.twoFactorEnabled) {
    throw new ConflictError('Two-factor authentication is already enabled');
  }

  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(user.email, env.TOTP_ISSUER, secret);

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: encrypt(secret) },
  });

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, otpauthUrl, qrCodeDataUrl };
}

/** Confirms enrollment by verifying a code, enabling 2FA and issuing backup codes. */
export async function enableTwoFactor(
  userId: string,
  code: string,
  context: RequestContext,
): Promise<{ backupCodes: string[] }> {
  const user = await requireUser(userId);
  if (user.twoFactorEnabled) {
    throw new ConflictError('Two-factor authentication is already enabled');
  }
  if (!user.twoFactorSecret) {
    throw new ValidationError('Start setup before enabling two-factor authentication');
  }

  const secret = decrypt(user.twoFactorSecret);
  if (!TOTP_CODE_PATTERN.test(code.trim()) || !authenticator.verify({ token: code.trim(), secret })) {
    throw new ValidationError('Invalid authentication code');
  }

  const backupCodes = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorEnabledAt: new Date() },
    });
    return replaceBackupCodes(userId, tx);
  });

  logger.info({ userId }, 'Two-factor enabled');
  await recordAudit({ action: 'TWO_FACTOR_ENABLED', userId, context });
  await notify(userId, {
    type: 'SECURITY_ALERT',
    title: 'Two-factor authentication enabled',
    body: 'Two-factor authentication was turned on for your account.',
  });
  return { backupCodes };
}

/** Disables 2FA after a password check and clears all related secrets/devices. */
export async function disableTwoFactor(
  userId: string,
  password: string,
  context: RequestContext,
): Promise<void> {
  const user = await requireUser(userId);
  if (!user.twoFactorEnabled) {
    throw new ConflictError('Two-factor authentication is not enabled');
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw new UnauthorizedError('Password is incorrect');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorEnabledAt: null },
    }),
    prisma.backupCode.deleteMany({ where: { userId } }),
    prisma.trustedDevice.deleteMany({ where: { userId } }),
  ]);

  logger.info({ userId }, 'Two-factor disabled');
  await recordAudit({ action: 'TWO_FACTOR_DISABLED', userId, context });
  await notify(userId, {
    type: 'SECURITY_ALERT',
    title: 'Two-factor authentication disabled',
    body: 'Two-factor authentication was turned off for your account. If this wasn’t you, secure your account now.',
  });
}

export async function regenerateBackupCodes(
  userId: string,
  password: string,
  context: RequestContext,
): Promise<{ backupCodes: string[] }> {
  const user = await requireUser(userId);
  if (!user.twoFactorEnabled) {
    throw new ConflictError('Two-factor authentication is not enabled');
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw new UnauthorizedError('Password is incorrect');
  }

  const backupCodes = await prisma.$transaction((tx) => replaceBackupCodes(userId, tx));
  await recordAudit({ action: 'BACKUP_CODES_REGENERATED', userId, context });
  return { backupCodes };
}

export async function getStatus(userId: string): Promise<{
  enabled: boolean;
  backupCodesRemaining: number;
  sms: { enabled: boolean; phone: string | null };
}> {
  const user = await requireUser(userId);
  const backupCodesRemaining = user.twoFactorEnabled
    ? await prisma.backupCode.count({ where: { userId, usedAt: null } })
    : 0;
  return {
    enabled: user.twoFactorEnabled,
    backupCodesRemaining,
    sms: {
      enabled: Boolean(user.phoneNumber && user.phoneVerifiedAt),
      phone: user.phoneNumber ? maskPhone(user.phoneNumber) : null,
    },
  };
}

/**
 * Verifies a second factor: a current TOTP code, a one-time backup code, or an
 * emailed one-time 2FA code (all consumed on success). Returns whether it passed.
 */
export async function verifySecondFactor(user: User, code: string): Promise<boolean> {
  const trimmed = code.trim();

  if (TOTP_CODE_PATTERN.test(trimmed) && user.twoFactorSecret) {
    if (authenticator.verify({ token: trimmed, secret: decrypt(user.twoFactorSecret) })) {
      return true;
    }
  }

  // A one-time backup code.
  const codeHash = hashToken(normalizeCode(trimmed));
  const backup = await prisma.backupCode.findFirst({
    where: { userId: user.id, codeHash, usedAt: null },
  });
  if (backup) {
    await prisma.backupCode.update({ where: { id: backup.id }, data: { usedAt: new Date() } });
    return true;
  }

  // A 6-digit code delivered out-of-band by email or SMS (a fallback for when
  // the authenticator isn't handy).
  if (TOTP_CODE_PATTERN.test(trimmed)) {
    if (await consumeDeliveredOtp(user.id, 'TWO_FACTOR_OTP', trimmed)) return true;
    if (await consumeDeliveredOtp(user.id, 'TWO_FACTOR_SMS_OTP', trimmed)) return true;
  }

  return false;
}

/**
 * Checks (and consumes) a delivered one-time 2FA code of the given type, with an
 * attempt cap. Shared by the email- and SMS-delivered code channels.
 */
async function consumeDeliveredOtp(
  userId: string,
  type: 'TWO_FACTOR_OTP' | 'TWO_FACTOR_SMS_OTP' | 'PHONE_VERIFICATION',
  code: string,
): Promise<boolean> {
  const token = await prisma.loginToken.findFirst({
    where: { userId, type, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!token || token.expiresAt.getTime() < Date.now() || token.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
    return false;
  }

  if (hashToken(`${userId}:${code}`) !== token.tokenHash) {
    await prisma.loginToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
    return false;
  }

  const claim = await prisma.loginToken.updateMany({
    where: { id: token.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return claim.count > 0;
}

/**
 * Emails a one-time 2FA code as an alternative second factor. Called during the
 * login challenge (the caller has already verified the first factor).
 */
export async function requestEmailOtp(userId: string): Promise<void> {
  const user = await requireUser(userId);
  if (!user.twoFactorEnabled) {
    throw new ConflictError('Two-factor authentication is not enabled');
  }

  const code = generateNumericCode();
  await prisma.$transaction([
    prisma.loginToken.deleteMany({ where: { userId, type: 'TWO_FACTOR_OTP' } }),
    prisma.loginToken.create({
      data: {
        userId,
        type: 'TWO_FACTOR_OTP',
        tokenHash: hashToken(`${userId}:${code}`),
        expiresAt: new Date(Date.now() + EMAIL_OTP_TTL_MS),
      },
    }),
  ]);

  await emailService.sendLoginOtpEmail(user.email, code);
  logger.info({ userId }, 'Two-factor email OTP sent');
}

/** E.164 phone number, e.g. +14155552671. */
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

/**
 * Registers a phone number for SMS-based 2FA and sends a verification code. The
 * phone is stored unverified until confirmed via {@link verifyPhoneNumber}.
 */
export async function setupSmsFactor(userId: string, phoneNumber: string): Promise<{ phone: string }> {
  const phone = phoneNumber.trim();
  if (!E164_PATTERN.test(phone)) {
    throw new ValidationError('Enter a phone number in international format, e.g. +14155552671');
  }
  const user = await requireUser(userId);

  const code = generateNumericCode();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { phoneNumber: phone, phoneVerifiedAt: null },
    }),
    prisma.loginToken.deleteMany({ where: { userId, type: 'PHONE_VERIFICATION' } }),
    prisma.loginToken.create({
      data: {
        userId,
        type: 'PHONE_VERIFICATION',
        tokenHash: hashToken(`${userId}:${code}`),
        expiresAt: new Date(Date.now() + PHONE_VERIFICATION_TTL_MS),
      },
    }),
  ]);

  await smsService.sendPhoneVerification(phone, code);
  logger.info({ userId }, 'Phone verification code sent');
  return { phone: maskPhone(phone) };
}

/** Confirms phone ownership with the SMS code, enabling SMS as a 2FA channel. */
export async function verifyPhoneNumber(userId: string, code: string): Promise<void> {
  const user = await requireUser(userId);
  if (!user.phoneNumber) {
    throw new ConflictError('No phone number to verify');
  }
  if (!(await consumeDeliveredOtp(userId, 'PHONE_VERIFICATION', code.trim()))) {
    throw new UnauthorizedError('Invalid or expired verification code');
  }
  await prisma.user.update({ where: { id: userId }, data: { phoneVerifiedAt: new Date() } });
  logger.info({ userId }, 'Phone number verified');
}

/** Removes the SMS 2FA channel: clears the phone and any pending SMS tokens. */
export async function removeSmsFactor(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { phoneNumber: null, phoneVerifiedAt: null },
    }),
    prisma.loginToken.deleteMany({
      where: { userId, type: { in: ['PHONE_VERIFICATION', 'TWO_FACTOR_SMS_OTP'] } },
    }),
  ]);
}

/**
 * Sends a one-time 2FA code by SMS as an alternative second factor. Called
 * during the login challenge (the first factor has already been verified).
 */
export async function requestSmsOtp(userId: string): Promise<void> {
  const user = await requireUser(userId);
  if (!user.twoFactorEnabled) {
    throw new ConflictError('Two-factor authentication is not enabled');
  }
  if (!user.phoneNumber || !user.phoneVerifiedAt) {
    throw new ConflictError('No verified phone number on file');
  }

  const code = generateNumericCode();
  await prisma.$transaction([
    prisma.loginToken.deleteMany({ where: { userId, type: 'TWO_FACTOR_SMS_OTP' } }),
    prisma.loginToken.create({
      data: {
        userId,
        type: 'TWO_FACTOR_SMS_OTP',
        tokenHash: hashToken(`${userId}:${code}`),
        expiresAt: new Date(Date.now() + SMS_OTP_TTL_MS),
      },
    }),
  ]);

  await smsService.sendLoginOtp(user.phoneNumber, code);
  logger.info({ userId }, 'Two-factor SMS OTP sent');
}

function trustedDeviceExpiry(): Date {
  return new Date(Date.now() + env.TRUSTED_DEVICE_TTL_DAYS * MS_PER_DAY);
}

/** True if the presented cookie matches a non-expired trusted device. */
export async function isTrustedDevice(
  userId: string,
  rawCookie: string | undefined,
): Promise<boolean> {
  if (!rawCookie) return false;

  const device = await prisma.trustedDevice.findFirst({
    where: { userId, tokenHash: hashToken(rawCookie), expiresAt: { gt: new Date() } },
  });
  if (!device) return false;

  await prisma.trustedDevice.update({
    where: { id: device.id },
    data: { lastUsedAt: new Date() },
  });
  return true;
}

/** Registers a trusted device and returns the raw cookie value to set. */
export async function registerTrustedDevice(
  userId: string,
  context: RequestContext,
): Promise<{ token: string; expiresAt: Date }> {
  const { token, hash } = generateOpaqueToken();
  const expiresAt = trustedDeviceExpiry();

  await prisma.trustedDevice.create({
    data: {
      userId,
      tokenHash: hash,
      expiresAt,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
    },
  });

  return { token, expiresAt };
}
