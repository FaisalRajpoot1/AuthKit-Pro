import { randomBytes, randomUUID } from 'node:crypto';
import type { OrgRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { emailService } from '../../lib/email/email.service';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { generateOpaqueToken, hashToken } from '../../lib/tokens';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { recordAudit } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.types';
import type {
  AcceptInviteInput,
  CreateOrganizationInput,
  InviteMemberInput,
  UpdateOrganizationInput,
} from './organizations.schema';
import {
  orgRoleAtLeast,
  type OrganizationDto,
  type OrganizationMemberDto,
} from './organizations.types';

const INVITE_TTL_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Loads the caller's membership and enforces a minimum role. Throws 404 if the
 * org is missing/deleted and 403 if the caller isn't a member or lacks the role.
 */
export async function requireMembership(
  organizationId: string,
  userId: string,
  minimum: OrgRole = 'MEMBER',
): Promise<{ role: OrgRole }> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!org) throw new NotFoundError('Organization not found');

  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  });
  if (!membership) throw new ForbiddenError('You are not a member of this organization');
  if (!orgRoleAtLeast(membership.role, minimum)) {
    throw new ForbiddenError('You do not have permission to perform this action');
  }
  return membership;
}

async function uniqueSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'org';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(2).toString('hex')}`;
    const taken = await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export async function createOrganization(
  userId: string,
  input: CreateOrganizationInput,
  context: RequestContext,
): Promise<OrganizationDto> {
  const slug = await uniqueSlug(input.name);

  const org = await prisma.organization.create({
    data: {
      name: input.name,
      slug,
      ownerId: userId,
      members: { create: { userId, role: 'OWNER' } },
    },
  });

  await recordAudit({ action: 'ORG_CREATED', userId, context, metadata: { organizationId: org.id } });
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    myRole: 'OWNER',
    memberCount: 1,
    createdAt: org.createdAt.toISOString(),
  };
}

export async function listMyOrganizations(userId: string): Promise<OrganizationDto[]> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, organization: { deletedAt: null } },
    include: { organization: { include: { _count: { select: { members: true } } } } },
    orderBy: { organization: { createdAt: 'asc' } },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    myRole: m.role,
    memberCount: m.organization._count.members,
    createdAt: m.organization.createdAt.toISOString(),
  }));
}

export async function updateOrganization(
  userId: string,
  organizationId: string,
  input: UpdateOrganizationInput,
  context: RequestContext,
): Promise<void> {
  await requireMembership(organizationId, userId, 'ADMIN');
  await prisma.organization.update({ where: { id: organizationId }, data: { name: input.name } });
  await recordAudit({ action: 'ORG_UPDATED', userId, context, metadata: { organizationId } });
}

export async function deleteOrganization(
  userId: string,
  organizationId: string,
  context: RequestContext,
): Promise<void> {
  await requireMembership(organizationId, userId, 'OWNER');
  await prisma.organization.update({
    where: { id: organizationId },
    data: { deletedAt: new Date() },
  });
  await recordAudit({ action: 'ORG_DELETED', userId, context, metadata: { organizationId } });
}

export async function listMembers(
  userId: string,
  organizationId: string,
): Promise<OrganizationMemberDto[]> {
  await requireMembership(organizationId, userId);
  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    include: { user: { select: { username: true, email: true, displayName: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return members.map((m) => ({
    userId: m.userId,
    username: m.user.username,
    email: m.user.email,
    displayName: m.user.displayName,
    role: m.role,
    joinedAt: m.createdAt.toISOString(),
  }));
}

export async function changeMemberRole(
  userId: string,
  organizationId: string,
  targetUserId: string,
  role: OrgRole,
  context: RequestContext,
): Promise<void> {
  await requireMembership(organizationId, userId, 'ADMIN');

  const target = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
    select: { role: true },
  });
  if (!target) throw new NotFoundError('Member not found');
  if (target.role === 'OWNER') {
    throw new ConflictError("The owner's role can only change via ownership transfer");
  }

  await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
    data: { role },
  });
  await recordAudit({
    action: 'ORG_MEMBER_ROLE_CHANGED',
    userId,
    context,
    metadata: { organizationId, targetUserId, role },
  });
}

export async function removeMember(
  userId: string,
  organizationId: string,
  targetUserId: string,
  context: RequestContext,
): Promise<void> {
  await requireMembership(organizationId, userId, 'ADMIN');

  const target = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
    select: { role: true },
  });
  if (!target) throw new NotFoundError('Member not found');
  if (target.role === 'OWNER') {
    throw new ConflictError('The owner cannot be removed');
  }

  await prisma.organizationMember.delete({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
  });
  await recordAudit({
    action: 'ORG_MEMBER_REMOVED',
    userId,
    context,
    metadata: { organizationId, targetUserId },
  });
}

export async function leaveOrganization(
  userId: string,
  organizationId: string,
  context: RequestContext,
): Promise<void> {
  const membership = await requireMembership(organizationId, userId);
  if (membership.role === 'OWNER') {
    throw new ConflictError('Transfer ownership or delete the organization before leaving');
  }

  await prisma.organizationMember.delete({
    where: { organizationId_userId: { organizationId, userId } },
  });
  await recordAudit({ action: 'ORG_MEMBER_LEFT', userId, context, metadata: { organizationId } });
}

export async function transferOwnership(
  userId: string,
  organizationId: string,
  targetUserId: string,
  context: RequestContext,
): Promise<void> {
  await requireMembership(organizationId, userId, 'OWNER');
  if (targetUserId === userId) {
    throw new ValidationError('You already own this organization');
  }

  const target = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
    select: { id: true },
  });
  if (!target) throw new NotFoundError('Target user is not a member');

  await prisma.$transaction([
    prisma.organization.update({ where: { id: organizationId }, data: { ownerId: targetUserId } }),
    prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
      data: { role: 'OWNER' },
    }),
    prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: { role: 'ADMIN' },
    }),
  ]);
  await recordAudit({
    action: 'ORG_OWNERSHIP_TRANSFERRED',
    userId,
    context,
    metadata: { organizationId, targetUserId },
  });
}

export async function inviteMember(
  userId: string,
  organizationId: string,
  input: InviteMemberInput,
  context: RequestContext,
): Promise<void> {
  await requireMembership(organizationId, userId, 'ADMIN');

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true },
  });

  const { token, hash } = generateOpaqueToken();
  await prisma.organizationInvite.create({
    data: {
      organizationId,
      email: input.email,
      role: input.role,
      tokenHash: hash,
      invitedById: userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * MS_PER_DAY),
    },
  });

  await emailService.sendOrganizationInviteEmail(input.email, org.name, token);
  await recordAudit({
    action: 'ORG_MEMBER_INVITED',
    userId,
    context,
    metadata: { organizationId, email: input.email, role: input.role },
  });
  logger.info({ organizationId, email: input.email }, 'Organization invite sent');
}

export async function acceptInvite(
  userId: string,
  input: AcceptInviteInput,
  context: RequestContext,
): Promise<OrganizationDto> {
  const invite = await prisma.organizationInvite.findUnique({
    where: { tokenHash: hashToken(input.token) },
  });
  if (!invite) throw new ValidationError('Invalid invitation');
  if (invite.acceptedAt) throw new ValidationError('This invitation has already been used');
  if (invite.expiresAt.getTime() < Date.now()) throw new ValidationError('This invitation has expired');

  try {
    await prisma.$transaction([
      prisma.organizationMember.create({
        data: { organizationId: invite.organizationId, userId, role: invite.role },
      }),
      prisma.organizationInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('You are already a member of this organization');
    }
    throw error;
  }

  await recordAudit({
    action: 'ORG_MEMBER_JOINED',
    userId,
    context,
    metadata: { organizationId: invite.organizationId },
  });

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: invite.organizationId },
    include: { _count: { select: { members: true } } },
  });
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    myRole: invite.role,
    memberCount: org._count.members,
    createdAt: org.createdAt.toISOString(),
  };
}
