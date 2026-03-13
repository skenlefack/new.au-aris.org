import Fastify, { FastifyInstance, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware/fastify';
import type { AuthHookOptions } from '@aris/auth-middleware/fastify';
import { AuditService } from './services/audit.service.js';
import { InventoryService } from './services/inventory.service.js';
import { ProtectedAreaService } from './services/protected-area.service.js';
import { CitesPermitService } from './services/cites-permit.service.js';
import { CrimeService } from './services/crime.service.js';
import { registerInventoryRoutes } from './routes/inventory.routes.js';
import { registerProtectedAreaRoutes } from './routes/protected-area.routes.js';
import { registerCitesPermitRoutes } from './routes/cites-permit.routes.js';
import { registerCrimeRoutes } from './routes/crime.routes.js';

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
  await prisma.$queryRawUnsafe('SELECT 1');
  app.log.info('Prisma connected to database (pool primed)');
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    app.log.info('Prisma disconnected from database');
  });

  // Kafka producer
  const kafka = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-wildlife-service',
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

  // Services
  const audit = new AuditService();
  const inventoryService = new InventoryService(prisma, kafka, audit);
  const protectedAreaService = new ProtectedAreaService(prisma, kafka, audit);
  const citesPermitService = new CitesPermitService(prisma, kafka, audit);
  const crimeService = new CrimeService(prisma, kafka, audit);

  app.decorate('inventoryService', inventoryService);
  app.decorate('protectedAreaService', protectedAreaService);
  app.decorate('citesPermitService', citesPermitService);
  app.decorate('crimeService', crimeService);

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

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'wildlife',
    timestamp: new Date().toISOString(),
  }));

  // Routes
  await app.register(registerInventoryRoutes);
  await app.register(registerProtectedAreaRoutes);
  await app.register(registerCitesPermitRoutes);
  await app.register(registerCrimeRoutes);

  return app;
}
