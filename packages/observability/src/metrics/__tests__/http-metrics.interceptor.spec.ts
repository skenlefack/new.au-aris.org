import { describe, it, expect } from 'vitest';
import * as client from 'prom-client';
import { of, throwError } from 'rxjs';
import { HttpMetricsInterceptor } from '../http-metrics.interceptor';

function mockContext(method = 'GET', url = '/api/v1/test', statusCode = 200) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, url }),
      getResponse: () => ({ statusCode }),
    }),
  } as unknown as import('@nestjs/common').ExecutionContext;
}

// NOTE: We do NOT call register.clear() because the http-metrics interceptor
// creates counters/histograms at module scope. Clearing would orphan them.

describe('HttpMetricsInterceptor', () => {
  const interceptor = new HttpMetricsInterceptor();

  it('should record successful requests', async () => {
    const ctx = mockContext('POST', '/api/v1/auth/login', 200);
    const next = { handle: () => of({ data: 'ok' }) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, next).subscribe({ complete: resolve });
    });

    const metricsText = await client.register.metrics();
    expect(metricsText).toContain('aris_http_requests_total');
  });

  it('should record error responses', async () => {
    const ctx = mockContext('GET', '/api/v1/users');
    const next = {
      handle: () => throwError(() => ({ status: 500 })),
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, next).subscribe({
        error: () => resolve(),
      });
    });

    const metricsText = await client.register.metrics();
    expect(metricsText).toContain('aris_http_requests_total');
    expect(metricsText).toContain('500');
  });

  it('should normalize UUID paths to :id', async () => {
    const ctx = mockContext(
      'GET',
      '/api/v1/users/550e8400-e29b-41d4-a716-446655440000',
      200,
    );
    const next = { handle: () => of({ data: 'ok' }) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, next).subscribe({ complete: resolve });
    });

    const metricsText = await client.register.metrics();
    expect(metricsText).toContain('/api/v1/users/:id');
    expect(metricsText).not.toContain('550e8400');
  });

  it('should track request duration via histogram', async () => {
    const ctx = mockContext('GET', '/api/v1/health', 200);
    const next = { handle: () => of({ status: 'ok' }) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, next).subscribe({ complete: resolve });
    });

    const metricsText = await client.register.metrics();
    expect(metricsText).toContain('aris_http_request_duration_seconds');
  });
});
