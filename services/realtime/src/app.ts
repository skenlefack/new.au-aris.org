import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import authPlugin from './plugins/auth.plugin';
import websocketPlugin from './plugins/websocket';
import kafkaConsumersPlugin from './plugins/kafka-consumers';
import { RoomManagerService } from './services/room-manager.service';
import { PresenceService } from './services/presence.service';
import { registerHealthRoutes } from './routes/health';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport: process.env['NODE_ENV'] !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // Security / CORS
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: (process.env['CORS_ORIGINS'] || 'http://localhost:3000').split(','),
    credentials: true,
  });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    const statusCode = (error as any).statusCode ?? 500;
    const message = error.message ?? 'Internal Server Error';

    if (statusCode >= 500) {
      request.log.error(error, 'Unhandled server error');
    }

    return reply.code(statusCode).send({
      statusCode,
      message,
      errors: (error as any).errors ?? undefined,
    });
  });

  // Services (plain classes, no decorators)
  const roomManager = new RoomManagerService();
  const presenceService = new PresenceService();

  app.decorate('roomManager', roomManager);
  app.decorate('presenceService', presenceService);

  // Auth plugin (JWT public key for Socket.IO and HTTP route guards)
  await app.register(authPlugin);

  // Socket.IO mounted on Fastify's http.Server
  await app.register(websocketPlugin);

  // Kafka consumers (subscribe to 7 topics, broadcast to rooms via Socket.IO)
  await app.register(kafkaConsumersPlugin);

  // HTTP routes (health, ready, stats)
  await app.register(registerHealthRoutes);

  // Presence cleanup every 15 minutes
  const presenceCleanupInterval = setInterval(() => {
    presenceService.cleanup();
  }, 15 * 60 * 1000);

  // Graceful shutdown
  app.addHook('onClose', async () => {
    clearInterval(presenceCleanupInterval);
  });

  return app;
}
