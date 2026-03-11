import type { PrismaClient } from '@prisma/client';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { CensusService } from './services/census.service.js';
import type { ProductionService } from './services/production.service.js';
import type { SlaughterService } from './services/slaughter.service.js';
import type { TranshumanceService } from './services/transhumance.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    authHookFn: ReturnType<typeof authHook>;
    censusService: CensusService;
    productionService: ProductionService;
    slaughterService: SlaughterService;
    transhumanceService: TranshumanceService;
  }
}
