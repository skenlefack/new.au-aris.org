/**
 * OpenTelemetry Distributed Tracing — ARIS 4.0
 *
 * IMPORTANT: This module MUST be imported and called BEFORE any other imports
 * in every service's entry point (main.ts / server.ts). The OTel SDK instruments
 * modules at require-time, so it must be initialized first.
 *
 * Usage:
 *   import { initTracing } from '@aris/observability/tracing';
 *   initTracing('tenant', '0.1.0');
 *   // ... then import everything else
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter as OTLPGrpcExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPHttpExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

export interface TracingOptions {
  /** Service name for the resource (e.g. 'tenant', 'collecte') */
  serviceName: string;
  /** Service version (e.g. '0.1.0') */
  version?: string;
  /** Deployment environment — defaults to OTEL_ENVIRONMENT or 'development' */
  environment?: string;
  /** OTLP endpoint — defaults to OTEL_EXPORTER_OTLP_ENDPOINT or 'http://localhost:4318' */
  endpoint?: string;
  /** Transport protocol: 'grpc' | 'http'. Defaults to 'http' */
  protocol?: 'grpc' | 'http';
  /** Enable debug logging for OTel SDK */
  debug?: boolean;
  /** Sampling ratio 0.0–1.0, defaults to OTEL_TRACES_SAMPLER_ARG or 1.0 */
  samplingRatio?: number;
  /** Disable specific instrumentations */
  disableInstrumentations?: {
    http?: boolean;
    fastify?: boolean;
    pg?: boolean;
    ioredis?: boolean;
  };
}

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry distributed tracing.
 *
 * Must be called BEFORE any other module imports in the service entry point.
 * Only initializes once — subsequent calls are no-ops.
 *
 * @param serviceName - Service identifier (e.g. 'tenant', 'collecte')
 * @param version - Service version string
 */
export function initTracing(serviceName: string, version = '0.1.0'): void {
  initTracingWithOptions({ serviceName, version });
}

/**
 * Initialize OpenTelemetry with full options control.
 */
export function initTracingWithOptions(options: TracingOptions): void {
  // Skip if tracing is explicitly disabled
  if (process.env['OTEL_TRACING_DISABLED'] === 'true') {
    return;
  }

  // Only initialize once
  if (sdk) {
    return;
  }

  const {
    serviceName,
    version = '0.1.0',
    environment = process.env['OTEL_ENVIRONMENT'] ?? process.env['NODE_ENV'] ?? 'development',
    endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318',
    protocol = (process.env['OTEL_EXPORTER_OTLP_PROTOCOL'] as 'grpc' | 'http') ?? 'http',
    debug = process.env['OTEL_LOG_LEVEL'] === 'debug',
    samplingRatio = parseFloat(process.env['OTEL_TRACES_SAMPLER_ARG'] ?? '1.0'),
    disableInstrumentations = {},
  } = options;

  if (debug) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  // Build resource attributes
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: `aris-${serviceName}`,
    [ATTR_SERVICE_VERSION]: version,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
  });

  // Configure exporter based on protocol
  const exporter = protocol === 'grpc'
    ? new OTLPGrpcExporter({ url: endpoint })
    : new OTLPHttpExporter({ url: `${endpoint}/v1/traces` });

  // Use BatchSpanProcessor for production, SimpleSpanProcessor for dev/debug
  const spanProcessor = environment === 'production'
    ? new BatchSpanProcessor(exporter, {
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
        scheduledDelayMillis: 5000,
      })
    : new SimpleSpanProcessor(exporter);

  // Collect enabled instrumentations
  const instrumentations = [];

  if (!disableInstrumentations.http) {
    instrumentations.push(
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) => {
          // Don't trace health check / metrics endpoints
          const url = req.url ?? '';
          return url === '/health' || url === '/metrics' || url === '/ready' || url === '/live';
        },
      }),
    );
  }

  if (!disableInstrumentations.fastify) {
    instrumentations.push(new FastifyInstrumentation());
  }

  if (!disableInstrumentations.pg) {
    instrumentations.push(
      new PgInstrumentation({
        enhancedDatabaseReporting: true,
      }),
    );
  }

  if (!disableInstrumentations.ioredis) {
    instrumentations.push(new IORedisInstrumentation());
  }

  sdk = new NodeSDK({
    resource,
    spanProcessors: [spanProcessor as any],
    instrumentations,
    ...(samplingRatio < 1.0 ? {
      sampler: new (require('@opentelemetry/sdk-trace-base').TraceIdRatioBasedSampler)(samplingRatio),
    } : {}),
  });

  sdk.start();

  // Graceful shutdown — flush pending spans
  const shutdownTracing = async () => {
    try {
      await sdk?.shutdown();
    } catch (err) {
      console.error('[OTEL] Error shutting down tracing SDK:', err);
    }
  };
  process.on('SIGTERM', shutdownTracing);
  process.on('SIGINT', shutdownTracing);
}

/**
 * Shutdown the OTel SDK. Used in tests and graceful shutdown.
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}

/**
 * Check if tracing is initialized.
 */
export function isTracingInitialized(): boolean {
  return sdk !== null;
}

// Re-export OTel API for convenience
export { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
export type { Span, Tracer } from '@opentelemetry/api';
