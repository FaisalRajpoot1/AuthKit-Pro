import type { RequestHandler } from 'express';
import { getUserPermissionKeys, userHasRole } from '../features/rbac/rbac.service';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * Authorization guards. Both assume `requireAuth` ran first (so `req.user` is
 * set) and resolve the user's roles/permissions from the database per request.
 */
export function requirePermission(permissionKey: string): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    getUserPermissionKeys(req.user.id)
      .then((keys) => {
        if (!keys.has(permissionKey)) {
          throw new ForbiddenError(`Missing required permission: ${permissionKey}`);
        }
        next();
      })
      .catch(next);
  };
}

export function requireRole(roleName: string): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    userHasRole(req.user.id, roleName)
      .then((hasRole) => {
        if (!hasRole) {
          throw new ForbiddenError(`Requires the "${roleName}" role`);
        }
        next();
      })
      .catch(next);
  };
}
