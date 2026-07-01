import { apiClient } from '@/lib/apiClient';

export interface ApiScope {
  key: string;
  description: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string;
}

export interface CreateApiKeyResult {
  apiKey: ApiKey;
  /** Full secret — shown once, never returned again. */
  secret: string;
}

export async function listScopes(): Promise<ApiScope[]> {
  const { data } = await apiClient.get<{ scopes: ApiScope[] }>('/account/api-keys/scopes');
  return data.scopes;
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const { data } = await apiClient.get<{ apiKeys: ApiKey[] }>('/account/api-keys');
  return data.apiKeys;
}

export async function createApiKey(input: {
  name: string;
  scopes: string[];
  expiresInDays?: number;
}): Promise<CreateApiKeyResult> {
  const { data } = await apiClient.post<CreateApiKeyResult>('/account/api-keys', input);
  return data;
}

export async function revokeApiKey(id: string): Promise<void> {
  await apiClient.delete(`/account/api-keys/${id}`);
}
