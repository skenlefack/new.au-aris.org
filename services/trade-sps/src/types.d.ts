import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { AuditService } from './services/audit.service.js';
import type { TradeFlowService } from './services/trade-flow.service.js';
import type { SpsCertificateService } from './services/sps-certificate.service.js';
import type { MarketPriceService } from './services/market-price.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    kafka: StandaloneKafkaProducer;
    authHookFn: ReturnType<typeof authHook>;
    auditService: AuditService;
    tradeFlowService: TradeFlowService;
    spsCertificateService: SpsCertificateService;
    marketPriceService: MarketPriceService;
  }
}
