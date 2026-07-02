import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { isTest } from '../config/env';
import { createRateLimitStore } from './rateLimitStore';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function buildLimiter(options: {
  windowMs: number;
  max: number;
  prefix: string;
}): RateLimitRequestHandler {
  // When Redis is configured, limits are shared across instances; otherwise the
  // limiter falls back to its default in-process memory store (store: undefined).
  const store = createRateLimitStore(options.prefix);
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    ...(store ? { store } : {}),
    // Bypass limiting under test to keep the suite deterministic.
    skip: () => isTest,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later' },
    },
  });
}

/** Generous limiter for general API traffic. */
export const apiRateLimiter = buildLimiter({ windowMs: FIFTEEN_MINUTES, max: 300, prefix: 'rl:api:' });

/** Strict limiter for sensitive auth endpoints (login, register, refresh). */
export const authRateLimiter = buildLimiter({ windowMs: FIFTEEN_MINUTES, max: 20, prefix: 'rl:auth:' });
