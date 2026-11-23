import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Applies pending migrations to the test database once, before any test file runs.
    globalSetup: ['tests/setup/globalSetup.js'],
    // Integration tests share one database, so test files run one at a time.
    fileParallelism: false,
    env: { NODE_ENV: 'test' },
    restoreMocks: true,
  },
});
