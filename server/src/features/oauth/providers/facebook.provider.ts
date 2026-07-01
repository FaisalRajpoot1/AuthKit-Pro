import { env } from '../../../config/env';
import { UnauthorizedError } from '../../../utils/errors';
import type { OAuthProfile, OAuthProviderClient } from '../oauth.types';

interface FacebookTokenResponse {
  access_token?: string;
}

interface FacebookUser {
  id: string;
  name?: string | null;
  email?: string | null;
  picture?: { data?: { url?: string | null } | null } | null;
}

const GRAPH_VERSION = 'v19.0';
const AUTHORIZE_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const TOKEN_URL = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
const USER_URL = 'https://graph.facebook.com/me';

/**
 * Facebook Login (OAuth2). Facebook only releases an email when the user grants
 * the `email` scope, and any email it returns has been verified on their side.
 */
export const facebookProvider: OAuthProviderClient = {
  name: 'FACEBOOK',

  isConfigured() {
    return Boolean(env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET);
  },

  getAuthorizationUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      client_id: env.FACEBOOK_CLIENT_ID ?? '',
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'email public_profile',
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }) {
    const tokenParams = new URLSearchParams({
      client_id: env.FACEBOOK_CLIENT_ID ?? '',
      client_secret: env.FACEBOOK_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      code,
    });
    const tokenRes = await fetch(`${TOKEN_URL}?${tokenParams.toString()}`);
    if (!tokenRes.ok) {
      throw new UnauthorizedError('Facebook token exchange failed');
    }
    const token = (await tokenRes.json()) as FacebookTokenResponse;
    if (!token.access_token) {
      throw new UnauthorizedError('Facebook did not return an access token');
    }

    const userParams = new URLSearchParams({
      fields: 'id,name,email,picture.type(large)',
      access_token: token.access_token,
    });
    const userRes = await fetch(`${USER_URL}?${userParams.toString()}`);
    if (!userRes.ok) {
      throw new UnauthorizedError('Failed to fetch Facebook profile');
    }
    const user = (await userRes.json()) as FacebookUser;

    const result: OAuthProfile = {
      providerAccountId: user.id,
      email: user.email ?? null,
      // Facebook only surfaces emails it has already verified.
      emailVerified: Boolean(user.email),
      displayName: user.name ?? null,
      avatarUrl: user.picture?.data?.url ?? null,
    };
    return result;
  },
};
