import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env';

/**
 * Authenticated symmetric encryption (AES-256-GCM) for secrets stored at rest,
 * such as TOTP seeds. A DB leak alone does not expose plaintext secrets; the
 * key lives only in the environment.
 *
 * Serialized form: base64(iv).base64(authTag).base64(ciphertext)
 */
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce recommended for GCM

const key = Buffer.from(env.ENCRYPTION_KEY, 'base64');

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    '.',
  );
}

export function decrypt(serialized: string): string {
  const [ivPart, tagPart, dataPart] = serialized.split('.');
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Malformed ciphertext');
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
