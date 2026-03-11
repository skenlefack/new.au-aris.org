import Fastify, { FastifyInstance, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { tracingPlugin } from '@aris/observability';
import { StandaloneKafkaProducer, StandaloneKafkaConsumer } from '@aris/kafka-client';
import {
  TOPIC_AU_WORKFLOW_WAHIS_READY,
  TOPIC_AU_WORKFLOW_ANALYTICS_READY,
} from '@aris/shared-types';
import prismaPlugin from './plugins/prisma';
import redisPlugin from './plugins/redis';
import minioPlugin from './plugins/minio';
import { WahisService } from './services/wahis.service';
import { EmpresService } from './services/empres.service';
import { FaostatService } from './services/faostat.service';
import { ConnectorService } from './services/connector.service';
import { ExportSchedulerService } from './services/export-scheduler.service';
import { registerInteropRoutes } from './routes/interop.routes';

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

  // OpenTelemetry log-trace correlation (injects traceId/spanId into Pino logs)
  await app.register(tracingPlugin);

  // Infrastructure plugins
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(minioPlugin);

  // Kafka producer
  const kafkaProducer = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-interop-hub-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  try {
    await kafkaProducer.connect();
    app.log.info('Kafka producer connected');
  } catch (err) {
    app.log.warn(`Kafka producer connect failed, events will be unavailable: ${err}`);
  }

  app.decorate('kafka', kafkaProducer as any);
  app.addHook('onClose', async () => {
    await kafkaProducer.disconnect();
  });

  // Kafka consumer
  const kafkaConsumer = new StandaloneKafkaConsumer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-interop-hub-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  app.addHook('onClose', async () => {
    await kafkaConsumer.disconnectAll();
  });

  // Services — pass MinIO for file storage
  const wahisService = new WahisService(app.prisma, kafkaProducer, app.minio);
  const empresService = new EmpresService(app.prisma, kafkaProducer, app.minio);
  const faostatService = new FaostatService(app.prisma, kafkaProducer, app.minio);
  const connectorService = new ConnectorService(app.prisma);

  app.decorate('wahisService', wahisService);
  app.decorate('empresService', empresService);
  app.decorate('faostatService', faostatService);
  app.decorate('connectorService', connectorService);

  // Export scheduler
  const exportScheduler = new ExportSchedulerService(
    app.prisma,
    wahisService,
    empresService,
    app.log,
  );
  app.decorate('exportScheduler', exportScheduler);

  app.addHook('onClose', async () => {
    exportScheduler.stop();
  });

  // Error handler -- maps HttpError.statusCode to HTTP response
  app.setErrorHandler((error: FastifyError, request, reply) => {
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

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'interop-hub',
    timestamp: new Date().toISOString(),
  }));

  // Routes
  await app.register(registerInteropRoutes);

  // Set up Kafka consumers and scheduler after server is ready
  app.addHook('onReady', async () => {
    // Start export scheduler
    exportScheduler.start();

    try {
      // Subscribe to WAHIS-ready events (Level 2 approved workflow instances)
      await kafkaConsumer.subscribe(
        { topic: TOPIC_AU_WORKFLOW_WAHIS_READY, groupId: 'interop-hub-wahis-ready' },
        async (payload, headers) => {
          const data = payload as Record<string, unknown> | null;
          if (!data) return;

          const instanceId = data.id ?? data.instanceId ?? data.instance_id;
          const tenantId = headers['tenantId'] ?? (data.tenantId as string | undefined) ?? (data.tenant_id as string | undefined);

          app.log.info(
            `WAHIS-ready event received: instance=${instanceId as string} tenant=${tenantId as string}`,
          );
        },
      );

      // Subscribe to analytics-ready events (Level 4 approved workflow instances)
      await kafkaConsumer.subscribe(
        { topic: TOPIC_AU_WORKFLOW_ANALYTICS_READY, groupId: 'interop-hub-analytics-ready' },
        async (payload, headers) => {
          const data = payload as Record<string, unknown> | null;
          if (!data) return;

          const instanceId = data.id ?? data.instanceId ?? data.instance_id;
          const tenantId = headers['tenantId'] ?? (data.tenantId as string | undefined) ?? (data.tenant_id as string | undefined);

          app.log.info(
            `Analytics-ready event received: instance=${instanceId as string} tenant=${tenantId as string}`,
          );
        },
      );

      app.log.info('Interop-hub Kafka consumers subscribed to topics');
    } catch (err) {
      app.log.warn(`Failed to subscribe Kafka consumers: ${err}`);
    }
  });

  return app;
}
