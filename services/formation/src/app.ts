import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { authHook } from '@aris/auth-middleware/fastify';
import type { AuthHookOptions } from '@aris/auth-middleware/fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { FormationService } from './services/formation.service';
import { registerHealthRoutes } from './routes/health.routes';
import { registerFormationRoutes } from './routes/formation.routes';

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
  app.setErrorHandler((error, request, reply) => {
    const statusCode = (error as any).statusCode ?? 500;
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

  // --- Infrastructure ---
  const prisma = new PrismaClient();
  await prisma.$connect();
  app.decorate('prisma', prisma);

  const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
  await redis.connect();
  app.decorate('redis', redis);

  const kafka = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-formation-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });
  try {
    await kafka.connect();
  } catch (err) {
    app.log.warn(`Kafka connect failed, events will be unavailable: ${err}`);
  }
  app.decorate('kafka', kafka);

  // --- Auth hook ---
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try { publicKey = require('fs').readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8'); } catch {}
  }

  const authOptions: AuthHookOptions = {
    publicKey,
    isTokenBlacklisted: async (token: string) => {
      const result = await redis.get(`blacklist:${token}`);
      return result !== null;
    },
  };
  app.decorate('authHookFn', authHook(authOptions));

  // --- Services ---
  const formationService = new FormationService(prisma, redis, kafka);
  app.decorate('formationService', formationService);

  // --- Routes ---
  await app.register(registerHealthRoutes);
  await app.register(registerFormationRoutes);

  // --- Graceful shutdown ---
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    await redis.quit();
    await kafka.disconnect();
  });

  return app;
}
