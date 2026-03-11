import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/services/__tests__/**/*.spec.ts', 'src/import-export/csv-parser.util.spec.ts'],
    exclude: ['src/**/*.integration.spec.ts', 'src/**/*.e2e.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/seed/**', '**/*.spec.ts', '**/*.dto.ts', '**/*.entity.ts'],
    },
  },
});
