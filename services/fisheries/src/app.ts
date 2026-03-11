import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware/fastify';
import type { AuthHookOptions } from '@aris/auth-middleware/fastify';
import { CaptureService } from './services/capture.service.js';
import { VesselService } from './services/vessel.service.js';
import { AquacultureFarmService } from './services/aquaculture-farm.service.js';
import { AquacultureProductionService } from './services/aquaculture-production.service.js';
import { registerCaptureRoutes } from './routes/capture.routes.js';
import { registerVesselRoutes } from './routes/vessel.routes.js';
import { registerAquacultureFarmRoutes } from './routes/aquaculture-farm.routes.js';
import { registerAquacultureProductionRoutes } from './routes/aquaculture-production.routes.js';

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
  await app.register(cors, {
    origin: (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000,http://localhost:3100').split(','),
    credentials: true,
  });

  // Error handler — maps HttpError.statusCode to HTTP response
  app.setErrorHandler((error: Error & { statusCode?: number; errors?: unknown[] }, request, reply) => {
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

  // --- Prisma plugin (inline) ---
  const prisma = new PrismaClient();
  await prisma.$connect();
  await prisma.$queryRawUnsafe('SELECT 1');
  app.log.info('Prisma connected to database (pool primed)');
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    app.log.info('Prisma disconnected from database');
  });

  // --- Kafka producer (standalone) ---
  const kafka = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-fisheries-service',
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
    app.log.info('Kafka producer disconnected');
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
  const captureService = new CaptureService(prisma, kafka);
  const vesselService = new VesselService(prisma, kafka);
  const aquacultureFarmService = new AquacultureFarmService(prisma, kafka);
  const aquacultureProductionService = new AquacultureProductionService(prisma, kafka);

  app.decorate('captureService', captureService);
  app.decorate('vesselService', vesselService);
  app.decorate('aquacultureFarmService', aquacultureFarmService);
  app.decorate('aquacultureProductionService', aquacultureProductionService);

  // --- Health check ---
  app.get('/health', async () => ({
    status: 'ok',
    service: 'fisheries',
    timestamp: new Date().toISOString(),
  }));

  // --- Routes ---
  await app.register(registerCaptureRoutes);
  await app.register(registerVesselRoutes);
  await app.register(registerAquacultureFarmRoutes);
  await app.register(registerAquacultureProductionRoutes);

  return app;
}
