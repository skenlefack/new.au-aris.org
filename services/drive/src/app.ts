import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { fastifyKafka } from '@aris/kafka-client';
import prismaPlugin from './plugins/prisma';
import multipartPlugin from './plugins/multipart';
import fileRoutes from './routes/files';

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
  await app.register(prismaPlugin);
  await app.register(multipartPlugin);
  await app.register(fastifyKafka, {
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-drive-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'drive',
    timestamp: new Date().toISOString(),
  }));

  // Error handler — maps HttpError.statusCode to HTTP response
  app.setErrorHandler((error, _request, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    reply.code(statusCode).send({
      statusCode,
      message: error.message,
      errors: (error as { errors?: unknown[] }).errors,
    });
  });

  // Routes
  await app.register(fileRoutes);

  return app;
}
