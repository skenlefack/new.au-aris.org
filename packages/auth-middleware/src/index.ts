// Module
export { AuthModule } from './auth.module';

// Guards
export { AuthGuard } from './guards/auth.guard';
export { RolesGuard } from './guards/roles.guard';
export { TenantGuard } from './guards/tenant.guard';
export {
  ClassificationGuard,
  RequireClassification,
  CLASSIFICATION_KEY,
} from './guards/classification.guard';

// Decorators
export { CurrentUser } from './decorators/current-user.decorator';
export { CurrentTenant } from './decorators/current-tenant.decorator';
export { Roles, ROLES_KEY } from './decorators/roles.decorator';

// Security
export {
  RateLimitGuard,
  RateLimit,
  RATE_LIMIT_KEY,
  CsrfGuard,
  SanitizePipe,
  AuditLogInterceptor,
  IpFilterGuard,
} from './security';
export type { RateLimitOptions } from './security';

// Middleware
export { HelmetMiddleware } from './middleware/helmet.middleware';

// Bootstrap
export { applySecurityBootstrap } from './bootstrap-security';

// Pipes
export { createArisValidationPipe } from './pipes/aris-validation.pipe';

// Interfaces
export type {
  JwtPayload,
  AuthenticatedUser,
  TenantContext,
  AuthModuleOptions,
  RateLimitConfig,
  CorsConfig,
  IpFilterConfig,
  SecurityOptions,
} from './interfaces/jwt-payload.interface';
export { AUTH_MODULE_OPTIONS } from './interfaces/jwt-payload.interface';

// Fastify hooks (standalone, no NestJS)
export { authHook, rolesHook, tenantHook } from './fastify';
export type { AuthHookOptions } from './fastify';

// Fastify plugin (registers app.authenticate decorator)
export { fastifyAuth, requireRoles, requireTenant } from './fastify';
