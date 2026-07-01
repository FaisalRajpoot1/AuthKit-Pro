import { env } from '../../../config/env';
import { UnauthorizedError } from '../../../utils/errors';
import type { OAuthProfile, OAuthProviderClient } from '../oauth.types';

interface MicrosoftTokenResponse {
  access_token?: string;
}

interface MicrosoftUserInfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

const AUTHORIZE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const USERINFO_URL = 'https://graph.microsoft.com/oidc/userinfo';

/** Microsoft identity platform (Azure AD) provider via OpenID Connect. */
export const microsoftProvider: OAuthProviderClient = {
  name: 'MICROSOFT',

  isConfigured() {
    return Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
  },

  getAuthorizationUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID ?? '',
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: 'openid email profile',
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }) {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.MICROSOFT_CLIENT_ID ?? '',
        client_secret: env.MICROSOFT_CLIENT_SECRET ?? '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid email profile',
      }),
    });
    if (!tokenRes.ok) {
      throw new UnauthorizedError('Microsoft token exchange failed');
    }
    const token = (await tokenRes.json()) as MicrosoftTokenResponse;
    if (!token.access_token) {
      throw new UnauthorizedError('Microsoft did not return an access token');
    }

    const userRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userRes.ok) {
      throw new UnauthorizedError('Failed to fetch Microsoft profile');
    }
    const profile = (await userRes.json()) as MicrosoftUserInfo;

    const result: OAuthProfile = {
      providerAccountId: profile.sub,
      email: profile.email ?? null,
      // Microsoft OIDC emails from verified work/school or personal accounts.
      emailVerified: Boolean(profile.email),
      displayName: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
    };
    return result;
  },
};
