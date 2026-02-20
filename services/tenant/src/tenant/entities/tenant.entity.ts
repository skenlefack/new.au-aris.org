import type { TenantLevel } from '@aris/shared-types';

/**
 * Reference type matching the Prisma Tenant model.
 * Used for typing service/controller return values without
 * coupling to the Prisma-generated types in non-DB layers.
 */
export interface TenantEntity {
  id: string;
  name: string;
  code: string;
  level: TenantLevel;
  parentId: string | null;
  countryCode: string | null;
  recCode: string | null;
  domain: string;
  config: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
