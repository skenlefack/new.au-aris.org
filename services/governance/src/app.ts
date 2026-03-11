import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware/fastify';
import type { AuthHookOptions } from '@aris/auth-middleware/fastify';
import { LegalFrameworkService } from './services/legal-framework.service.js';
import { CapacityService } from './services/capacity.service.js';
import { PvsEvaluationService } from './services/pvs-evaluation.service.js';
import { StakeholderService } from './services/stakeholder.service.js';
import { registerHealthRoutes } from './routes/health.routes.js';
import { registerLegalFrameworkRoutes } from './routes/legal-framework.routes.js';
import { registerCapacityRoutes } from './routes/capacity.routes.js';
import { registerPvsEvaluationRoutes } from './routes/pvs-evaluation.routes.js';
import { registerStakeholderRoutes } from './routes/stakeholder.routes.js';

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

  // --- Error handler --- maps HttpError.statusCode to HTTP response
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

  // --- Prisma ---
  const prisma = new PrismaClient();
  await prisma.$connect();
  await prisma.$queryRawUnsafe('SELECT 1');
  app.log.info('Prisma connected to database (pool primed)');
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    app.log.info('Prisma disconnected from database');
  });

  // --- Kafka producer ---
  const kafka = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-governance-service',
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

  // --- Auth hook ---
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try {
      publicKey = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8');
    } catch { /* key file not found, auth will fail */ }
  }
  const authOptions: AuthHookOptions = { publicKey };
  app.decorate('authHookFn', authHook(authOptions));

  // --- Services ---
  const legalFrameworkService = new LegalFrameworkService(prisma, kafka);
  const capacityService = new CapacityService(prisma, kafka);
  const pvsEvaluationService = new PvsEvaluationService(prisma, kafka);
  const stakeholderService = new StakeholderService(prisma, kafka);

  app.decorate('legalFrameworkService', legalFrameworkService);
  app.decorate('capacityService', capacityService);
  app.decorate('pvsEvaluationService', pvsEvaluationService);
  app.decorate('stakeholderService', stakeholderService);

  // --- Routes ---
  await app.register(registerHealthRoutes);
  await app.register(registerLegalFrameworkRoutes);
  await app.register(registerCapacityRoutes);
  await app.register(registerPvsEvaluationRoutes);
  await app.register(registerStakeholderRoutes);

  return app;
}
