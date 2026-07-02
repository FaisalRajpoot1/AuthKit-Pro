import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { logger } from '../lib/logger';
import { getRedisClient } from '../lib/redis';

/**
 * Wraps a store (here, Redis) so that store failures never break the API. If a
 * command throws — e.g. Redis is briefly unreachable — the request is allowed
 * through rather than erroring, trading strict enforcement for availability
 * during an outage. Rate limiting resumes automatically once the store recovers.
 */
class FailOpenStore implements Store {
  private windowMs = 60_000;

  constructor(private readonly inner: Store) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.inner.init?.(options);
  }

  /** A permissive result: counts as a first hit, so it never trips the limit. */
  private allow(): ClientRateLimitInfo {
    return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    try {
      return await this.inner.increment(key);
    } catch (err) {
      logger.warn({ err }, 'Rate-limit store increment failed; allowing request (fail-open)');
      return this.allow();
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await this.inner.decrement(key);
    } catch {
      // Best-effort; a lost decrement only makes limiting slightly stricter.
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await this.inner.resetKey(key);
    } catch {
      // Best-effort.
    }
  }
}

/**
 * Builds the store express-rate-limit should use. Returns `undefined` when Redis
 * is not configured, so the limiter keeps its default in-process memory store.
 */
export function createRateLimitStore(prefix: string): Store | undefined {
  const client = getRedisClient();
  if (!client) {
    return undefined;
  }
  const redisStore = new RedisStore({
    // ioredis exposes `call` for arbitrary commands, which is what RedisStore wants.
    sendCommand: (command: string, ...args: string[]) =>
      client.call(command, ...args) as Promise<never>,
    prefix,
  });
  return new FailOpenStore(redisStore);
}

export { FailOpenStore };
