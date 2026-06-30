import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';

/**
 * Guard-level tests for Phase 2 flows. They assert validation and auth happen
 * before any database access, so they run without a database.
 */
const app = createApp();

describe('password reset guards', () => {
  it('rejects forgot-password with an invalid email (400)', async () => {
    const res = await request(app).post('/api/v1/auth/password/forgot').send({ email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects reset-password with a weak password (400)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/password/reset')
      .send({ token: 'abc', password: 'weak' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('email verification guards', () => {
  it('rejects verify with an empty token (400)', async () => {
    const res = await request(app).post('/api/v1/auth/email/verify').send({ token: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects resend without authentication (401)', async () => {
    const res = await request(app).post('/api/v1/auth/email/resend');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('account guards', () => {
  it('rejects profile update without authentication (401)', async () => {
    const res = await request(app).patch('/api/v1/account/profile').send({ displayName: 'X' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects availability check with no query params (400)', async () => {
    const res = await request(app).get('/api/v1/account/availability');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
