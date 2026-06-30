import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';

/** Claims embedded in the short-lived access token. */
export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  sid: string; // session id — identifies the originating device session
}

const ACCESS_TOKEN_OPTIONS: SignOptions = {
  expiresIn: env.ACCESS_TOKEN_TTL as NonNullable<SignOptions['expiresIn']>,
  issuer: 'authkit',
  audience: 'authkit-client',
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, ACCESS_TOKEN_OPTIONS);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'authkit',
      audience: 'authkit-client',
    });

    if (
      typeof decoded === 'string' ||
      typeof decoded.sub !== 'string' ||
      typeof decoded.sid !== 'string'
    ) {
      throw new UnauthorizedError('Invalid access token');
    }

    return { sub: decoded.sub, email: String(decoded.email), sid: decoded.sid };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

const TWO_FACTOR_AUDIENCE = 'authkit-2fa';

/**
 * Short-lived token issued after a correct password when 2FA is required. It
 * proves the first factor succeeded so the second-factor step can complete
 * login. Audience-scoped so it can never be used as an access token.
 */
export function signTwoFactorChallenge(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: '5m',
    issuer: 'authkit',
    audience: TWO_FACTOR_AUDIENCE,
  });
}

export function verifyTwoFactorChallenge(token: string): { userId: string } {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'authkit',
      audience: TWO_FACTOR_AUDIENCE,
    });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw new UnauthorizedError('Invalid challenge token');
    }
    return { userId: decoded.sub };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired challenge token');
  }
}
