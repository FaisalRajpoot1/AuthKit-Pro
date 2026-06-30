import type { Request, Response } from 'express';
import * as service from './emailVerification.service';

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  await service.verifyEmail(req.body.token);
  res.status(200).json({ message: 'Email verified successfully' });
}

export async function confirmEmailChange(req: Request, res: Response): Promise<void> {
  await service.confirmEmailChange(req.body.token);
  res.status(200).json({ message: 'Email address updated successfully' });
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  await service.resendVerification(req.user!.id);
  res.status(202).json({ message: 'Verification email sent' });
}
