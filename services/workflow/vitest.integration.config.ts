import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.spec.ts', 'test/**/*.integration.spec.ts', 'test/**/*.e2e.spec.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
