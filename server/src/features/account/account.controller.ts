import type { Request, Response } from 'express';
import { clearRefreshCookie, REFRESH_COOKIE_NAME } from '../auth/auth.cookies';
import { availabilityQuerySchema } from './account.schema';
import * as service from './account.service';

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const user = await service.updateProfile(req.user!.id, req.body);
  res.status(200).json({ user });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const currentRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await service.changePassword(req.user!.id, req.body, currentRefreshToken);
  res.status(200).json({ message: 'Password updated successfully' });
}

export async function changeEmail(req: Request, res: Response): Promise<void> {
  await service.requestEmailChange(req.user!.id, req.body);
  res.status(202).json({ message: 'Confirmation link sent to the new email address' });
}

export async function deleteAccount(req: Request, res: Response): Promise<void> {
  await service.deleteAccount(req.user!.id, req.body);
  clearRefreshCookie(res);
  res.status(204).send();
}

export async function checkAvailability(req: Request, res: Response): Promise<void> {
  const query = availabilityQuerySchema.parse(req.query);
  const availability = await service.checkAvailability(query);
  res.status(200).json(availability);
}
