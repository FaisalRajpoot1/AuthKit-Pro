import { describe, expect, it, vi } from 'vitest';
import { AuthKit } from './client.js';
import { AuthKitError } from './errors.js';

function json(status: number, body: unknown): Response {
  // 204 responses must have a null body per the Fetch spec.
  const payload = body === undefined ? null : JSON.stringify(body);
  return new Response(payload, { status, headers: { 'Content-Type': 'application/json' } });
}

/** Builds an AuthKit wired to a fetch mock, exposing the mock for assertions. */
function setup(handler: (url: string, init: RequestInit) => Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init ?? {})),
  );
  const auth = new AuthKit({ baseUrl: 'https://api.test', fetch: fetchMock as typeof fetch });
  return { auth, fetchMock };
}

const USER = {
  id: 'u1',
  email: 'a@b.com',
  username: 'ab',
  displayName: null,
  emailVerified: false,
  createdAt: '2020-01-01T00:00:00.000Z',
};

describe('AuthKit.login', () => {
  it('authenticates and stores the access token', async () => {
    const { auth } = setup(() => json(200, { user: USER, accessToken: 'tok-1' }));
    const result = await auth.login({ identifier: 'ab', password: 'pw' });

    expect(result.status).toBe('authenticated');
    expect(auth.accessToken).toBe('tok-1');
    expect(auth.isAuthenticated).toBe(true);
  });

  it('surfaces a two-factor challenge without storing a token', async () => {
    const { auth } = setup(() => json(200, { twoFactorRequired: true, challengeToken: 'ch-1' }));
    const result = await auth.login({ identifier: 'ab', password: 'pw' });

    expect(result).toEqual({ status: 'two_factor_required', challengeToken: 'ch-1' });
    expect(auth.isAuthenticated).toBe(false);
  });

  it('throws an AuthKitError on bad credentials', async () => {
    const { auth } = setup(() =>
      json(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }),
    );

    await expect(auth.login({ identifier: 'ab', password: 'bad' })).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
    await expect(auth.login({ identifier: 'ab', password: 'bad' })).rejects.toBeInstanceOf(
      AuthKitError,
    );
  });
});

describe('AuthKit.me', () => {
  it('sends the bearer token', async () => {
    const { auth, fetchMock } = setup((url) =>
      url.endsWith('/auth/login')
        ? json(200, { user: USER, accessToken: 'tok-1' })
        : json(200, { user: USER, roles: ['customer'], permissions: [] }),
    );

    await auth.login({ identifier: 'ab', password: 'pw' });
    const profile = await auth.me();

    expect(profile.roles).toEqual(['customer']);
    const meCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/auth/me'));
    const headers = (meCall?.[1]?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-1');
  });
});

describe('transparent refresh on 401', () => {
  it('refreshes once and retries the original request', async () => {
    let meCalls = 0;
    const { auth, fetchMock } = setup((url) => {
      if (url.endsWith('/auth/refresh')) return json(200, { user: USER, accessToken: 'tok-2' });
      if (url.endsWith('/auth/me')) {
        meCalls += 1;
        return meCalls === 1
          ? json(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } })
          : json(200, { user: USER, roles: [], permissions: [] });
      }
      return json(404, {});
    });

    // Seed a (now-expired) token so `me` attaches auth and triggers refresh.
    await auth.refresh(); // sets tok-2 via the refresh endpoint
    const profile = await auth.me();

    expect(profile.user.id).toBe('u1');
    expect(meCalls).toBe(2); // original 401 + retry
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/auth/refresh'))).toBe(true);
  });
});

describe('AuthKit.logout', () => {
  it('clears the token even on success', async () => {
    const { auth } = setup((url) =>
      url.endsWith('/auth/login')
        ? json(200, { user: USER, accessToken: 'tok-1' })
        : json(204, undefined),
    );
    await auth.login({ identifier: 'ab', password: 'pw' });
    await auth.logout();
    expect(auth.isAuthenticated).toBe(false);
  });
});
