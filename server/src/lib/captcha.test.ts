import { describe, expect, it, vi } from 'vitest';
import { verifyCaptchaToken } from './captcha';

const opts = { provider: 'turnstile' as const, secret: 'test-secret' };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('verifyCaptchaToken', () => {
  it('returns true when the provider reports success', async () => {
    const fetchMock = vi.fn(async () => json(200, { success: true })) as unknown as typeof fetch;
    expect(await verifyCaptchaToken('tok', opts, fetchMock)).toBe(true);
  });

  it('returns false when the provider reports failure', async () => {
    const fetchMock = vi.fn(async () => json(200, { success: false })) as unknown as typeof fetch;
    expect(await verifyCaptchaToken('tok', opts, fetchMock)).toBe(false);
  });

  it('posts the secret and token to the provider', async () => {
    const fetchMock = vi.fn(async () => json(200, { success: true })) as unknown as typeof fetch;
    await verifyCaptchaToken('the-token', { ...opts, remoteIp: '1.2.3.4' }, fetchMock);

    const call = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(call?.[0]).toContain('challenges.cloudflare.com');
    const body = String(call?.[1]?.body);
    expect(body).toContain('secret=test-secret');
    expect(body).toContain('response=the-token');
    expect(body).toContain('remoteip=1.2.3.4');
  });

  it('fails open on a provider error (non-OK)', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 502 })) as unknown as typeof fetch;
    expect(await verifyCaptchaToken('tok', opts, fetchMock)).toBe(true);
  });

  it('fails open on a network error', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    expect(await verifyCaptchaToken('tok', opts, fetchMock)).toBe(true);
  });
});
