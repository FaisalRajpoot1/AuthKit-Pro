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
  /** Whether the provider has the necessary client credentials configured. */
  isConfigured(): boolean;
  getAuthorizationUrl(params: { state: string; redirectUri: string }): string;
  exchangeCode(params: { code: string; redirectUri: string }): Promise<OAuthProfile>;
}
