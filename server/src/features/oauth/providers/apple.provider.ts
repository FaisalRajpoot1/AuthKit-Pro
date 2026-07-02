import jwt from 'jsonwebtoken';
import { env } from '../../../config/env';
import { UnauthorizedError } from '../../../utils/errors';
import type { OAuthProfile, OAuthProviderClient } from '../oauth.types';

interface AppleTokenResponse {
  id_token?: string;
}

/** Claims from Apple's identity token. */
interface AppleIdToken {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
}

const AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize';
const TOKEN_URL = 'https://appleid.apple.com/auth/token';
const AUDIENCE = 'https://appleid.apple.com';
/** Apple caps the client-secret JWT lifetime at 6 months; stay well under. */
const CLIENT_SECRET_TTL_SECONDS = 60 * 60 * 24 * 180;

/** The .p8 may be provided with escaped newlines; normalize to real ones. */
function privateKeyPem(): string {
  return (env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
}

/**
 * Builds Apple's client secret: an ES256 JWT signed with the team's private key.
 * Apple has no static client secret — one is minted per token exchange.
 */
function buildClientSecret(): string {
  return jwt.sign({}, privateKeyPem(), {
    algorithm: 'ES256',
    keyid: env.APPLE_KEY_ID,
    issuer: env.APPLE_TEAM_ID,
    audience: AUDIENCE,
    subject: env.APPLE_CLIENT_ID,
    expiresIn: CLIENT_SECRET_TTL_SECONDS,
  });
}

/**
 * Sign in with Apple. Apple returns to the callback via a cross-site POST
 * (`response_mode=form_post`) and delivers identity in an `id_token` JWT; the
 * user's email lives in that token's claims.
 */
export const appleProvider: OAuthProviderClient = {
  name: 'APPLE',
  usesFormPost: true,

  isConfigured() {
    return Boolean(
      env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY,
    );
  },

  getAuthorizationUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      response_type: 'code',
      // Required to receive name/email and to keep the flow POST-based.
      response_mode: 'form_post',
      client_id: env.APPLE_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      scope: 'name email',
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
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        client_id: env.APPLE_CLIENT_ID ?? '',
        client_secret: buildClientSecret(),
      }),
    });
    if (!tokenRes.ok) {
      throw new UnauthorizedError('Apple token exchange failed');
    }
    const token = (await tokenRes.json()) as AppleTokenResponse;
    if (!token.id_token) {
      throw new UnauthorizedError('Apple did not return an identity token');
    }

    // The id_token came directly from Apple over TLS; decode its claims.
    const claims = jwt.decode(token.id_token) as AppleIdToken | null;
    if (!claims?.sub) {
      throw new UnauthorizedError('Apple identity token was malformed');
    }

    const result: OAuthProfile = {
      providerAccountId: claims.sub,
      email: claims.email ?? null,
      emailVerified: claims.email_verified === true || claims.email_verified === 'true',
      // Apple only sends the display name in the first callback POST, not the
      // token; we leave it null and let the user set one later.
      displayName: null,
      avatarUrl: null,
    };
    return result;
  },
};
