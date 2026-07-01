import type { Response } from 'express';
import { setRefreshCookie } from './auth.cookies';
import type { LoginResult } from './auth.types';

/**
 * Writes an HTTP response for a {@link LoginResult}: either a 2FA challenge or a
 * fully authenticated session (refresh cookie + access token). Shared by
 * password login and passwordless login so both behave identically.
 */
export function sendLoginResult(res: Response, result: LoginResult): void {
  if (result.status === 'two_factor_required') {
    res.status(200).json({ twoFactorRequired: true, challengeToken: result.challengeToken });
    return;
  }

  setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshTokenExpiresAt);
  res.status(200).json({ user: result.user, accessToken: result.tokens.accessToken });
}
