import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { WaterStressService } from './services/water-stress.service.js';
import type { RangelandService } from './services/rangeland.service.js';
import type { HotspotService } from './services/hotspot.service.js';
import type { ClimateDataService } from './services/climate-data.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    kafka: StandaloneKafkaProducer;
    authHookFn: ReturnType<typeof authHook>;
    waterStressService: WaterStressService;
    rangelandService: RangelandService;
    hotspotService: HotspotService;
    climateDataService: ClimateDataService;
  }
}
