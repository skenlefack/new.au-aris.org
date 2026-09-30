import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware/fastify';
import type { AuthHookOptions } from '@aris/auth-middleware/fastify';
import { ProgrammeService } from './services/programme.service.js';
import { ActivityService } from './services/activity.service.js';
import { BudgetService } from './services/budget.service.js';
import { IndicatorService } from './services/indicator.service.js';
import { ReportingService } from './services/reporting.service.js';
import { RiskService } from './services/risk.service.js';
import { DashboardService } from './services/dashboard.service.js';
import { registerHealthRoutes } from './routes/health.routes.js';
import { registerProgrammeRoutes } from './routes/programme.routes.js';
import { registerActivityRoutes } from './routes/activity.routes.js';
import { registerBudgetRoutes } from './routes/budget.routes.js';
import { registerIndicatorRoutes } from './routes/indicator.routes.js';
import { registerReportingRoutes } from './routes/reporting.routes.js';
import { registerDashboardRoutes } from './routes/dashboard.routes.js';
import { registerRiskTeamRoutes } from './routes/risk-team.routes.js';

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

  // Error handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;
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

  // --- Prisma ---
  const prisma = new PrismaClient();
  await prisma.$connect();
  await prisma.$queryRawUnsafe('SELECT 1');
  app.log.info('Prisma connected to database (pool primed)');
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    app.log.info('Prisma disconnected from database');
  });

  // --- Kafka producer ---
  const kafka = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-programme-monitoring-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  try {
    await kafka.connect();
    app.log.info('Kafka producer connected');
  } catch (err) {
    app.log.warn(`Kafka connect failed, events will be unavailable: ${err}`);
  }

  app.decorate('kafka', kafka as any);
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
  const programmeService = new ProgrammeService(prisma, kafka);
  const activityService = new ActivityService(prisma, kafka);
  const budgetService = new BudgetService(prisma, kafka);
  const indicatorService = new IndicatorService(prisma, kafka);
  const reportingService = new ReportingService(prisma, kafka);
  const riskService = new RiskService(prisma, kafka);
  const dashboardService = new DashboardService(prisma, kafka);

  app.decorate('programmeService', programmeService);
  app.decorate('activityService', activityService);
  app.decorate('budgetService', budgetService);
  app.decorate('indicatorService', indicatorService);
  app.decorate('reportingService', reportingService);
  app.decorate('riskService', riskService);
  app.decorate('dashboardService', dashboardService);

  // --- Routes ---
  await app.register(registerHealthRoutes);
  await app.register(registerProgrammeRoutes);
  await app.register(registerActivityRoutes);
  await app.register(registerBudgetRoutes);
  await app.register(registerIndicatorRoutes);
  await app.register(registerReportingRoutes);
  await app.register(registerDashboardRoutes);
  await app.register(registerRiskTeamRoutes);

  return app;
}
