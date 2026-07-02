import type { OAuthProvider as PrismaOAuthProvider } from '@prisma/client';

/** Normalized profile returned by every provider after code exchange. */
export interface OAuthProfile {
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
}

/** Strategy implemented per identity provider. */
export interface OAuthProviderClient {
  readonly name: PrismaOAuthProvider;
  /**
   * Whether this provider requires PKCE (Proof Key for Code Exchange). When true,
   * the flow generates a verifier/challenge pair: the challenge goes in the
   * authorization URL and the verifier is echoed back at code exchange.
   */
  readonly usesPkce?: boolean;
  /** Whether the provider has the necessary client credentials configured. */
  isConfigured(): boolean;
  getAuthorizationUrl(params: {
    state: string;
    redirectUri: string;
    codeChallenge?: string;
  }): string;
  exchangeCode(params: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<OAuthProfile>;
}
