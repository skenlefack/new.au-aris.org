import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { fastifyKafka } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware';
import type { AuthHookOptions } from '@aris/auth-middleware';
import prismaPlugin from './plugins/prisma';
import redisPlugin from './plugins/redis';
import { OfflineService } from './services/offline.service';
import { registerHealthRoutes } from './routes/health.routes';
import { registerOfflineRoutes } from './routes/offline.routes';

declare module 'fastify' {
  interface FastifyInstance {
    offlineService: OfflineService;
    authHookFn: ReturnType<typeof authHook>;
  }
}

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
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(fastifyKafka, {
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-offline-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  // --- Auth hook ---
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try { publicKey = require('fs').readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8'); } catch {}
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
  const offlineService = new OfflineService(app.prisma, app.redis, app.kafka.producer);
  app.decorate('offlineService', offlineService);

  // --- Routes ---
  await app.register(registerHealthRoutes);
  await app.register(registerOfflineRoutes);

  return app;
}
