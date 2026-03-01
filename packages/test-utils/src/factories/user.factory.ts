import { UserRole, TenantLevel } from '@aris/shared-types';
import { randomUUID } from 'crypto';

export interface MockUser {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  lastLoginAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function createMockUser(
  overrides: Partial<MockUser> = {},
): MockUser {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    tenantId: randomUUID(),
    email: `user-${id.substring(0, 8)}@au-aris.org`,
    passwordHash: '$2b$12$mockhashvalue',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.NATIONAL_ADMIN,
    mfaEnabled: false,
    mfaSecret: null,
    lastLoginAt: null,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export interface MockJwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenantLevel: TenantLevel;
}

export function createMockJwtPayload(
  overrides: Partial<MockJwtPayload> = {},
): MockJwtPayload {
  return {
    userId: randomUUID(),
    email: 'admin@au-aris.org',
    role: UserRole.SUPER_ADMIN,
    tenantId: randomUUID(),
    tenantLevel: TenantLevel.CONTINENTAL,
    ...overrides,
  };
}

/** Convenience: create a mock AuthenticatedUser compatible with @aris/auth-middleware */
export function createMockAuthenticatedUser(
  overrides: Partial<MockJwtPayload> = {},
): MockJwtPayload {
  return createMockJwtPayload(overrides);
}
