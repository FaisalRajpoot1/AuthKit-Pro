import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { describe, expect, it, vi } from 'vitest';
import { createRateLimitStore, FailOpenStore } from './rateLimitStore';

const options = { windowMs: 60_000 } as Options;

function fakeStore(overrides: Partial<Store>): Store {
  return {
    increment: vi.fn(async () => ({ totalHits: 5, resetTime: undefined }) as ClientRateLimitInfo),
    decrement: vi.fn(async () => undefined),
    resetKey: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('FailOpenStore', () => {
  it('delegates increment to the inner store when it succeeds', async () => {
    const inner = fakeStore({});
    const store = new FailOpenStore(inner);
    store.init(options);

    const result = await store.increment('k');
    expect(result.totalHits).toBe(5);
    expect(inner.increment).toHaveBeenCalledWith('k');
  });

  it('allows the request (totalHits=1) when the inner store throws', async () => {
    const inner = fakeStore({
      increment: vi.fn(async () => {
        throw new Error('redis down');
      }),
    });
    const store = new FailOpenStore(inner);
    store.init(options);

    const result = await store.increment('k');
    // A first hit never trips the limit — the request is allowed through.
    expect(result.totalHits).toBe(1);
    expect(result.resetTime).toBeInstanceOf(Date);
  });

  it('swallows errors from decrement and resetKey', async () => {
    const inner = fakeStore({
      decrement: vi.fn(async () => {
        throw new Error('boom');
      }),
      resetKey: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    const store = new FailOpenStore(inner);
    store.init(options);

    await expect(store.decrement('k')).resolves.toBeUndefined();
    await expect(store.resetKey('k')).resolves.toBeUndefined();
  });
});

describe('createRateLimitStore', () => {
  it('returns undefined when Redis is not configured (default memory store)', () => {
    // The test env sets no REDIS_URL, so no Redis client is created.
    expect(createRateLimitStore('rl:test:')).toBeUndefined();
  });
});
