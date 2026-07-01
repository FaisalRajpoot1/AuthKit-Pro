import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { testUser } from './helpers';

const app = createApp();

async function registerAndToken(): Promise<string> {
  const res = await request(app).post('/api/v1/auth/register').send(testUser());
  return res.body.accessToken as string;
}

async function createKey(token: string, scopes: string[]): Promise<{ id: string; secret: string }> {
  const res = await request(app)
    .post('/api/v1/account/api-keys')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'CI key', scopes });
  expect(res.status).toBe(201);
  return { id: res.body.apiKey.id as string, secret: res.body.secret as string };
}

describe('API keys (integration)', () => {
  it('creates a key, returns the secret once, and lists it without the secret', async () => {
    const token = await registerAndToken();
    const { secret } = await createKey(token, ['profile:read']);
    expect(secret.startsWith('ak_')).toBe(true);

    const list = await request(app)
      .get('/api/v1/account/api-keys')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.apiKeys).toHaveLength(1);
    expect(list.body.apiKeys[0]).not.toHaveProperty('secret');
    expect(list.body.apiKeys[0].scopes).toEqual(['profile:read']);
  });

  it('authenticates the programmatic API with the key and enforces scopes', async () => {
    const token = await registerAndToken();
    const { secret } = await createKey(token, ['profile:read']);

    // In-scope: profile:read → 200
    const profile = await request(app).get('/api/v1/programmatic/profile').set('X-API-Key', secret);
    expect(profile.status).toBe(200);
    expect(profile.body.user.email).toBe(testUser().email);

    // Out-of-scope: sessions:read not granted → 403
    const sessions = await request(app).get('/api/v1/programmatic/sessions').set('X-API-Key', secret);
    expect(sessions.status).toBe(403);
  });

  it('rejects a revoked key', async () => {
    const token = await registerAndToken();
    const { id, secret } = await createKey(token, ['profile:read']);

    const revoke = await request(app)
      .delete(`/api/v1/account/api-keys/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(revoke.status).toBe(204);

    const after = await request(app).get('/api/v1/programmatic/profile').set('X-API-Key', secret);
    expect(after.status).toBe(401);
  });

  it('rejects a bogus key and an unknown scope', async () => {
    const token = await registerAndToken();

    const bogus = await request(app).get('/api/v1/programmatic/profile').set('X-API-Key', 'ak_nope');
    expect(bogus.status).toBe(401);

    const badScope = await request(app)
      .post('/api/v1/account/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'bad', scopes: ['everything:destroy'] });
    expect(badScope.status).toBe(400);
  });
});
