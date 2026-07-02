import { describe, expect, it } from 'vitest';
import { getRedisClient } from './redis';

describe('getRedisClient', () => {
  it('returns null when REDIS_URL is not configured', () => {
    // The test env intentionally leaves REDIS_URL unset.
    expect(getRedisClient()).toBeNull();
  });

  it('is memoized (same result on repeated calls)', () => {
    expect(getRedisClient()).toBe(getRedisClient());
  });
});
