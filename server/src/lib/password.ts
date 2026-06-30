import argon2 from 'argon2';

/**
 * Password hashing using Argon2id — the OWASP-recommended algorithm, resistant
 * to both GPU and side-channel attacks. Parameters follow OWASP minimums.
 */
const HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, HASH_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // A malformed hash should never authenticate a user.
    return false;
  }
}
