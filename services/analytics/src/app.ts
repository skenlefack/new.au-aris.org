import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { fastifyKafka } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware';
import type { AuthHookOptions } from '@aris/auth-middleware';
import redisPlugin from './plugins/redis';
import { RedisClient } from './services/redis-client';
import { AggregationService } from './services/aggregation.service';
import { DomainAggregationService } from './services/domain-aggregation.service';
import { HealthKpiService } from './services/health-kpi.service';
import { CrossDomainService } from './services/cross-domain.service';
import { DbStatsService } from './services/db-stats.service';
import { registerConsumers } from './consumers/consumer-registry';
import { registerHealthRoutes } from './routes/health.routes';
import { registerAnalyticsRoutes } from './routes/analytics.routes';
import { IndicatorService } from './indicators/indicator.service';
import { FormulaEvaluator } from './indicators/formula-evaluator';
import { registerIndicatorRoutes } from './indicators/indicator.routes';
import { registerAutoFromFormConsumer } from './indicators/auto-from-form.consumer';
import { registerAutoFromKpiConsumer } from './indicators/auto-from-kpi.consumer';
import { registerCompositeRecomputeConsumer } from './indicators/composite-recompute.consumer';
import { DashboardService } from './dashboards/dashboard.service';
import { WidgetResolver } from './dashboards/widget-resolver';
import { registerDashboardRoutes } from './dashboards/dashboard.routes';
import { ReportService } from './reports/report.service';
import { registerReportRoutes } from './reports/report.routes';
import { registerFlashDetectorConsumer } from './reports/flash-detector';
import { DomainSummaryService } from './domain-summary/domain-summary.service';
import { registerDomainSummaryRoutes } from './domain-summary/domain-summary.routes';

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

  // --- Infrastructure plugins ---
  await app.register(redisPlugin);
  await app.register(fastifyKafka, {
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-analytics-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  // --- Auth hook ---
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try { publicKey = require('fs').readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8'); } catch { /* ignore */ }
  }

  const authOptions: AuthHookOptions = {
    publicKey,
    isTokenBlacklisted: async (token: string) => {
      const result = await app.redis.get(`blacklist:${token}`);
      return result !== null;
    },
  };
  app.decorate('authHookFn', authHook(authOptions));

  // --- Services ---
  const redisClient = new RedisClient(app.redis);
  const aggregationService = new AggregationService(redisClient);
  const domainAggregationService = new DomainAggregationService(redisClient);
  const healthKpiService = new HealthKpiService(redisClient);
  const crossDomainService = new CrossDomainService(redisClient);

  const dbStatsService = new DbStatsService(redisClient);
  const domainSummaryService = new DomainSummaryService(redisClient);

  app.decorate('aggregationService', aggregationService);
  app.decorate('domainAggregationService', domainAggregationService);
  app.decorate('healthKpiService', healthKpiService);
  app.decorate('crossDomainService', crossDomainService);
  app.decorate('dbStatsService', dbStatsService);
  app.decorate('domainSummaryService', domainSummaryService);

  // --- Indicator service ---
  const indicatorService = new IndicatorService(redisClient, app.kafka);
  const formulaEvaluator = new FormulaEvaluator(redisClient, indicatorService);
  app.decorate('indicatorService', indicatorService);
  app.decorate('formulaEvaluator', formulaEvaluator);

  // --- Dashboard builder service ---
  const dashboardService = new DashboardService(redisClient, app.kafka);
  const widgetResolver = new WidgetResolver(redisClient, indicatorService, dashboardService);
  app.decorate('dashboardService', dashboardService);
  app.decorate('widgetResolver', widgetResolver);

  // --- Report service ---
  const reportService = new ReportService(redisClient, app.kafka);
  app.decorate('reportService', reportService);

  // --- Kafka Consumers (12 aggregation + 2 indicator subscriptions + flash detector) ---
  await registerConsumers(app, aggregationService, domainAggregationService);
  await registerAutoFromFormConsumer(app, indicatorService.getPool());
  await registerAutoFromKpiConsumer(app, indicatorService.getPool());
  await registerCompositeRecomputeConsumer(app, indicatorService.getPool(), formulaEvaluator);
  await registerFlashDetectorConsumer(app, reportService.getPool());

  // --- Routes ---
  await app.register(registerHealthRoutes);
  await app.register(registerAnalyticsRoutes);
  await app.register(registerIndicatorRoutes);
  await app.register(registerDashboardRoutes);
  await app.register(registerReportRoutes);
  await app.register(registerDomainSummaryRoutes);

  return app;
}
