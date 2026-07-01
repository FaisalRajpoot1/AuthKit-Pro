import type { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { recordAudit } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.types';
import { revokeAllUserSessions } from '../sessions/sessions.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE = 20;
const MAX_PAGE = 100;

export interface AdminStats {
  users: { total: number; active: number; verified: number; twoFactor: number; new7d: number; new30d: number };
  organizations: number;
  activeSessions: number;
}

/** Aggregate counts for the admin overview. */
export async function getStats(): Promise<AdminStats> {
  const now = Date.now();
  const since7 = new Date(now - 7 * MS_PER_DAY);
  const since30 = new Date(now - 30 * MS_PER_DAY);

  const [total, active, verified, twoFactor, new7d, new30d, organizations, activeSessions] =
    await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      prisma.user.count({ where: { deletedAt: null, emailVerified: true } }),
      prisma.user.count({ where: { deletedAt: null, twoFactorEnabled: true } }),
      prisma.user.count({ where: { deletedAt: null, createdAt: { gte: since7 } } }),
      prisma.user.count({ where: { deletedAt: null, createdAt: { gte: since30 } } }),
      prisma.organization.count({ where: { deletedAt: null } }),
      prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date(now) } } }),
    ]);

  return {
    users: { total, active, verified, twoFactor, new7d, new30d },
    organizations,
    activeSessions,
  };
}

export interface AdminUserListItem {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  isActive: boolean;
  locked: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  roles: string[];
  createdAt: string;
  lastLoginAt: string | null;
}

function isUserLocked(lockedUntil: Date | null): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > Date.now();
}

function clampLimit(limit?: number): number {
  return Math.min(limit ?? DEFAULT_PAGE, MAX_PAGE);
}

export async function listUsers(options: {
  search?: string | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}): Promise<{ items: AdminUserListItem[]; nextCursor: string | null }> {
  const take = clampLimit(options.limit);
  const search = options.search?.trim();

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const rows = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    include: { roles: { select: { role: { select: { name: true } } } } },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  return {
    items: page.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      displayName: u.displayName,
      isActive: u.isActive,
      locked: isUserLocked(u.lockedUntil),
      emailVerified: u.emailVerified,
      twoFactorEnabled: u.twoFactorEnabled,
      roles: u.roles.map((r) => r.role.name),
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

export interface AdminUserDetail extends AdminUserListItem {
  activeSessions: number;
  organizations: number;
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { roles: { select: { role: { select: { name: true } } } } },
  });
  if (!user) throw new NotFoundError('User not found');

  const [activeSessions, organizations] = await Promise.all([
    prisma.session.count({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.organizationMember.count({ where: { userId } }),
  ]);

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    isActive: user.isActive,
    locked: isUserLocked(user.lockedUntil),
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    roles: user.roles.map((r) => r.role.name),
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    activeSessions,
    organizations,
  };
}

/** Activates or deactivates a user; deactivation also revokes all sessions. */
export async function setUserActive(
  targetUserId: string,
  isActive: boolean,
  actingUserId: string,
  context: RequestContext,
): Promise<void> {
  if (targetUserId === actingUserId) {
    throw new ConflictError('You cannot change your own account status');
  }
  const user = await prisma.user.findFirst({ where: { id: targetUserId, deletedAt: null }, select: { id: true } });
  if (!user) throw new NotFoundError('User not found');

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: targetUserId }, data: { isActive } });
    if (!isActive) {
      await revokeAllUserSessions(targetUserId, null, tx);
    }
  });

  await recordAudit({
    action: 'ADMIN_USER_STATUS_CHANGED',
    userId: actingUserId,
    context,
    metadata: { targetUserId, isActive },
  });
}

export interface AdminAuditLogItem {
  id: string;
  action: AuditAction;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export async function listAllAuditLogs(options: {
  userId?: string | undefined;
  action?: AuditAction | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}): Promise<{ items: AdminAuditLogItem[]; nextCursor: string | null }> {
  const take = clampLimit(options.limit);

  const where: Prisma.AuditLogWhereInput = {
    ...(options.userId ? { userId: options.userId } : {}),
    ...(options.action ? { action: options.action } : {}),
  };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    include: { user: { select: { email: true } } },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  return {
    items: page.map((row) => ({
      id: row.id,
      action: row.action,
      userId: row.userId,
      userEmail: row.user?.email ?? null,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

export interface AdminOrganizationItem {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  memberCount: number;
  createdAt: string;
}

export async function listAllOrganizations(options: {
  search?: string | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}): Promise<{ items: AdminOrganizationItem[]; nextCursor: string | null }> {
  const take = clampLimit(options.limit);
  const search = options.search?.trim();

  const where: Prisma.OrganizationWhereInput = {
    deletedAt: null,
    ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
  };

  const rows = await prisma.organization.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    include: { owner: { select: { email: true } }, _count: { select: { members: true } } },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  return {
    items: page.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      ownerEmail: org.owner.email,
      memberCount: org._count.members,
      createdAt: org.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}
