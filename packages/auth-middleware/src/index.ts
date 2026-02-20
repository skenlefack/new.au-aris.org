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

// Interfaces
export type {
  JwtPayload,
  AuthenticatedUser,
  TenantContext,
  AuthModuleOptions,
} from './interfaces/jwt-payload.interface';
export { AUTH_MODULE_OPTIONS } from './interfaces/jwt-payload.interface';
