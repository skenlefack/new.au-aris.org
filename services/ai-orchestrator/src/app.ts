import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { fastifyKafka } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware';
import type { AuthHookOptions, AuthenticatedUser } from '@aris/auth-middleware';
import redisPlugin from './plugins/redis';
import { OllamaClient } from './clients/ollama.client';
import { MlClient } from './clients/ml.client';
import { RateLimiter } from './services/rate-limiter';
import { UsageLogger } from './services/usage-logger';
import { PromptCache } from './services/prompt-cache';
import { registerHealthRoutes } from './routes/health.routes';
import { registerNlpRoutes } from './routes/nlp.routes';
import { registerGenerationRoutes } from './routes/generation.routes';
import { registerPredictionRoutes } from './routes/predictions.routes';
import { registerAnomalyRoutes } from './routes/anomalies.routes';
import { registerSpatialRoutes } from './routes/spatial.routes';
import { registerInteropRoutes } from './routes/interop.routes';
import { registerCodeRoutes } from './routes/code.routes';

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
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-ai-orchestrator',
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

  // --- AI Clients ---
  const ollamaClient = new OllamaClient(process.env['OLLAMA_URL']);
  const mlClient = new MlClient(process.env['ML_SERVICE_URL']);
  app.decorate('ollamaClient', ollamaClient);
  app.decorate('mlClient', mlClient);

  // --- Services ---
  const rateLimiter = new RateLimiter(app.redis);
  const usageLogger = new UsageLogger(app.redis);
  const promptCache = new PromptCache(app.redis);
  app.decorate('rateLimiter', rateLimiter);
  app.decorate('usageLogger', usageLogger);
  app.decorate('promptCache', promptCache);

  // --- Rate-limit preHandler hook ---
  const rateLimitHook = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user as AuthenticatedUser | undefined;
    if (!user?.userId) return; // unauthenticated requests handled by authHook

    const { allowed, remaining, retryAfterMs } = await rateLimiter.check(user.userId);
    reply.header('X-RateLimit-Remaining', remaining.toString());

    if (!allowed) {
      reply.header('Retry-After', Math.ceil(retryAfterMs / 1000).toString());
      throw Object.assign(new Error('AI rate limit exceeded. Max 20 requests per minute.'), {
        statusCode: 429,
      });
    }
  };
  app.decorate('rateLimitHook', rateLimitHook);

  // --- Routes ---
  await app.register(registerHealthRoutes);
  await app.register(registerNlpRoutes);
  await app.register(registerGenerationRoutes);
  await app.register(registerPredictionRoutes);
  await app.register(registerAnomalyRoutes);
  await app.register(registerSpatialRoutes);
  await app.register(registerInteropRoutes);
  await app.register(registerCodeRoutes);

  return app;
}
