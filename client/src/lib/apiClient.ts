import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

/**
 * Central HTTP client.
 *
 * Access token: kept in memory only (never localStorage) to limit XSS blast
 * radius. Refresh token: an httpOnly cookie the browser sends automatically,
 * so `withCredentials` is required.
 *
 * On a 401 the client transparently attempts a single token refresh and
 * replays the original request. Concurrent 401s share one refresh call.
 */
const API_BASE_URL = '/api/v1';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Single in-flight refresh shared across concurrent 401s.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const response = await axios.post<{ accessToken: string }>(
    `${API_BASE_URL}/auth/refresh`,
    null,
    { withCredentials: true },
  );
  const token = response.data.accessToken;
  setAccessToken(token);
  return token;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const isAuthEndpoint = original?.url?.includes('/auth/refresh') ?? false;

    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        refreshPromise ??= refreshAccessToken();
        const token = await refreshPromise;
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      } catch (refreshError) {
        setAccessToken(null);
        return Promise.reject(refreshError);
      } finally {
        refreshPromise = null;
      }
    }

    return Promise.reject(error);
  },
);
