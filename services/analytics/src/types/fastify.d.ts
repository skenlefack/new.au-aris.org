import type { authHook } from '@aris/auth-middleware';
import type { HealthKpiService } from '../services/health-kpi.service';
import type { CrossDomainService } from '../services/cross-domain.service';
import type { AggregationService } from '../services/aggregation.service';
import type { DomainAggregationService } from '../services/domain-aggregation.service';

declare module 'fastify' {
  interface FastifyInstance {
    authHookFn: ReturnType<typeof authHook>;
    healthKpiService: HealthKpiService;
    crossDomainService: CrossDomainService;
    aggregationService: AggregationService;
    domainAggregationService: DomainAggregationService;
  }
}
