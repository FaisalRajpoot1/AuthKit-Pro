import { createHash, randomBytes } from 'node:crypto';

/**
 * Refresh tokens are opaque high-entropy random strings (not JWTs). The raw
 * token is sent to the client; only its SHA-256 hash is stored, so a database
 * leak does not expose usable tokens. Comparison is by hash lookup.
 */
const REFRESH_TOKEN_BYTES = 48;

export interface GeneratedToken {
  /** Raw token to send to the client/email. Never stored. */
  token: string;
  /** SHA-256 hash to persist. */
  hash: string;
}

/** Generates a high-entropy opaque token plus its storage hash. */
export function generateOpaqueToken(bytes = 32): GeneratedToken {
  const token = randomBytes(bytes).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function generateRefreshToken(): GeneratedToken {
  return generateOpaqueToken(REFRESH_TOKEN_BYTES);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
