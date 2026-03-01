import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { I18nService } from '@aris/i18n';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { AuthService } from './services/auth.service.js';
import type { UserService } from './services/user.service.js';
import type { MfaService } from './services/mfa.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    authService: AuthService;
    userService: UserService;
    mfaService: MfaService;
    i18n: I18nService;
    authHookFn: ReturnType<typeof authHook>;
  }
}
