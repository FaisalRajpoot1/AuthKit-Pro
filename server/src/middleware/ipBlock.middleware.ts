import type { RequestHandler } from 'express';
import { isIpBlocked } from '../features/ip-blocking/ipBlocking.service';
import { ForbiddenError } from '../utils/errors';

/**
 * Rejects requests from administrator-blocked IP addresses. Mounted early on the
 * API surface so a blocked client is turned away before any work is done. When
 * `req.ip` is unavailable it lets the request through (nothing to match on); the
 * underlying lookup fails open on database errors.
 */
export const ipBlockGuard: RequestHandler = (req, _res, next) => {
  const ip = req.ip;
  if (!ip) {
    next();
    return;
  }
  isIpBlocked(ip)
    .then((blocked) => {
      if (blocked) {
        throw new ForbiddenError('Your IP address has been blocked');
      }
      next();
    })
    .catch(next);
};
