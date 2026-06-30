import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import {
  clearOAuthStateCookie,
  OAUTH_STATE_COOKIE_NAME,
  setOAuthStateCookie,
  setRefreshCookie,
} from '../auth/auth.cookies';
import type { RequestContext } from '../auth/auth.types';
import * as service from './oauth.service';
import { configuredProviders, parseProvider } from './providers';

function getContext(req: Request): RequestContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

function frontend(path: string, params: Record<string, string>): string {
  const url = new URL(path, env.APP_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/** Returns the authorization URL for signing in with a provider (public). */
export function getLoginUrl(req: Request, res: Response): void {
  const provider = parseProvider(req.params.provider as string);
  const { url, state } = service.buildAuthorization(provider, 'login');
  setOAuthStateCookie(res, state);
  res.status(200).json({ url });
}

/** Returns the authorization URL for linking a provider to the current user. */
export function getLinkUrl(req: Request, res: Response): void {
  const provider = parseProvider(req.params.provider as string);
  const { url, state } = service.buildAuthorization(provider, 'link', req.user!.id);
  setOAuthStateCookie(res, state);
  res.status(200).json({ url });
}

/** Provider redirect target. On success/failure it bounces back to the SPA. */
export async function callback(req: Request, res: Response): Promise<void> {
  const cookieState = req.cookies?.[OAUTH_STATE_COOKIE_NAME] as string | undefined;
  clearOAuthStateCookie(res);

  try {
    const provider = parseProvider(req.params.provider as string);
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code) {
      throw new Error('Missing authorization code');
    }

    const result = await service.handleCallback({
      provider,
      code,
      state,
      cookieState,
      context: getContext(req),
    });

    if (result.kind === 'login') {
      setRefreshCookie(
        res,
        result.auth.tokens.refreshToken,
        result.auth.tokens.refreshTokenExpiresAt,
      );
      res.redirect(frontend('/oauth/callback', { status: 'success' }));
      return;
    }

    res.redirect(frontend('/oauth/callback', { status: 'linked', provider: result.provider }));
  } catch (error) {
    logger.warn({ err: error }, 'OAuth callback failed');
    res.redirect(frontend('/oauth/callback', { status: 'error' }));
  }
}

export async function listAccounts(req: Request, res: Response): Promise<void> {
  const accounts = await service.listLinkedAccounts(req.user!.id);
  res.status(200).json({ accounts, available: configuredProviders() });
}

export async function unlink(req: Request, res: Response): Promise<void> {
  const provider = parseProvider(req.params.provider as string);
  await service.unlinkAccount(req.user!.id, provider, getContext(req));
  res.status(204).send();
}
