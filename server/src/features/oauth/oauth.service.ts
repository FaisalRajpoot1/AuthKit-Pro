import { randomBytes, randomUUID } from 'node:crypto';
import type { OAuthProvider, User } from '@prisma/client';
import { env } from '../../config/env';
import { signOAuthState, verifyOAuthState } from '../../lib/jwt';
import { logger } from '../../lib/logger';
import { hashPassword } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import { ConflictError, UnauthorizedError, ValidationError } from '../../utils/errors';
import { recordAudit } from '../audit/audit.service';
import { issueAuthenticatedSession } from '../auth/auth.service';
import type { AuthResult, RequestContext } from '../auth/auth.types';
import { getProviderClient } from './providers';

function redirectUri(provider: OAuthProvider): string {
  return `${env.SERVER_PUBLIC_URL}/api/v1/auth/oauth/${provider.toLowerCase()}/callback`;
}

/**
 * Builds a provider authorization URL and a signed state token. The state binds
 * a CSRF nonce, the intent (login vs link), and — when linking — the user id.
 */
export function buildAuthorization(
  provider: OAuthProvider,
  intent: 'login' | 'link',
  userId?: string,
): { url: string; state: string } {
  const client = getProviderClient(provider);
  if (!client.isConfigured()) {
    throw new ValidationError(`${provider} login is not configured`);
  }

  const state = signOAuthState({
    provider,
    intent,
    nonce: randomUUID(),
    ...(userId ? { userId } : {}),
  });
  const url = client.getAuthorizationUrl({ state, redirectUri: redirectUri(provider) });
  return { url, state };
}

export type CallbackResult =
  | { kind: 'login'; auth: AuthResult }
  | { kind: 'link'; provider: OAuthProvider };

/**
 * Handles the provider redirect: validates state against the cookie, exchanges
 * the code for a profile, then logs in / signs up / links accordingly.
 */
export async function handleCallback(params: {
  provider: OAuthProvider;
  code: string;
  state: string;
  cookieState: string | undefined;
  context: RequestContext;
}): Promise<CallbackResult> {
  const { provider, code, state, cookieState, context } = params;

  // CSRF: the state echoed by the provider must match the one we set in the
  // httpOnly cookie, and must be a valid signed token for this provider.
  if (!cookieState || cookieState !== state) {
    throw new UnauthorizedError('OAuth state mismatch');
  }
  const decoded = verifyOAuthState(state);
  if (decoded.provider !== provider) {
    throw new UnauthorizedError('OAuth state mismatch');
  }

  const profile = await getProviderClient(provider).exchangeCode({
    code,
    redirectUri: redirectUri(provider),
  });

  if (decoded.intent === 'link') {
    if (!decoded.userId) {
      throw new UnauthorizedError('Missing user for account linking');
    }
    await linkAccount(decoded.userId, provider, profile, context);
    return { kind: 'link', provider };
  }

  const user = await resolveLoginUser(provider, profile, context);
  const auth = await issueAuthenticatedSession(user, context);
  await recordAudit({ action: 'OAUTH_LOGIN', userId: user.id, context, metadata: { provider } });
  return { kind: 'login', auth };
}

/** Finds the user for an OAuth login, linking by email or creating as needed. */
async function resolveLoginUser(
  provider: OAuthProvider,
  profile: { providerAccountId: string; email: string | null; emailVerified: boolean; displayName: string | null; avatarUrl: string | null },
  context: RequestContext,
): Promise<User> {
  const existing = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } },
    include: { user: true },
  });
  if (existing) {
    if (existing.user.deletedAt || !existing.user.isActive) {
      throw new UnauthorizedError('This account is no longer active');
    }
    return existing.user;
  }

  // No linked account yet. Link to an existing user by verified email, else
  // create a fresh account.
  if (profile.email && profile.emailVerified) {
    const byEmail = await prisma.user.findFirst({
      where: { email: profile.email.toLowerCase(), deletedAt: null },
    });
    if (byEmail) {
      await createOAuthAccount(byEmail.id, provider, profile);
      await recordAudit({
        action: 'OAUTH_ACCOUNT_LINKED',
        userId: byEmail.id,
        context,
        metadata: { provider, autoLinked: true },
      });
      return byEmail;
    }
  }

  if (!profile.email) {
    throw new ValidationError(`${provider} did not provide an email address`);
  }

  return createUserFromProfile(provider, profile);
}

async function createUserFromProfile(
  provider: OAuthProvider,
  profile: { providerAccountId: string; email: string | null; emailVerified: boolean; displayName: string | null; avatarUrl: string | null },
): Promise<User> {
  const email = profile.email!.toLowerCase();
  const username = await generateUniqueUsername(email);
  // OAuth-only users get an unguessable random password; they can set a real
  // one later via the password-reset flow.
  const passwordHash = await hashPassword(randomBytes(32).toString('base64url'));

  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      displayName: profile.displayName,
      emailVerified: profile.emailVerified,
      oauthAccounts: {
        create: {
          provider,
          providerAccountId: profile.providerAccountId,
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        },
      },
    },
  });

  logger.info({ userId: user.id, provider }, 'User created via OAuth');
  return user;
}

/** Links a provider to an already-authenticated user. */
async function linkAccount(
  userId: string,
  provider: OAuthProvider,
  profile: { providerAccountId: string; email: string | null; displayName: string | null; avatarUrl: string | null },
  context: RequestContext,
): Promise<void> {
  const existing = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } },
    select: { userId: true },
  });
  if (existing && existing.userId !== userId) {
    throw new ConflictError('That account is already linked to another user');
  }

  await createOAuthAccount(userId, provider, profile, true);
  await recordAudit({ action: 'OAUTH_ACCOUNT_LINKED', userId, context, metadata: { provider } });
  logger.info({ userId, provider }, 'OAuth account linked');
}

function createOAuthAccount(
  userId: string,
  provider: OAuthProvider,
  profile: { providerAccountId: string; email: string | null; displayName: string | null; avatarUrl: string | null },
  upsert = false,
): Promise<unknown> {
  const data = {
    provider,
    providerAccountId: profile.providerAccountId,
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  };

  if (upsert) {
    return prisma.oAuthAccount.upsert({
      where: {
        provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId },
      },
      create: { userId, ...data },
      update: data,
    });
  }
  return prisma.oAuthAccount.create({ data: { userId, ...data } });
}

async function generateUniqueUsername(email: string): Promise<string> {
  const base = (email.split('@')[0] ?? 'user').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24) || 'user';
  // The bare base, then base + random suffix until free.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}_${randomBytes(3).toString('hex')}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}_${randomUUID().slice(0, 8)}`;
}

export interface LinkedAccountDto {
  provider: OAuthProvider;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export async function listLinkedAccounts(userId: string): Promise<LinkedAccountDto[]> {
  const accounts = await prisma.oAuthAccount.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  return accounts.map((a) => ({
    provider: a.provider,
    email: a.email,
    displayName: a.displayName,
    avatarUrl: a.avatarUrl,
    createdAt: a.createdAt.toISOString(),
  }));
}

/**
 * Unlinks a provider. Refuses if it would leave the user with no way back in
 * (no other provider and an unverified email to reset a password with).
 */
export async function unlinkAccount(
  userId: string,
  provider: OAuthProvider,
  context: RequestContext,
): Promise<void> {
  const account = await prisma.oAuthAccount.findFirst({ where: { userId, provider } });
  if (!account) {
    throw new ValidationError(`No linked ${provider} account`);
  }

  const [user, otherCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { emailVerified: true } }),
    prisma.oAuthAccount.count({ where: { userId, provider: { not: provider } } }),
  ]);

  if (otherCount === 0 && !user.emailVerified) {
    throw new ConflictError(
      'Verify your email or add another login method before unlinking this account',
    );
  }

  await prisma.oAuthAccount.delete({ where: { id: account.id } });
  await recordAudit({ action: 'OAUTH_ACCOUNT_UNLINKED', userId, context, metadata: { provider } });
  logger.info({ userId, provider }, 'OAuth account unlinked');
}
