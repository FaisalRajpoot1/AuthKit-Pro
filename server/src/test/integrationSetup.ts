import { afterAll, beforeAll, beforeEach } from 'vitest';
import { env } from '../config/env';
import { seedRbac } from '../features/rbac/rbac.seed';
import { prisma } from '../lib/prisma';

/**
 * Shared setup for DB-backed integration tests. Seeds roles/permissions once and
 * truncates user-derived data between tests (roles/permissions are preserved).
 *
 * Guard: refuses to run unless the database name looks like a test database, so
 * it can never wipe a development or production database.
 */
beforeAll(async () => {
  if (!/test/i.test(env.DATABASE_URL)) {
    throw new Error(
      `Integration tests require a test database (name must contain "test"). Got: ${env.DATABASE_URL}`,
    );
  }
  await prisma.$connect();
  await seedRbac(prisma);
});

beforeEach(async () => {
  // Truncating users cascades to all user-derived tables (sessions, tokens,
  // memberships, orgs, audit logs); seeded roles/permissions remain.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});
