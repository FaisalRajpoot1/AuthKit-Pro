import { afterEach, describe, expect, it, vi } from 'vitest';
import { twitterProvider } from './twitter.provider';

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

describe('twitterProvider', () => {
  it('declares PKCE support', () => {
    expect(twitterProvider.usesPkce).toBe(true);
  });

  it('puts the S256 code challenge in the authorization URL', () => {
    const url = twitterProvider.getAuthorizationUrl({
      state: 's',
      redirectUri: 'https://app/cb',
      codeChallenge: 'CHALLENGE',
    });
    expect(url).toContain('code_challenge=CHALLENGE');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('scope=users.read+tweet.read');
  });

  it('exchanges a code with Basic auth and the code verifier, mapping a profile', async () => {
    const fetchMock = stubFetch([
      json({ access_token: 'tok' }),
      json({ data: { id: '99', name: 'Jack', username: 'jack', profile_image_url: 'https://img/j.png' } }),
    ]);

    const profile = await twitterProvider.exchangeCode({
      code: 'c',
      redirectUri: 'https://app/cb',
      codeVerifier: 'VERIFIER',
    });

    // Token call carries Basic auth and the PKCE verifier.
    const [, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((tokenInit.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
    expect(String(tokenInit.body)).toContain('code_verifier=VERIFIER');

    expect(profile).toEqual({
      providerAccountId: '99',
      email: null,
      emailVerified: false,
      displayName: 'Jack',
      avatarUrl: 'https://img/j.png',
    });
  });

  it('throws when the token exchange fails', async () => {
    stubFetch([new Response('', { status: 400 })]);
    await expect(
      twitterProvider.exchangeCode({ code: 'c', redirectUri: 'https://app/cb', codeVerifier: 'v' }),
    ).rejects.toThrow(/X token exchange failed/);
  });
});
