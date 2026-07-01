import { env } from '../../../config/env';
import { UnauthorizedError } from '../../../utils/errors';
import type { OAuthProfile, OAuthProviderClient } from '../oauth.types';

interface DiscordTokenResponse {
  access_token?: string;
}

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  email?: string | null;
  verified?: boolean;
  avatar?: string | null;
}

const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const USER_URL = 'https://discord.com/api/users/@me';

/** Discord OAuth2 provider. */
export const discordProvider: OAuthProviderClient = {
  name: 'DISCORD',

  isConfigured() {
    return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);
  },

  getAuthorizationUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID ?? '',
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'identify email',
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
        client_id: env.DISCORD_CLIENT_ID ?? '',
        client_secret: env.DISCORD_CLIENT_SECRET ?? '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      throw new UnauthorizedError('Discord token exchange failed');
    }
    const token = (await tokenRes.json()) as DiscordTokenResponse;
    if (!token.access_token) {
      throw new UnauthorizedError('Discord did not return an access token');
    }

    const userRes = await fetch(USER_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userRes.ok) {
      throw new UnauthorizedError('Failed to fetch Discord profile');
    }
    const user = (await userRes.json()) as DiscordUser;

    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : null;

    const result: OAuthProfile = {
      providerAccountId: user.id,
      email: user.email ?? null,
      emailVerified: Boolean(user.email) && user.verified === true,
      displayName: user.global_name ?? user.username,
      avatarUrl,
    };
    return result;
  },
};
