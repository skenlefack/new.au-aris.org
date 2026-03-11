import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the OTel SDK and exporters — factory MUST NOT reference top-level variables
vi.mock('@opentelemetry/sdk-node', () => {
  return {
    NodeSDK: vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

vi.mock('@opentelemetry/exporter-trace-otlp-grpc', () => ({
  OTLPTraceExporter: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/sdk-trace-base', () => ({
  BatchSpanProcessor: vi.fn().mockImplementation(() => ({})),
  SimpleSpanProcessor: vi.fn().mockImplementation(() => ({})),
  TraceIdRatioBasedSampler: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/instrumentation-http', () => ({
  HttpInstrumentation: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/instrumentation-fastify', () => ({
  FastifyInstrumentation: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/instrumentation-pg', () => ({
  PgInstrumentation: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/instrumentation-ioredis', () => ({
  IORedisInstrumentation: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/resources', () => ({
  Resource: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/api', () => ({
  diag: { setLogger: vi.fn() },
  DiagConsoleLogger: vi.fn(),
  DiagLogLevel: { DEBUG: 1 },
  trace: { getSpan: vi.fn() },
  context: { active: vi.fn() },
  SpanStatusCode: { ERROR: 2, OK: 0 },
  SpanKind: { INTERNAL: 0 },
}));

// Import after mocks are set up
import {
  initTracing,
  initTracingWithOptions,
  shutdownTracing,
  isTracingInitialized,
} from '../tracing/init-tracing';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SimpleSpanProcessor, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter as OTLPHttpExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as OTLPGrpcExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';

describe('initTracing', () => {
  beforeEach(async () => {
    // Reset the internal SDK state between tests
    await shutdownTracing();
    vi.clearAllMocks();
    delete process.env['OTEL_TRACING_DISABLED'];
    delete process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    delete process.env['OTEL_EXPORTER_OTLP_PROTOCOL'];
    delete process.env['OTEL_ENVIRONMENT'];
    delete process.env['OTEL_LOG_LEVEL'];
    delete process.env['OTEL_TRACES_SAMPLER_ARG'];
  });

  afterEach(async () => {
    await shutdownTracing();
  });

  it('should initialize the OTel SDK with service name', () => {
    initTracing('tenant', '0.1.0');

    expect(NodeSDK).toHaveBeenCalledTimes(1);
    expect(isTracingInitialized()).toBe(true);
  });

  it('should only initialize once (subsequent calls are no-ops)', () => {
    initTracing('tenant', '0.1.0');
    initTracing('tenant', '0.1.0');
    initTracing('tenant', '0.1.0');

    expect(NodeSDK).toHaveBeenCalledTimes(1);
  });

  it('should call sdk.start()', () => {
    initTracing('collecte', '0.2.0');

    const sdkInstance = (NodeSDK as any).mock.results[0].value;
    expect(sdkInstance.start).toHaveBeenCalledTimes(1);
  });

  it('should skip initialization when OTEL_TRACING_DISABLED=true', () => {
    process.env['OTEL_TRACING_DISABLED'] = 'true';

    initTracing('tenant');

    expect(NodeSDK).not.toHaveBeenCalled();
    expect(isTracingInitialized()).toBe(false);
  });

  it('should use HTTP OTLP exporter by default', () => {
    initTracing('tenant');

    expect(OTLPHttpExporter).toHaveBeenCalled();
    expect(OTLPGrpcExporter).not.toHaveBeenCalled();
  });

  it('should use gRPC OTLP exporter when protocol=grpc', () => {
    initTracingWithOptions({
      serviceName: 'tenant',
      protocol: 'grpc',
    });

    expect(OTLPGrpcExporter).toHaveBeenCalled();
  });

  it('should use SimpleSpanProcessor in development', () => {
    initTracingWithOptions({
      serviceName: 'tenant',
      environment: 'development',
    });

    expect(SimpleSpanProcessor).toHaveBeenCalled();
    expect(BatchSpanProcessor).not.toHaveBeenCalled();
  });

  it('should use BatchSpanProcessor in production', () => {
    initTracingWithOptions({
      serviceName: 'tenant',
      environment: 'production',
    });

    expect(BatchSpanProcessor).toHaveBeenCalled();
    expect(SimpleSpanProcessor).not.toHaveBeenCalled();
  });

  it('should use custom endpoint from options', () => {
    initTracingWithOptions({
      serviceName: 'tenant',
      endpoint: 'http://jaeger:4318',
    });

    expect(OTLPHttpExporter).toHaveBeenCalledWith({
      url: 'http://jaeger:4318/v1/traces',
    });
  });

  it('should read endpoint from OTEL_EXPORTER_OTLP_ENDPOINT env var', () => {
    process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://custom-jaeger:4318';

    initTracing('tenant');

    expect(OTLPHttpExporter).toHaveBeenCalledWith({
      url: 'http://custom-jaeger:4318/v1/traces',
    });
  });

  it('should shutdown cleanly', async () => {
    initTracing('tenant');
    expect(isTracingInitialized()).toBe(true);

    await shutdownTracing();

    expect(isTracingInitialized()).toBe(false);
    const sdkInstance = (NodeSDK as any).mock.results[0].value;
    expect(sdkInstance.shutdown).toHaveBeenCalledTimes(1);
  });

  it('should be safe to call shutdownTracing when not initialized', async () => {
    await expect(shutdownTracing()).resolves.not.toThrow();
  });

  it('should prefix service name with aris-', () => {
    initTracing('workflow');

    expect(Resource).toHaveBeenCalledWith(
      expect.objectContaining({
        'service.name': 'aris-workflow',
      }),
    );
  });

  it('should default version to 0.1.0', () => {
    initTracing('tenant');

    expect(Resource).toHaveBeenCalledWith(
      expect.objectContaining({
        'service.version': '0.1.0',
      }),
    );
  });
});
