import type { TeamRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { recordAudit } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.types';
import { requireMembership } from './organizations.service';
import type { TeamDto, TeamMemberDto } from './organizations.types';

/** Ensures a team belongs to the given org, returning it or throwing 404. */
async function requireTeam(organizationId: string, teamId: string): Promise<{ id: string }> {
  const team = await prisma.team.findFirst({
    where: { id: teamId, organizationId },
    select: { id: true },
  });
  if (!team) throw new NotFoundError('Team not found');
  return team;
}

export async function listTeams(userId: string, organizationId: string): Promise<TeamDto[]> {
  await requireMembership(organizationId, userId);
  const teams = await prisma.team.findMany({
    where: { organizationId },
    include: { _count: { select: { members: true } } },
    orderBy: { name: 'asc' },
  });
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    memberCount: t._count.members,
    createdAt: t.createdAt.toISOString(),
  }));
}

export async function createTeam(
  userId: string,
  organizationId: string,
  name: string,
  context: RequestContext,
): Promise<TeamDto> {
  await requireMembership(organizationId, userId, 'ADMIN');

  try {
    const team = await prisma.team.create({ data: { organizationId, name } });
    await recordAudit({
      action: 'TEAM_CREATED',
      userId,
      context,
      metadata: { organizationId, teamId: team.id },
    });
    return { id: team.id, name: team.name, memberCount: 0, createdAt: team.createdAt.toISOString() };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('A team with that name already exists');
    }
    throw error;
  }
}

export async function deleteTeam(
  userId: string,
  organizationId: string,
  teamId: string,
  context: RequestContext,
): Promise<void> {
  await requireMembership(organizationId, userId, 'ADMIN');
  await requireTeam(organizationId, teamId);
  await prisma.team.delete({ where: { id: teamId } });
  await recordAudit({
    action: 'TEAM_DELETED',
    userId,
    context,
    metadata: { organizationId, teamId },
  });
}

export async function listTeamMembers(
  userId: string,
  organizationId: string,
  teamId: string,
): Promise<TeamMemberDto[]> {
  await requireMembership(organizationId, userId);
  await requireTeam(organizationId, teamId);

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: { select: { username: true, displayName: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return members.map((m) => ({
    userId: m.userId,
    username: m.user.username,
    displayName: m.user.displayName,
    role: m.role,
    joinedAt: m.createdAt.toISOString(),
  }));
}

export async function addTeamMember(
  userId: string,
  organizationId: string,
  teamId: string,
  targetUserId: string,
  role: TeamRole,
  context: RequestContext,
): Promise<void> {
  await requireMembership(organizationId, userId, 'ADMIN');
  await requireTeam(organizationId, teamId);

  // The target must belong to the organization first.
  const orgMember = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
    select: { userId: true },
  });
  if (!orgMember) throw new NotFoundError('User is not a member of this organization');

  try {
    await prisma.teamMember.create({ data: { teamId, userId: targetUserId, role } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('User is already in this team');
    }
    throw error;
  }
  await recordAudit({
    action: 'TEAM_MEMBER_ADDED',
    userId,
    context,
    metadata: { organizationId, teamId, targetUserId, role },
  });
}

export async function removeTeamMember(
  userId: string,
  organizationId: string,
  teamId: string,
  targetUserId: string,
  context: RequestContext,
): Promise<void> {
  await requireMembership(organizationId, userId, 'ADMIN');
  await requireTeam(organizationId, teamId);

  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: targetUserId } },
    select: { id: true },
  });
  if (!member) throw new NotFoundError('Team member not found');

  await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId: targetUserId } } });
  await recordAudit({
    action: 'TEAM_MEMBER_REMOVED',
    userId,
    context,
    metadata: { organizationId, teamId, targetUserId },
  });
}
