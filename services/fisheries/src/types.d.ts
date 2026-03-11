import type { PrismaClient } from '@prisma/client';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { CaptureService } from './services/capture.service.js';
import type { VesselService } from './services/vessel.service.js';
import type { AquacultureFarmService } from './services/aquaculture-farm.service.js';
import type { AquacultureProductionService } from './services/aquaculture-production.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    authHookFn: ReturnType<typeof authHook>;
    captureService: CaptureService;
    vesselService: VesselService;
    aquacultureFarmService: AquacultureFarmService;
    aquacultureProductionService: AquacultureProductionService;
  }
}
