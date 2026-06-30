import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from './auth.cookies';
import * as authService from './auth.service';
import type { RequestContext } from './auth.types';

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
  const { user, tokens } = await authService.login(req.body, getContext(req));
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
  res.status(200).json({ user, accessToken: tokens.accessToken });
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
  const user = await authService.getProfile(req.user!.id);
  res.status(200).json({ user });
}
