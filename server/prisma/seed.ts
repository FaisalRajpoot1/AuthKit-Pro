import { PrismaClient } from '@prisma/client';
import {
  PERMISSIONS,
  SYSTEM_ROLES,
  permissionKey,
  resolveRolePermissionKeys,
} from '../src/features/rbac/rbac.constants';

const prisma = new PrismaClient();

/**
 * Idempotently seeds the permission catalog and system roles. Safe to run on
 * every deploy — it upserts and re-syncs each role's permission set to match
 * the definitions in rbac.constants.
 */
async function main(): Promise<void> {
  for (const permission of PERMISSIONS) {
    const key = permissionKey(permission);
    await prisma.permission.upsert({
      where: { key },
      create: { key, resource: permission.resource, action: permission.action, description: permission.description },
      update: { resource: permission.resource, action: permission.action, description: permission.description },
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

    // Re-sync to exactly the defined set.
    await prisma.rolePermission.deleteMany({ where: { roleId: saved.id } });
    await prisma.rolePermission.createMany({
      data: wanted.map((permissionId) => ({ roleId: saved.id, permissionId })),
      skipDuplicates: true,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded ${PERMISSIONS.length} permissions and ${SYSTEM_ROLES.length} roles.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
