import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import prismaPlugin from './plugins/prisma';
import redisPlugin from './plugins/redis';
import { authHook } from '@aris/auth-middleware';
import type { AuthHookOptions } from '@aris/auth-middleware';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { GeoService } from './services/geo.service';
import { RiskLayerService } from './services/risk-layer.service';
import { registerHealthRoutes } from './routes/health.routes';
import { registerGeoRoutes } from './routes/geo.routes';
import { registerRiskLayerRoutes } from './routes/risk-layer.routes';

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

  // Error handler — catches errors with statusCode property (e.g. 404)
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

  // --- Plugins ---
  await app.register(prismaPlugin);
  await app.register(redisPlugin);

  // --- Auth ---
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try {
      publicKey = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8');
    } catch { /* key file not found, auth will fail */ }
  }
  const authOptions: AuthHookOptions = { publicKey };
  app.decorate('authHookFn', authHook(authOptions));

  // --- Kafka Producer ---
  let kafkaProducer: StandaloneKafkaProducer | null = null;
  try {
    kafkaProducer = new StandaloneKafkaProducer({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-geo-services',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    });
    await kafkaProducer.connect();
    app.log.info('Kafka producer connected');
  } catch (err) {
    app.log.warn(`Kafka producer connect failed (non-fatal): ${err}`);
    kafkaProducer = null;
  }
  app.decorate('kafkaProducer', kafkaProducer);

  app.addHook('onClose', async () => {
    if (kafkaProducer) {
      try { await kafkaProducer.disconnect(); } catch { /* ignore */ }
    }
  });

  // --- Services ---
  const geoService = new GeoService(app.prisma, app.redis);
  app.decorate('geoService', geoService);

  const riskLayerService = new RiskLayerService(app.prisma, app.redis, kafkaProducer);
  app.decorate('riskLayerService', riskLayerService);

  // --- Routes ---
  await app.register(registerHealthRoutes);
  await app.register(registerGeoRoutes);
  await app.register(registerRiskLayerRoutes);

  return app;
}
