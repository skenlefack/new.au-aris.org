import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { FastifyKafka } from '@aris/kafka-client';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { ConnectionService } from '../services/connection.service.js';
import type { MappingService } from '../services/mapping.service.js';
import type { TransactionService } from '../services/transaction.service.js';
import type { TransformEngine } from '../services/transform.engine.js';
import type { SyncService } from '../services/sync.service.js';
import type { FhirService } from '../services/fhir.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    kafka: FastifyKafka;
    authHookFn: ReturnType<typeof authHook>;
    connectionService: ConnectionService;
    mappingService: MappingService;
    transactionService: TransactionService;
    transformEngine: TransformEngine;
    syncService: SyncService;
    fhirService: FhirService;
  }
}
