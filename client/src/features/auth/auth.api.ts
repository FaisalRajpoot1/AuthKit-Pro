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

export async function login(values: LoginFormValues): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', values);
  setAccessToken(data.accessToken);
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
  setAccessToken(null);
}

/** Fetch the current user. Used to restore a session via the refresh cookie. */
export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>('/auth/me');
  return data.user;
}
