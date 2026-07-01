import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { getSetCookie, REFRESH_COOKIE, testUser } from './helpers';

const app = createApp();

describe('auth flow (integration)', () => {
  it('registers, assigns the default role, and returns the profile', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(testUser());
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(testUser().email);
    expect(me.body.roles).toEqual(['customer']);
  });

  it('logs in with email or username', async () => {
    await request(app).post('/api/v1/auth/register').send(testUser());

    const byEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser().email, password: testUser().password });
    expect(byEmail.status).toBe(200);

    const byUsername = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser().username, password: testUser().password });
    expect(byUsername.status).toBe(200);
  });

  it('rejects a wrong password with 401', async () => {
    await request(app).post('/api/v1/auth/register').send(testUser());
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser().email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rotates the refresh token and detects reuse', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send(testUser());
    const original = getSetCookie(registered, REFRESH_COOKIE);
    expect(original).toBeTruthy();

    // First refresh rotates successfully and issues a new cookie.
    const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', original!);
    expect(rotated.status).toBe(200);
    expect(rotated.body.accessToken).toBeTruthy();
    const next = getSetCookie(rotated, REFRESH_COOKIE);
    expect(next).toBeTruthy();
    expect(next).not.toBe(original);

    // Reusing the ORIGINAL (now-rotated) token is rejected...
    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', original!);
    expect(reuse.status).toBe(401);

    // ...and the reuse burns the whole session, so the successor also fails.
    const successor = await request(app).post('/api/v1/auth/refresh').set('Cookie', next!);
    expect(successor.status).toBe(401);
  });

  it('logs out and invalidates both the refresh token and the access token', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send(testUser());
    const cookie = getSetCookie(registered, REFRESH_COOKIE)!;
    const accessToken = registered.body.accessToken as string;

    // Access token works before logout.
    const before = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(before.status).toBe(200);

    const loggedOut = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(loggedOut.status).toBe(204);

    // Refresh cookie is now invalid...
    const afterLogout = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(afterLogout.status).toBe(401);

    // ...and the still-unexpired access token is rejected because its session
    // was revoked (no waiting out the token TTL).
    const meAfter = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meAfter.status).toBe(401);
  });

  it('prevents duplicate email/username registration (409)', async () => {
    await request(app).post('/api/v1/auth/register').send(testUser());
    const dup = await request(app).post('/api/v1/auth/register').send(testUser());
    expect(dup.status).toBe(409);
  });
});
