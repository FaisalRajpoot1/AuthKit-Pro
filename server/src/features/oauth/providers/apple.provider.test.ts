import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Provide Apple credentials with a freshly generated EC key so the ES256
// client-secret JWT is really signed. (Mock factories are hoisted, so the key is
// generated inside the factory.)
vi.mock('../../../config/env', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { generateKeyPairSync } = require('node:crypto') as typeof import('node:crypto');
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;
  return {
    env: {
      APPLE_CLIENT_ID: 'com.example.app',
      APPLE_TEAM_ID: 'TEAMID1234',
      APPLE_KEY_ID: 'KEYID5678',
      APPLE_PRIVATE_KEY: pem,
    },
  };
});

import { appleProvider } from './apple.provider';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => vi.unstubAllGlobals());

describe('appleProvider', () => {
  it('is form-post based and configured when all Apple env vars are present', () => {
    expect(appleProvider.usesFormPost).toBe(true);
    expect(appleProvider.isConfigured()).toBe(true);
  });

  it('builds a form_post authorization URL with the name+email scope', () => {
    const url = appleProvider.getAuthorizationUrl({ state: 'st', redirectUri: 'https://app/cb' });
    expect(url).toContain('appleid.apple.com/auth/authorize');
    expect(url).toContain('response_mode=form_post');
    expect(url).toContain('scope=name+email');
    expect(url).toContain('client_id=com.example.app');
  });

  it('exchanges a code with an ES256 client secret and maps id_token claims', async () => {
    const idToken = jwt.sign(
      { sub: '001122.abcdef', email: 'user@privaterelay.appleid.com', email_verified: 'true' },
      'irrelevant',
    );
    const fetchMock = vi.fn(async () => json({ id_token: idToken }));
    vi.stubGlobal('fetch', fetchMock);

    const profile = await appleProvider.exchangeCode({ code: 'c', redirectUri: 'https://app/cb' });

    // The token request carries a signed ES256 JWT client secret with our key id.
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = new URLSearchParams(String(init.body));
    const clientSecret = body.get('client_secret') as string;
    const header = JSON.parse(Buffer.from(clientSecret.split('.')[0]!, 'base64url').toString());
    expect(header.alg).toBe('ES256');
    expect(header.kid).toBe('KEYID5678');
    expect(body.get('grant_type')).toBe('authorization_code');

    expect(profile).toEqual({
      providerAccountId: '001122.abcdef',
      email: 'user@privaterelay.appleid.com',
      emailVerified: true,
      displayName: null,
      avatarUrl: null,
    });
  });

  it('throws when Apple does not return an identity token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({})));
    await expect(
      appleProvider.exchangeCode({ code: 'c', redirectUri: 'https://app/cb' }),
    ).rejects.toThrow(/identity token/);
  });
});
