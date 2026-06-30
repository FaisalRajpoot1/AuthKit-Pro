import type { Request, Response } from 'express';
import type { RequestContext } from '../auth/auth.types';
import * as service from './twoFactor.service';

function getContext(req: Request): RequestContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

export async function status(req: Request, res: Response): Promise<void> {
  res.status(200).json(await service.getStatus(req.user!.id));
}

export async function setup(req: Request, res: Response): Promise<void> {
  const result = await service.setupTwoFactor(req.user!.id);
  res.status(200).json(result);
}

export async function enable(req: Request, res: Response): Promise<void> {
  const result = await service.enableTwoFactor(req.user!.id, req.body.code, getContext(req));
  res.status(200).json(result);
}

export async function disable(req: Request, res: Response): Promise<void> {
  await service.disableTwoFactor(req.user!.id, req.body.password, getContext(req));
  res.status(200).json({ message: 'Two-factor authentication disabled' });
}

export async function regenerateBackupCodes(req: Request, res: Response): Promise<void> {
  const result = await service.regenerateBackupCodes(
    req.user!.id,
    req.body.password,
    getContext(req),
  );
  res.status(200).json(result);
}
