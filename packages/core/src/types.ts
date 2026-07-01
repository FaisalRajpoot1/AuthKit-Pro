/** Public user shape returned by the AuthKit API. */
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  emailVerified: boolean;
  createdAt: string;
}

/** Current user plus their resolved roles and permissions. */
export interface Profile {
  user: User;
  roles: string[];
  permissions: string[];
}

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

export interface LoginInput {
  /** Email or username. */
  identifier: string;
  password: string;
}

export interface TwoFactorLoginInput {
  challengeToken: string;
  code: string;
  trustDevice?: boolean;
}

/** A successful authentication: the user and a short-lived access token. */
export interface AuthSession {
  user: User;
  accessToken: string;
}

/** Login either authenticates or requires a second factor. */
export type LoginResult =
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'two_factor_required'; challengeToken: string };

/** Configuration for {@link AuthKit}. */
export interface AuthKitConfig {
  /** Base URL of the API, e.g. "https://api.example.com" or "/" for same-origin. */
  baseUrl: string;
  /** API path prefix. Defaults to "/api/v1". */
  apiPrefix?: string;
  /**
   * Whether to send cookies with requests (required for the refresh-token
   * cookie). Defaults to true.
   */
  credentials?: boolean;
  /** Injectable fetch implementation (defaults to the global `fetch`). */
  fetch?: typeof fetch;
  /** Called whenever the in-memory access token changes (login/refresh/logout). */
  onAccessTokenChange?: (token: string | null) => void;
}
