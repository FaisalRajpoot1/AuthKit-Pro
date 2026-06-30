import type { Request, Response } from 'express';
import type { RequestContext } from '../auth/auth.types';
import * as rbac from '../rbac/rbac.service';

function getContext(req: Request): RequestContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

export async function listRoles(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ roles: await rbac.listRoles() });
}

export async function listPermissions(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ permissions: await rbac.listPermissions() });
}

export async function createRole(req: Request, res: Response): Promise<void> {
  const role = await rbac.createRole(req.body, req.user!.id, getContext(req));
  res.status(201).json({ role });
}

export async function updateRole(req: Request, res: Response): Promise<void> {
  const role = await rbac.updateRole(
    req.params.id as string,
    req.body,
    req.user!.id,
    getContext(req),
  );
  res.status(200).json({ role });
}

export async function deleteRole(req: Request, res: Response): Promise<void> {
  await rbac.deleteRole(req.params.id as string, req.user!.id, getContext(req));
  res.status(204).send();
}

export async function setRolePermissions(req: Request, res: Response): Promise<void> {
  const role = await rbac.setRolePermissions(
    req.params.id as string,
    req.body.permissionKeys,
    req.user!.id,
    getContext(req),
  );
  res.status(200).json({ role });
}

export async function setUserRoles(req: Request, res: Response): Promise<void> {
  const result = await rbac.setUserRoles(
    req.params.id as string,
    req.body.roleIds,
    req.user!.id,
    getContext(req),
  );
  res.status(200).json(result);
}
