import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import { StandaloneKafkaProducer, StandaloneKafkaConsumer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware';
import type { AuthHookOptions } from '@aris/auth-middleware';
import prismaPlugin from './plugins/prisma';
import redisPlugin from './plugins/redis';
import { ContractService } from './services/contract.service';
import { ComplianceService } from './services/compliance.service';
import { registerContractRoutes } from './routes/contract.routes';
import { registerComplianceConsumers } from './services/compliance.consumer';

export async function buildApp(): Promise<FastifyInstance> {
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

  // Infrastructure plugins
  await app.register(prismaPlugin);
  await app.register(redisPlugin);

  // Kafka producer
  const kafkaProducer = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-data-contract-service',
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
    } catch { /* key file not found, auth will fail */ }
  }
  const authOptions: AuthHookOptions = { publicKey };
  app.decorate('authHookFn', authHook(authOptions));

  // Services
  const contractService = new ContractService(app.prisma, kafkaProducer);
  const complianceService = new ComplianceService(app.prisma, kafkaProducer);

  app.decorate('contractService', contractService);
  app.decorate('complianceService', complianceService);

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'data-contract',
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
  await app.register(registerContractRoutes);

  // Kafka consumers for compliance events
  const kafkaConsumer = new StandaloneKafkaConsumer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-data-contract-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  app.ready().then(() => {
    registerComplianceConsumers(kafkaConsumer, complianceService).catch((err) => {
      app.log.warn(`Kafka compliance consumer start failed: ${err}`);
    });
  });

  // Graceful shutdown: disconnect Kafka producer + consumer
  app.addHook('onClose', async () => {
    await kafkaProducer.disconnect();
    await kafkaConsumer.disconnectAll();
    app.log.info('Kafka producer and consumers disconnected');
  });

  return app;
}
