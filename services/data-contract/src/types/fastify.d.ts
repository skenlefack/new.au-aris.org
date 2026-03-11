import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { authHook } from '@aris/auth-middleware';
import type { ContractService } from '../services/contract.service';
import type { ComplianceService } from '../services/compliance.service';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    kafka: StandaloneKafkaProducer;
    contractService: ContractService;
    complianceService: ComplianceService;
    authHookFn: ReturnType<typeof authHook>;
  }
}
