import type { Request, Response } from 'express';
import type { RequestContext } from '../auth/auth.types';
import * as teams from './teams.service';

function getContext(req: Request): RequestContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

const orgId = (req: Request): string => req.params.id as string;
const teamId = (req: Request): string => req.params.teamId as string;

export async function list(req: Request, res: Response): Promise<void> {
  res.status(200).json({ teams: await teams.listTeams(req.user!.id, orgId(req)) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const team = await teams.createTeam(req.user!.id, orgId(req), req.body.name, getContext(req));
  res.status(201).json({ team });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await teams.deleteTeam(req.user!.id, orgId(req), teamId(req), getContext(req));
  res.status(204).send();
}

export async function listMembers(req: Request, res: Response): Promise<void> {
  res.status(200).json({ members: await teams.listTeamMembers(req.user!.id, orgId(req), teamId(req)) });
}

export async function addMember(req: Request, res: Response): Promise<void> {
  await teams.addTeamMember(
    req.user!.id,
    orgId(req),
    teamId(req),
    req.body.userId,
    req.body.role,
    getContext(req),
  );
  res.status(201).json({ message: 'Member added to team' });
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  await teams.removeTeamMember(
    req.user!.id,
    orgId(req),
    teamId(req),
    req.params.userId as string,
    getContext(req),
  );
  res.status(204).send();
}
