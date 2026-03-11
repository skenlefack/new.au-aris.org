import type { authHook } from '@aris/auth-middleware';
import type { GeoService } from '../services/geo.service';
import type { RiskLayerService } from '../services/risk-layer.service';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';

declare module 'fastify' {
  interface FastifyInstance {
    authHookFn: ReturnType<typeof authHook>;
    geoService: GeoService;
    riskLayerService: RiskLayerService;
    kafkaProducer: StandaloneKafkaProducer | null;
  }
}
