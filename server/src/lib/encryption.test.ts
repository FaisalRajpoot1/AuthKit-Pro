import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './encryption';

describe('encryption (AES-256-GCM)', () => {
  it('round-trips a secret', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const plaintext = 'same-input';
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
  });

  it('rejects tampered ciphertext', () => {
    const serialized = encrypt('secret');
    const [iv, tag, data] = serialized.split('.');
    const tampered = [iv, tag, Buffer.from('different').toString('base64')].join('.');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('throws on malformed input', () => {
    expect(() => decrypt('not-valid')).toThrow('Malformed ciphertext');
  });
});
