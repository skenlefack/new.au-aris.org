import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { authHook } from '@aris/auth-middleware';
import type { ValidateService } from '../services/validate.service';
import type { EngineService } from '../services/engine.service';
import type { RuleService } from '../services/rule.service';
import type { ReportService } from '../services/report.service';
import type { DashboardService } from '../services/dashboard.service';
import type { CorrectionService } from '../services/correction.service';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    kafka: StandaloneKafkaProducer;
    authHookFn: ReturnType<typeof authHook>;
    validateService: ValidateService;
    engineService: EngineService;
    ruleService: RuleService;
    reportService: ReportService;
    dashboardService: DashboardService;
    correctionService: CorrectionService;
  }
}
