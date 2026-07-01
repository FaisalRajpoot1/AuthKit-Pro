import type { Request, Response } from 'express';
import { unlockUser } from '../auth/lockout';
import type { RequestContext } from '../auth/auth.types';
import { adminAuditQuerySchema, adminListQuerySchema } from './admin.schema';
import * as dashboard from './adminDashboard.service';

function getContext(req: Request): RequestContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

export async function stats(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await dashboard.getStats());
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const query = adminListQuerySchema.parse(req.query);
  res.status(200).json(await dashboard.listUsers(query));
}

export async function getUser(req: Request, res: Response): Promise<void> {
  res.status(200).json({ user: await dashboard.getUserDetail(req.params.id as string) });
}

export async function setUserActive(req: Request, res: Response): Promise<void> {
  await dashboard.setUserActive(
    req.params.id as string,
    req.body.isActive,
    req.user!.id,
    getContext(req),
  );
  res.status(200).json({ message: 'User status updated' });
}

export async function unlock(req: Request, res: Response): Promise<void> {
  await unlockUser(req.params.id as string, req.user!.id, getContext(req));
  res.status(200).json({ message: 'User unlocked' });
}

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const query = adminAuditQuerySchema.parse(req.query);
  res.status(200).json(await dashboard.listAllAuditLogs(query));
}

export async function listOrganizations(req: Request, res: Response): Promise<void> {
  const query = adminListQuerySchema.parse(req.query);
  res.status(200).json(await dashboard.listAllOrganizations(query));
}
