import type { RequestHandler } from 'express';
import { authenticateApiKey } from '../features/api-keys/apiKeys.service';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * Authenticates a request via an API key presented in the `X-API-Key` header
 * (kept separate from the `Authorization` Bearer flow used by user sessions).
 * Attaches `req.apiAuth = { userId, scopes }`.
 */
export const apiKeyAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers['x-api-key'];
  const key = Array.isArray(header) ? header[0] : header;

  if (!key) {
    next(new UnauthorizedError('Missing X-API-Key header'));
    return;
  }

  authenticateApiKey(key)
    .then((principal) => {
      req.apiAuth = principal;
      next();
    })
    .catch(next);
};

/** Requires the authenticating API key to hold a given scope. */
export function requireScope(scope: string): RequestHandler {
  return (req, _res, next) => {
    if (!req.apiAuth) {
      next(new UnauthorizedError('API key authentication required'));
      return;
    }
    if (!req.apiAuth.scopes.includes(scope)) {
      next(new ForbiddenError(`API key is missing the required scope: ${scope}`));
      return;
    }
    next();
  };
}
