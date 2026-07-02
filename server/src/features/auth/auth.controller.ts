import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import {
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
  setTrustedDeviceCookie,
  TRUSTED_DEVICE_COOKIE_NAME,
} from './auth.cookies';
import { verifyTwoFactorChallenge } from '../../lib/jwt';
import { getUserRbac } from '../rbac/rbac.service';
import { requestEmailOtp, requestSmsOtp } from '../two-factor/twoFactor.service';
import * as authService from './auth.service';
import type { RequestContext } from './auth.types';
import { sendLoginResult } from './loginResponse';

function getContext(req: Request): RequestContext {
  return {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const { user, tokens } = await authService.register(req.body, getContext(req));
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
  res.status(201).json({ user, accessToken: tokens.accessToken });
}

export async function login(req: Request, res: Response): Promise<void> {
  const trustedDeviceToken = req.cookies?.[TRUSTED_DEVICE_COOKIE_NAME] as string | undefined;
  const result = await authService.login(req.body, getContext(req), { trustedDeviceToken });
  sendLoginResult(res, result);
}

export async function twoFactorEmailOtp(req: Request, res: Response): Promise<void> {
  // The challenge token proves the first factor already passed.
  const { userId } = verifyTwoFactorChallenge(req.body.challengeToken);
  await requestEmailOtp(userId);
  res.status(202).json({ message: 'A verification code has been sent to your email' });
}

export async function twoFactorSmsOtp(req: Request, res: Response): Promise<void> {
  const { userId } = verifyTwoFactorChallenge(req.body.challengeToken);
  await requestSmsOtp(userId);
  res.status(202).json({ message: 'A verification code has been sent by SMS' });
}

export async function twoFactorLogin(req: Request, res: Response): Promise<void> {
  const result = await authService.completeTwoFactorLogin(req.body, getContext(req));

  setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshTokenExpiresAt);
  if (result.trustedDevice) {
    setTrustedDeviceCookie(res, result.trustedDevice.token, result.trustedDevice.expiresAt);
  }
  res.status(200).json({ user: result.user, accessToken: result.tokens.accessToken });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!rawToken) {
    throw new UnauthorizedError('Refresh token cookie is missing');
  }

  const { user, tokens } = await authService.refresh(rawToken, getContext(req));
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
  res.status(200).json({ user, accessToken: tokens.accessToken });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await authService.logout(rawToken, getContext(req));
  clearRefreshCookie(res);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  // `requireAuth` guarantees req.user is present.
  const [user, rbac] = await Promise.all([
    authService.getProfile(req.user!.id),
    getUserRbac(req.user!.id),
  ]);
  res.status(200).json({ user, roles: rbac.roles, permissions: rbac.permissions });
}
