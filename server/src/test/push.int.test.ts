import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { testUser } from './helpers';

const app = createApp();

async function token(): Promise<string> {
  const res = await request(app).post('/api/v1/auth/register').send(testUser());
  return res.body.accessToken as string;
}

const SUBSCRIPTION = {
  endpoint: 'https://push.example.com/sub-abc',
  keys: { p256dh: 'BPublicKeyBase64', auth: 'AuthSecret' },
};

describe('web push (integration)', () => {
  it('reports push disabled when VAPID is not configured', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/push/public-key')
      .set('Authorization', `Bearer ${await token()}`);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.publicKey).toBeNull();
  });

  it('subscribes and unsubscribes a device', async () => {
    const bearer = `Bearer ${await token()}`;

    const sub = await request(app)
      .post('/api/v1/notifications/push/subscribe')
      .set('Authorization', bearer)
      .send(SUBSCRIPTION);
    expect(sub.status).toBe(201);
    expect(await prisma.pushSubscription.count({ where: { endpoint: SUBSCRIPTION.endpoint } })).toBe(1);

    // Re-subscribing the same endpoint upserts (no duplicate).
    await request(app)
      .post('/api/v1/notifications/push/subscribe')
      .set('Authorization', bearer)
      .send(SUBSCRIPTION);
    expect(await prisma.pushSubscription.count({ where: { endpoint: SUBSCRIPTION.endpoint } })).toBe(1);

    const unsub = await request(app)
      .post('/api/v1/notifications/push/unsubscribe')
      .set('Authorization', bearer)
      .send({ endpoint: SUBSCRIPTION.endpoint });
    expect(unsub.status).toBe(200);
    expect(await prisma.pushSubscription.count({ where: { endpoint: SUBSCRIPTION.endpoint } })).toBe(0);
  });

  it('rejects a malformed subscription (400)', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/push/subscribe')
      .set('Authorization', `Bearer ${await token()}`)
      .send({ endpoint: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  it('requires auth', async () => {
    const res = await request(app).post('/api/v1/notifications/push/subscribe').send(SUBSCRIPTION);
    expect(res.status).toBe(401);
  });
});
