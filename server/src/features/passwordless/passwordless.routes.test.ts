import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';

/** Validation guards that resolve before any DB access. */
const app = createApp();

describe('passwordless guards', () => {
  it('rejects a magic-link request with an invalid email (400)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/passwordless/magic-link/request')
      .send({ email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a magic-link verify with no token (400)', async () => {
    const res = await request(app).post('/api/v1/auth/passwordless/magic-link/verify').send({});
    expect(res.status).toBe(400);
  });

  it('rejects an OTP verify with a malformed code (400)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/passwordless/otp/verify')
      .send({ email: 'a@b.com', code: '12' });
    expect(res.status).toBe(400);
  });
});
