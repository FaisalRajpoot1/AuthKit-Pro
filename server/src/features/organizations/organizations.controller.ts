import type { Request, Response } from 'express';
import type { RequestContext } from '../auth/auth.types';
import * as orgs from './organizations.service';

function getContext(req: Request): RequestContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

const orgId = (req: Request): string => req.params.id as string;
const targetUserId = (req: Request): string => req.params.userId as string;

export async function create(req: Request, res: Response): Promise<void> {
  const organization = await orgs.createOrganization(req.user!.id, req.body, getContext(req));
  res.status(201).json({ organization });
}

export async function listMine(req: Request, res: Response): Promise<void> {
  res.status(200).json({ organizations: await orgs.listMyOrganizations(req.user!.id) });
}

export async function update(req: Request, res: Response): Promise<void> {
  await orgs.updateOrganization(req.user!.id, orgId(req), req.body, getContext(req));
  res.status(200).json({ message: 'Organization updated' });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await orgs.deleteOrganization(req.user!.id, orgId(req), getContext(req));
  res.status(204).send();
}

export async function listMembers(req: Request, res: Response): Promise<void> {
  res.status(200).json({ members: await orgs.listMembers(req.user!.id, orgId(req)) });
}

export async function changeMemberRole(req: Request, res: Response): Promise<void> {
  await orgs.changeMemberRole(req.user!.id, orgId(req), targetUserId(req), req.body.role, getContext(req));
  res.status(200).json({ message: 'Member role updated' });
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  await orgs.removeMember(req.user!.id, orgId(req), targetUserId(req), getContext(req));
  res.status(204).send();
}

export async function leave(req: Request, res: Response): Promise<void> {
  await orgs.leaveOrganization(req.user!.id, orgId(req), getContext(req));
  res.status(204).send();
}

export async function transferOwnership(req: Request, res: Response): Promise<void> {
  await orgs.transferOwnership(req.user!.id, orgId(req), req.body.userId, getContext(req));
  res.status(200).json({ message: 'Ownership transferred' });
}

export async function invite(req: Request, res: Response): Promise<void> {
  await orgs.inviteMember(req.user!.id, orgId(req), req.body, getContext(req));
  res.status(202).json({ message: 'Invitation sent' });
}

export async function acceptInvite(req: Request, res: Response): Promise<void> {
  const organization = await orgs.acceptInvite(req.user!.id, req.body, getContext(req));
  res.status(200).json({ organization });
}
