import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { FormationService } from '../services/formation.service';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    kafka: StandaloneKafkaProducer;
    formationService: FormationService;
    authHookFn: ReturnType<typeof authHook>;
  }
}
