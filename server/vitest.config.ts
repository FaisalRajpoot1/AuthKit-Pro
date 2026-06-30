import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Provide deterministic env so config validation passes without a real .env.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/authkit_test?schema=public',
      JWT_ACCESS_SECRET: 'test_access_secret_at_least_32_chars_long_xx',
      JWT_REFRESH_SECRET: 'test_refresh_secret_at_least_32_chars_long_x',
    },
    include: ['src/**/*.{test,spec}.ts'],
  },
});
