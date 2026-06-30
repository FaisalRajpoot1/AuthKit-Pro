import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';

/** Guard/validation tests for 2FA endpoints (resolve before DB access). */
const app = createApp();

describe('2FA management guards', () => {
  it('rejects 2FA status without auth (401)', async () => {
    const res = await request(app).get('/api/v1/account/2fa');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects 2FA setup without auth (401)', async () => {
    const res = await request(app).post('/api/v1/account/2fa/setup');
    expect(res.status).toBe(401);
  });

  it('rejects enable without auth (401)', async () => {
    const res = await request(app).post('/api/v1/account/2fa/enable').send({ code: '123456' });
    expect(res.status).toBe(401);
  });
});

describe('2FA login completion', () => {
  it('rejects with a missing code (400)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/2fa/login')
      .send({ challengeToken: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid challenge token (401)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/2fa/login')
      .send({ challengeToken: 'not-a-real-token', code: '123456' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
