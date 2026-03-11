import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { LegalFrameworkService } from '../services/legal-framework.service';
import type { CapacityService } from '../services/capacity.service';
import type { PvsEvaluationService } from '../services/pvs-evaluation.service';
import type { StakeholderService } from '../services/stakeholder.service';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    kafka: StandaloneKafkaProducer;
    authHookFn: ReturnType<typeof authHook>;
    legalFrameworkService: LegalFrameworkService;
    capacityService: CapacityService;
    pvsEvaluationService: PvsEvaluationService;
    stakeholderService: StakeholderService;
  }
}
