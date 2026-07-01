import type { Request, Response } from 'express';
import type { RequestContext } from '../auth/auth.types';
import * as service from './ipBlocking.service';

function getContext(req: Request): RequestContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

export async function list(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ blockedIps: await service.listBlockedIps() });
}

export async function block(req: Request, res: Response): Promise<void> {
  const { ipAddress, reason, expiresAt } = req.body as {
    ipAddress: string;
    reason?: string;
    expiresAt?: string;
  };
  const blockedIp = await service.blockIp(
    {
      ipAddress,
      reason,
      ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
    },
    req.user!.id,
    getContext(req),
  );
  res.status(201).json({ blockedIp });
}

export async function unblock(req: Request, res: Response): Promise<void> {
  await service.unblockIp(req.params.id as string, req.user!.id, getContext(req));
  res.status(200).json({ message: 'IP address unblocked' });
}
