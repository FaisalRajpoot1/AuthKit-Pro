import { AuthKitError } from './errors.js';
import type { AuthKitConfig } from './types.js';

type RefreshHandler = () => Promise<string | null>;

interface RequestOptions {
  body?: unknown;
  /** Attach the access token and enable refresh-on-401. Default false. */
  auth?: boolean;
  _retry?: boolean;
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

/**
 * Thin fetch wrapper handling base URL, JSON (de)serialization, cookie
 * credentials, bearer-token injection, and a single transparent token refresh
 * when an authenticated request returns 401.
 */
export class HttpClient {
  private accessToken: string | null = null;
  private refreshHandler: RefreshHandler | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  private readonly baseUrl: string;
  private readonly credentials: RequestCredentials;
  private readonly fetchImpl: typeof fetch;
  private readonly onAccessTokenChange: ((token: string | null) => void) | undefined;

  constructor(config: AuthKitConfig) {
    const prefix = config.apiPrefix ?? '/api/v1';
    this.baseUrl = `${config.baseUrl.replace(/\/$/, '')}${prefix}`;
    this.credentials = (config.credentials ?? true) ? 'include' : 'same-origin';
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    this.onAccessTokenChange = config.onAccessTokenChange;

    if (!this.fetchImpl) {
      throw new Error('No fetch implementation available; pass one via config.fetch');
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
    this.onAccessTokenChange?.(token);
  }

  /** The client registers how to refresh; keeps HTTP decoupled from auth flow. */
  setRefreshHandler(handler: RefreshHandler): void {
    this.refreshHandler = handler;
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.auth && this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      credentials: this.credentials,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });

    if (response.ok) {
      return this.parse<T>(response);
    }

    // Try one transparent refresh for authenticated 401s.
    if (response.status === 401 && options.auth && this.refreshHandler && !options._retry) {
      const token = await this.refreshOnce();
      if (token) {
        return this.request<T>(method, path, { ...options, _retry: true });
      }
    }

    throw await this.toError(response);
  }

  private async refreshOnce(): Promise<string | null> {
    this.refreshPromise ??= this.refreshHandler!().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async parse<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  private async toError(response: Response): Promise<AuthKitError> {
    let code = 'UNKNOWN';
    let message = response.statusText || 'Request failed';
    let details: unknown;
    try {
      const body = (await response.json()) as ErrorBody;
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
      details = body.error?.details;
    } catch {
      // Non-JSON error body — keep defaults.
    }
    return new AuthKitError(response.status, code, message, details);
  }
}
