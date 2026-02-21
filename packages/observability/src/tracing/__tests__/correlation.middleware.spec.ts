import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CorrelationMiddleware } from '../correlation.middleware';
import { StructuredLogger } from '../../logging/structured-logger';

describe('CorrelationMiddleware', () => {
  let middleware: CorrelationMiddleware;

  beforeEach(() => {
    middleware = new CorrelationMiddleware();
    StructuredLogger.currentCorrelationId = '';
  });

  it('should generate a correlation ID if none provided', () => {
    const req = { headers: {} } as { headers: Record<string, string | undefined>; correlationId?: string };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBeDefined();
    expect(req.correlationId!.length).toBeGreaterThan(0);
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', req.correlationId);
    expect(next).toHaveBeenCalledOnce();
  });

  it('should use existing correlation ID from request header', () => {
    const req = {
      headers: { 'x-correlation-id': 'existing-corr-id' },
    } as { headers: Record<string, string | undefined>; correlationId?: string };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBe('existing-corr-id');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'existing-corr-id');
  });

  it('should set correlation ID on StructuredLogger', () => {
    const req = {
      headers: { 'x-correlation-id': 'trace-abc-123' },
    } as { headers: Record<string, string | undefined>; correlationId?: string };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(StructuredLogger.currentCorrelationId).toBe('trace-abc-123');
  });

  it('should generate UUID when header is empty string', () => {
    const req = {
      headers: { 'x-correlation-id': '' },
    } as { headers: Record<string, string | undefined>; correlationId?: string };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBeDefined();
    expect(req.correlationId).not.toBe('');
    // Should be a UUID format
    expect(req.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
