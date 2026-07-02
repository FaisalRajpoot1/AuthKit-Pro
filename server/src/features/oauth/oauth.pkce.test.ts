import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { OAuthProviderClient } from './oauth.types';

// A configurable fake provider whose getAuthorizationUrl echoes what it received
// (state + optional code challenge) into the returned URL so we can inspect it.
const fake: { usesPkce: boolean } = { usesPkce: true };

vi.mock('./providers', () => ({
  getProviderClient: (): OAuthProviderClient => ({
    name: 'TWITTER',
    usesPkce: fake.usesPkce,
    isConfigured: () => true,
    getAuthorizationUrl: ({ state, codeChallenge }) => {
      const params = new URLSearchParams({ state });
      if (codeChallenge) params.set('code_challenge', codeChallenge);
      return `https://provider/authorize?${params.toString()}`;
    },
    exchangeCode: async () => ({
      providerAccountId: 'x',
      email: null,
      emailVerified: false,
      displayName: null,
      avatarUrl: null,
    }),
  }),
}));

import { verifyOAuthState } from '../../lib/jwt';
import { buildAuthorization } from './oauth.service';

function s256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

describe('buildAuthorization PKCE', () => {
  it('mints a verifier in the state and the matching S256 challenge in the URL', () => {
    fake.usesPkce = true;
    const { url, state } = buildAuthorization('TWITTER', 'login');

    const decoded = verifyOAuthState(state);
    expect(decoded.codeVerifier).toBeTruthy();

    const challenge = new URL(url).searchParams.get('code_challenge');
    expect(challenge).toBe(s256(decoded.codeVerifier as string));
  });

  it('omits PKCE for providers that do not use it', () => {
    fake.usesPkce = false;
    const { url, state } = buildAuthorization('TWITTER', 'login');

    expect(verifyOAuthState(state).codeVerifier).toBeUndefined();
    expect(new URL(url).searchParams.get('code_challenge')).toBeNull();
  });
});
