import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { PrismaClient } from '@prisma/client';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware';
import Redis from 'ioredis';
import { Client as MinioClient } from 'minio';
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';

import { registerFileRoutes } from './routes/files';
import { registerRunRoutes } from './routes/runs';
import { handleFileReceived } from './workers/profiler.worker';
import { handleProfileCompleted } from './workers/matcher.worker';
import { handleMappingConfirmed } from './workers/loader.worker';

const SERVICE_NAME = 'ingest-service';

const MAX_FILE_SIZE = parseInt(process.env['INGEST_MAX_FILE_SIZE'] ?? '104857600', 10); // 100 MB

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      ...(process.env['NODE_ENV'] !== 'production' ? { transport: { target: 'pino-pretty' } } : {}),
    },
  });

  // ── Security ──
  await app.register(cors, {
    origin: (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });
  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_SIZE },
  });

  // ── Auth ──
  const publicKey = process.env['JWT_PUBLIC_KEY']
    ?? (process.env['JWT_PUBLIC_KEY_PATH']
      ? require('fs').readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8')
      : '');
  const authHookFn = authHook({ publicKey });
  app.decorate('authHookFn', authHookFn);

  // ── Prisma ──
  const prisma = new PrismaClient();
  await prisma.$connect();
  await prisma.$queryRawUnsafe('SELECT 1');
  app.log.info('Prisma connected (pool primed)');
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  // ── Kafka ──
  const kafka = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? `aris-${SERVICE_NAME}`,
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });
  try {
    await kafka.connect();
    app.log.info('Kafka producer connected');
  } catch (err) {
    app.log.warn(`Kafka connect failed: ${err}`);
  }
  app.decorate('kafka', kafka as any);
  app.addHook('onClose', async () => {
    await kafka.disconnect();
  });

  // ── Redis ──
  const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
  redis.on('error', (err) => app.log.error(err, 'Redis error'));
  app.decorate('redis', redis);
  app.addHook('onClose', async () => {
    redis.disconnect();
  });

  // ── MinIO ──
  const minio = new MinioClient({
    endPoint: process.env['MINIO_ENDPOINT'] ?? 'localhost',
    port: parseInt(process.env['MINIO_PORT'] ?? '9000', 10),
    useSSL: process.env['MINIO_USE_SSL'] === 'true',
    accessKey: process.env['MINIO_ACCESS_KEY'] ?? process.env['MINIO_ROOT_USER'] ?? 'minioadmin',
    secretKey: process.env['MINIO_SECRET_KEY'] ?? process.env['MINIO_ROOT_PASSWORD'] ?? 'minioadmin',
  });
  app.decorate('minio', minio);

  // ── OpenSearch ──
  const opensearchUrl = process.env['OPENSEARCH_URL'] ?? 'http://localhost:9200';
  const opensearch = new OpenSearchClient({
    node: opensearchUrl,
    ssl: { rejectUnauthorized: process.env['NODE_ENV'] === 'production' },
    ...(process.env['OPENSEARCH_USER'] ? {
      auth: {
        username: process.env['OPENSEARCH_USER'],
        password: process.env['OPENSEARCH_PASSWORD'] ?? '',
      },
    } : {}),
  });
  app.decorate('opensearch', opensearch);

  // ── Health ──
  app.get('/health', async () => ({
    status: 'ok',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
  }));

  // ── Error handler ──
  app.setErrorHandler((error: Error & { statusCode?: number; errors?: unknown[] }, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    app.log.error(error);
    reply.code(statusCode).send({
      statusCode,
      message: error.message,
      errors: error.errors,
    });
  });

  // ── Routes ──
  await app.register(registerFileRoutes);
  await app.register(registerRunRoutes);

  // ── Kafka Consumers ──
  app.addHook('onReady', async () => {
    try {
      const { StandaloneKafkaConsumer } = await import('@aris/kafka-client');
      const consumer = new StandaloneKafkaConsumer({
        clientId: `aris-${SERVICE_NAME}-consumer`,
        brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
      });

      // Worker: file received → profiler
      await consumer.subscribe(
        { topic: 'ingest.file.received.v1', groupId: 'ingest-profiler', fromBeginning: false },
        async (payload: unknown) => {
          const p = payload as Record<string, unknown>;
          app.log.info({ fileId: p.fileId }, 'Profiling file');
          await handleFileReceived(p as any, prisma, kafka, minio);
        },
      );

      // Worker: profile completed → matcher
      await consumer.subscribe(
        { topic: 'ingest.profile.completed.v1', groupId: 'ingest-matcher', fromBeginning: false },
        async (payload: unknown) => {
          const p = payload as Record<string, unknown>;
          app.log.info({ fileId: p.fileId }, 'Matching file');
          await handleProfileCompleted(p as any, prisma, kafka);
        },
      );

      // Worker: mapping confirmed → loader (dry-run or commit)
      await consumer.subscribe(
        { topic: 'ingest.mapping.confirmed.v1', groupId: 'ingest-loader', fromBeginning: false },
        async (payload: unknown) => {
          const p = payload as Record<string, unknown>;
          app.log.info({ fileId: p.fileId, dryRun: p.dryRun }, 'Loading file');
          await handleMappingConfirmed(p as any, prisma, kafka, minio);
        },
      );

      app.log.info('Kafka consumers started (profiler + matcher + loader)');
    } catch (err) {
      app.log.warn(`Kafka consumers failed to start: ${err}`);
    }
  });

  return app;
}
