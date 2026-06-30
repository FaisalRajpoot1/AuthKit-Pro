import { env } from '../../config/env';
import { emailService } from '../../lib/email/email.service';
import { logger } from '../../lib/logger';
import { hashPassword } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import { generateOpaqueToken, hashToken } from '../../lib/tokens';
import { ValidationError } from '../../utils/errors';
import { recordAudit } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.types';
import { revokeAllUserSessions } from '../sessions/sessions.service';
import type { ForgotPasswordInput, ResetPasswordInput } from './passwordReset.schema';

const MS_PER_MINUTE = 60 * 1000;

function resetExpiry(): Date {
  return new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * MS_PER_MINUTE);
}

/**
 * Begins a password reset. Always resolves the same way whether or not the
 * email exists, so the endpoint cannot be used to enumerate accounts.
 */
export async function forgotPassword(
  input: ForgotPasswordInput,
  context: RequestContext,
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
    select: { id: true, email: true },
  });

  if (!user) {
    logger.info({ email: input.email }, 'Password reset requested for unknown email (no-op)');
    return;
  }

  const { token, hash } = generateOpaqueToken();
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash: hash, expiresAt: resetExpiry() },
  });

  await emailService.sendPasswordResetEmail(user.email, token);
  logger.info({ userId: user.id }, 'Password reset email sent');
  await recordAudit({ action: 'PASSWORD_RESET_REQUESTED', userId: user.id, context });
}

/**
 * Completes a reset: validates the token, sets the new password, marks the
 * token consumed, and revokes all refresh tokens so existing sessions die.
 */
export async function resetPassword(
  input: ResetPasswordInput,
  context: RequestContext,
): Promise<void> {
  const record = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashToken(input.token) },
  });

  if (!record) {
    throw new ValidationError('Invalid reset token');
  }
  if (record.consumedAt) {
    throw new ValidationError('This reset link has already been used');
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw new ValidationError('This reset link has expired');
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction(async (tx) => {
    await tx.passwordReset.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    // Invalidate every active session for this user.
    await revokeAllUserSessions(record.userId, null, tx);
  });

  logger.info({ userId: record.userId }, 'Password reset completed');
  await recordAudit({ action: 'PASSWORD_RESET_COMPLETED', userId: record.userId, context });
}
