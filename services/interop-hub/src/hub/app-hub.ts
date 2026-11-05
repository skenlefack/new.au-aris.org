/**
 * ARIS Interoperability Hub v3 — Fastify app builder.
 *
 * Replaces the legacy app.ts with the unified hub architecture:
 * - Connection management (WAHIS, DHIS2, FHIR, country systems, etc.)
 * - Pipeline engine (inbound + outbound)
 * - Referential + field mappings
 * - Transaction tracking with inbox/outbox (MANUAL mode)
 * - Bilateral data exchange agreements
 * - Scheduling (cron-based)
 * - Dashboard KPIs
 * - Audit trail
 * - Ingest endpoints (push, upload, webhook)
 *
 * Also mounts the LEGACY routes so existing integrations keep working.
 */
import Fastify, { FastifyInstance, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { tracingPlugin } from '@aris/observability';
import { StandaloneKafkaProducer, StandaloneKafkaConsumer } from '@aris/kafka-client';
import {
  TOPIC_AU_WORKFLOW_WAHIS_READY,
  TOPIC_AU_WORKFLOW_ANALYTICS_READY,
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
} from '@aris/shared-types';

// Infrastructure plugins
import prismaPlugin from '../plugins/prisma';
import redisPlugin from '../plugins/redis';
import minioPlugin from '../plugins/minio';

// Legacy services (kept for backward-compat routes)
import { WahisService } from '../services/wahis.service';
import { EmpresService } from '../services/empres.service';
import { FaostatService } from '../services/faostat.service';
import { ConnectorService } from '../services/connector.service';
import { CountryIngestionService } from '../services/country-ingestion.service';
import { ExportSchedulerService } from '../services/export-scheduler.service';

// Legacy routes
import { registerInteropRoutes } from '../routes/interop.routes';
import { registerCountryIngestionRoutes } from '../routes/country-ingestion.routes';

// Hub v3 services
import { HubAuditService } from './audit-service';
import { ConnectionService } from './connection.service';
import { PipelineService } from './pipeline.service';
import { PipelineEngineService } from './pipeline-engine.service';
import { MappingService } from './mapping.service';
import { TransactionService } from './transaction.service';
import { AgreementService } from './agreement.service';
import { NotificationService } from './notification.service';
import { ScheduleService } from './schedule.service';
import { triggerOutboundPipelines } from './outbound-trigger';
import { registerRawJsonParser } from './raw-json-parser';

// Hub v3 routes
import { registerConnectionRoutes } from './routes/connection.routes';
import { registerPipelineRoutes } from './routes/pipeline.routes';
import { registerMappingRoutes } from './routes/mapping.routes';
import { registerTransactionRoutes } from './routes/transaction.routes';
import { registerAgreementRoutes } from './routes/agreement.routes';
import { registerScheduleRoutes } from './routes/schedule.routes';
import { registerDashboardRoutes } from './routes/dashboard.routes';
import { registerAuditRoutes } from './routes/audit.routes';
import { registerIngestRoutes } from './routes/ingest.routes';

export async function buildHubApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport: process.env['NODE_ENV'] !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // ─── Security ──────────────────────────────────────────────
  await app.register(cors, {
    origin: (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000,http://localhost:3100').split(','),
    credentials: true,
  });

  // ─── Multipart (file uploads for ingest + mapping import) ──
  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100 MB max
      files: 1,
    },
  });

  // ─── JSON body parser that keeps the raw body (webhook HMAC check) ──
  registerRawJsonParser(app);

  // ─── Tracing ───────────────────────────────────────────────
  await app.register(tracingPlugin);

  // ─── Infrastructure plugins ────────────────────────────────
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(minioPlugin);

  // ─── Kafka producer ────────────────────────────────────────
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

  // ─── Kafka consumer ────────────────────────────────────────
  const kafkaConsumer = new StandaloneKafkaConsumer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-interop-hub-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  app.addHook('onClose', async () => {
    await kafkaConsumer.disconnectAll();
  });

  // ─── Legacy services ───────────────────────────────────────
  const wahisService = new WahisService(app.prisma, kafkaProducer, app.minio);
  const empresService = new EmpresService(app.prisma, kafkaProducer, app.minio);
  const faostatService = new FaostatService(app.prisma, kafkaProducer, app.minio);
  const connectorService = new ConnectorService(app.prisma);
  const countryIngestionService = new CountryIngestionService(app.prisma, kafkaProducer, app.minio);

  app.decorate('wahisService', wahisService);
  app.decorate('empresService', empresService);
  app.decorate('faostatService', faostatService);
  app.decorate('connectorService', connectorService);
  app.decorate('countryIngestionService', countryIngestionService);

  // Export scheduler (legacy)
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

  // ─── Hub v3 services ───────────────────────────────────────
  const hubAudit = new HubAuditService(app.prisma);
  const connectionService = new ConnectionService(app.prisma, kafkaProducer, app.log);
  const pipelineService = new PipelineService(app.prisma, kafkaProducer, app.log);
  const mappingService = new MappingService(app.prisma, app.log);
  const notificationService = new NotificationService(app.prisma, app.log);
  const pipelineEngine = new PipelineEngineService(
    app.prisma, kafkaProducer, mappingService, notificationService, app.log,
  );
  const transactionService = new TransactionService(
    app.prisma, kafkaProducer, pipelineEngine, app.log,
  );
  const agreementService = new AgreementService(app.prisma, kafkaProducer, app.log);
  const scheduleService = new ScheduleService(
    app.prisma, pipelineEngine, app.log,
  );

  app.decorate('hubAudit', hubAudit);
  app.decorate('hubConnectionService', connectionService);
  app.decorate('hubPipelineService', pipelineService);
  app.decorate('hubMappingService', mappingService);
  app.decorate('hubNotificationService', notificationService);
  app.decorate('hubPipelineEngine', pipelineEngine);
  app.decorate('hubTransactionService', transactionService);
  app.decorate('hubAgreementService', agreementService);
  app.decorate('hubScheduleService', scheduleService);

  // Stop the hub scheduler on shutdown
  app.addHook('onClose', async () => {
    scheduleService.stopScheduler();
  });

  // ─── Error handler ─────────────────────────────────────────
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

  // ─── Health check ──────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    service: 'interop-hub',
    version: 'v3',
    timestamp: new Date().toISOString(),
  }));

  // ─── Legacy routes (backward compatibility) ────────────────
  await app.register(registerInteropRoutes);
  await app.register(registerCountryIngestionRoutes);

  // ─── Hub v3 routes ─────────────────────────────────────────
  await app.register(registerConnectionRoutes);
  await app.register(registerPipelineRoutes);
  await app.register(registerMappingRoutes);
  await app.register(registerTransactionRoutes);
  await app.register(registerAgreementRoutes);
  await app.register(registerScheduleRoutes);
  await app.register(registerDashboardRoutes);
  await app.register(registerAuditRoutes);
  await app.register(registerIngestRoutes);

  // ─── Kafka consumers (set up after server ready) ───────────
  app.addHook('onReady', async () => {
    // Start legacy export scheduler + hub scheduler
    exportScheduler.start();
    scheduleService.startScheduler();

    // Subscribe in the background: each consumer group join takes ~3s, and
    // awaiting them here exceeds Fastify's 10s onReady timeout (crash loop).
    void (async () => {
    try {
      const runOutbound = (
        tenantId: string,
        data: Record<string, unknown>,
        filter: Record<string, unknown>,
      ) => triggerOutboundPipelines(app.prisma as any, pipelineEngine, app.log, tenantId, data, filter);

      // WAHIS-ready events (Level 2 approved) → trigger WAHIS outbound
      await kafkaConsumer.subscribe(
        { topic: TOPIC_AU_WORKFLOW_WAHIS_READY, groupId: 'interop-hub-wahis-ready' },
        async (payload, headers) => {
          const data = payload as Record<string, unknown> | null;
          if (!data) return;
          const tenantId = (headers['tenantId'] ?? data.tenantId ?? data.tenant_id) as string | undefined;
          if (tenantId) {
            await runOutbound(tenantId, data, { connection: { system_type: 'WAHIS' } });
          }
        },
      );

      // Analytics-ready events (Level 4 approved) → trigger FAOSTAT/EMPRES/etc.
      await kafkaConsumer.subscribe(
        { topic: TOPIC_AU_WORKFLOW_ANALYTICS_READY, groupId: 'interop-hub-analytics-ready' },
        async (payload, headers) => {
          const data = payload as Record<string, unknown> | null;
          if (!data) return;
          const tenantId = (headers['tenantId'] ?? data.tenantId ?? data.tenant_id) as string | undefined;
          if (tenantId) {
            await runOutbound(tenantId, data, { connection: { system_type: { not: 'WAHIS' } } });
          }
        },
      );

      // Form submissions → trigger domain-specific outbound
      await kafkaConsumer.subscribe(
        { topic: TOPIC_MS_COLLECTE_FORM_SUBMITTED, groupId: 'interop-hub-form-submitted' },
        async (payload, headers) => {
          const data = payload as Record<string, unknown> | null;
          if (!data) return;
          const tenantId = (headers['tenantId'] ?? data.tenantId ?? data.tenant_id) as string | undefined;
          const domain = data.domain as string | undefined;
          if (tenantId && domain) {
            await runOutbound(tenantId, data, { domain });
          }
        },
      );

      app.log.info('Interop Hub v3 Kafka consumers subscribed');
    } catch (err) {
      app.log.warn(`Failed to subscribe Kafka consumers: ${err}`);
    }
    })();
  });

  return app;
}
