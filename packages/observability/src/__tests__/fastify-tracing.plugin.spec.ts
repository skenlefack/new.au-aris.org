import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OTel API — factory MUST NOT reference top-level variables (vitest hoisting)
vi.mock('@opentelemetry/api', () => ({
  trace: {
    getSpan: vi.fn().mockReturnValue({
      spanContext: vi.fn().mockReturnValue({
        traceId: 'abc123def456789012345678abcdef01',
        spanId: '0123456789abcdef',
        traceFlags: 1,
      }),
      recordException: vi.fn(),
      setStatus: vi.fn(),
    }),
  },
  context: {
    active: vi.fn().mockReturnValue({}),
  },
  SpanStatusCode: { ERROR: 2, OK: 0 },
}));

// Mock fastify-plugin to just pass through the function
vi.mock('fastify-plugin', () => ({
  default: vi.fn((fn: any) => fn),
}));

import { tracingPlugin } from '../tracing/fastify-tracing.plugin';
import { trace } from '@opentelemetry/api';

describe('tracingPlugin', () => {
  let fastifyMock: any;
  let hooks: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    hooks = {};
    fastifyMock = {
      addHook: vi.fn((name: string, handler: Function) => {
        hooks[name] = handler;
      }),
    };

    // Reset mock return values after clearAllMocks
    const mockSpan = {
      spanContext: vi.fn().mockReturnValue({
        traceId: 'abc123def456789012345678abcdef01',
        spanId: '0123456789abcdef',
        traceFlags: 1,
      }),
      recordException: vi.fn(),
      setStatus: vi.fn(),
    };
    (trace.getSpan as any).mockReturnValue(mockSpan);
  });

  it('should register onRequest and onError hooks', () => {
    const done = vi.fn();
    (tracingPlugin as any)(fastifyMock, {}, done);

    expect(fastifyMock.addHook).toHaveBeenCalledWith('onRequest', expect.any(Function));
    expect(fastifyMock.addHook).toHaveBeenCalledWith('onError', expect.any(Function));
    expect(done).toHaveBeenCalled();
  });

  it('should inject traceId and spanId into request', async () => {
    const done = vi.fn();
    (tracingPlugin as any)(fastifyMock, {}, done);

    const mockChild = vi.fn().mockReturnValue({});
    const request: any = {
      log: { child: mockChild },
    };
    const reply: any = {};

    await hooks['onRequest'](request, reply);

    expect(request.traceId).toBe('abc123def456789012345678abcdef01');
    expect(request.spanId).toBe('0123456789abcdef');
  });

  it('should create Pino child logger with trace context', async () => {
    const done = vi.fn();
    (tracingPlugin as any)(fastifyMock, {}, done);

    const childLogger = { info: vi.fn() };
    const mockChild = vi.fn().mockReturnValue(childLogger);
    const request: any = {
      log: { child: mockChild },
    };
    const reply: any = {};

    await hooks['onRequest'](request, reply);

    expect(mockChild).toHaveBeenCalledWith({
      traceId: 'abc123def456789012345678abcdef01',
      spanId: '0123456789abcdef',
      traceFlags: 1,
    });
    expect(request.log).toBe(childLogger);
  });

  it('should handle missing active span gracefully', async () => {
    // Override getSpan to return undefined (no active span)
    (trace.getSpan as any).mockReturnValueOnce(undefined);

    const done = vi.fn();
    (tracingPlugin as any)(fastifyMock, {}, done);

    const request: any = {
      log: { child: vi.fn() },
    };
    const reply: any = {};

    await hooks['onRequest'](request, reply);

    expect(request.traceId).toBeUndefined();
    expect(request.spanId).toBeUndefined();
    expect(request.log.child).not.toHaveBeenCalled();
  });

  it('should record exception on active span when error occurs', async () => {
    const done = vi.fn();
    (tracingPlugin as any)(fastifyMock, {}, done);

    const request: any = {};
    const reply: any = {};
    const error = new Error('Test error');

    await hooks['onError'](request, reply, error);

    const span = (trace.getSpan as any).mock.results[0]?.value;
    expect(span.recordException).toHaveBeenCalledWith(error);
    expect(span.setStatus).toHaveBeenCalledWith({
      code: 2, // SpanStatusCode.ERROR
      message: 'Test error',
    });
  });

  it('should not fail on error hook when no active span', async () => {
    (trace.getSpan as any).mockReturnValue(undefined);

    const done = vi.fn();
    (tracingPlugin as any)(fastifyMock, {}, done);

    const request: any = { log: { child: vi.fn() } };
    const reply: any = {};
    const error = new Error('No span error');

    // Should not throw
    await hooks['onError'](request, reply, error);
  });
});
