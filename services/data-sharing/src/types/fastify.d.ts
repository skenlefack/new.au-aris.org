import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { onRequestHookHandler } from 'fastify';
import type { AgreementService } from '../services/agreement.service';
import type { AccessLogService } from '../services/access-log.service';
import type { DashboardService } from '../services/dashboard.service';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    kafka: StandaloneKafkaProducer;
    authHookFn: onRequestHookHandler;
    agreementService: AgreementService;
    accessLogService: AccessLogService;
    dashboardService: DashboardService;
  }
}
