import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { emailService } from '../lib/email/email.service';
import { testUser } from './helpers';

const app = createApp();

async function loginFrom(device: string, ip: string): Promise<number> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('User-Agent', device)
    .set('X-Forwarded-For', ip)
    .send({ identifier: testUser().email, password: testUser().password });
  return res.status;
}

describe('suspicious login alerts (integration)', () => {
  it('emails an alert when a login comes from a new device and IP', async () => {
    await request(app).post('/api/v1/auth/register').send(testUser());
    const spy = vi.spyOn(emailService, 'sendSuspiciousLoginEmail').mockResolvedValue();

    // First login establishes a baseline device/IP — no alert.
    expect(await loginFrom('Device-A', '9.9.9.1')).toBe(200);
    expect(spy).not.toHaveBeenCalled();

    // A login from a different device AND IP is flagged.
    expect(await loginFrom('Device-B', '9.9.9.2')).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBe(testUser().email);

    spy.mockRestore();
  });

  it('does not alert for a login from a previously-seen device', async () => {
    await request(app).post('/api/v1/auth/register').send(testUser());
    const spy = vi.spyOn(emailService, 'sendSuspiciousLoginEmail').mockResolvedValue();

    expect(await loginFrom('Device-A', '9.9.9.1')).toBe(200);
    expect(await loginFrom('Device-A', '9.9.9.1')).toBe(200);
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });
});
