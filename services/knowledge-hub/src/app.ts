import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware';
import type { AuthHookOptions } from '@aris/auth-middleware';
import { CategoryService } from './services/category.service';
import { PublicationService } from './services/publication.service';
import { SearchService } from './services/search.service';
import { ElearningService } from './services/elearning.service';
import { registerHealthRoutes } from './routes/health.routes';
import { registerCategoryRoutes } from './routes/category.routes';
import { registerPublicationRoutes } from './routes/publication.routes';
import { registerSearchRoutes } from './routes/search.routes';
import { registerElearningRoutes } from './routes/elearning.routes';

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
  const searchService = new SearchService(prisma);
  // Best-effort: set up the OpenSearch index in the background so service
  // boot doesn't block on cluster availability.
  searchService.ensureIndex().catch((err) =>
    app.log.warn(`SearchService.ensureIndex failed (will retry on first use): ${err}`),
  );
  const categoryService = new CategoryService(prisma, kafka);
  const publicationService = new PublicationService(prisma, kafka, categoryService, searchService);
  const elearningService = new ElearningService(prisma, kafka);

  app.decorate('categoryService', categoryService);
  app.decorate('publicationService', publicationService);
  app.decorate('searchService', searchService);
  app.decorate('elearningService', elearningService);

  // --- Routes ---
  await app.register(registerHealthRoutes);
  await app.register(registerCategoryRoutes);
  await app.register(registerPublicationRoutes);
  await app.register(registerSearchRoutes);
  await app.register(registerElearningRoutes);

  return app;
}
