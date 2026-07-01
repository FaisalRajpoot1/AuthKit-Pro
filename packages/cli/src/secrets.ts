import { randomBytes } from 'node:crypto';

export interface Secrets {
  /** JWT access-token signing secret (base64url, 48 bytes). */
  jwtAccessSecret: string;
  /** JWT refresh-token signing secret (base64url, 48 bytes). */
  jwtRefreshSecret: string;
  /** AES-256-GCM key for 2FA secret encryption (base64, exactly 32 bytes). */
  encryptionKey: string;
}

/** Generates a fresh set of cryptographically-random secrets. */
export function generateSecrets(): Secrets {
  return {
    jwtAccessSecret: randomBytes(48).toString('base64url'),
    jwtRefreshSecret: randomBytes(48).toString('base64url'),
    encryptionKey: randomBytes(32).toString('base64'),
  };
}

/** A single random secret, handy for `authkit secret`. */
export function generateSecret(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}
