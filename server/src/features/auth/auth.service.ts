import type { Prisma, RefreshToken, Session, User } from '@prisma/client';
import { signAccessToken, signTwoFactorChallenge, verifyTwoFactorChallenge } from '../../lib/jwt';
import { emailService } from '../../lib/email/email.service';
import { logger } from '../../lib/logger';
import { hashPassword, verifyPassword } from '../../lib/password';
import { assertPasswordNotPwned } from '../../lib/pwnedPasswords';
import { prisma } from '../../lib/prisma';
import { generateRefreshToken, hashToken } from '../../lib/tokens';
import { ConflictError, TooManyRequestsError, UnauthorizedError } from '../../utils/errors';
import { recordAudit } from '../audit/audit.service';
import { issueEmailVerification } from '../email-verification/emailVerification.service';
import {
  createSession,
  refreshExpiry,
  revokeSession,
  touchSession,
} from '../sessions/sessions.service';
import { assignDefaultRole } from '../rbac/rbac.service';
import {
  isTrustedDevice,
  registerTrustedDevice,
  verifySecondFactor,
} from '../two-factor/twoFactor.service';
import {
  clearFailedAttempts,
  isLocked,
  recordLoginAttempt,
  registerFailedAttempt,
} from './lockout';
import { checkSuspiciousLogin } from './suspiciousLogin';
import type { LoginInput, RegisterInput, TwoFactorLoginInput } from './auth.schema';
import {
  type AuthResult,
  type AuthTokens,
  type LoginResult,
  type RequestContext,
  type TwoFactorLoginResult,
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
    select: { id: true },
  });

  if (existing) {
    // Generic message so registration can't be used to enumerate which emails
    // or usernames are already registered.
    throw new ConflictError('That email or username is already in use');
  }

  await assertPasswordNotPwned(input.password);
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
    await assignDefaultRole(user.id, tx);
    const session = await createSession(user.id, context, refreshExpiry(), tx);
    return issueTokens(user, session.id, session.expiresAt, tx);
  });

  logger.info({ userId: user.id }, 'User registered');
  await recordAudit({ action: 'USER_REGISTERED', userId: user.id, context });

  // Best-effort: a failed verification/welcome email must not fail registration.
  try {
    await issueEmailVerification(user.id, user.email);
    await emailService.sendWelcomeEmail(user.email, user.displayName);
  } catch (error) {
    logger.error({ err: error, userId: user.id }, 'Failed to send registration email');
  }

  return { user: toUserDto(user), tokens };
}

/** Creates a session and issues a fresh token pair for an authenticated user. */
export async function issueAuthenticatedSession(
  user: User,
  context: RequestContext,
): Promise<AuthResult> {
  const tokens = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const session = await createSession(user.id, context, refreshExpiry(), tx);
    return issueTokens(user, session.id, session.expiresAt, tx);
  });
  return { user: toUserDto(user), tokens };
}

export async function login(
  input: LoginInput,
  context: RequestContext,
  options: { trustedDeviceToken?: string | undefined } = {},
): Promise<LoginResult> {
  const identifier = input.identifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ email: identifier }, { username: input.identifier }],
    },
  });

  // Reject early if the account is temporarily locked from failed attempts.
  if (user && isLocked(user)) {
    await recordLoginAttempt({ email: identifier, userId: user.id, successful: false, context });
    throw new TooManyRequestsError(
      'Account temporarily locked due to too many failed attempts. Try again later.',
    );
  }

  // Always run a hash verification to keep timing uniform whether or not the
  // user exists, mitigating account-enumeration via response timing.
  const passwordValid = user
    ? await verifyPassword(user.passwordHash, input.password)
    : await verifyPassword(await dummyHashPromise, input.password);

  if (!user || !passwordValid) {
    if (user) await registerFailedAttempt(user, context);
    await recordLoginAttempt({ email: identifier, userId: user?.id ?? null, successful: false, context });
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

  await clearFailedAttempts(user);
  // Check against prior history BEFORE recording this attempt, so a new device
  // is detected relative to past sign-ins only.
  await checkSuspiciousLogin(user, context);
  await recordLoginAttempt({ email: user.email, userId: user.id, successful: true, context });
  return finalizeLogin(user, context, options.trustedDeviceToken);
}

/**
 * Shared final step of any successful first factor (password or passwordless):
 * enforces 2FA when enabled (unless the device is trusted), otherwise issues a
 * session. Reused by password login and passwordless login.
 */
export async function finalizeLogin(
  user: User,
  context: RequestContext,
  trustedDeviceToken?: string | undefined,
): Promise<LoginResult> {
  if (user.twoFactorEnabled) {
    const trusted = await isTrustedDevice(user.id, trustedDeviceToken);
    if (!trusted) {
      return { status: 'two_factor_required', challengeToken: signTwoFactorChallenge(user.id) };
    }
  }

  const result = await issueAuthenticatedSession(user, context);
  logger.info({ userId: user.id }, 'User logged in');
  await recordAudit({ action: 'USER_LOGIN', userId: user.id, context });
  return { status: 'authenticated', ...result };
}

/**
 * Completes a 2FA login: validates the first-factor challenge, verifies the
 * second factor (TOTP or backup code), issues tokens, and optionally remembers
 * the device so future logins from it skip 2FA.
 */
export async function completeTwoFactorLogin(
  input: TwoFactorLoginInput,
  context: RequestContext,
): Promise<TwoFactorLoginResult> {
  const { userId } = verifyTwoFactorChallenge(input.challengeToken);

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user || !user.twoFactorEnabled || !user.isActive) {
    throw new UnauthorizedError('Two-factor authentication challenge is no longer valid');
  }

  const verified = await verifySecondFactor(user, input.code);
  if (!verified) {
    await recordAudit({ action: 'TWO_FACTOR_CHALLENGE_FAILED', userId: user.id, context });
    throw new UnauthorizedError('Invalid authentication code');
  }

  const result = await issueAuthenticatedSession(user, context);
  logger.info({ userId: user.id }, 'User logged in (2FA)');
  await recordAudit({ action: 'TWO_FACTOR_CHALLENGE_SUCCEEDED', userId: user.id, context });
  await recordAudit({ action: 'USER_LOGIN', userId: user.id, context });

  if (input.trustDevice) {
    const trusted = await registerTrustedDevice(user.id, context);
    return { ...result, trustedDevice: trusted };
  }
  return result;
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

    // Atomically claim the rotation: only the request that flips revokedAt from
    // null wins. A concurrent request presenting the same token loses the race
    // (count === 0) and is treated as reuse — closing the double-spend window.
    const claim = await tx.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claim.count === 0) {
      await revokeSession(stored.sessionId, tx);
      return { reuse: true as const, userId: stored.userId };
    }

    const expiresAt = refreshExpiry();
    const tokens = await issueTokens(stored.user, stored.sessionId, expiresAt, tx);
    const successor = await tx.refreshToken.findUnique({
      where: { tokenHash: hashToken(tokens.refreshToken) },
      select: { id: true },
    });

    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { replacedById: successor?.id ?? null },
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
