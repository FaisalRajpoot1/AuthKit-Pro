import type { Request, RequestHandler } from 'express';
import { AuthError } from './errors';
import { verifyAccessToken } from './jwt';
import type { AuthMiddlewareConfig, AuthPrincipal, AuthzResult } from './types';

// Request-scoped state kept off the Request object (no global type augmentation).
const principals = new WeakMap<object, AuthPrincipal>();
const tokens = new WeakMap<object, string>();

/** Returns the authenticated principal for a request, if `authenticate` ran. */
export function getAuth(req: Request): AuthPrincipal | undefined {
  return principals.get(req);
}

export interface AuthMiddleware {
  /** Verifies the Bearer token and attaches the principal. */
  authenticate: RequestHandler;
  /** Requires the caller to hold a role (resolved via config). */
  requireRole: (role: string) => RequestHandler;
  /** Requires the caller to hold a `resource:action` permission. */
  requirePermission: (permission: string) => RequestHandler;
  /** Custom check against the resolved roles/permissions and principal. */
  authorize: (
    check: (authz: AuthzResult, principal: AuthPrincipal) => boolean,
    message?: string,
  ) => RequestHandler;
}

/** Builds a set of authentication/authorization middlewares. */
export function createAuthMiddleware(config: AuthMiddlewareConfig): AuthMiddleware {
  const issuer = config.issuer ?? 'authkit';
  const audience = config.audience ?? 'authkit-client';
  const apiPrefix = config.apiPrefix ?? '/api/v1';
  const fetchImpl = config.fetch ?? globalThis.fetch;

  const authenticate: RequestHandler = (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      next(new AuthError(401, 'UNAUTHORIZED', 'Missing or malformed Authorization header'));
      return;
    }
    try {
      const token = header.slice('Bearer '.length).trim();
      const principal = verifyAccessToken(token, { secret: config.accessSecret, issuer, audience });
      principals.set(req, principal);
      tokens.set(req, token);
      next();
    } catch (error) {
      next(error);
    }
  };

  const resolveAuthz = async (req: Request): Promise<AuthzResult> => {
    const principal = principals.get(req);
    const token = tokens.get(req);
    if (!principal || !token) {
      throw new AuthError(401, 'UNAUTHORIZED', 'Not authenticated');
    }

    if (config.resolveAuthz) {
      return config.resolveAuthz({ principal, token });
    }

    if (config.apiBaseUrl) {
      if (!fetchImpl) {
        throw new AuthError(500, 'CONFIG_ERROR', 'No fetch implementation available');
      }
      const url = `${config.apiBaseUrl.replace(/\/$/, '')}${apiPrefix}/auth/me`;
      const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        throw new AuthError(response.status === 401 ? 401 : 403, 'FORBIDDEN', 'Authorization check failed');
      }
      const data = (await response.json()) as { roles?: string[]; permissions?: string[] };
      return { roles: data.roles ?? [], permissions: data.permissions ?? [] };
    }

    throw new AuthError(
      500,
      'CONFIG_ERROR',
      'Configure `resolveAuthz` or `apiBaseUrl` to use role/permission guards',
    );
  };

  const guard = (checkAndThrow: (authz: AuthzResult, principal: AuthPrincipal) => void): RequestHandler => {
    return (req, _res, next) => {
      void (async () => {
        const authz = await resolveAuthz(req);
        checkAndThrow(authz, principals.get(req)!);
        next();
      })().catch(next);
    };
  };

  const requireRole = (role: string): RequestHandler =>
    guard((authz) => {
      if (!authz.roles.includes(role)) {
        throw new AuthError(403, 'FORBIDDEN', `Requires the "${role}" role`);
      }
    });

  const requirePermission = (permission: string): RequestHandler =>
    guard((authz) => {
      if (!authz.permissions.includes(permission)) {
        throw new AuthError(403, 'FORBIDDEN', `Missing required permission: ${permission}`);
      }
    });

  const authorize = (
    check: (authz: AuthzResult, principal: AuthPrincipal) => boolean,
    message = 'You do not have permission to perform this action',
  ): RequestHandler =>
    guard((authz, principal) => {
      if (!check(authz, principal)) {
        throw new AuthError(403, 'FORBIDDEN', message);
      }
    });

  return { authenticate, requireRole, requirePermission, authorize };
}
