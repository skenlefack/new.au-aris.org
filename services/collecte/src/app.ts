import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { fastifyKafka } from '@aris/kafka-client';
import prismaPlugin from './plugins/prisma';
import campaignRoutes from './routes/campaigns';
import submissionRoutes from './routes/submissions';
import syncRoutes from './routes/sync';
import workflowRoutes from './routes/workflow';
import { WorkflowCronService } from './services/workflow-cron.service';

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
  await app.register(helmet);

  // Plugins
  await app.register(prismaPlugin);
  await app.register(fastifyKafka, {
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-collecte-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'collecte',
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
  await app.register(campaignRoutes);
  await app.register(submissionRoutes);
  await app.register(syncRoutes);
  await app.register(workflowRoutes);

  // Start workflow cron jobs after server is ready
  app.addHook('onReady', async () => {
    const cronService = new WorkflowCronService(app.prisma, app.kafka.producer);
    cronService.start();

    // Stop cron on app close
    app.addHook('onClose', async () => {
      cronService.stop();
    });
  });

  return app;
}
