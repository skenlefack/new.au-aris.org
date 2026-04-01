import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type Redis from 'ioredis';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { TenantService } from './services/tenant.service.js';
import type { SettingsService } from './services/settings.service.js';
import type { BiService } from './services/bi.service.js';
import type { RoleService } from './services/role.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    kafka: StandaloneKafkaProducer;
    tenantService: TenantService;
    settingsService: SettingsService;
    roleService: RoleService;
    biService: BiService;
    authHookFn: ReturnType<typeof authHook>;
  }
}
