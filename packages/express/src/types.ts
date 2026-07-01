/** The authenticated principal extracted from a verified access token. */
export interface AuthPrincipal {
  userId: string;
  email: string;
  sessionId: string;
}

/** Roles and permissions resolved for a request. */
export interface AuthzResult {
  roles: string[];
  permissions: string[];
}

export interface AuthzContext {
  principal: AuthPrincipal;
  /** The raw bearer token, e.g. for calling the AuthKit API. */
  token: string;
}

export interface AuthMiddlewareConfig {
  /** Shared secret used to verify access tokens (matches the server's JWT_ACCESS_SECRET). */
  accessSecret: string;
  issuer?: string;
  audience?: string;

  /**
   * Resolves the caller's roles/permissions. Provide this, or `apiBaseUrl` to
   * use the built-in resolver that calls the AuthKit `/auth/me` endpoint.
   */
  resolveAuthz?: (ctx: AuthzContext) => Promise<AuthzResult> | AuthzResult;

  /** Base URL of the AuthKit API, used by the default authz resolver. */
  apiBaseUrl?: string;
  /** API path prefix for the default resolver. Defaults to "/api/v1". */
  apiPrefix?: string;
  /** Injectable fetch (defaults to global `fetch`). */
  fetch?: typeof fetch;
}
