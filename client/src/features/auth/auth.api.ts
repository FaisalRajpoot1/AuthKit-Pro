import { apiClient, setAccessToken } from '@/lib/apiClient';
import type {
  AuthResponse,
  LoginFormValues,
  RegisterFormValues,
  User,
} from './auth.types';

/** Thin API layer mapping auth endpoints to typed calls. */

export async function register(values: RegisterFormValues): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', values);
  setAccessToken(data.accessToken);
  return data;
}

/** Login may complete, or require a second factor. */
export type LoginResult =
  | { kind: 'authenticated'; response: AuthResponse }
  | { kind: 'two_factor_required'; challengeToken: string };

interface LoginApiResponse extends Partial<AuthResponse> {
  twoFactorRequired?: boolean;
  challengeToken?: string;
}

/** Maps a login-style API response to a LoginResult, storing the token if any. */
function interpretLogin(data: LoginApiResponse): LoginResult {
  if (data.twoFactorRequired && data.challengeToken) {
    return { kind: 'two_factor_required', challengeToken: data.challengeToken };
  }
  const response = data as AuthResponse;
  setAccessToken(response.accessToken);
  return { kind: 'authenticated', response };
}

export async function login(values: LoginFormValues): Promise<LoginResult> {
  const { data } = await apiClient.post<LoginApiResponse>('/auth/login', values);
  return interpretLogin(data);
}

// ── Passwordless ─────────────────────────────────────────────────────────────

export async function requestMagicLink(email: string): Promise<void> {
  await apiClient.post('/auth/passwordless/magic-link/request', { email });
}

export async function verifyMagicLink(token: string): Promise<LoginResult> {
  const { data } = await apiClient.post<LoginApiResponse>('/auth/passwordless/magic-link/verify', {
    token,
  });
  return interpretLogin(data);
}

export async function requestLoginOtp(email: string): Promise<void> {
  await apiClient.post('/auth/passwordless/otp/request', { email });
}

export async function verifyLoginOtp(email: string, code: string): Promise<LoginResult> {
  const { data } = await apiClient.post<LoginApiResponse>('/auth/passwordless/otp/verify', {
    email,
    code,
  });
  return interpretLogin(data);
}

export interface TwoFactorLoginInput {
  challengeToken: string;
  code: string;
  trustDevice?: boolean;
}

export async function completeTwoFactorLogin(input: TwoFactorLoginInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/2fa/login', input);
  setAccessToken(data.accessToken);
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
  setAccessToken(null);
}

export interface Profile {
  user: User;
  roles: string[];
  permissions: string[];
}

/** Fetch the current user + RBAC. Restores a session via the refresh cookie. */
export async function fetchMe(): Promise<Profile> {
  const { data } = await apiClient.get<Profile>('/auth/me');
  return data;
}

/** Request a password-reset link (always succeeds, even for unknown emails). */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post('/auth/password/forgot', { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await apiClient.post('/auth/password/reset', { token, password });
}

export async function verifyEmail(token: string): Promise<void> {
  await apiClient.post('/auth/email/verify', { token });
}

export async function confirmEmailChange(token: string): Promise<void> {
  await apiClient.post('/auth/email/confirm-change', { token });
}
