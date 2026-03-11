import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { fastifyKafka } from '@aris/kafka-client';
import prismaPlugin from './plugins/prisma';
import templateRoutes from './routes/templates';
import submissionRoutes from './routes/submissions';
import overlayRoutes from './routes/overlays';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport: process.env['NODE_ENV'] !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // Security
  await app.register(cors, {
    origin: (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000,http://localhost:3100').split(','),
    credentials: true,
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  // Plugins
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max
  await app.register(prismaPlugin);
  await app.register(fastifyKafka, {
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-form-builder-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'form-builder',
    timestamp: new Date().toISOString(),
  }));

  // Error handler — maps HttpError.statusCode to HTTP response
  app.setErrorHandler((error: Error & { statusCode?: number; errors?: unknown[] }, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    reply.code(statusCode).send({
      statusCode,
      message: error.message,
      errors: error.errors,
    });
  });

  // Routes
  await app.register(templateRoutes);
  await app.register(submissionRoutes);
  await app.register(overlayRoutes);

  return app;
}
