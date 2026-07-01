import type { PrismaClient } from '@prisma/client';
import {
  PERMISSIONS,
  SYSTEM_ROLES,
  permissionKey,
  resolveRolePermissionKeys,
} from './rbac.constants';

/**
 * Idempotently seeds the permission catalog and system roles, re-syncing each
 * role's permission set to the definitions in {@link rbac.constants}. Shared by
 * the CLI seed script and the integration-test harness.
 */
export async function seedRbac(prisma: PrismaClient): Promise<void> {
  for (const permission of PERMISSIONS) {
    const key = permissionKey(permission);
    await prisma.permission.upsert({
      where: { key },
      create: {
        key,
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
      },
      update: {
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
      },
    });
  }

  const permissions = await prisma.permission.findMany();
  const idByKey = new Map(permissions.map((p) => [p.key, p.id]));

  for (const role of SYSTEM_ROLES) {
    const saved = await prisma.role.upsert({
      where: { name: role.name },
      create: { name: role.name, description: role.description, isSystem: true },
      update: { description: role.description, isSystem: true },
    });

    const wanted = resolveRolePermissionKeys(role)
      .map((key) => idByKey.get(key))
      .filter((id): id is string => Boolean(id));

    await prisma.rolePermission.deleteMany({ where: { roleId: saved.id } });
    await prisma.rolePermission.createMany({
      data: wanted.map((permissionId) => ({ roleId: saved.id, permissionId })),
      skipDuplicates: true,
    });
  }
}
