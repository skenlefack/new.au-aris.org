import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { ProgrammeService } from '../services/programme.service';
import type { ActivityService } from '../services/activity.service';
import type { BudgetService } from '../services/budget.service';
import type { IndicatorService } from '../services/indicator.service';
import type { ReportingService } from '../services/reporting.service';
import type { RiskService } from '../services/risk.service';
import type { DashboardService } from '../services/dashboard.service';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    kafka: StandaloneKafkaProducer;
    authHookFn: ReturnType<typeof authHook>;
    programmeService: ProgrammeService;
    activityService: ActivityService;
    budgetService: BudgetService;
    indicatorService: IndicatorService;
    reportingService: ReportingService;
    riskService: RiskService;
    dashboardService: DashboardService;
  }
}
