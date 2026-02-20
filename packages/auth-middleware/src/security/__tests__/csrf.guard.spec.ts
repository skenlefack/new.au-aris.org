import { describe, it, expect } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from '../csrf.guard';
import type { AuthModuleOptions } from '../../interfaces/jwt-payload.interface';

function mockContext(
  method: string,
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        cookies,
        headers,
      }),
    }),
  } as unknown as import('@nestjs/common').ExecutionContext;
}

describe('CsrfGuard', () => {
  const csrfOptions: AuthModuleOptions = {
    publicKey: 'test-key',
    security: { csrf: true },
  };

  const disabledOptions: AuthModuleOptions = {
    publicKey: 'test-key',
    security: { csrf: false },
  };

  it('should skip CSRF check for GET requests', () => {
    const guard = new CsrfGuard(csrfOptions);
    const ctx = mockContext('GET');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should skip CSRF check for HEAD requests', () => {
    const guard = new CsrfGuard(csrfOptions);
    const ctx = mockContext('HEAD');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should skip CSRF check for OPTIONS requests', () => {
    const guard = new CsrfGuard(csrfOptions);
    const ctx = mockContext('OPTIONS');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw 403 for POST without CSRF cookie', () => {
    const guard = new CsrfGuard(csrfOptions);
    const ctx = mockContext('POST', {}, { 'x-csrf-token': 'abc' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw 403 for POST without CSRF header', () => {
    const guard = new CsrfGuard(csrfOptions);
    const ctx = mockContext('POST', { 'XSRF-TOKEN': 'abc' }, {});
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw 403 when cookie and header tokens mismatch', () => {
    const guard = new CsrfGuard(csrfOptions);
    const ctx = mockContext(
      'POST',
      { 'XSRF-TOKEN': 'token-a' },
      { 'x-csrf-token': 'token-b' },
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should pass when cookie and header tokens match', () => {
    const guard = new CsrfGuard(csrfOptions);
    const ctx = mockContext(
      'POST',
      { 'XSRF-TOKEN': 'valid-token' },
      { 'x-csrf-token': 'valid-token' },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should pass all requests when CSRF is disabled', () => {
    const guard = new CsrfGuard(disabledOptions);
    const ctx = mockContext('POST');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should use custom cookie name from options', () => {
    const options: AuthModuleOptions = {
      publicKey: 'test-key',
      security: { csrf: true, csrfCookieName: 'MY-CSRF' },
    };
    const guard = new CsrfGuard(options);
    const ctx = mockContext(
      'POST',
      { 'MY-CSRF': 'token-xyz' },
      { 'x-csrf-token': 'token-xyz' },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
