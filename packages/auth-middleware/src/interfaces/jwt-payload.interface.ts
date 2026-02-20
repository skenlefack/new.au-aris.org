import { UserRole, TenantLevel } from '@aris/shared-types';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenantLevel: TenantLevel;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenantLevel: TenantLevel;
}

export interface TenantContext {
  tenantId: string;
  tenantLevel: TenantLevel;
  parentTenantId?: string;
  childTenantIds?: string[];
}

export const AUTH_MODULE_OPTIONS = 'ARIS_AUTH_MODULE_OPTIONS';

export interface AuthModuleOptions {
  publicKey: string;
  algorithms?: string[];
}
