import type { User } from '@prisma/client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { recordAudit } from '../audit/audit.service';
import type { RequestContext } from './auth.types';

/** Lock the account after this many consecutive failed password attempts. */
export const MAX_FAILED_ATTEMPTS = 5;
/** How long an account stays locked. */
export const LOCK_DURATION_MS = 15 * 60 * 1000;

export function isLocked(user: Pick<User, 'lockedUntil'>): boolean {
  return user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now();
}

/** Records a login attempt for forensics. Best-effort — never breaks login. */
export async function recordLoginAttempt(params: {
  email: string;
  userId: string | null;
  successful: boolean;
  context: RequestContext;
}): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        email: params.email,
        userId: params.userId,
        successful: params.successful,
        ipAddress: params.context.ipAddress ?? null,
        userAgent: params.context.userAgent ?? null,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to record login attempt');
  }
}

/**
 * Registers a failed password attempt for a known user, locking the account
 * once the threshold is reached.
 */
export async function registerFailedAttempt(user: User, context: RequestContext): Promise<void> {
  const attempts = user.failedLoginAttempts + 1;
  const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: attempts,
      ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) } : {}),
    },
  });

  if (shouldLock) {
    logger.warn({ userId: user.id }, 'Account locked after repeated failed logins');
    await recordAudit({ action: 'ACCOUNT_LOCKED', userId: user.id, context });
  }
}

/** Clears the failure counter (and any lock) after a successful login. */
export async function clearFailedAttempts(user: Pick<User, 'id' | 'failedLoginAttempts' | 'lockedUntil'>): Promise<void> {
  if (user.failedLoginAttempts === 0 && user.lockedUntil === null) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

/** Admin action: unlock a user and reset their failure counter. */
export async function unlockUser(
  userId: string,
  actingUserId: string,
  context: RequestContext,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
  await recordAudit({ action: 'ACCOUNT_UNLOCKED', userId: actingUserId, context, metadata: { targetUserId: userId } });
}
