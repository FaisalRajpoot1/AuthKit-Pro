import type { Response } from 'express';
import { env, isProduction } from '../../config/env';

/**
 * The refresh token lives in an httpOnly, SameSite cookie so it is never
 * exposed to JavaScript (XSS-resistant) and is scoped to the auth routes that
 * actually need it. The short-lived access token is returned in the JSON body.
 */
export const REFRESH_COOKIE_NAME = 'authkit_refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction || env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction || env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    path: REFRESH_COOKIE_PATH,
  });
}

/**
 * "Remember this device" cookie. Scoped broadly (path "/") so it is presented
 * on the login request, letting the server skip 2FA for a trusted device.
 */
export const TRUSTED_DEVICE_COOKIE_NAME = 'authkit_trusted_device';

export function setTrustedDeviceCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(TRUSTED_DEVICE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction || env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    path: '/',
    expires: expiresAt,
  });
}
