import { env } from '../../../config/env';
import { UnauthorizedError } from '../../../utils/errors';
import type { OAuthProfile, OAuthProviderClient } from '../oauth.types';

interface GoogleTokenResponse {
  access_token: string;
}

interface GoogleUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/** Google OAuth 2.0 / OpenID Connect provider. */
export const googleProvider: OAuthProviderClient = {
  name: 'GOOGLE',

  isConfigured() {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  },

  getAuthorizationUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }) {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID ?? '',
        client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      throw new UnauthorizedError('Google token exchange failed');
    }
    const token = (await tokenRes.json()) as GoogleTokenResponse;

    const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userRes.ok) {
      throw new UnauthorizedError('Failed to fetch Google profile');
    }
    const profile = (await userRes.json()) as GoogleUserInfo;

    const result: OAuthProfile = {
      providerAccountId: profile.sub,
      email: profile.email ?? null,
      emailVerified: profile.email_verified ?? false,
      displayName: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
    };
    return result;
  },
};
