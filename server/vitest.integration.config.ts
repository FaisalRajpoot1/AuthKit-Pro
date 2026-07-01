import { defineConfig } from 'vitest/config';

/**
 * Integration tests run against a REAL PostgreSQL database. Provide DATABASE_URL
 * via the environment (a dedicated test database). The other secrets are fixed
 * for determinism. Tables are migrated once and truncated between tests by the
 * setup file.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.int.test.ts'],
    setupFiles: ['src/test/integrationSetup.ts'],
    // The whole suite shares one database, so run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test_access_secret_at_least_32_chars_long_xx',
      JWT_REFRESH_SECRET: 'test_refresh_secret_at_least_32_chars_long_x',
      ENCRYPTION_KEY: 'JB6IodCakx3kzIvrFGpV5mhh0CHabl4MPeJI7PVvV1U=',
    },
  },
});
