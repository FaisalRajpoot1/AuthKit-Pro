import { authenticator } from 'otplib';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { smsService } from '../lib/sms/sms.service';
import { testUser } from './helpers';

const app = createApp();
const PHONE = '+14155552671';

async function registerAndToken(): Promise<string> {
  const res = await request(app).post('/api/v1/auth/register').send(testUser());
  return res.body.accessToken as string;
}

async function enableTotp(token: string): Promise<string> {
  const setup = await request(app)
    .post('/api/v1/account/2fa/setup')
    .set('Authorization', `Bearer ${token}`);
  const secret = setup.body.secret as string;
  await request(app)
    .post('/api/v1/account/2fa/enable')
    .set('Authorization', `Bearer ${token}`)
    .send({ code: authenticator.generate(secret) });
  return secret;
}

/** Registers + verifies a phone for SMS 2FA; returns the bearer token. */
async function setupVerifiedPhone(token: string): Promise<void> {
  const setupSpy = vi.spyOn(smsService, 'sendPhoneVerification').mockResolvedValue();
  const setup = await request(app)
    .post('/api/v1/account/2fa/sms/setup')
    .set('Authorization', `Bearer ${token}`)
    .send({ phoneNumber: PHONE });
  expect(setup.status).toBe(202);
  const code = setupSpy.mock.calls[0]?.[1] as string;
  setupSpy.mockRestore();

  const verify = await request(app)
    .post('/api/v1/account/2fa/sms/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ code });
  expect(verify.status).toBe(200);
}

describe('SMS two-factor (integration)', () => {
  let token: string;

  beforeEach(async () => {
    token = await registerAndToken();
    await enableTotp(token);
  });

  it('registers and verifies a phone, reflected in status', async () => {
    await setupVerifiedPhone(token);
    const status = await request(app)
      .get('/api/v1/account/2fa')
      .set('Authorization', `Bearer ${token}`);
    expect(status.body.sms.enabled).toBe(true);
    expect(status.body.sms.phone).toMatch(/71$/); // masked, last two digits
  });

  it('rejects a bad phone-verification code', async () => {
    vi.spyOn(smsService, 'sendPhoneVerification').mockResolvedValue();
    await request(app)
      .post('/api/v1/account/2fa/sms/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: PHONE });
    vi.restoreAllMocks();

    const verify = await request(app)
      .post('/api/v1/account/2fa/sms/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' });
    expect(verify.status).toBe(401);
  });

  it('completes login with an SMS 2FA code', async () => {
    await setupVerifiedPhone(token);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser().email, password: testUser().password });
    expect(login.body.twoFactorRequired).toBe(true);

    const otpSpy = vi.spyOn(smsService, 'sendLoginOtp').mockResolvedValue();
    const reqOtp = await request(app)
      .post('/api/v1/auth/2fa/sms-otp/request')
      .send({ challengeToken: login.body.challengeToken });
    expect(reqOtp.status).toBe(202);
    const code = otpSpy.mock.calls[0]?.[1] as string;
    otpSpy.mockRestore();
    expect(code).toMatch(/^\d{6}$/);

    const completed = await request(app)
      .post('/api/v1/auth/2fa/login')
      .send({ challengeToken: login.body.challengeToken, code });
    expect(completed.status).toBe(200);
    expect(completed.body.accessToken).toBeTruthy();
  });

  it('will not send an SMS code without a verified phone', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser().email, password: testUser().password });

    const reqOtp = await request(app)
      .post('/api/v1/auth/2fa/sms-otp/request')
      .send({ challengeToken: login.body.challengeToken });
    expect(reqOtp.status).toBe(409);
  });

  it('removes the SMS factor', async () => {
    await setupVerifiedPhone(token);
    const removed = await request(app)
      .delete('/api/v1/account/2fa/sms')
      .set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(200);

    const status = await request(app)
      .get('/api/v1/account/2fa')
      .set('Authorization', `Bearer ${token}`);
    expect(status.body.sms.enabled).toBe(false);
    expect(status.body.sms.phone).toBeNull();
  });
});
