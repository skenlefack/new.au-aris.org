import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { fastifyKafka } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware/fastify';
import type { AuthHookOptions } from '@aris/auth-middleware/fastify';
import { I18nService } from '@aris/i18n';
import { AuthService } from './services/auth.service.js';
import { UserService } from './services/user.service.js';
import { MfaService } from './services/mfa.service.js';
import { AccountLockoutService } from './services/account-lockout.service.js';
import { registerAuthRoutes } from './routes/auth.routes.js';
import { registerUserRoutes } from './routes/user.routes.js';
import { registerMfaRoutes } from './routes/mfa.routes.js';
import { registerI18nRoutes } from './routes/i18n.routes.js';
import { registerHealthRoutes } from './routes/health.routes.js';

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

  // --- Prisma plugin (inline) ---
  const prisma = new PrismaClient();
  await prisma.$connect();
  // Warm-up: prime connection pool to avoid cold-start latency
  await prisma.$queryRawUnsafe('SELECT 1');
  app.log.info('Prisma connected to database (pool primed)');
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    app.log.info('Prisma disconnected from database');
  });

  // --- Redis plugin (inline) ---
  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const redis = new Redis(redisUrl);
  redis.on('error', (err) => app.log.error(err, 'Redis connection error'));
  app.decorate('redis', redis);
  app.addHook('onClose', async () => {
    await redis.quit();
  });

  // --- Kafka plugin ---
  await app.register(fastifyKafka, {
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-credential-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  // --- Auth plugin (inline) ---
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try {
      publicKey = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8');
    } catch { /* key file not found, auth will fail */ }
  }
  const authOptions: AuthHookOptions = { publicKey };
  app.decorate('authHookFn', authHook(authOptions));

  // Services
  const lockout = new AccountLockoutService(app.redis);
  const authService = new AuthService(app.prisma, app.redis, app.kafka, lockout);
  const userService = new UserService(app.prisma);
  const mfaService = new MfaService(app.prisma);
  const i18n = new I18nService();

  app.decorate('authService', authService);
  app.decorate('userService', userService);
  app.decorate('mfaService', mfaService);
  app.decorate('i18n', i18n);

  // Routes
  await app.register(registerHealthRoutes);
  await app.register(registerAuthRoutes);
  await app.register(registerUserRoutes);
  await app.register(registerMfaRoutes);
  await app.register(registerI18nRoutes);

  return app;
}
