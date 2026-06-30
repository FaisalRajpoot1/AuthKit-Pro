import type { Prisma, RefreshToken, Session, User } from '@prisma/client';
import { signAccessToken } from '../../lib/jwt';
import { logger } from '../../lib/logger';
import { hashPassword, verifyPassword } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import { generateRefreshToken, hashToken } from '../../lib/tokens';
import { ConflictError, UnauthorizedError } from '../../utils/errors';
import { recordAudit } from '../audit/audit.service';
import { issueEmailVerification } from '../email-verification/emailVerification.service';
import {
  createSession,
  refreshExpiry,
  revokeSession,
  touchSession,
} from '../sessions/sessions.service';
import type { LoginInput, RegisterInput } from './auth.schema';
import {
  type AuthResult,
  type AuthTokens,
  type RequestContext,
  type UserDto,
  toUserDto,
} from './auth.types';

/** Generic credentials error — never reveal whether the account exists. */
const INVALID_CREDENTIALS = 'Invalid credentials';

/**
 * A real Argon2 hash computed once at startup. Verifying against it when the
 * account doesn't exist makes login spend the same CPU work either way,
 * preventing account enumeration via response timing.
 */
const dummyHashPromise = hashPassword('authkit-timing-equalizer-password');

/**
 * Issues an access token (carrying the session id) plus a persisted, hashed
 * refresh token bound to the session. The raw refresh token is returned only
 * here and never stored.
 */
async function issueTokens(
  user: User,
  sessionId: string,
  expiresAt: Date,
  tx: Prisma.TransactionClient = prisma,
): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: user.id, email: user.email, sid: sessionId });
  const { token, hash } = generateRefreshToken();

  await tx.refreshToken.create({
    data: { userId: user.id, sessionId, tokenHash: hash, expiresAt },
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

  const tokens = await prisma.$transaction(async (tx) => {
    const session = await createSession(user.id, context, refreshExpiry(), tx);
    return issueTokens(user, session.id, session.expiresAt, tx);
  });

  logger.info({ userId: user.id }, 'User registered');
  await recordAudit({ action: 'USER_REGISTERED', userId: user.id, context });

  // Best-effort: a failed verification email must not fail registration.
  try {
    await issueEmailVerification(user.id, user.email);
  } catch (error) {
    logger.error({ err: error, userId: user.id }, 'Failed to send verification email');
  }

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
    await recordAudit({
      action: 'LOGIN_FAILED',
      userId: user?.id ?? null,
      context,
      metadata: { identifier: input.identifier },
    });
    throw new UnauthorizedError(INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    throw new UnauthorizedError('This account has been disabled');
  }

  const tokens = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const session = await createSession(user.id, context, refreshExpiry(), tx);
    return issueTokens(user, session.id, session.expiresAt, tx);
  });

  logger.info({ userId: user.id }, 'User logged in');
  await recordAudit({ action: 'USER_LOGIN', userId: user.id, context });
  return { user: toUserDto(user), tokens };
}

/**
 * Rotates a refresh token: validates the presented token, issues a new pair,
 * and revokes the old token. Detects reuse of an already-rotated token and
 * defensively revokes the whole session.
 */
export async function refresh(
  rawToken: string,
  context: RequestContext,
): Promise<{ tokens: AuthTokens; user: UserDto }> {
  const tokenHash = hashToken(rawToken);

  const result = await prisma.$transaction(async (tx) => {
    const stored: (RefreshToken & { user: User; session: Session }) | null =
      await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true, session: true },
      });

    if (!stored) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Reuse of a rotated/revoked token => likely theft. Burn the session.
    if (stored.revokedAt) {
      await revokeSession(stored.sessionId, tx);
      return { reuse: true as const, userId: stored.userId };
    }

    if (stored.expiresAt.getTime() < Date.now() || stored.session.revokedAt) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    if (!stored.user.isActive || stored.user.deletedAt) {
      throw new UnauthorizedError('Account is no longer active');
    }

    const expiresAt = refreshExpiry();
    const tokens = await issueTokens(stored.user, stored.sessionId, expiresAt, tx);
    const successor = await tx.refreshToken.findUnique({
      where: { tokenHash: hashToken(tokens.refreshToken) },
      select: { id: true },
    });

    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: successor?.id ?? null },
    });
    await touchSession(stored.sessionId, context, expiresAt, tx);

    return { reuse: false as const, tokens, user: toUserDto(stored.user) };
  });

  if (result.reuse) {
    logger.warn({ userId: result.userId }, 'Refresh token reuse detected — session revoked');
    await recordAudit({
      action: 'REFRESH_TOKEN_REUSE_DETECTED',
      userId: result.userId,
      context,
    });
    throw new UnauthorizedError('Refresh token has been revoked');
  }

  return { tokens: result.tokens, user: result.user };
}

/** Revoke the session behind the presented refresh token at logout. */
export async function logout(
  rawToken: string | undefined,
  context: RequestContext,
): Promise<void> {
  if (!rawToken) return;

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { sessionId: true, userId: true },
  });
  if (!stored) return;

  await revokeSession(stored.sessionId);
  await recordAudit({ action: 'USER_LOGOUT', userId: stored.userId, context });
}

export async function getProfile(userId: string): Promise<UserDto> {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) {
    throw new UnauthorizedError('Account not found');
  }
  return toUserDto(user);
}
