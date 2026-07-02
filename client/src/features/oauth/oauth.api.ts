import { apiClient } from '@/lib/apiClient';

export type OAuthProvider =
  | 'GOOGLE'
  | 'GITHUB'
  | 'MICROSOFT'
  | 'DISCORD'
  | 'FACEBOOK'
  | 'LINKEDIN'
  | 'TWITTER'
  | 'APPLE';

export interface LinkedAccount {
  provider: OAuthProvider;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface LinkedAccountsResponse {
  accounts: LinkedAccount[];
  available: OAuthProvider[];
}

/** Begin sign-in: fetch the authorization URL (sets the state cookie) and go. */
export async function startOAuthLogin(provider: OAuthProvider): Promise<void> {
  const { data } = await apiClient.get<{ url: string }>(
    `/auth/oauth/${provider.toLowerCase()}/url`,
  );
  window.location.assign(data.url);
}

/** Begin linking a provider to the signed-in account. */
export async function startOAuthLink(provider: OAuthProvider): Promise<void> {
  const { data } = await apiClient.get<{ url: string }>(
    `/auth/oauth/${provider.toLowerCase()}/link`,
  );
  window.location.assign(data.url);
}

export async function listLinkedAccounts(): Promise<LinkedAccountsResponse> {
  const { data } = await apiClient.get<LinkedAccountsResponse>('/auth/oauth/accounts');
  return data;
}

export async function unlinkAccount(provider: OAuthProvider): Promise<void> {
  await apiClient.delete(`/auth/oauth/${provider.toLowerCase()}`);
}

export const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  GOOGLE: 'Google',
  GITHUB: 'GitHub',
  MICROSOFT: 'Microsoft',
  DISCORD: 'Discord',
  FACEBOOK: 'Facebook',
  LINKEDIN: 'LinkedIn',
  TWITTER: 'X',
  APPLE: 'Apple',
};
