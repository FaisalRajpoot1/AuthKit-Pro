import { createHash } from 'node:crypto';
import { env } from '../config/env';
import { ValidationError } from '../utils/errors';
import { logger } from './logger';

/**
 * Checks a password against the Have I Been Pwned "Pwned Passwords" range API
 * using k-anonymity: only the first 5 characters of the SHA-1 hash are sent, so
 * the plaintext password never leaves the server. The `Add-Padding` header hides
 * the true result size.
 *
 * Fails open (returns false) on any network/service error so an outage can never
 * lock users out of registration or password changes.
 */
const RANGE_URL = 'https://api.pwnedpasswords.com/range/';

export async function isPasswordPwned(
  password: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<boolean> {
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const response = await fetchImpl(`${RANGE_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!response.ok) return false;

    const body = await response.text();
    for (const line of body.split('\n')) {
      const [hashSuffix, countStr] = line.split(':');
      // Padding entries have a count of 0 and must not count as a match.
      if (hashSuffix?.trim().toUpperCase() === suffix && Number(countStr) > 0) {
        return true;
      }
    }
    return false;
  } catch (error) {
    logger.warn({ err: error }, 'Pwned Passwords check unavailable — allowing password');
    return false;
  }
}

/** Throws a ValidationError if the password is breached (when the check is on). */
export async function assertPasswordNotPwned(password: string): Promise<void> {
  if (!env.HIBP_ENABLED) return;
  if (await isPasswordPwned(password)) {
    throw new ValidationError(
      'This password has appeared in a known data breach. Please choose a different password.',
    );
  }
}
