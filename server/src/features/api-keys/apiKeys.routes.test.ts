import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';

/** Guard tests that resolve before any DB access. */
const app = createApp();

describe('api-key management guards', () => {
  it('rejects listing keys without auth (401)', async () => {
    const res = await request(app).get('/api/v1/account/api-keys');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects creating a key without auth (401)', async () => {
    const res = await request(app).post('/api/v1/account/api-keys').send({ name: 'x', scopes: ['profile:read'] });
    expect(res.status).toBe(401);
  });
});

describe('programmatic api-key auth guards', () => {
  it('rejects /programmatic/profile without an X-API-Key header (401)', async () => {
    const res = await request(app).get('/api/v1/programmatic/profile');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects /programmatic/sessions without an X-API-Key header (401)', async () => {
    const res = await request(app).get('/api/v1/programmatic/sessions');
    expect(res.status).toBe(401);
  });
});
