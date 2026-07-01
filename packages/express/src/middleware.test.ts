import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { AuthError } from './errors';
import { createAuthMiddleware, getAuth } from './middleware';

const SECRET = 'test-secret-at-least-32-chars-long-xxxxx';

function makeToken(overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    { sub: 'u1', email: 'a@b.com', sid: 's1', ...overrides },
    SECRET,
    { issuer: 'authkit', audience: 'authkit-client', expiresIn: '5m' },
  );
}

function reqWith(authorization?: string): Request {
  return { headers: authorization ? { authorization } : {} } as unknown as Request;
}

const res = {} as Response;
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const mw = createAuthMiddleware({
  accessSecret: SECRET,
  resolveAuthz: () => ({ roles: ['customer'], permissions: ['users:read'] }),
});

describe('authenticate', () => {
  it('attaches the principal for a valid token', () => {
    const req = reqWith(`Bearer ${makeToken()}`);
    const next = vi.fn();

    mw.authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(getAuth(req)).toEqual({ userId: 'u1', email: 'a@b.com', sessionId: 's1' });
  });

  it('rejects a missing Authorization header (401)', () => {
    const req = reqWith();
    const next = vi.fn();

    mw.authenticate(req, res, next);

    const err = next.mock.calls[0]?.[0] as AuthError;
    expect(err).toBeInstanceOf(AuthError);
    expect(err.statusCode).toBe(401);
  });

  it('rejects a tampered token (401)', () => {
    const req = reqWith(`Bearer ${makeToken()}x`);
    const next = vi.fn();

    mw.authenticate(req, res, next);

    expect((next.mock.calls[0]?.[0] as AuthError).statusCode).toBe(401);
  });
});

describe('requirePermission / requireRole', () => {
  it('allows a held permission', async () => {
    const req = reqWith(`Bearer ${makeToken()}`);
    mw.authenticate(req, res, vi.fn());

    const next = vi.fn();
    mw.requirePermission('users:read')(req, res, next);
    await flush();

    expect(next).toHaveBeenCalledWith();
  });

  it('denies a missing permission (403)', async () => {
    const req = reqWith(`Bearer ${makeToken()}`);
    mw.authenticate(req, res, vi.fn());

    const next = vi.fn();
    mw.requirePermission('roles:manage')(req, res, next);
    await flush();

    expect((next.mock.calls[0]?.[0] as AuthError).statusCode).toBe(403);
  });

  it('denies a missing role (403)', async () => {
    const req = reqWith(`Bearer ${makeToken()}`);
    mw.authenticate(req, res, vi.fn());

    const next = vi.fn();
    mw.requireRole('admin')(req, res, next);
    await flush();

    expect((next.mock.calls[0]?.[0] as AuthError).statusCode).toBe(403);
  });
});

describe('config errors', () => {
  it('errors when no authz resolver is configured', async () => {
    const bare = createAuthMiddleware({ accessSecret: SECRET });
    const req = reqWith(`Bearer ${makeToken()}`);
    bare.authenticate(req, res, vi.fn());

    const next = vi.fn();
    bare.requirePermission('users:read')(req, res, next);
    await flush();

    expect((next.mock.calls[0]?.[0] as AuthError).statusCode).toBe(500);
  });
});
