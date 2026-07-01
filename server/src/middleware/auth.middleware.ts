import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { assertSessionActive } from '../features/sessions/sessions.service';
import { UnauthorizedError } from '../utils/errors';

/**
 * Authentication guard. Extracts a Bearer access token, verifies it, confirms
 * the backing session is still active (so logout / revocation / account-disable
 * take effect immediately), and attaches the principal to `req.user`.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = verifyAccessToken(token);
    assertSessionActive(payload.sub, payload.sid)
      .then(() => {
        req.user = { id: payload.sub, email: payload.email, sessionId: payload.sid };
        next();
      })
      .catch(next);
  } catch (error) {
    next(error);
  }
};
