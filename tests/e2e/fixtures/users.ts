/**
 * Test user fixtures for sub-domains Phase 1 E2E tests.
 *
 * These users must be seeded in the test database or mocked via
 * the test auth interceptor before running the scenarios.
 */

export const TEST_USERS = {
  admin: {
    email: 'admin@aris.test',
    password: 'Aris2024!',
    role: 'SUPER_ADMIN' as const,
    permissions: { '*': ['*'] },
  },
  livestockFocal: {
    email: 'livestock.focal@aris.test',
    password: 'Aris2024!',
    role: 'DATA_STEWARD' as const,
    permissions: { 'livestock-prod': ['DAIRY', 'RED_MEAT'] },
  },
  exec: {
    email: 'exec@aris.test',
    password: 'Aris2024!',
    role: 'CONTINENTAL_ADMIN' as const,
    permissions: {
      'livestock-prod': ['*'],
      'trade-sps': ['*'],
      'animal-health': ['*'],
    },
  },
  focalPoint: {
    email: 'focal.point@aris.test',
    password: 'Aris2024!',
    role: 'DATA_STEWARD' as const,
    permissions: { 'animal-health': ['*'] },
  },
} as const;

export type TestUserKey = keyof typeof TEST_USERS;
