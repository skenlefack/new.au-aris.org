import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { AuditLogInterceptor } from '../audit-log.interceptor';

function mockContext(
  method = 'GET',
  url = '/api/test',
  ip = '127.0.0.1',
  user?: { userId: string; tenantId: string; role: string },
) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        url,
        ip,
        headers: {},
        user,
      }),
      getResponse: () => ({
        statusCode: 200,
      }),
    }),
  } as unknown as import('@nestjs/common').ExecutionContext;
}

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    interceptor = new AuditLogInterceptor();
    logSpy = vi.spyOn(interceptor['logger'], 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(interceptor['logger'], 'warn').mockImplementation(() => {});
  });

  it('should log successful requests with method, URL, status, and duration', async () => {
    const ctx = mockContext('POST', '/api/v1/auth/login', '10.0.0.1', {
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'NATIONAL_ADMIN',
    });
    const next = { handle: () => of({ data: 'ok' }) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, next).subscribe({
        complete: () => {
          expect(logSpy).toHaveBeenCalledOnce();
          const message = logSpy.mock.calls[0][0] as string;
          expect(message).toContain('POST');
          expect(message).toContain('/api/v1/auth/login');
          expect(message).toContain('200');
          expect(message).toContain('user=user-1');
          expect(message).toContain('tenant=tenant-1');
          resolve();
        },
      });
    });
  });

  it('should log anonymous requests', async () => {
    const ctx = mockContext('GET', '/api/v1/public');
    const next = { handle: () => of({ data: 'ok' }) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, next).subscribe({
        complete: () => {
          const message = logSpy.mock.calls[0][0] as string;
          expect(message).toContain('user=anonymous');
          expect(message).toContain('tenant=none');
          resolve();
        },
      });
    });
  });

  it('should log errors with error message', async () => {
    const ctx = mockContext('POST', '/api/v1/auth/login');
    const next = {
      handle: () => throwError(() => new Error('Something went wrong')),
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, next).subscribe({
        error: () => {
          expect(warnSpy).toHaveBeenCalledOnce();
          const message = warnSpy.mock.calls[0][0] as string;
          expect(message).toContain('ERROR');
          expect(message).toContain('Something went wrong');
          resolve();
        },
      });
    });
  });
});
