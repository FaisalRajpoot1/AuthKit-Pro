import { env } from '../../../config/env';
import { UnauthorizedError } from '../../../utils/errors';
import type { OAuthProfile, OAuthProviderClient } from '../oauth.types';

interface TwitterTokenResponse {
  access_token?: string;
}

interface TwitterUser {
  data?: {
    id: string;
    name?: string | null;
    username?: string | null;
    profile_image_url?: string | null;
  };
}

const AUTHORIZE_URL = 'https://twitter.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const USER_URL = 'https://api.twitter.com/2/users/me?user.fields=profile_image_url';

/**
 * X (Twitter) OAuth 2.0. X mandates PKCE and authenticates confidential clients
 * with HTTP Basic auth at the token endpoint. Its v2 API does not expose an
 * email address, so `email` is always null — X can be linked to an existing
 * account, and first-time sign-in requires an account it can match by identity.
 */
export const twitterProvider: OAuthProviderClient = {
  name: 'TWITTER',
  usesPkce: true,

  isConfigured() {
    return Boolean(env.TWITTER_CLIENT_ID && env.TWITTER_CLIENT_SECRET);
  },

  getAuthorizationUrl({ state, redirectUri, codeChallenge }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.TWITTER_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      scope: 'users.read tweet.read',
      state,
      code_challenge: codeChallenge ?? '',
      code_challenge_method: 'S256',
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri, codeVerifier }) {
    const basic = Buffer.from(
      `${env.TWITTER_CLIENT_ID ?? ''}:${env.TWITTER_CLIENT_SECRET ?? ''}`,
    ).toString('base64');

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier ?? '',
        client_id: env.TWITTER_CLIENT_ID ?? '',
      }),
    });
    if (!tokenRes.ok) {
      throw new UnauthorizedError('X token exchange failed');
    }
    const token = (await tokenRes.json()) as TwitterTokenResponse;
    if (!token.access_token) {
      throw new UnauthorizedError('X did not return an access token');
    }

    const userRes = await fetch(USER_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userRes.ok) {
      throw new UnauthorizedError('Failed to fetch X profile');
    }
    const user = (await userRes.json()) as TwitterUser;
    if (!user.data?.id) {
      throw new UnauthorizedError('X returned an unexpected profile');
    }

    const result: OAuthProfile = {
      providerAccountId: user.data.id,
      // X's v2 API does not provide the user's email address.
      email: null,
      emailVerified: false,
      displayName: user.data.name ?? user.data.username ?? null,
      avatarUrl: user.data.profile_image_url ?? null,
    };
    return result;
  },
};
