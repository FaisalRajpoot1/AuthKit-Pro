import { env } from '../../../config/env';
import { UnauthorizedError } from '../../../utils/errors';
import type { OAuthProfile, OAuthProviderClient } from '../oauth.types';

interface LinkedInTokenResponse {
  access_token?: string;
}

/** Claims from LinkedIn's OpenID Connect userinfo endpoint. */
interface LinkedInUserInfo {
  sub: string;
  name?: string | null;
  email?: string | null;
  email_verified?: boolean | string;
  picture?: string | null;
}

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

/**
 * "Sign In with LinkedIn using OpenID Connect". Profile and email come from the
 * standard OIDC `userinfo` endpoint rather than LinkedIn's legacy REST API.
 */
export const linkedinProvider: OAuthProviderClient = {
  name: 'LINKEDIN',

  isConfigured() {
    return Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET);
  },

  getAuthorizationUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      client_id: env.LINKEDIN_CLIENT_ID ?? '',
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }) {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: env.LINKEDIN_CLIENT_ID ?? '',
        client_secret: env.LINKEDIN_CLIENT_SECRET ?? '',
      }),
    });
    if (!tokenRes.ok) {
      throw new UnauthorizedError('LinkedIn token exchange failed');
    }
    const token = (await tokenRes.json()) as LinkedInTokenResponse;
    if (!token.access_token) {
      throw new UnauthorizedError('LinkedIn did not return an access token');
    }

    const userRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userRes.ok) {
      throw new UnauthorizedError('Failed to fetch LinkedIn profile');
    }
    const user = (await userRes.json()) as LinkedInUserInfo;

    const result: OAuthProfile = {
      providerAccountId: user.sub,
      email: user.email ?? null,
      emailVerified: user.email_verified === true || user.email_verified === 'true',
      displayName: user.name ?? null,
      avatarUrl: user.picture ?? null,
    };
    return result;
  },
};
