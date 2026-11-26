import type { PrismaClient } from '@prisma/client';
import type { onRequestHookHandler } from 'fastify';
import type { VeilleService } from '../services/veille.service';
import type { ScannerService } from '../services/scanner.service';
import type { AiEnrichmentService } from '../services/ai.service';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    authHookFn: onRequestHookHandler;
    veilleService: VeilleService;
    scanner: ScannerService;
    ai: AiEnrichmentService;
  }
}
