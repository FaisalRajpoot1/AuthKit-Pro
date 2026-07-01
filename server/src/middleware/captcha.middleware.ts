import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { verifyCaptchaToken } from '../lib/captcha';
import { logger } from '../lib/logger';
import { ForbiddenError } from '../utils/errors';

/**
 * Verifies a CAPTCHA token on sensitive endpoints. The token is read from the
 * `X-Captcha-Token` header (preferred) or a `captchaToken` body field. This is a
 * no-op when `CAPTCHA_ENABLED` is false, so it can be applied unconditionally.
 */
export const verifyCaptcha: RequestHandler = (req, _res, next) => {
  if (!env.CAPTCHA_ENABLED) {
    next();
    return;
  }

  if (!env.CAPTCHA_SECRET) {
    logger.error('CAPTCHA_ENABLED is true but CAPTCHA_SECRET is not set');
    next(new Error('CAPTCHA is misconfigured'));
    return;
  }

  const header = req.headers['x-captcha-token'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const token = fromHeader || (req.body?.captchaToken as string | undefined);

  if (!token || typeof token !== 'string') {
    next(new ForbiddenError('CAPTCHA token is required'));
    return;
  }

  verifyCaptchaToken(token, {
    provider: env.CAPTCHA_PROVIDER,
    secret: env.CAPTCHA_SECRET,
    remoteIp: req.ip,
  })
    .then((ok) => {
      if (!ok) throw new ForbiddenError('CAPTCHA verification failed');
      next();
    })
    .catch(next);
};
