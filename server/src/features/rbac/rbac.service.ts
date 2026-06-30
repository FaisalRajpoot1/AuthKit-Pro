import { Prisma } from '@prisma/client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { recordAudit } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.types';
import { DEFAULT_USER_ROLE } from './rbac.constants';

type Db = Prisma.TransactionClient;

// ── Resolution (used by middleware and /me) ──────────────────────────────────

/** Returns the set of permission keys granted to a user across all their roles. */
export async function getUserPermissionKeys(userId: string): Promise<Set<string>> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } },
  });

  const keys = new Set<string>();
  for (const row of rows) {
    for (const rp of row.role.permissions) {
      keys.add(rp.permission.key);
    }
  }
  return keys;
}

export async function userHasRole(userId: string, roleName: string): Promise<boolean> {
  const count = await prisma.userRole.count({ where: { userId, role: { name: roleName } } });
  return count > 0;
}

export async function getUserRbac(
  userId: string,
): Promise<{ roles: string[]; permissions: string[] }> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: {
      role: {
        select: { name: true, permissions: { select: { permission: { select: { key: true } } } } },
      },
    },
  });

  const roles: string[] = [];
  const permissions = new Set<string>();
  for (const row of rows) {
    roles.push(row.role.name);
    for (const rp of row.role.permissions) permissions.add(rp.permission.key);
  }
  return { roles: roles.sort(), permissions: [...permissions].sort() };
}

/** Assigns the default role to a freshly registered user (no-op if missing). */
export async function assignDefaultRole(userId: string, tx: Db = prisma): Promise<void> {
  const role = await tx.role.findUnique({ where: { name: DEFAULT_USER_ROLE }, select: { id: true } });
  if (!role) {
    logger.warn({ role: DEFAULT_USER_ROLE }, 'Default role missing — run the seed');
    return;
  }
  await tx.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    create: { userId, roleId: role.id },
    update: {},
  });
}

// ── Admin management ─────────────────────────────────────────────────────────

export interface RoleDto {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface PermissionDto {
  key: string;
  resource: string;
  action: string;
  description: string | null;
}

export async function listRoles(): Promise<RoleDto[]> {
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: {
      permissions: { select: { permission: { select: { key: true } } } },
      _count: { select: { users: true } },
    },
  });

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.permissions.map((p) => p.permission.key).sort(),
    userCount: role._count.users,
  }));
}

export async function listPermissions(): Promise<PermissionDto[]> {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ resource: 'asc' }, { action: 'asc' }],
  });
  return permissions.map((p) => ({
    key: p.key,
    resource: p.resource,
    action: p.action,
    description: p.description,
  }));
}

/** Maps permission keys to ids, rejecting any unknown key. */
async function resolvePermissionIds(keys: string[]): Promise<string[]> {
  const unique = [...new Set(keys)];
  const found = await prisma.permission.findMany({
    where: { key: { in: unique } },
    select: { id: true, key: true },
  });
  if (found.length !== unique.length) {
    const known = new Set(found.map((p) => p.key));
    const unknown = unique.filter((k) => !known.has(k));
    throw new ValidationError(`Unknown permissions: ${unknown.join(', ')}`);
  }
  return found.map((p) => p.id);
}

export async function createRole(
  input: { name: string; description?: string | undefined; permissionKeys?: string[] | undefined },
  actingUserId: string,
  context: RequestContext,
): Promise<RoleDto> {
  const permissionIds = await resolvePermissionIds(input.permissionKeys ?? []);

  try {
    const role = await prisma.role.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        isSystem: false,
        permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
      },
    });
    await recordAudit({ action: 'ROLE_CREATED', userId: actingUserId, context, metadata: { role: role.name } });
    return (await listRoles()).find((r) => r.id === role.id)!;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('A role with that name already exists');
    }
    throw error;
  }
}

async function requireRole(roleId: string): Promise<{ id: string; name: string; isSystem: boolean }> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true, isSystem: true },
  });
  if (!role) throw new NotFoundError('Role not found');
  return role;
}

export async function updateRole(
  roleId: string,
  input: { description?: string | undefined },
  actingUserId: string,
  context: RequestContext,
): Promise<RoleDto> {
  await requireRole(roleId);
  await prisma.role.update({
    where: { id: roleId },
    data: input.description === undefined ? {} : { description: input.description },
  });
  await recordAudit({ action: 'ROLE_UPDATED', userId: actingUserId, context, metadata: { roleId } });
  return (await listRoles()).find((r) => r.id === roleId)!;
}

export async function deleteRole(
  roleId: string,
  actingUserId: string,
  context: RequestContext,
): Promise<void> {
  const role = await requireRole(roleId);
  if (role.isSystem) {
    throw new ConflictError('System roles cannot be deleted');
  }
  await prisma.role.delete({ where: { id: roleId } });
  await recordAudit({ action: 'ROLE_DELETED', userId: actingUserId, context, metadata: { role: role.name } });
}

export async function setRolePermissions(
  roleId: string,
  permissionKeys: string[],
  actingUserId: string,
  context: RequestContext,
): Promise<RoleDto> {
  await requireRole(roleId);
  const permissionIds = await resolvePermissionIds(permissionKeys);

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    }),
  ]);

  await recordAudit({
    action: 'ROLE_PERMISSIONS_UPDATED',
    userId: actingUserId,
    context,
    metadata: { roleId, count: permissionIds.length },
  });
  return (await listRoles()).find((r) => r.id === roleId)!;
}

/** Replaces the set of roles assigned to a user. */
export async function setUserRoles(
  targetUserId: string,
  roleIds: string[],
  actingUserId: string,
  context: RequestContext,
): Promise<{ roles: string[] }> {
  const user = await prisma.user.findFirst({ where: { id: targetUserId, deletedAt: null }, select: { id: true } });
  if (!user) throw new NotFoundError('User not found');

  const unique = [...new Set(roleIds)];
  const roles = await prisma.role.findMany({ where: { id: { in: unique } }, select: { id: true } });
  if (roles.length !== unique.length) {
    throw new ValidationError('One or more roles do not exist');
  }

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: targetUserId } }),
    prisma.userRole.createMany({
      data: unique.map((roleId) => ({ userId: targetUserId, roleId })),
      skipDuplicates: true,
    }),
  ]);

  await recordAudit({
    action: 'USER_ROLES_UPDATED',
    userId: actingUserId,
    context,
    metadata: { targetUserId, roleCount: unique.length },
  });

  const rbac = await getUserRbac(targetUserId);
  return { roles: rbac.roles };
}
