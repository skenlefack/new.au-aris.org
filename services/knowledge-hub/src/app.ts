import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware';
import type { AuthHookOptions } from '@aris/auth-middleware';
import { PublicationService } from './services/publication.service';
import { ELearningService } from './services/elearning.service';
import { FaqService } from './services/faq.service';
import { registerHealthRoutes } from './routes/health.routes';
import { registerPublicationRoutes } from './routes/publication.routes';
import { registerELearningRoutes } from './routes/elearning.routes';
import { registerFaqRoutes } from './routes/faq.routes';

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

  // --- Error handler --- maps statusCode on Error to HTTP response
  app.setErrorHandler((error: FastifyError, request, reply) => {
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
      errors: (error as any).errors ?? undefined,
    });
  });

  // --- Prisma ---
  const prisma = new PrismaClient();
  await prisma.$connect();
  app.log.info('Prisma connected to database');
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    app.log.info('Prisma disconnected from database');
  });

  // --- Kafka producer ---
  const kafka = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-knowledge-hub-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  try {
    await kafka.connect();
    app.log.info('Kafka producer connected');
  } catch (err) {
    app.log.warn(`Kafka connect failed, events will be unavailable: ${err}`);
  }

  app.addHook('onClose', async () => {
    await kafka.disconnect();
  });

  // --- Auth hook ---
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try {
      publicKey = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8');
    } catch { /* key file not found, auth will fail */ }
  }
  const authOptions: AuthHookOptions = { publicKey };
  app.decorate('authHookFn', authHook(authOptions));

  // --- Services ---
  const publicationService = new PublicationService(prisma, kafka);
  const elearningService = new ELearningService(prisma, kafka);
  const faqService = new FaqService(prisma, kafka);

  app.decorate('publicationService', publicationService);
  app.decorate('elearningService', elearningService);
  app.decorate('faqService', faqService);

  // --- Routes ---
  await app.register(registerHealthRoutes);
  await app.register(registerPublicationRoutes);
  await app.register(registerELearningRoutes);
  await app.register(registerFaqRoutes);

  return app;
}
