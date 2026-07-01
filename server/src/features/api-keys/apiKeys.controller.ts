import type { Request, Response } from 'express';
import type { RequestContext } from '../auth/auth.types';
import { API_SCOPES } from './apiKeys.constants';
import * as service from './apiKeys.service';

function getContext(req: Request): RequestContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

export function listScopes(_req: Request, res: Response): void {
  res.status(200).json({ scopes: API_SCOPES });
}

export async function list(req: Request, res: Response): Promise<void> {
  res.status(200).json({ apiKeys: await service.listApiKeys(req.user!.id) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const result = await service.createApiKey(req.user!.id, req.body, getContext(req));
  // The `secret` is returned exactly once — the client must store it now.
  res.status(201).json(result);
}

export async function revoke(req: Request, res: Response): Promise<void> {
  await service.revokeApiKey(req.user!.id, req.params.id as string, getContext(req));
  res.status(204).send();
}
