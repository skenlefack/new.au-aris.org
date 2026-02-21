import type { UserRole } from '@aris/shared-types';

/**
 * Reference type matching the Prisma User model.
 * Excludes passwordHash and mfaSecret for safe API responses.
 */
export interface UserEntity {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  locale: string;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
