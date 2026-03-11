import Fastify from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import { StandaloneKafkaProducer, StandaloneKafkaConsumer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware';
import type { AuthHookOptions } from '@aris/auth-middleware';
import prismaPlugin from './plugins/prisma';
import redisPlugin from './plugins/redis';
import { EngineService } from './services/engine.service';
import { ValidateService } from './services/validate.service';
import { RuleService } from './services/rule.service';
import { ReportService } from './services/report.service';
import { DashboardService } from './services/dashboard.service';
import { CorrectionService } from './services/correction.service';
import { registerQualityRoutes } from './routes/quality.routes';

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
    origin: (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000').split(','),
    credentials: true,
  });

  // Plugins
  await app.register(prismaPlugin);
  await app.register(redisPlugin);

  // Kafka producer
  const kafka = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-data-quality-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  try {
    await kafka.connect();
    app.log.info('Kafka producer connected');
  } catch (err) {
    app.log.warn(`Kafka producer connect failed, events will be unavailable: ${err}`);
  }

  app.decorate('kafka', kafka);

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
  const engineService = new EngineService(app.prisma);
  const validateService = new ValidateService(app.prisma, engineService, kafka);
  const ruleService = new RuleService(app.prisma);
  const reportService = new ReportService(app.prisma);
  const dashboardService = new DashboardService(app.prisma);
  const correctionService = new CorrectionService(app.prisma, kafka);

  app.decorate('engineService', engineService);
  app.decorate('validateService', validateService);
  app.decorate('ruleService', ruleService);
  app.decorate('reportService', reportService);
  app.decorate('dashboardService', dashboardService);
  app.decorate('correctionService', correctionService);

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'data-quality',
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
  await app.register(registerQualityRoutes);

  // Correction cron via setInterval (every 10 minutes)
  let correctionInterval: ReturnType<typeof setInterval> | undefined;

  app.addHook('onReady', async () => {
    correctionInterval = setInterval(async () => {
      try {
        await correctionService.handleOverdueCorrections();
      } catch (err) {
        app.log.error(err, 'Correction cron failed');
      }
    }, 10 * 60 * 1000);

    app.log.info('Correction cron started (every 10 minutes)');
  });

  // Kafka consumer for validation requests
  const kafkaConsumer = new StandaloneKafkaConsumer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-data-quality-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  app.addHook('onReady', async () => {
    try {
      await kafkaConsumer.subscribe(
        {
          topic: 'au.quality.validation.requested.v1',
          groupId: 'data-quality-validation-request-consumer',
        },
        async (payload: unknown) => {
          const event = payload as {
            recordId: string;
            entityType: string;
            domain: string;
            record: Record<string, unknown>;
            requiredFields?: string[];
            temporalPairs?: [string, string][];
            geoFields?: string[];
            unitFields?: string[];
            auditFields?: string[];
            codeFields?: Record<string, string>;
            confidenceLevelField?: string;
            confidenceEvidenceFields?: string[];
            dedupFields?: string[];
            dataContractId?: string;
            tenantId?: string;
            userId?: string;
          };

          // Build a synthetic AuthenticatedUser from the event metadata
          const user = {
            userId: event.userId ?? '00000000-0000-0000-0000-000000000000',
            tenantId: event.tenantId ?? '',
            role: 'SYSTEM' as const,
            tenantLevel: 'CONTINENTAL' as const,
            email: 'system@au-aris.org',
          };

          try {
            await validateService.validate(
              {
                recordId: event.recordId,
                entityType: event.entityType,
                domain: event.domain,
                record: event.record,
                ...(event.requiredFields && { requiredFields: event.requiredFields }),
                ...(event.temporalPairs && { temporalPairs: event.temporalPairs }),
                ...(event.geoFields && { geoFields: event.geoFields }),
                ...(event.unitFields && { unitFields: event.unitFields }),
                ...(event.auditFields && { auditFields: event.auditFields }),
                ...(event.codeFields && { codeFields: event.codeFields }),
                ...(event.confidenceLevelField && { confidenceLevelField: event.confidenceLevelField }),
                ...(event.confidenceEvidenceFields && { confidenceEvidenceFields: event.confidenceEvidenceFields }),
                ...(event.dedupFields && { dedupFields: event.dedupFields }),
                ...(event.dataContractId && { dataContractId: event.dataContractId }),
              },
              user as never,
            );
          } catch (err) {
            app.log.error(err, `Failed to process validation request for record ${event.recordId}`);
          }
        },
      );
      app.log.info('Subscribed to au.quality.validation.requested.v1');
    } catch (err) {
      app.log.warn(`Kafka consumer not available -- async validation disabled: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // Cleanup on close
  app.addHook('onClose', async () => {
    if (correctionInterval) {
      clearInterval(correctionInterval);
      app.log.info('Correction cron stopped');
    }
    await kafka.disconnect();
    app.log.info('Kafka producer disconnected');
    try {
      await kafkaConsumer.disconnect();
      app.log.info('Kafka consumer disconnected');
    } catch {
      // consumer may not have been connected
    }
  });

  return app;
}
