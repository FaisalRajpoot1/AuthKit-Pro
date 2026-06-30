import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';

/** Guard/validation tests for OAuth endpoints (no provider creds in test env). */
const app = createApp();

describe('oauth routes', () => {
  it('404s for an unknown provider', async () => {
    const res = await request(app).get('/api/v1/auth/oauth/myspace/url');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('400s when the provider is not configured', async () => {
    const res = await request(app).get('/api/v1/auth/oauth/google/url');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects listing linked accounts without auth (401)', async () => {
    const res = await request(app).get('/api/v1/auth/oauth/accounts');
    expect(res.status).toBe(401);
  });

  it('rejects unlink without auth (401)', async () => {
    const res = await request(app).delete('/api/v1/auth/oauth/google');
    expect(res.status).toBe(401);
  });

  it('redirects to the frontend with an error when state is missing on callback', async () => {
    const res = await request(app).get('/api/v1/auth/oauth/google/callback?code=abc&state=xyz');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/oauth/callback');
    expect(res.headers.location).toContain('status=error');
  });
});
