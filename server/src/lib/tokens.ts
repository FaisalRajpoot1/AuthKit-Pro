import { createHash, randomBytes, randomUUID } from 'node:crypto';

/**
 * Refresh tokens are opaque high-entropy random strings (not JWTs). The raw
 * token is sent to the client; only its SHA-256 hash is stored, so a database
 * leak does not expose usable tokens. Comparison is by hash lookup.
 */
const REFRESH_TOKEN_BYTES = 48;

export interface GeneratedRefreshToken {
  /** Raw token to send to the client. Never stored. */
  token: string;
  /** SHA-256 hash to persist. */
  hash: string;
}

export function generateRefreshToken(): GeneratedRefreshToken {
  const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A new rotation-chain identifier for a login session's refresh tokens. */
export function newTokenFamily(): string {
  return randomUUID();
}
