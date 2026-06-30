import { PrismaClient } from '@prisma/client';
import { isProduction } from '../config/env';

/**
 * Singleton Prisma client. In development we cache it on `globalThis` so that
 * hot-reloads (tsx watch) don't exhaust the connection pool by instantiating
 * a new client on every reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['warn', 'error'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
