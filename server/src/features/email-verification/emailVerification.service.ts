import { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { emailService } from '../../lib/email/email.service';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { generateOpaqueToken, hashToken } from '../../lib/tokens';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { recordAudit } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.types';

const MS_PER_HOUR = 60 * 60 * 1000;

function verificationExpiry(): Date {
  return new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_HOURS * MS_PER_HOUR);
}

/**
 * Issues an email-verification token and sends the email. Used on registration
 * and on explicit resend. Accepts a transaction client so it can participate in
 * the registration transaction.
 */
export async function issueEmailVerification(
  userId: string,
  email: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  const { token, hash } = generateOpaqueToken();
  await tx.verificationToken.create({
    data: { userId, tokenHash: hash, purpose: 'EMAIL_VERIFICATION', expiresAt: verificationExpiry() },
  });
  await emailService.sendVerificationEmail(email, token);
}

/** Issues an email-change confirmation token sent to the *new* address. */
export async function issueEmailChange(userId: string, newEmail: string): Promise<void> {
  const { token, hash } = generateOpaqueToken();
  await prisma.verificationToken.create({
    data: {
      userId,
      tokenHash: hash,
      purpose: 'EMAIL_CHANGE',
      newEmail,
      expiresAt: verificationExpiry(),
    },
  });
  await emailService.sendEmailChangeEmail(newEmail, token);
}

/** Resend verification for a user who hasn't verified yet (idempotent-ish). */
export async function resendVerification(userId: string): Promise<void> {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new NotFoundError('Account not found');
  if (user.emailVerified) {
    throw new ConflictError('Email is already verified');
  }
  await issueEmailVerification(user.id, user.email);
  logger.info({ userId }, 'Verification email re-sent');
}

/** Consume an EMAIL_VERIFICATION token and mark the account verified. */
export async function verifyEmail(rawToken: string, context: RequestContext): Promise<void> {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (!record || record.purpose !== 'EMAIL_VERIFICATION') {
    throw new ValidationError('Invalid verification token');
  }
  if (record.consumedAt) {
    throw new ValidationError('This verification link has already been used');
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw new ValidationError('This verification link has expired');
  }

  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
  ]);

  logger.info({ userId: record.userId }, 'Email verified');
  await recordAudit({ action: 'EMAIL_VERIFIED', userId: record.userId, context });
}

/** Consume an EMAIL_CHANGE token and apply the new email address. */
export async function confirmEmailChange(
  rawToken: string,
  context: RequestContext,
): Promise<void> {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (!record || record.purpose !== 'EMAIL_CHANGE' || !record.newEmail) {
    throw new ValidationError('Invalid email-change token');
  }
  if (record.consumedAt) {
    throw new ValidationError('This link has already been used');
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw new ValidationError('This link has expired');
  }

  try {
    await prisma.$transaction([
      prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { email: record.newEmail, emailVerified: true },
      }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('That email address is already in use');
    }
    throw error;
  }

  logger.info({ userId: record.userId }, 'Email address changed');
  await recordAudit({ action: 'EMAIL_CHANGED', userId: record.userId, context });
}
