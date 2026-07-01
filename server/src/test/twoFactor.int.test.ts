import { authenticator } from 'otplib';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { emailService } from '../lib/email/email.service';
import { testUser } from './helpers';

const app = createApp();

/** Registers a user and returns a bearer access token. */
async function registerAndToken(): Promise<string> {
  const res = await request(app).post('/api/v1/auth/register').send(testUser());
  return res.body.accessToken as string;
}

/** Enables TOTP 2FA for the token's user; returns the secret and backup codes. */
async function enableTwoFactor(
  token: string,
): Promise<{ secret: string; backupCodes: string[] }> {
  const setup = await request(app)
    .post('/api/v1/account/2fa/setup')
    .set('Authorization', `Bearer ${token}`);
  const secret = setup.body.secret as string;

  const enable = await request(app)
    .post('/api/v1/account/2fa/enable')
    .set('Authorization', `Bearer ${token}`)
    .send({ code: authenticator.generate(secret) });
  expect(enable.status).toBe(200);

  return { secret, backupCodes: enable.body.backupCodes as string[] };
}

describe('two-factor authentication (integration)', () => {
  let token: string;
  let secret: string;
  let backupCodes: string[];

  beforeEach(async () => {
    token = await registerAndToken();
    ({ secret, backupCodes } = await enableTwoFactor(token));
  });

  it('reports enabled status with backup codes remaining', async () => {
    const status = await request(app)
      .get('/api/v1/account/2fa')
      .set('Authorization', `Bearer ${token}`);
    expect(status.body).toMatchObject({ enabled: true });
    expect(status.body.backupCodesRemaining).toBeGreaterThan(0);
    expect(backupCodes.length).toBeGreaterThan(0);
  });

  it('requires a second factor at login and completes with a TOTP code', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser().email, password: testUser().password });
    expect(login.status).toBe(200);
    expect(login.body.twoFactorRequired).toBe(true);
    expect(login.body.accessToken).toBeUndefined();

    const completed = await request(app)
      .post('/api/v1/auth/2fa/login')
      .send({ challengeToken: login.body.challengeToken, code: authenticator.generate(secret) });
    expect(completed.status).toBe(200);
    expect(completed.body.accessToken).toBeTruthy();
  });

  it('completes login with a one-time backup code (and burns it)', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser().email, password: testUser().password });

    const code = backupCodes[0]!;
    const first = await request(app)
      .post('/api/v1/auth/2fa/login')
      .send({ challengeToken: login.body.challengeToken, code });
    expect(first.status).toBe(200);

    // The same backup code cannot be reused.
    const login2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser().email, password: testUser().password });
    const reuse = await request(app)
      .post('/api/v1/auth/2fa/login')
      .send({ challengeToken: login2.body.challengeToken, code });
    expect(reuse.status).toBe(401);
  });

  it('rejects an invalid second factor', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser().email, password: testUser().password });
    const bad = await request(app)
      .post('/api/v1/auth/2fa/login')
      .send({ challengeToken: login.body.challengeToken, code: '000000' });
    expect(bad.status).toBe(401);
  });

  it('completes login with an emailed 2FA code', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser().email, password: testUser().password });
    expect(login.body.twoFactorRequired).toBe(true);

    const spy = vi.spyOn(emailService, 'sendLoginOtpEmail').mockResolvedValue();
    const req = await request(app)
      .post('/api/v1/auth/2fa/email-otp/request')
      .send({ challengeToken: login.body.challengeToken });
    expect(req.status).toBe(202);
    const code = spy.mock.calls[0]?.[1] as string;
    spy.mockRestore();
    expect(code).toMatch(/^\d{6}$/);

    const completed = await request(app)
      .post('/api/v1/auth/2fa/login')
      .send({ challengeToken: login.body.challengeToken, code });
    expect(completed.status).toBe(200);
    expect(completed.body.accessToken).toBeTruthy();
  });
});
