import type { Prisma, RefreshToken, User } from '@prisma/client';
import { env } from '../../config/env';
import { signAccessToken } from '../../lib/jwt';
import { logger } from '../../lib/logger';
import { hashPassword, verifyPassword } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import { generateRefreshToken, hashToken, newTokenFamily } from '../../lib/tokens';
import { ConflictError, UnauthorizedError } from '../../utils/errors';
import type { LoginInput, RegisterInput } from './auth.schema';
import {
  type AuthResult,
  type AuthTokens,
  type RequestContext,
  type UserDto,
  toUserDto,
} from './auth.types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Generic credentials error — never reveal whether the account exists. */
const INVALID_CREDENTIALS = 'Invalid credentials';

/**
 * A real Argon2 hash computed once at startup. Verifying against it when the
 * account doesn't exist makes login spend the same CPU work either way,
 * preventing account enumeration via response timing.
 */
const dummyHashPromise = hashPassword('authkit-timing-equalizer-password');

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * MS_PER_DAY);
}

/**
 * Issues an access token plus a persisted, hashed refresh token belonging to
 * the given rotation family. The raw refresh token is returned only here.
 */
async function issueTokens(
  user: User,
  family: string,
  context: RequestContext,
  tx: Prisma.TransactionClient = prisma,
): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const { token, hash } = generateRefreshToken();
  const expiresAt = refreshExpiry();

  await tx.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      family,
      expiresAt,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
    },
  });

  return { accessToken, refreshToken: token, refreshTokenExpiresAt: expiresAt };
}

export async function register(input: RegisterInput, context: RequestContext): Promise<AuthResult> {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
    select: { email: true, username: true },
  });

  if (existing) {
    const field = existing.email === input.email ? 'email' : 'username';
    throw new ConflictError(`That ${field} is already taken`);
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      displayName: input.displayName ?? null,
    },
  });

  const tokens = await issueTokens(user, newTokenFamily(), context);
  logger.info({ userId: user.id }, 'User registered');

  return { user: toUserDto(user), tokens };
}

export async function login(input: LoginInput, context: RequestContext): Promise<AuthResult> {
  const identifier = input.identifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ email: identifier }, { username: input.identifier }],
    },
  });

  // Always run a hash verification to keep timing uniform whether or not the
  // user exists, mitigating account-enumeration via response timing.
  const passwordValid = user
    ? await verifyPassword(user.passwordHash, input.password)
    : await verifyPassword(await dummyHashPromise, input.password);

  if (!user || !passwordValid) {
    throw new UnauthorizedError(INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    throw new UnauthorizedError('This account has been disabled');
  }

  const tokens = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return issueTokens(user, newTokenFamily(), context, tx);
  });

  logger.info({ userId: user.id }, 'User logged in');
  return { user: toUserDto(user), tokens };
}

/** Revoke an entire rotation family — used when token reuse is detected. */
async function revokeFamily(family: string, tx: Prisma.TransactionClient): Promise<void> {
  await tx.refreshToken.updateMany({
    where: { family, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Rotates a refresh token: validates the presented token, issues a new pair,
 * and revokes the old token. Detects reuse of an already-rotated token and
 * defensively revokes the whole family.
 */
export async function refresh(
  rawToken: string,
  context: RequestContext,
): Promise<{ tokens: AuthTokens; user: UserDto }> {
  const tokenHash = hashToken(rawToken);

  return prisma.$transaction(async (tx) => {
    const stored: (RefreshToken & { user: User }) | null = await tx.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Reuse of a rotated/revoked token => likely theft. Burn the family.
    if (stored.revokedAt) {
      await revokeFamily(stored.family, tx);
      logger.warn(
        { userId: stored.userId, family: stored.family },
        'Refresh token reuse detected — family revoked',
      );
      throw new UnauthorizedError('Refresh token has been revoked');
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    if (!stored.user.isActive || stored.user.deletedAt) {
      throw new UnauthorizedError('Account is no longer active');
    }

    const tokens = await issueTokens(stored.user, stored.family, context, tx);
    const successor = await tx.refreshToken.findUnique({
      where: { tokenHash: hashToken(tokens.refreshToken) },
      select: { id: true },
    });

    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: successor?.id ?? null },
    });

    return { tokens, user: toUserDto(stored.user) };
  });
}

/** Revoke the refresh token presented at logout (idempotent). */
export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getProfile(userId: string): Promise<UserDto> {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) {
    throw new UnauthorizedError('Account not found');
  }
  return toUserDto(user);
}
