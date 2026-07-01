import { HttpClient } from './http.js';
import type {
  AuthKitConfig,
  AuthSession,
  LoginInput,
  LoginResult,
  Profile,
  RegisterInput,
  TwoFactorLoginInput,
} from './types.js';

interface SessionResponse {
  user: AuthSession['user'];
  accessToken: string;
}

interface LoginApiResponse extends Partial<SessionResponse> {
  twoFactorRequired?: boolean;
  challengeToken?: string;
}

/**
 * The AuthKit client. Wraps the REST API with in-memory access-token management
 * and transparent refresh. The refresh token is an httpOnly cookie handled by
 * the browser, so most apps just need `credentials: true` (the default).
 *
 * @example
 * const auth = new AuthKit({ baseUrl: 'https://api.example.com' });
 * await auth.login({ identifier: 'me@example.com', password: 'secret' });
 * const { user } = await auth.me();
 */
export class AuthKit {
  private readonly http: HttpClient;

  constructor(config: AuthKitConfig) {
    this.http = new HttpClient(config);
    // Wire transparent refresh: on a 401 the HTTP layer calls this.
    this.http.setRefreshHandler(() => this.tryRefresh());
  }

  /** The current in-memory access token, if any. */
  get accessToken(): string | null {
    return this.http.getAccessToken();
  }

  /** Whether an access token is currently held. */
  get isAuthenticated(): boolean {
    return this.http.getAccessToken() !== null;
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    const data = await this.http.request<SessionResponse>('POST', '/auth/register', {
      body: input,
    });
    this.http.setAccessToken(data.accessToken);
    return data;
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const data = await this.http.request<LoginApiResponse>('POST', '/auth/login', { body: input });

    if (data.twoFactorRequired && data.challengeToken) {
      return { status: 'two_factor_required', challengeToken: data.challengeToken };
    }

    const session = { user: data.user!, accessToken: data.accessToken! };
    this.http.setAccessToken(session.accessToken);
    return { status: 'authenticated', session };
  }

  /** Complete a login that required a second factor. */
  async completeTwoFactor(input: TwoFactorLoginInput): Promise<AuthSession> {
    const data = await this.http.request<SessionResponse>('POST', '/auth/2fa/login', {
      body: input,
    });
    this.http.setAccessToken(data.accessToken);
    return data;
  }

  /** Fetch the current user with roles and permissions. */
  me(): Promise<Profile> {
    return this.http.request<Profile>('GET', '/auth/me', { auth: true });
  }

  /** Exchange the refresh cookie for a new access token. Throws if unauthorized. */
  async refresh(): Promise<string> {
    const data = await this.http.request<SessionResponse>('POST', '/auth/refresh');
    this.http.setAccessToken(data.accessToken);
    return data.accessToken;
  }

  async logout(): Promise<void> {
    try {
      await this.http.request<void>('POST', '/auth/logout');
    } finally {
      this.http.setAccessToken(null);
    }
  }

  verifyEmail(token: string): Promise<void> {
    return this.http.request<void>('POST', '/auth/email/verify', { body: { token } });
  }

  forgotPassword(email: string): Promise<void> {
    return this.http.request<void>('POST', '/auth/password/forgot', { body: { email } });
  }

  resetPassword(token: string, password: string): Promise<void> {
    return this.http.request<void>('POST', '/auth/password/reset', { body: { token, password } });
  }

  /** Internal: used by the HTTP layer to refresh on 401. Never throws. */
  private async tryRefresh(): Promise<string | null> {
    try {
      const data = await this.http.request<SessionResponse>('POST', '/auth/refresh');
      this.http.setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      this.http.setAccessToken(null);
      return null;
    }
  }
}
