import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';

const app = createApp();

describe('passkey management guards', () => {
  it('rejects listing passkeys without auth (401)', async () => {
    const res = await request(app).get('/api/v1/account/passkeys');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects registration options without auth (401)', async () => {
    const res = await request(app).post('/api/v1/account/passkeys/registration/options');
    expect(res.status).toBe(401);
  });
});

describe('passkey authentication', () => {
  it('returns authentication options (challenge) without an email', async () => {
    const res = await request(app).post('/api/v1/auth/passkeys/authentication/options').send({});
    expect(res.status).toBe(200);
    expect(typeof res.body.challenge).toBe('string');
    expect(res.body.rpId).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects verify without a challenge cookie (401)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/passkeys/authentication/verify')
      .send({ response: { id: 'abc' } });
    expect(res.status).toBe(401);
  });
});
