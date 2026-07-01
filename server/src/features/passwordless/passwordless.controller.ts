import type { Request, Response } from 'express';
import { sendLoginResult } from '../auth/loginResponse';
import type { RequestContext } from '../auth/auth.types';
import * as service from './passwordless.service';

function getContext(req: Request): RequestContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

export async function requestMagicLink(req: Request, res: Response): Promise<void> {
  await service.requestMagicLink(req.body.email, getContext(req));
  res.status(202).json({ message: 'If that account exists, a sign-in link has been sent' });
}

export async function verifyMagicLink(req: Request, res: Response): Promise<void> {
  const result = await service.verifyMagicLink(req.body.token, getContext(req));
  sendLoginResult(res, result);
}

export async function requestOtp(req: Request, res: Response): Promise<void> {
  await service.requestLoginOtp(req.body.email, getContext(req));
  res.status(202).json({ message: 'If that account exists, a code has been sent' });
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const result = await service.verifyLoginOtp(req.body.email, req.body.code, getContext(req));
  sendLoginResult(res, result);
}
