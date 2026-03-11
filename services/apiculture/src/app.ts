import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware/fastify';
import type { AuthHookOptions } from '@aris/auth-middleware/fastify';
import prismaPlugin from './plugins/prisma';
import { AuditService } from './services/audit.service';
import { ApiaryService } from './services/apiary.service';
import { ProductionService } from './services/production.service';
import { ColonyHealthService } from './services/colony-health.service';
import { TrainingService } from './services/training.service';
import { registerHealthRoutes } from './routes/health.routes';
import { registerApiaryRoutes } from './routes/apiary.routes';
import { registerProductionRoutes } from './routes/production.routes';
import { registerColonyHealthRoutes } from './routes/colony-health.routes';
import { registerTrainingRoutes } from './routes/training.routes';

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

  // Error handler — maps HttpError.statusCode to HTTP response
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const message = error.message ?? 'Internal Server Error';

    if (statusCode >= 500) {
      request.log.error(error, 'Unhandled server error');
    } else {
      request.log.warn({ statusCode, message, url: request.url }, 'Client error');
    }

    return reply.code(statusCode).send({
      statusCode,
      message,
      errors: (error as any).errors ?? undefined,
    });
  });

  // --- Prisma ---
  await app.register(prismaPlugin);

  // --- Kafka producer ---
  const kafka = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-apiculture-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  try {
    await kafka.connect();
    app.log.info('Kafka producer connected');
  } catch (err) {
    app.log.warn(`Kafka connect failed, events will be unavailable: ${err}`);
  }

  app.decorate('kafkaProducer', kafka);
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
  const audit = new AuditService();
  const apiaryService = new ApiaryService(app.prisma, kafka, audit);
  const productionService = new ProductionService(app.prisma, kafka, audit);
  const colonyHealthService = new ColonyHealthService(app.prisma, kafka, audit);
  const trainingService = new TrainingService(app.prisma, kafka, audit);

  app.decorate('apiaryService', apiaryService);
  app.decorate('productionService', productionService);
  app.decorate('colonyHealthService', colonyHealthService);
  app.decorate('trainingService', trainingService);

  // --- Routes ---
  await app.register(registerHealthRoutes);
  await app.register(registerApiaryRoutes);
  await app.register(registerProductionRoutes);
  await app.register(registerColonyHealthRoutes);
  await app.register(registerTrainingRoutes);

  return app;
}
