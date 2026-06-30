import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { UnauthorizedError } from '../utils/errors';

/**
 * Authentication guard. Extracts a Bearer access token, verifies it, and
 * attaches the principal to `req.user`. Throws 401 when missing or invalid.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const token = header.slice('Bearer '.length).trim();
  const payload = verifyAccessToken(token);

  req.user = { id: payload.sub, email: payload.email };
  next();
};
