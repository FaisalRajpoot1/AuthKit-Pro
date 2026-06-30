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

/** Short-lived CSRF state for the OAuth round-trip. */
export const OAUTH_STATE_COOKIE_NAME = 'authkit_oauth_state';
const OAUTH_STATE_PATH = '/api/v1/auth/oauth';

export function setOAuthStateCookie(res: Response, state: string): void {
  res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: isProduction || env.COOKIE_SECURE,
    // 'lax' allows the cookie to ride the top-level redirect back from the provider.
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    path: OAUTH_STATE_PATH,
    maxAge: 10 * 60 * 1000,
  });
}

export function clearOAuthStateCookie(res: Response): void {
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction || env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    path: OAUTH_STATE_PATH,
  });
}
