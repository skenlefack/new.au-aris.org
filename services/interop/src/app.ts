import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { fastifyKafka } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware/fastify';
import type { AuthHookOptions } from '@aris/auth-middleware/fastify';
import {
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
  TOPIC_MS_HEALTH_EVENT_CREATED,
} from '@aris/shared-types';
import { ConnectionService } from './services/connection.service.js';
import { MappingService } from './services/mapping.service.js';
import { TransactionService } from './services/transaction.service.js';
import { TransformEngine } from './services/transform.engine.js';
import { SyncService } from './services/sync.service.js';
import { FhirService } from './services/fhir.service.js';
import { registerHealthRoutes } from './routes/health.routes.js';
import { registerConnectionRoutes } from './routes/connection.routes.js';
import { registerMappingRoutes } from './routes/mapping.routes.js';
import { registerTransactionRoutes } from './routes/transaction.routes.js';
import { registerTransformRoutes } from './routes/transform.routes.js';
import { registerFhirRoutes } from './routes/fhir.routes.js';
import { handleFormSubmitted } from './consumers/form-submitted.consumer.js';
import { handleHealthEvent } from './consumers/health-event.consumer.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport: process.env['NODE_ENV'] !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // CORS
  await app.register(cors, { origin: true, credentials: true });

  // --- Error handler ---
  app.setErrorHandler((error: Error & { statusCode?: number; errors?: unknown }, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const message = error.message ?? 'Internal Server Error';

    if (statusCode >= 500) {
      request.log.error(error, 'Unhandled server error');
    }

    return reply.code(statusCode).send({
      statusCode,
      message,
      errors: error.errors ?? undefined,
    });
  });

  // --- Prisma (inline) ---
  const prisma = new PrismaClient();
  await prisma.$connect();
  await prisma.$queryRawUnsafe('SELECT 1');
  app.log.info('Prisma connected to database (pool primed)');
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    app.log.info('Prisma disconnected');
  });

  // --- Redis (inline) ---
  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const redis = new Redis(redisUrl);
  redis.on('error', (err) => app.log.error(err, 'Redis connection error'));
  app.decorate('redis', redis);
  app.addHook('onClose', async () => {
    await redis.quit();
  });

  // --- Kafka plugin ---
  await app.register(fastifyKafka, {
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-interop-v2-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  // --- Auth hook ---
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try {
      publicKey = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8');
    } catch { /* key file not found */ }
  }
  const authOptions: AuthHookOptions = {
    publicKey,
    isTokenBlacklisted: async (token: string) => {
      const result = await redis.get(`blacklist:${token}`);
      return result !== null;
    },
  };
  app.decorate('authHookFn', authHook(authOptions));

  // --- Services ---
  const transformEngine = new TransformEngine();
  const transactionService = new TransactionService(prisma);
  const connectionService = new ConnectionService(prisma, app.kafka);
  const mappingService = new MappingService(prisma);
  const syncService = new SyncService(prisma, app.kafka, transactionService, transformEngine);
  const fhirService = new FhirService(prisma);

  app.decorate('transformEngine', transformEngine);
  app.decorate('transactionService', transactionService);
  app.decorate('connectionService', connectionService);
  app.decorate('mappingService', mappingService);
  app.decorate('syncService', syncService);
  app.decorate('fhirService', fhirService);

  // --- Routes ---
  await app.register(registerHealthRoutes);
  await app.register(registerConnectionRoutes);
  await app.register(registerMappingRoutes);
  await app.register(registerTransactionRoutes);
  await app.register(registerTransformRoutes);
  await app.register(registerFhirRoutes);

  // --- Kafka consumers (started after server is ready) ---
  app.addHook('onReady', async () => {
    try {
      await app.kafka.subscribe(
        { groupId: 'interop-v2-form-consumer', topics: [TOPIC_MS_COLLECTE_FORM_SUBMITTED] },
        async (message) => {
          const payload = JSON.parse(message.value?.toString() ?? '{}');
          const key = message.key?.toString() ?? '';
          const headers: Record<string, unknown> = {};
          if (message.headers) {
            for (const [k, v] of Object.entries(message.headers)) {
              headers[k] = v?.toString();
            }
          }
          await handleFormSubmitted(app)(payload, key, headers);
        },
      );
      app.log.info('Subscribed to form-submitted consumer');
    } catch (err) {
      app.log.warn(err, 'Failed to subscribe form-submitted consumer');
    }

    try {
      await app.kafka.subscribe(
        { groupId: 'interop-v2-health-consumer', topics: [TOPIC_MS_HEALTH_EVENT_CREATED] },
        async (message) => {
          const payload = JSON.parse(message.value?.toString() ?? '{}');
          const key = message.key?.toString() ?? '';
          const headers: Record<string, unknown> = {};
          if (message.headers) {
            for (const [k, v] of Object.entries(message.headers)) {
              headers[k] = v?.toString();
            }
          }
          await handleHealthEvent(app)(payload, key, headers);
        },
      );
      app.log.info('Subscribed to health-event consumer');
    } catch (err) {
      app.log.warn(err, 'Failed to subscribe health-event consumer');
    }
  });

  return app;
}
