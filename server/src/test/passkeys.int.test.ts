import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { testUser } from './helpers';

const app = createApp();

async function registerAndToken(): Promise<{ id: string; token: string }> {
  const res = await request(app).post('/api/v1/auth/register').send(testUser());
  return { id: res.body.user.id as string, token: res.body.accessToken as string };
}

describe('passkeys (integration)', () => {
  it('generates registration options and sets a challenge cookie', async () => {
    const { token } = await registerAndToken();
    const res = await request(app)
      .post('/api/v1/account/passkeys/registration/options')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.challenge).toBe('string');
    expect(res.body.user.name).toBe(testUser().email);
    expect(res.body.rp.id).toBe('localhost');
    expect(res.headers['set-cookie']?.[0]).toContain('authkit_webauthn');
  });

  it('lists and deletes a stored passkey', async () => {
    const { id, token } = await registerAndToken();

    // Insert a passkey directly (the browser ceremony can't run headless).
    const created = await prisma.passkey.create({
      data: {
        userId: id,
        credentialId: 'cred-int-1',
        publicKey: Buffer.from([1, 2, 3, 4]),
        counter: 0,
        transports: ['internal'],
        backedUp: true,
        deviceType: 'multiDevice',
        name: 'Test key',
      },
    });

    const list = await request(app)
      .get('/api/v1/account/passkeys')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.passkeys).toHaveLength(1);
    expect(list.body.passkeys[0].name).toBe('Test key');
    expect(list.body.passkeys[0]).not.toHaveProperty('publicKey');

    const del = await request(app)
      .delete(`/api/v1/account/passkeys/${created.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const after = await request(app)
      .get('/api/v1/account/passkeys')
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.passkeys).toHaveLength(0);
  });

  it('includes a user’s credentials in authentication options and rejects a forged assertion', async () => {
    const { id } = await registerAndToken();
    await prisma.passkey.create({
      data: {
        userId: id,
        credentialId: 'cred-int-2',
        publicKey: Buffer.from([9, 9, 9]),
        counter: 0,
        transports: ['internal'],
      },
    });

    const agent = request.agent(app);
    const options = await agent
      .post('/api/v1/auth/passkeys/authentication/options')
      .send({ email: testUser().email });
    expect(options.status).toBe(200);
    expect(options.body.allowCredentials?.some((c: { id: string }) => c.id === 'cred-int-2')).toBe(true);

    // A forged assertion for the known credential fails verification.
    const verify = await agent
      .post('/api/v1/auth/passkeys/authentication/verify')
      .send({ response: { id: 'cred-int-2', response: {}, type: 'public-key', clientExtensionResults: {} } });
    expect(verify.status).toBeGreaterThanOrEqual(400);
    expect(verify.body.accessToken).toBeUndefined();
  });
});
