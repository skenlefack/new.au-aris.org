import { UserRole, TenantLevel } from '@aris/shared-types';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  roles?: string[];  // effective role codes (new permission system)
  tenantId: string;
  tenantLevel: TenantLevel;
  locale?: string;
  domains?: Record<string, string[]>;  // { "livestock-prod": ["DAIRY","RED_MEAT"], "trade-sps": ["*"] }
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  roles: string[];  // effective role codes — defaults to [role] for backward compat
  tenantId: string;
  tenantLevel: TenantLevel;
  locale?: string;
  domains: Record<string, string[]>;  // hierarchical domain → sub-domain permissions
}

export interface TenantContext {
  tenantId: string;
  tenantLevel: TenantLevel;
  parentTenantId?: string;
  childTenantIds?: string[];
}

export interface RateLimitConfig {
  max?: number;
  windowMs?: number;
}

export interface CorsConfig {
  origins?: string[];
  credentials?: boolean;
  methods?: string[];
}

export interface IpFilterConfig {
  whitelist?: string[];
  blacklist?: string[];
}

export interface SecurityOptions {
  helmet?: boolean;
  rateLimit?: RateLimitConfig;
  cors?: CorsConfig;
  ipFilter?: IpFilterConfig;
  csrf?: boolean;
  csrfCookieName?: string;
  auditLog?: boolean;
}

export const AUTH_MODULE_OPTIONS = 'ARIS_AUTH_MODULE_OPTIONS';

export interface AuthModuleOptions {
  publicKey: string;
  algorithms?: string[];
  security?: SecurityOptions;
  isTokenBlacklisted?: (token: string) => Promise<boolean>;
}
