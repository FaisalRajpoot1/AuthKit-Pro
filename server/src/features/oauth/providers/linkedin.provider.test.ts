import { afterEach, describe, expect, it, vi } from 'vitest';
import { linkedinProvider } from './linkedin.provider';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function stubFetch(responses: Response[]): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  responses.forEach((res) => fn.mockResolvedValueOnce(res));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('linkedinProvider', () => {
  it('builds an OIDC authorization URL', () => {
    const url = linkedinProvider.getAuthorizationUrl({ state: 'xyz', redirectUri: 'https://app/cb' });
    expect(url).toContain('linkedin.com/oauth/v2/authorization');
    expect(url).toContain('scope=openid+profile+email');
    expect(url).toContain('state=xyz');
  });

  it('exchanges a code and maps OIDC userinfo claims', async () => {
    stubFetch([
      json({ access_token: 'tok' }),
      json({
        sub: 'urn:li:person:42',
        name: 'Grace Hopper',
        email: 'grace@example.com',
        email_verified: true,
        picture: 'https://cdn/grace.png',
      }),
    ]);

    const profile = await linkedinProvider.exchangeCode({ code: 'c', redirectUri: 'https://app/cb' });
    expect(profile).toEqual({
      providerAccountId: 'urn:li:person:42',
      email: 'grace@example.com',
      emailVerified: true,
      displayName: 'Grace Hopper',
      avatarUrl: 'https://cdn/grace.png',
    });
  });

  it('accepts email_verified as the string "true"', async () => {
    stubFetch([
      json({ access_token: 'tok' }),
      json({ sub: 's', email: 'a@b.co', email_verified: 'true' }),
    ]);
    const profile = await linkedinProvider.exchangeCode({ code: 'c', redirectUri: 'https://app/cb' });
    expect(profile.emailVerified).toBe(true);
    expect(profile.displayName).toBeNull();
  });

  it('throws when userinfo fetch fails', async () => {
    stubFetch([json({ access_token: 'tok' }), new Response('', { status: 401 })]);
    await expect(
      linkedinProvider.exchangeCode({ code: 'c', redirectUri: 'https://app/cb' }),
    ).rejects.toThrow(/Failed to fetch LinkedIn profile/i);
  });
});
