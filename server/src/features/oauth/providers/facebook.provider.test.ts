import { afterEach, describe, expect, it, vi } from 'vitest';
import { facebookProvider } from './facebook.provider';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Queues sequential fetch responses so a multi-call exchange can be simulated. */
function stubFetch(responses: Response[]): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  responses.forEach((res) => fn.mockResolvedValueOnce(res));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('facebookProvider', () => {
  it('builds an authorization URL with the email scope and state', () => {
    const url = facebookProvider.getAuthorizationUrl({
      state: 'abc',
      redirectUri: 'https://app/cb',
    });
    expect(url).toContain('facebook.com');
    expect(url).toContain('scope=email+public_profile');
    expect(url).toContain('state=abc');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fapp%2Fcb');
  });

  it('exchanges a code and normalizes the profile', async () => {
    stubFetch([
      json({ access_token: 'tok' }),
      json({
        id: '123',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        picture: { data: { url: 'https://cdn/ada.png' } },
      }),
    ]);

    const profile = await facebookProvider.exchangeCode({ code: 'c', redirectUri: 'https://app/cb' });
    expect(profile).toEqual({
      providerAccountId: '123',
      email: 'ada@example.com',
      emailVerified: true,
      displayName: 'Ada Lovelace',
      avatarUrl: 'https://cdn/ada.png',
    });
  });

  it('treats a missing email as unverified and null', async () => {
    stubFetch([json({ access_token: 'tok' }), json({ id: '9', name: 'No Email' })]);
    const profile = await facebookProvider.exchangeCode({ code: 'c', redirectUri: 'https://app/cb' });
    expect(profile.email).toBeNull();
    expect(profile.emailVerified).toBe(false);
    expect(profile.avatarUrl).toBeNull();
  });

  it('throws when the token exchange fails', async () => {
    stubFetch([new Response('', { status: 400 })]);
    await expect(
      facebookProvider.exchangeCode({ code: 'c', redirectUri: 'https://app/cb' }),
    ).rejects.toThrow(/token exchange failed/i);
  });
});
