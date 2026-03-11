import type { PrismaClient } from '@prisma/client';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { HealthEventService } from './services/health-event.service.js';
import type { LabResultService } from './services/lab-result.service.js';
import type { SurveillanceService } from './services/surveillance.service.js';
import type { VaccinationService } from './services/vaccination.service.js';
import type { CapacityService } from './services/capacity.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    authHookFn: ReturnType<typeof authHook>;
    healthEventService: HealthEventService;
    labResultService: LabResultService;
    surveillanceService: SurveillanceService;
    vaccinationService: VaccinationService;
    capacityService: CapacityService;
  }
}
