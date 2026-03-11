import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock OTel API — factory MUST NOT reference top-level variables (vitest hoisting)
vi.mock('@opentelemetry/api', () => ({
  trace: {
    getSpan: vi.fn().mockReturnValue({
      spanContext: vi.fn().mockReturnValue({
        traceId: 'a1b2c3d4e5f67890a1b2c3d4e5f67890',
        spanId: 'f1e2d3c4b5a69870',
      }),
    }),
  },
  context: {
    active: vi.fn().mockReturnValue({}),
  },
}));

// We need to mock NestJS since the logger uses @Injectable
vi.mock('@nestjs/common', () => ({
  Injectable: () => (target: any) => target,
  Scope: { TRANSIENT: 'TRANSIENT' },
  LoggerService: class {},
}));

import { StructuredLogger } from '../logging/structured-logger';
import { trace as otelTrace } from '@opentelemetry/api';

describe('StructuredLogger tracing integration', () => {
  let logger: StructuredLogger;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-establish mock return value after clearAllMocks
    (otelTrace.getSpan as any).mockReturnValue({
      spanContext: vi.fn().mockReturnValue({
        traceId: 'a1b2c3d4e5f67890a1b2c3d4e5f67890',
        spanId: 'f1e2d3c4b5a69870',
      }),
    });

    logger = new StructuredLogger();
    logger.setServiceName('test-service');
    logger.setContext('TestContext');

    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    StructuredLogger.currentCorrelationId = '';
  });

  it('should include traceId in log output', () => {
    logger.log('Test message');

    expect(stdoutSpy).toHaveBeenCalled();
    const output = stdoutSpy.mock.calls[0]![0] as string;
    const entry = JSON.parse(output);

    expect(entry.traceId).toBe('a1b2c3d4e5f67890a1b2c3d4e5f67890');
  });

  it('should include spanId in log output', () => {
    logger.log('Test message');

    const output = stdoutSpy.mock.calls[0]![0] as string;
    const entry = JSON.parse(output);

    expect(entry.spanId).toBe('f1e2d3c4b5a69870');
  });

  it('should include both correlationId and traceId', () => {
    StructuredLogger.setCorrelationId('corr-123');
    logger.log('Test message');

    const output = stdoutSpy.mock.calls[0]![0] as string;
    const entry = JSON.parse(output);

    expect(entry.correlationId).toBe('corr-123');
    expect(entry.traceId).toBe('a1b2c3d4e5f67890a1b2c3d4e5f67890');
    expect(entry.spanId).toBe('f1e2d3c4b5a69870');
  });

  it('should include traceId in error logs', () => {
    logger.error('Error occurred', 'stack trace');

    const output = stderrSpy.mock.calls[0]![0] as string;
    const entry = JSON.parse(output);

    expect(entry.traceId).toBe('a1b2c3d4e5f67890a1b2c3d4e5f67890');
    expect(entry.level).toBe('error');
  });

  it('should include traceId in warn logs', () => {
    logger.warn('Warning');

    const output = stdoutSpy.mock.calls[0]![0] as string;
    const entry = JSON.parse(output);

    expect(entry.traceId).toBe('a1b2c3d4e5f67890a1b2c3d4e5f67890');
    expect(entry.level).toBe('warn');
  });

  it('should handle missing active span gracefully', () => {
    (otelTrace.getSpan as any).mockReturnValueOnce(undefined);

    logger.log('No span message');

    const output = stdoutSpy.mock.calls[0]![0] as string;
    const entry = JSON.parse(output);

    expect(entry.traceId).toBeUndefined();
    expect(entry.spanId).toBeUndefined();
    expect(entry.message).toBe('No span message');
  });

  it('should preserve service name and context alongside trace data', () => {
    logger.log('Full context test');

    const output = stdoutSpy.mock.calls[0]![0] as string;
    const entry = JSON.parse(output);

    expect(entry.service).toBe('test-service');
    expect(entry.context).toBe('TestContext');
    expect(entry.traceId).toBe('a1b2c3d4e5f67890a1b2c3d4e5f67890');
  });
});
