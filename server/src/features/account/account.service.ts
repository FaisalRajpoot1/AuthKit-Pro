import type { User } from '@prisma/client';
import { logger } from '../../lib/logger';
import { hashPassword, verifyPassword } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import { hashToken } from '../../lib/tokens';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../utils/errors';
import { toUserDto, type UserDto } from '../auth/auth.types';
import { issueEmailChange } from '../email-verification/emailVerification.service';
import type {
  AvailabilityQuery,
  ChangeEmailInput,
  ChangePasswordInput,
  DeleteAccountInput,
  UpdateProfileInput,
} from './account.schema';

/** Loads an active user or throws — shared guard for account operations. */
async function requireActiveUser(userId: string): Promise<User> {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new NotFoundError('Account not found');
  return user;
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UserDto> {
  await requireActiveUser(userId);

  const user = await prisma.user.update({
    where: { id: userId },
    // Only touch displayName when the caller actually provided it.
    data: input.displayName === undefined ? {} : { displayName: input.displayName },
  });

  logger.info({ userId }, 'Profile updated');
  return toUserDto(user);
}

/**
 * Changes the password after verifying the current one, then revokes every
 * *other* refresh-token session. The caller's current session (identified by
 * its refresh token) is preserved.
 */
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  currentRefreshToken?: string,
): Promise<void> {
  const user = await requireActiveUser(userId);

  const valid = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!valid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const passwordHash = await hashPassword(input.newPassword);
  const keepHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(keepHash ? { tokenHash: { not: keepHash } } : {}),
      },
      data: { revokedAt: new Date() },
    }),
  ]);

  logger.info({ userId }, 'Password changed');
}

/**
 * Starts an email change: verifies the password, ensures the new address is
 * free, and emails a confirmation link to the new address. The address only
 * changes once that link is confirmed.
 */
export async function requestEmailChange(
  userId: string,
  input: ChangeEmailInput,
): Promise<void> {
  const user = await requireActiveUser(userId);

  const valid = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!valid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  if (input.newEmail === user.email) {
    throw new ConflictError('That is already your email address');
  }

  const taken = await prisma.user.findFirst({
    where: { email: input.newEmail },
    select: { id: true },
  });
  if (taken) {
    throw new ConflictError('That email address is already in use');
  }

  await issueEmailChange(userId, input.newEmail);
  logger.info({ userId }, 'Email change requested');
}

/** Soft-deletes the account and revokes all sessions. */
export async function deleteAccount(userId: string, input: DeleteAccountInput): Promise<void> {
  const user = await requireActiveUser(userId);

  const valid = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!valid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), isActive: false },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  logger.info({ userId }, 'Account soft-deleted');
}

/** Checks whether a username and/or email is available for registration. */
export async function checkAvailability(
  query: AvailabilityQuery,
): Promise<{ username?: boolean; email?: boolean }> {
  const result: { username?: boolean; email?: boolean } = {};

  if (query.username) {
    const existing = await prisma.user.findUnique({
      where: { username: query.username },
      select: { id: true },
    });
    result.username = existing === null;
  }

  if (query.email) {
    const existing = await prisma.user.findUnique({
      where: { email: query.email.toLowerCase() },
      select: { id: true },
    });
    result.email = existing === null;
  }

  return result;
}
