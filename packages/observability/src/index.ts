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

// Tracing — Correlation (NestJS middleware)
export {
  CorrelationMiddleware,
  CORRELATION_HEADER,
} from './tracing/correlation.middleware';

// Tracing — OpenTelemetry Distributed Tracing
export {
  initTracing,
  initTracingWithOptions,
  shutdownTracing,
  isTracingInitialized,
  trace,
  context,
  SpanStatusCode,
  SpanKind,
} from './tracing/init-tracing';
export type {
  TracingOptions,
  Span,
  Tracer,
} from './tracing/init-tracing';

// Tracing — Fastify Plugin (log-trace correlation)
export { tracingPlugin } from './tracing/fastify-tracing.plugin';
