import { randomInt } from 'node:crypto';
import { emailService } from '../../lib/email/email.service';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { generateOpaqueToken, hashToken } from '../../lib/tokens';
import { ValidationError } from '../../utils/errors';
import { recordAudit } from '../audit/audit.service';
import { finalizeLogin } from '../auth/auth.service';
import type { LoginResult, RequestContext } from '../auth/auth.types';

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const GENERIC_INVALID = 'Invalid or expired code';

async function findActiveUserByEmail(email: string): Promise<{ id: string; email: string; isActive: boolean } | null> {
  return prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
    select: { id: true, email: true, isActive: true },
  });
}

/** Emails a single-use magic link. Always resolves the same way (no enumeration). */
export async function requestMagicLink(email: string, context: RequestContext): Promise<void> {
  const user = await findActiveUserByEmail(email);
  if (!user || !user.isActive) {
    logger.info({ email }, 'Magic-link requested for unknown/inactive account (no-op)');
    return;
  }

  const { token, hash } = generateOpaqueToken();
  await prisma.$transaction([
    prisma.loginToken.deleteMany({ where: { userId: user.id, type: 'MAGIC_LINK' } }),
    prisma.loginToken.create({
      data: {
        userId: user.id,
        type: 'MAGIC_LINK',
        tokenHash: hash,
        expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    }),
  ]);

  await emailService.sendMagicLinkEmail(user.email, token);
  await recordAudit({
    action: 'PASSWORDLESS_LOGIN_REQUESTED',
    userId: user.id,
    context,
    metadata: { method: 'magic_link' },
  });
}

/** Consumes a magic-link token and completes login (may require 2FA). */
export async function verifyMagicLink(rawToken: string, context: RequestContext): Promise<LoginResult> {
  const record = await prisma.loginToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true },
  });

  if (
    !record ||
    record.type !== 'MAGIC_LINK' ||
    record.consumedAt !== null ||
    record.expiresAt.getTime() < Date.now()
  ) {
    throw new ValidationError('This sign-in link is invalid or has expired');
  }
  if (!record.user.isActive || record.user.deletedAt) {
    throw new ValidationError('Account is no longer active');
  }

  const claim = await prisma.loginToken.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (claim.count === 0) {
    throw new ValidationError('This sign-in link has already been used');
  }

  return finalizeLogin(record.user, context);
}

/** Emails a 6-digit one-time login code. Enumeration-safe. */
export async function requestLoginOtp(email: string, context: RequestContext): Promise<void> {
  const user = await findActiveUserByEmail(email);
  if (!user || !user.isActive) {
    logger.info({ email }, 'Login OTP requested for unknown/inactive account (no-op)');
    return;
  }

  // Salt the low-entropy code with the user id so hashes stay unique per user.
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  await prisma.$transaction([
    prisma.loginToken.deleteMany({ where: { userId: user.id, type: 'EMAIL_OTP' } }),
    prisma.loginToken.create({
      data: {
        userId: user.id,
        type: 'EMAIL_OTP',
        tokenHash: hashToken(`${user.id}:${code}`),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    }),
  ]);

  await emailService.sendLoginOtpEmail(user.email, code);
  await recordAudit({
    action: 'PASSWORDLESS_LOGIN_REQUESTED',
    userId: user.id,
    context,
    metadata: { method: 'email_otp' },
  });
}

/** Verifies a login OTP for an email, with a per-code attempt cap. */
export async function verifyLoginOtp(
  email: string,
  code: string,
  context: RequestContext,
): Promise<LoginResult> {
  const user = await findActiveUserByEmail(email);
  if (!user || !user.isActive) {
    throw new ValidationError(GENERIC_INVALID);
  }

  const token = await prisma.loginToken.findFirst({
    where: { userId: user.id, type: 'EMAIL_OTP', consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!token || token.expiresAt.getTime() < Date.now()) {
    throw new ValidationError(GENERIC_INVALID);
  }
  if (token.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.loginToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
    throw new ValidationError('Too many attempts. Request a new code.');
  }

  if (hashToken(`${user.id}:${code.trim()}`) !== token.tokenHash) {
    await prisma.loginToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
    throw new ValidationError(GENERIC_INVALID);
  }

  const claim = await prisma.loginToken.updateMany({
    where: { id: token.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (claim.count === 0) {
    throw new ValidationError(GENERIC_INVALID);
  }

  const fullUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  return finalizeLogin(fullUser, context);
}
