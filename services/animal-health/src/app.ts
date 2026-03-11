import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware/fastify';
import type { AuthHookOptions } from '@aris/auth-middleware/fastify';
import { HealthEventService } from './services/health-event.service.js';
import { LabResultService } from './services/lab-result.service.js';
import { SurveillanceService } from './services/surveillance.service.js';
import { VaccinationService } from './services/vaccination.service.js';
import { CapacityService } from './services/capacity.service.js';
import { WorkflowFlagConsumer } from './consumers/workflow-flag.consumer.js';
import { registerHealthEventRoutes } from './routes/health-event.routes.js';
import { registerLabResultRoutes } from './routes/lab-result.routes.js';
import { registerSurveillanceRoutes } from './routes/surveillance.routes.js';
import { registerVaccinationRoutes } from './routes/vaccination.routes.js';
import { registerCapacityRoutes } from './routes/capacity.routes.js';

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

  // Error handler
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
    clientId: 'aris-animal-health-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });
  await kafka.connect();
  app.log.info('Kafka producer connected');
  app.decorate('kafka', kafka as any);
  app.addHook('onClose', async () => {
    await kafka.disconnect();
    app.log.info('Kafka producer disconnected');
  });

  // --- Auth ---
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try {
      publicKey = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8');
    } catch { /* key file not found, auth will fail */ }
  }
  const authOptions: AuthHookOptions = { publicKey };
  app.decorate('authHookFn', authHook(authOptions));

  // --- Health check ---
  app.get('/health', async () => ({
    status: 'ok',
    service: 'animal-health',
    timestamp: new Date().toISOString(),
  }));

  // --- Services ---
  const healthEventService = new HealthEventService(prisma, kafka);
  const labResultService = new LabResultService(prisma, kafka);
  const surveillanceService = new SurveillanceService(prisma, kafka);
  const vaccinationService = new VaccinationService(prisma, kafka);
  const capacityService = new CapacityService(prisma, kafka);

  app.decorate('healthEventService', healthEventService);
  app.decorate('labResultService', labResultService);
  app.decorate('surveillanceService', surveillanceService);
  app.decorate('vaccinationService', vaccinationService);
  app.decorate('capacityService', capacityService);

  // --- Routes ---
  await app.register(registerHealthEventRoutes);
  await app.register(registerLabResultRoutes);
  await app.register(registerSurveillanceRoutes);
  await app.register(registerVaccinationRoutes);
  await app.register(registerCapacityRoutes);

  // --- Kafka consumers ---
  const workflowConsumer = new WorkflowFlagConsumer(prisma);
  workflowConsumer.start().catch((err) => {
    app.log.warn(`Workflow flag consumer failed to start: ${err instanceof Error ? err.message : String(err)}`);
  });
  app.addHook('onClose', async () => {
    await workflowConsumer.stop();
  });

  return app;
}
