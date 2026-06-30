import type { Request, Response } from 'express';
import * as service from './passwordReset.service';

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await service.forgotPassword(req.body);
  // Always 202 regardless of whether the email exists (no enumeration).
  res.status(202).json({ message: 'If that email exists, a reset link has been sent' });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  await service.resetPassword(req.body);
  res.status(200).json({ message: 'Password has been reset. Please sign in.' });
}
