import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

let client: Redis | null = null;
let initialized = false;

/**
 * Returns a lazily-created Redis client, or `null` when `REDIS_URL` is not
 * configured (the default). The client is resilient: connection failures are
 * logged but never throw here, so callers can treat Redis as best-effort. The
 * singleton is created once per process.
 */
export function getRedisClient(): Redis | null {
  if (initialized) {
    return client;
  }
  initialized = true;

  if (!env.REDIS_URL) {
    return null;
  }

  client = new Redis(env.REDIS_URL, {
    // Don't queue commands while offline — a fail-open caller would rather get a
    // fast error than have requests hang until Redis returns.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    // Keep trying to reconnect in the background with a capped backoff.
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

  client.on('error', (err) => {
    logger.warn({ err }, 'Redis connection error');
  });
  client.on('connect', () => {
    logger.info('Connected to Redis');
  });

  return client;
}

/** Closes the Redis connection if one was opened. Used for graceful shutdown. */
export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
    initialized = false;
  }
}
