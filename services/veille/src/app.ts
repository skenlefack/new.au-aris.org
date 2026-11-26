import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware';
import prismaPlugin from './plugins/prisma';
import { VeilleService } from './services/veille.service';
import { ScannerService } from './services/scanner.service';
import { AiEnrichmentService } from './services/ai.service';
import { registerVeilleRoutes } from './routes/veille.routes';

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

  const kafkaProducer = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-veille-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });
  try {
    await kafkaProducer.connect();
    app.log.info('Kafka producer connected');
  } catch (err) {
    app.log.warn(`Kafka producer connect failed, events will be unavailable: ${err}`);
  }

  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try {
      publicKey = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8');
    } catch {
      /* key file not found, auth will fail */
    }
  }
  app.decorate('authHookFn', authHook({ publicKey }));

  const ai = new AiEnrichmentService(app.prisma, app.log);
  const scanner = new ScannerService(app.prisma, kafkaProducer, ai, app.log);
  app.decorate('ai', ai);
  app.decorate('scanner', scanner);
  app.decorate('veilleService', new VeilleService(app.prisma));

  app.get('/health', async () => ({ status: 'ok', service: 'veille', ai: ai.isEnabled, timestamp: new Date().toISOString() }));

  app.setErrorHandler((error, request, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    if (statusCode >= 500) request.log.error(error, 'Unhandled server error');
    return reply.code(statusCode).send({
      statusCode,
      message: statusCode >= 500 ? 'Internal Server Error' : (error as Error).message,
      errors: (error as { errors?: unknown[] }).errors,
    });
  });

  await app.register(registerVeilleRoutes);

  if (process.env['VEILLE_SCANNER'] !== '0') {
    app.addHook('onReady', async () => scanner.start());
  }
  app.addHook('onClose', async () => {
    scanner.stop();
    await kafkaProducer.disconnect();
  });

  return app;
}
