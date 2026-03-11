import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { authHook } from '@aris/auth-middleware';
import type { AuthHookOptions } from '@aris/auth-middleware';
import Redis from 'ioredis';
import { Client } from '@opensearch-project/opensearch';
import { StandaloneKafkaProducer, StandaloneKafkaConsumer } from '@aris/kafka-client';
import prismaPlugin from './plugins/prisma';
import { DatalakeService } from './services/datalake.service';
import { HistoricalDataService } from './services/historical-data.service';
import { IngestionService } from './services/ingestion.service';
import { QueryEngineService } from './services/query-engine.service';
import { ExportService } from './services/export.service';
import { PartitionService } from './services/partition.service';
import { MinioStorage } from './services/minio.storage';
import { createDomainEventHandler } from './consumers/domain-event.consumer';
import { registerHealthRoutes } from './routes/health.routes';
import { registerDatalakeRoutes } from './routes/datalake.routes';
import { registerHistoricalRoutes } from './routes/historical.routes';
import { registerOlapRoutes } from './routes/olap.routes';


const SERVICE_NAME = 'datalake-service';

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

  // Multipart file upload (50 MB limit)
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: 1,
    },
  });

  // --- Error handler: convert HttpError instances to proper HTTP responses ---
  app.setErrorHandler((error: Error & { statusCode?: number; errors?: unknown[] }, request, reply) => {
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
      errors: error.errors ?? undefined,
    });
  });

  // --- Infrastructure ---

  // Prisma (PostgreSQL via PgBouncer)
  await app.register(prismaPlugin);

  // Redis
  const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
  await redis.connect();
  app.decorate('redis', redis);

  // OpenSearch
  const elastic = new Client({
    node: process.env['OPENSEARCH_URL'] ?? 'http://localhost:9200',
    ssl: { rejectUnauthorized: process.env['NODE_ENV'] === 'production' },
  });
  app.decorate('elastic', elastic);

  // Kafka Producer
  const kafka = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-datalake-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });
  try {
    await kafka.connect();
  } catch (err) {
    app.log.warn(`Kafka producer connect failed, events will be unavailable: ${err}`);
  }
  app.decorate('kafkaProducer', kafka);

  // Kafka Consumer — consumes domain events to index into OpenSearch
  const kafkaConsumer = new StandaloneKafkaConsumer({
    clientId: `${process.env['KAFKA_CLIENT_ID'] ?? 'aris-datalake-service'}-consumer`,
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  // Subscribe to domain events for indexing
  const domainTopics = (process.env['DATALAKE_CONSUME_TOPICS'] ?? '').split(',').filter(Boolean);
  for (const topic of domainTopics) {
    try {
      await kafkaConsumer.subscribe(
        {
          topic: topic.trim(),
          groupId: `${SERVICE_NAME}-indexer`,
          fromBeginning: false,
        },
        async (payload, headers) => {
          try {
            const indexName = headers['sourceService']
              ? `aris-${headers['sourceService'].replace('-service', '')}`
              : 'aris-events';
            await elastic.index({
              index: indexName,
              body: {
                ...((payload && typeof payload === 'object') ? payload : { raw: payload }),
                _ingested_at: new Date().toISOString(),
                _source_service: headers['sourceService'],
                _tenant_id: headers['tenantId'],
                _correlation_id: headers['correlationId'],
              },
            });
          } catch (indexErr) {
            app.log.error(`Failed to index event from topic ${topic}: ${indexErr}`);
          }
        },
      );
      app.log.info(`Subscribed to topic ${topic} for OpenSearch indexing`);
    } catch (subErr) {
      app.log.warn(`Failed to subscribe to topic ${topic}: ${subErr}`);
    }
  }
  app.decorate('kafkaConsumer', kafkaConsumer);

  // --- Auth hook ---
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try { publicKey = require('fs').readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8'); } catch {}
  }

  const authOptions: AuthHookOptions = {
    publicKey,
    isTokenBlacklisted: async (token: string) => {
      const result = await redis.get(`blacklist:${token}`);
      return result !== null;
    },
  };
  app.decorate('authHookFn', authHook(authOptions));

  // --- Services ---
  const datalakeService = new DatalakeService(elastic, redis, kafka);
  app.decorate('datalakeService', datalakeService);

  const historicalDataService = new HistoricalDataService(app.prisma, redis, kafka);
  app.decorate('historicalDataService', historicalDataService);

  // --- OLAP Services ---
  const minioStorage = new MinioStorage();
  app.decorate('minioStorage', minioStorage);

  const ingestionService = new IngestionService(app.prisma, elastic, redis, kafka);
  app.decorate('ingestionService', ingestionService);

  const queryEngine = new QueryEngineService(app.prisma);
  app.decorate('queryEngine', queryEngine);

  const exportService = new ExportService(app.prisma, queryEngine, minioStorage, kafka);
  app.decorate('exportService', exportService);

  const partitionService = new PartitionService(app.prisma, minioStorage, kafka);
  app.decorate('partitionService', partitionService);

  // --- Routes ---
  await app.register(registerHealthRoutes);
  await app.register(registerDatalakeRoutes);
  await app.register(registerHistoricalRoutes);
  await app.register(registerOlapRoutes);

  // --- OLAP Kafka Consumer (separate consumer group for OLAP ingestion) ---
  const olapTopics = (process.env['DATALAKE_OLAP_TOPICS'] ?? '').split(',').filter(Boolean);
  if (olapTopics.length > 0) {
    const olapConsumer = new StandaloneKafkaConsumer({
      clientId: `${process.env['KAFKA_CLIENT_ID'] ?? 'aris-datalake-service'}-olap`,
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    });

    const domainEventHandler = createDomainEventHandler(app, ingestionService);

    for (const topic of olapTopics) {
      try {
        await olapConsumer.subscribe(
          {
            topic: topic.trim(),
            groupId: `${SERVICE_NAME}-olap-ingester`,
            fromBeginning: false,
          },
          async (payload, headers, raw) => {
            // Inject topic name into headers for the handler
            const enrichedHeaders = { ...headers, topic: topic.trim() };
            await domainEventHandler(payload, enrichedHeaders, raw);
          },
        );
        app.log.info(`OLAP consumer subscribed to topic ${topic}`);
      } catch (subErr) {
        app.log.warn(`OLAP consumer failed to subscribe to topic ${topic}: ${subErr}`);
      }
    }

    // Ensure OLAP consumer disconnects on shutdown
    app.addHook('onClose', async () => {
      await olapConsumer.disconnect();
    });
  }

  // --- Graceful shutdown ---
  app.addHook('onClose', async () => {
    await redis.quit();
    await kafka.disconnect();
    await kafkaConsumer.disconnect();
    await elastic.close();
  });

  return app;
}
