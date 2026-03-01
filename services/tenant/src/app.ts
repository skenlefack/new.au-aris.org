// BigInt values from Prisma (e.g. country.population) must be serializable to JSON
(BigInt.prototype as any).toJSON = function () { return Number(this); };

import Fastify, { FastifyInstance, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { readFileSync } from 'fs';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware/fastify';
import type { AuthHookOptions } from '@aris/auth-middleware/fastify';
import { TenantService } from './services/tenant.service.js';
import { SettingsService } from './services/settings.service.js';
import { BiService } from './services/bi.service.js';
import { registerTenantRoutes } from './routes/tenant.routes.js';
import { registerSettingsRoutes } from './routes/settings.routes.js';
import { registerBiRoutes } from './routes/bi.routes.js';
import { registerPublicRoutes } from './routes/public.routes.js';
import { registerHealthRoutes } from './routes/health.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport: process.env['NODE_ENV'] !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  await app.register(cors, { origin: true, credentials: true });

  // Prisma
  const prisma = new PrismaClient();
  await prisma.$connect();
  // Warm-up: prime connection pool to avoid cold-start latency
  await prisma.$queryRawUnsafe('SELECT 1');
  app.log.info('Prisma connected to database (pool primed)');
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    app.log.info('Prisma disconnected from database');
  });

  // Redis (for caching)
  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const redis = new Redis(redisUrl);
  redis.on('error', (err) => app.log.error(err, 'Redis connection error'));
  app.decorate('redis', redis);
  app.addHook('onClose', async () => {
    await redis.quit();
  });

  // Kafka producer
  const kafka = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-tenant-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  try {
    await kafka.connect();
    app.log.info('Kafka producer connected');
  } catch (err) {
    app.log.warn(`Kafka connect failed, events will be unavailable: ${err}`);
  }

  app.decorate('kafka', kafka as any);
  app.addHook('onClose', async () => {
    await kafka.disconnect();
  });

  // Auth hook
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try {
      publicKey = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8');
    } catch { /* key file not found, auth will fail */ }
  }

  const authOptions: AuthHookOptions = { publicKey };
  app.decorate('authHookFn', authHook(authOptions));

  // Services — use local `kafka` variable (StandaloneKafkaProducer) directly
  // to avoid type conflict with @aris/kafka-client FastifyKafka augmentation
  const tenantService = new TenantService(app.prisma, kafka);
  app.decorate('tenantService', tenantService);

  const settingsService = new SettingsService(app.prisma, kafka, redis);
  app.decorate('settingsService', settingsService);

  const biService = new BiService(app.prisma);
  app.decorate('biService', biService);

  // Error handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const message = error.message ?? 'Internal Server Error';

    if (statusCode >= 500) {
      request.log.error(error, 'Unhandled server error');
    }

    return reply.code(statusCode).send({
      statusCode,
      message,
      errors: (error as any).errors ?? undefined,
    });
  });

  // Routes
  await app.register(registerHealthRoutes);
  await app.register(registerTenantRoutes);
  await app.register(registerSettingsRoutes);
  await app.register(registerBiRoutes);
  await app.register(registerPublicRoutes);

  return app;
}
