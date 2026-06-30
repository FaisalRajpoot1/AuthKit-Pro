import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';

/**
 * Smoke-level integration tests that exercise the middleware pipeline without
 * touching the database. Validation, auth-guard, and 404 behavior all resolve
 * before any persistence layer is reached. Full DB-backed flow tests are added
 * once a test database is provisioned in CI.
 */
const app = createApp();

describe('health', () => {
  it('reports liveness', async () => {
    const res = await request(app).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('auth route guards', () => {
  it('rejects registration with an invalid body (400)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', username: 'ab', password: 'weak' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects /me without a bearer token (401)', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
