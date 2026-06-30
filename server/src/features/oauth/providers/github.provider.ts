import { env } from '../../../config/env';
import { UnauthorizedError } from '../../../utils/errors';
import type { OAuthProfile, OAuthProviderClient } from '../oauth.types';

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

const USER_AGENT = 'AuthKit-Pro';

/** GitHub OAuth provider. Email is fetched separately as it may be private. */
export const githubProvider: OAuthProviderClient = {
  name: 'GITHUB',

  isConfigured() {
    return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
  },

  getAuthorizationUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }) {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        code,
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      throw new UnauthorizedError('GitHub token exchange failed');
    }
    const token = (await tokenRes.json()) as GitHubTokenResponse;
    if (!token.access_token) {
      throw new UnauthorizedError('GitHub did not return an access token');
    }

    const authHeaders = {
      Authorization: `Bearer ${token.access_token}`,
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github+json',
    };

    const userRes = await fetch('https://api.github.com/user', { headers: authHeaders });
    if (!userRes.ok) {
      throw new UnauthorizedError('Failed to fetch GitHub profile');
    }
    const user = (await userRes.json()) as GitHubUser;

    const { email, emailVerified } = await resolveEmail(user, authHeaders);

    const result: OAuthProfile = {
      providerAccountId: String(user.id),
      email,
      emailVerified,
      displayName: user.name ?? user.login,
      avatarUrl: user.avatar_url ?? null,
    };
    return result;
  },
};

/** Prefer the verified primary email; GitHub may omit email on the user object. */
async function resolveEmail(
  user: GitHubUser,
  headers: Record<string, string>,
): Promise<{ email: string | null; emailVerified: boolean }> {
  const res = await fetch('https://api.github.com/user/emails', { headers });
  if (res.ok) {
    const emails = (await res.json()) as GitHubEmail[];
    const primary = emails.find((e) => e.primary) ?? emails[0];
    if (primary) {
      return { email: primary.email, emailVerified: primary.verified };
    }
  }
  return { email: user.email ?? null, emailVerified: false };
}
