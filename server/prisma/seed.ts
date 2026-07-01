import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, SYSTEM_ROLES } from '../src/features/rbac/rbac.constants';
import { seedRbac } from '../src/features/rbac/rbac.seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await seedRbac(prisma);
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
