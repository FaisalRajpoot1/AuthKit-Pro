import jwt from 'jsonwebtoken';
import { AuthError } from './errors';
import type { AuthPrincipal } from './types';

/**
 * Verifies an AuthKit access token (HS256) and extracts the principal. Throws
 * an {@link AuthError} (401) if the token is missing claims, invalid, or expired.
 */
export function verifyAccessToken(
  token: string,
  options: { secret: string; issuer: string; audience: string },
): AuthPrincipal {
  try {
    const decoded = jwt.verify(token, options.secret, {
      issuer: options.issuer,
      audience: options.audience,
    });

    if (
      typeof decoded === 'string' ||
      typeof decoded.sub !== 'string' ||
      typeof decoded.sid !== 'string'
    ) {
      throw new AuthError(401, 'UNAUTHORIZED', 'Invalid access token');
    }

    return { userId: decoded.sub, email: String(decoded.email), sessionId: decoded.sid };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(401, 'UNAUTHORIZED', 'Invalid or expired access token');
  }
}
