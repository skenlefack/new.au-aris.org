import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { I18nService } from '@aris/i18n';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { AuthService } from './services/auth.service.js';
import type { UserService } from './services/user.service.js';
import type { MfaService } from './services/mfa.service.js';
import type { DomainService } from './services/domain.service.js';
import type { SubDomainService } from './services/subdomain.service.js';
import type { PermissionResolver } from './services/permission-resolver.js';
import type { AuditService } from './services/audit.service.js';
import type { SessionService } from './services/session.service.js';
import type { AccountLockoutService } from './services/account-lockout.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    authService: AuthService;
    userService: UserService;
    mfaService: MfaService;
    domainService: DomainService;
    subDomainService: SubDomainService;
    permissionResolver: PermissionResolver;
    auditService: AuditService;
    sessionService: SessionService;
    lockoutService: AccountLockoutService;
    i18n: I18nService;
    authHookFn: ReturnType<typeof authHook>;
  }
}
