import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware';
import type { AuthHookOptions } from '@aris/auth-middleware';
import prismaPlugin from './plugins/prisma';
import { AgreementService } from './services/agreement.service';
import { AccessLogService } from './services/access-log.service';
import { DashboardService } from './services/dashboard.service';
import { registerAgreementRoutes } from './routes/agreement.routes';
import { registerDashboardRoutes } from './routes/dashboard.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000,http://localhost:3100').split(','),
    credentials: true,
  });

  await app.register(prismaPlugin);

  // Kafka producer
  const kafkaProducer = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-data-sharing-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  try {
    await kafkaProducer.connect();
    app.log.info('Kafka producer connected');
  } catch (err) {
    app.log.warn(`Kafka producer connect failed, events will be unavailable: ${err}`);
  }

  app.decorate('kafka', kafkaProducer);

  // Auth hook
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try {
      publicKey = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8');
    } catch {
      /* key file not found, auth will fail */
    }
  }
  const authOptions: AuthHookOptions = { publicKey };
  app.decorate('authHookFn', authHook(authOptions));

  // Services
  const accessLogService = new AccessLogService(app.prisma, kafkaProducer);
  const agreementService = new AgreementService(app.prisma, kafkaProducer, accessLogService);
  const dashboardService = new DashboardService(app.prisma);

  app.decorate('agreementService', agreementService);
  app.decorate('accessLogService', accessLogService);
  app.decorate('dashboardService', dashboardService);

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'data-sharing',
    timestamp: new Date().toISOString(),
  }));

  // Error handler
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
  await app.register(registerAgreementRoutes);
  await app.register(registerDashboardRoutes);

  // Graceful shutdown: disconnect Kafka producer
  app.addHook('onClose', async () => {
    await kafkaProducer.disconnect();
    app.log.info('Kafka producer disconnected');
  });

  return app;
}
