import { authenticator } from 'otplib';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { emailService } from '../lib/email/email.service';
import { testUser } from './helpers';

const app = createApp();

beforeEach(async () => {
  await request(app).post('/api/v1/auth/register').send(testUser());
});

describe('passwordless — magic link (integration)', () => {
  it('emails a link and logs in when it is verified', async () => {
    const spy = vi.spyOn(emailService, 'sendMagicLinkEmail').mockResolvedValue();

    const req = await request(app)
      .post('/api/v1/auth/passwordless/magic-link/request')
      .send({ email: testUser().email });
    expect(req.status).toBe(202);
    const token = spy.mock.calls[0]?.[1] as string;
    spy.mockRestore();
    expect(token).toBeTruthy();

    const verify = await request(app)
      .post('/api/v1/auth/passwordless/magic-link/verify')
      .send({ token });
    expect(verify.status).toBe(200);
    expect(verify.body.accessToken).toBeTruthy();
  });

  it('rejects an invalid or reused link', async () => {
    const spy = vi.spyOn(emailService, 'sendMagicLinkEmail').mockResolvedValue();
    await request(app)
      .post('/api/v1/auth/passwordless/magic-link/request')
      .send({ email: testUser().email });
    const token = spy.mock.calls[0]?.[1] as string;
    spy.mockRestore();

    await request(app).post('/api/v1/auth/passwordless/magic-link/verify').send({ token });
    const reuse = await request(app)
      .post('/api/v1/auth/passwordless/magic-link/verify')
      .send({ token });
    expect(reuse.status).toBe(400);

    const bogus = await request(app)
      .post('/api/v1/auth/passwordless/magic-link/verify')
      .send({ token: 'not-a-token' });
    expect(bogus.status).toBe(400);
  });

  it('does not reveal whether the email exists', async () => {
    const res = await request(app)
      .post('/api/v1/auth/passwordless/magic-link/request')
      .send({ email: 'stranger@nowhere.dev' });
    expect(res.status).toBe(202);
  });
});

describe('passwordless — email OTP (integration)', () => {
  it('emails a code and logs in when it is verified', async () => {
    const spy = vi.spyOn(emailService, 'sendLoginOtpEmail').mockResolvedValue();
    await request(app).post('/api/v1/auth/passwordless/otp/request').send({ email: testUser().email });
    const code = spy.mock.calls[0]?.[1] as string;
    spy.mockRestore();
    expect(code).toMatch(/^\d{6}$/);

    const wrong = await request(app)
      .post('/api/v1/auth/passwordless/otp/verify')
      .send({ email: testUser().email, code: code === '000000' ? '111111' : '000000' });
    expect(wrong.status).toBe(400);

    const verify = await request(app)
      .post('/api/v1/auth/passwordless/otp/verify')
      .send({ email: testUser().email, code });
    expect(verify.status).toBe(200);
    expect(verify.body.accessToken).toBeTruthy();
  });
});

describe('passwordless — enforces 2FA (integration)', () => {
  it('returns a 2FA challenge instead of tokens when 2FA is enabled', async () => {
    // Enable 2FA for the registered user.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser().email, password: testUser().password });
    const token = login.body.accessToken as string;
    const setup = await request(app)
      .post('/api/v1/account/2fa/setup')
      .set('Authorization', `Bearer ${token}`);
    await request(app)
      .post('/api/v1/account/2fa/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: authenticator.generate(setup.body.secret) });

    // Magic-link verify now yields a challenge, not a session.
    const spy = vi.spyOn(emailService, 'sendMagicLinkEmail').mockResolvedValue();
    await request(app)
      .post('/api/v1/auth/passwordless/magic-link/request')
      .send({ email: testUser().email });
    const magicToken = spy.mock.calls[0]?.[1] as string;
    spy.mockRestore();

    const verify = await request(app)
      .post('/api/v1/auth/passwordless/magic-link/verify')
      .send({ token: magicToken });
    expect(verify.status).toBe(200);
    expect(verify.body.twoFactorRequired).toBe(true);
    expect(verify.body.accessToken).toBeUndefined();
  });
});
