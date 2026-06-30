import type { Request, Response } from 'express';
import type { RequestContext } from '../auth/auth.types';
import * as service from './passwordReset.service';

function getContext(req: Request): RequestContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await service.forgotPassword(req.body, getContext(req));
  // Always 202 regardless of whether the email exists (no enumeration).
  res.status(202).json({ message: 'If that email exists, a reset link has been sent' });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  await service.resetPassword(req.body, getContext(req));
  res.status(200).json({ message: 'Password has been reset. Please sign in.' });
}
