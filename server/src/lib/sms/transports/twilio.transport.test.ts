import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwilioSmsTransport } from './twilio.transport';

afterEach(() => vi.unstubAllGlobals());

describe('TwilioSmsTransport', () => {
  it('posts To/From/Body with HTTP Basic auth to the account Messages endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const transport = new TwilioSmsTransport('ACsid', 'token', '+15550001111');
    await transport.send({ to: '+14155552671', body: 'code 123456' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/ACsid/Messages.json');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('ACsid:token').toString('base64')}`,
    );
    const body = String(init.body);
    expect(body).toContain('To=%2B14155552671');
    expect(body).toContain('From=%2B15550001111');
    expect(body).toContain('Body=code+123456');
  });

  it('throws when Twilio responds with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    const transport = new TwilioSmsTransport('ACsid', 'token', '+15550001111');
    await expect(transport.send({ to: '+1', body: 'x' })).rejects.toThrow(/status 401/);
  });
});
