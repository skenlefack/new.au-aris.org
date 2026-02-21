// Metrics
export {
  PrometheusModule,
  PROMETHEUS_OPTIONS,
} from './metrics/prometheus.module';
export type { PrometheusModuleOptions } from './metrics/prometheus.module';
export { HttpMetricsInterceptor } from './metrics/http-metrics.interceptor';
export { KafkaMetricsService } from './metrics/kafka-metrics.service';
export { BusinessMetricsService } from './metrics/business-metrics.service';

// Health
export {
  HealthModule,
  PostgresHealthIndicator,
  RedisHealthIndicator,
  KafkaHealthIndicator,
  HEALTH_OPTIONS,
} from './health/health.module';
export type { HealthModuleOptions } from './health/health.module';

// Logging
export { StructuredLogger } from './logging/structured-logger';
export type { StructuredLogEntry } from './logging/structured-logger';

// Tracing
export {
  CorrelationMiddleware,
  CORRELATION_HEADER,
} from './tracing/correlation.middleware';
