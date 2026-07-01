import type { Request, Response } from 'express';
import {
  clearWebAuthnCookie,
  setRefreshCookie,
  setWebAuthnCookie,
  WEBAUTHN_COOKIE_NAME,
} from '../auth/auth.cookies';
import type { RequestContext } from '../auth/auth.types';
import { UnauthorizedError } from '../../utils/errors';
import * as service from './passkeys.service';
import type { AuthenticationResponse, RegistrationResponse } from './passkeys.service';

function getContext(req: Request): RequestContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

function challengeToken(req: Request): string {
  const token = req.cookies?.[WEBAUTHN_COOKIE_NAME] as string | undefined;
  if (!token) throw new UnauthorizedError('Missing WebAuthn challenge');
  return token;
}

// Registration (authenticated)

export async function registrationOptions(req: Request, res: Response): Promise<void> {
  const { options, challengeToken: token } = await service.getRegistrationOptions(req.user!.id);
  setWebAuthnCookie(res, token);
  res.status(200).json(options);
}

export async function registrationVerify(req: Request, res: Response): Promise<void> {
  const passkey = await service.verifyRegistration(
    req.user!.id,
    req.body.response as RegistrationResponse,
    challengeToken(req),
    req.body.name,
    getContext(req),
  );
  clearWebAuthnCookie(res);
  res.status(201).json({ passkey });
}

export async function list(req: Request, res: Response): Promise<void> {
  res.status(200).json({ passkeys: await service.listPasskeys(req.user!.id) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.deletePasskey(req.user!.id, req.params.id as string, getContext(req));
  res.status(204).send();
}

// Authentication (public)

export async function authenticationOptions(req: Request, res: Response): Promise<void> {
  const { options, challengeToken: token } = await service.getAuthenticationOptions(req.body.email);
  setWebAuthnCookie(res, token);
  res.status(200).json(options);
}

export async function authenticationVerify(req: Request, res: Response): Promise<void> {
  const result = await service.verifyAuthentication(
    req.body.response as AuthenticationResponse,
    challengeToken(req),
    getContext(req),
  );
  clearWebAuthnCookie(res);
  setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshTokenExpiresAt);
  res.status(200).json({ user: result.user, accessToken: result.tokens.accessToken });
}
