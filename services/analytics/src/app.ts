import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { fastifyKafka } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware';
import type { AuthHookOptions } from '@aris/auth-middleware';
import redisPlugin from './plugins/redis';
import { RedisClient } from './services/redis-client';
import { AggregationService } from './services/aggregation.service';
import { DomainAggregationService } from './services/domain-aggregation.service';
import { HealthKpiService } from './services/health-kpi.service';
import { CrossDomainService } from './services/cross-domain.service';
import { registerConsumers } from './consumers/consumer-registry';
import { registerHealthRoutes } from './routes/health.routes';
import { registerAnalyticsRoutes } from './routes/analytics.routes';

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
  app.setErrorHandler((error: Error & { statusCode?: number; errors?: unknown[] }, request, reply) => {
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
      errors: error.errors ?? undefined,
    });
  });

  // --- Infrastructure plugins ---
  await app.register(redisPlugin);
  await app.register(fastifyKafka, {
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-analytics-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  // --- Auth hook ---
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try { publicKey = require('fs').readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8'); } catch { /* ignore */ }
  }

  const authOptions: AuthHookOptions = {
    publicKey,
    isTokenBlacklisted: async (token: string) => {
      const result = await app.redis.get(`blacklist:${token}`);
      return result !== null;
    },
  };
  app.decorate('authHookFn', authHook(authOptions));

  // --- Services ---
  const redisClient = new RedisClient(app.redis);
  const aggregationService = new AggregationService(redisClient);
  const domainAggregationService = new DomainAggregationService(redisClient);
  const healthKpiService = new HealthKpiService(redisClient);
  const crossDomainService = new CrossDomainService(redisClient);

  app.decorate('aggregationService', aggregationService);
  app.decorate('domainAggregationService', domainAggregationService);
  app.decorate('healthKpiService', healthKpiService);
  app.decorate('crossDomainService', crossDomainService);

  // --- Kafka Consumers (12 subscriptions) ---
  await registerConsumers(app, aggregationService, domainAggregationService);

  // --- Routes ---
  await app.register(registerHealthRoutes);
  await app.register(registerAnalyticsRoutes);

  return app;
}
