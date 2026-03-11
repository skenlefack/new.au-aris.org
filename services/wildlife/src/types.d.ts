import type { PrismaClient } from '@prisma/client';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { InventoryService } from './services/inventory.service.js';
import type { ProtectedAreaService } from './services/protected-area.service.js';
import type { CitesPermitService } from './services/cites-permit.service.js';
import type { CrimeService } from './services/crime.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    authHookFn: ReturnType<typeof authHook>;
    inventoryService: InventoryService;
    protectedAreaService: ProtectedAreaService;
    citesPermitService: CitesPermitService;
    crimeService: CrimeService;
  }
}
