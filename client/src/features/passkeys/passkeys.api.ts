import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { apiClient, setAccessToken } from '@/lib/apiClient';
import type { AuthResponse } from '@/features/auth/auth.types';

export interface Passkey {
  id: string;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  transports: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export const passkeysSupported = browserSupportsWebAuthn;

export async function listPasskeys(): Promise<Passkey[]> {
  const { data } = await apiClient.get<{ passkeys: Passkey[] }>('/account/passkeys');
  return data.passkeys;
}

export async function deletePasskey(id: string): Promise<void> {
  await apiClient.delete(`/account/passkeys/${id}`);
}

/** Runs the full registration ceremony and stores the new passkey. */
export async function registerPasskey(name?: string): Promise<Passkey> {
  const { data: optionsJSON } = await apiClient.post('/account/passkeys/registration/options');
  const response = await startRegistration({ optionsJSON });
  const { data } = await apiClient.post<{ passkey: Passkey }>(
    '/account/passkeys/registration/verify',
    { response, name },
  );
  return data.passkey;
}

/** Runs the authentication ceremony and signs the user in. */
export async function loginWithPasskey(email?: string): Promise<AuthResponse> {
  const { data: optionsJSON } = await apiClient.post('/auth/passkeys/authentication/options', {
    ...(email ? { email } : {}),
  });
  const response = await startAuthentication({ optionsJSON });
  const { data } = await apiClient.post<AuthResponse>('/auth/passkeys/authentication/verify', {
    response,
  });
  setAccessToken(data.accessToken);
  return data;
}
