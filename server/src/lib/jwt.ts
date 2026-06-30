import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';

/** Claims embedded in the short-lived access token. */
export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
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

    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw new UnauthorizedError('Invalid access token');
    }

    return { sub: decoded.sub, email: String(decoded.email) };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired access token');
  }
}
