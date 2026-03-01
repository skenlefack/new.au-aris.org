import Fastify from 'fastify';
import cors from '@fastify/cors';
import prismaPlugin from './plugins/prisma';
import kafkaPlugin from './plugins/kafka';
import authPlugin from './plugins/auth';
import schedulerPlugin from './plugins/scheduler';
import kafkaConsumersPlugin from './plugins/kafka-consumers';
import { registerNotificationRoutes } from './routes/notification.routes';
import { registerPreferencesRoutes } from './routes/preferences.routes';

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
    origin: (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000').split(','),
    credentials: true,
  });

  // Infrastructure plugins
  await app.register(prismaPlugin);
  await app.register(kafkaPlugin);
  await app.register(authPlugin);

  // Services + scheduler (decorates app.notificationService, app.preferencesService)
  await app.register(schedulerPlugin);

  // Kafka consumers (subscribes on app.ready)
  await app.register(kafkaConsumersPlugin);

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'message',
    timestamp: new Date().toISOString(),
  }));

  // Error handler -- maps HttpError.statusCode to HTTP response
  app.setErrorHandler((error, request, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    const message = error.message ?? 'Internal Server Error';

    if (statusCode >= 500) {
      request.log.error(error, 'Unhandled server error');
    }

    return reply.code(statusCode).send({
      statusCode,
      message,
      errors: (error as { errors?: unknown[] }).errors,
    });
  });

  // Routes
  await app.register(registerNotificationRoutes);
  await app.register(registerPreferencesRoutes);

  return app;
}
