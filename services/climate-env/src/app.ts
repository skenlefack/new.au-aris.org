import Fastify, { FastifyInstance, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware/fastify';
import type { AuthHookOptions } from '@aris/auth-middleware/fastify';
import { WaterStressService } from './services/water-stress.service.js';
import { RangelandService } from './services/rangeland.service.js';
import { HotspotService } from './services/hotspot.service.js';
import { ClimateDataService } from './services/climate-data.service.js';
import { registerHealthRoutes } from './routes/health.routes.js';
import { registerWaterStressRoutes } from './routes/water-stress.routes.js';
import { registerRangelandRoutes } from './routes/rangeland.routes.js';
import { registerHotspotRoutes } from './routes/hotspot.routes.js';
import { registerClimateDataRoutes } from './routes/climate-data.routes.js';

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

  // --- Error handler --- maps statusCode on Error to HTTP response
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
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-climate-env-service',
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
  const waterStressService = new WaterStressService(prisma, kafka);
  const rangelandService = new RangelandService(prisma, kafka);
  const hotspotService = new HotspotService(prisma, kafka);
  const climateDataService = new ClimateDataService(prisma, kafka);

  app.decorate('waterStressService', waterStressService);
  app.decorate('rangelandService', rangelandService);
  app.decorate('hotspotService', hotspotService);
  app.decorate('climateDataService', climateDataService);

  // --- Routes ---
  await app.register(registerHealthRoutes);
  await app.register(registerWaterStressRoutes);
  await app.register(registerRangelandRoutes);
  await app.register(registerHotspotRoutes);
  await app.register(registerClimateDataRoutes);

  return app;
}
