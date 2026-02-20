import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from '../rate-limit.guard';
import type { AuthModuleOptions } from '../../interfaces/jwt-payload.interface';

function mockContext(
  ip = '127.0.0.1',
  className = 'TestController',
  handlerName = 'testHandler',
) {
  const request = {
    ip,
    headers: {},
    connection: { remoteAddress: ip },
  };
  const response = {
    setHeader: vi.fn(),
  };
  const handler = function handler() {};
  Object.defineProperty(handler, 'name', { value: handlerName, writable: false });
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getClass: () => ({ name: className }),
    getHandler: () => handler,
    request,
    response,
  } as unknown as import('@nestjs/common').ExecutionContext & {
    request: typeof request;
    response: typeof response;
  };
}

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;
  const defaultOptions: AuthModuleOptions = {
    publicKey: 'test-key',
    security: {
      rateLimit: { max: 100, windowMs: 60_000 },
    },
  };

  beforeEach(() => {
    reflector = new Reflector();
    vi.spyOn(reflector, 'get').mockReturnValue(undefined);
    guard = new RateLimitGuard(reflector, defaultOptions);
  });

  afterEach(() => {
    guard.onModuleDestroy();
  });

  it('should allow requests under the limit', () => {
    const ctx = mockContext();
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow up to max requests', () => {
    const ctx = mockContext();
    for (let i = 0; i < 100; i++) {
      expect(guard.canActivate(ctx)).toBe(true);
    }
  });

  it('should return 429 when limit is exceeded', () => {
    const ctx = mockContext();
    for (let i = 0; i < 100; i++) {
      guard.canActivate(ctx);
    }

    try {
      guard.canActivate(ctx);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it('should set Retry-After header on 429', () => {
    const ctx = mockContext();
    for (let i = 0; i < 100; i++) {
      guard.canActivate(ctx);
    }

    try {
      guard.canActivate(ctx);
    } catch {
      // expected
    }

    expect(ctx.response.setHeader).toHaveBeenCalledWith(
      'Retry-After',
      expect.any(Number),
    );
  });

  it('should respect per-endpoint override via @RateLimit decorator', () => {
    vi.spyOn(reflector, 'get').mockReturnValue({ max: 2, windowMs: 60_000 });
    guard = new RateLimitGuard(reflector, defaultOptions);

    const ctx = mockContext();
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);

    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
    guard.onModuleDestroy();
  });

  it('should bypass rate limit for whitelisted IPs', () => {
    const options: AuthModuleOptions = {
      publicKey: 'test-key',
      security: {
        rateLimit: { max: 1, windowMs: 60_000 },
        ipFilter: { whitelist: ['10.0.0.1'] },
      },
    };
    guard = new RateLimitGuard(reflector, options);

    const ctx = mockContext('10.0.0.1');
    // Should always pass, even over limit
    for (let i = 0; i < 10; i++) {
      expect(guard.canActivate(ctx)).toBe(true);
    }
    guard.onModuleDestroy();
  });

  it('should track different IPs separately', () => {
    const options: AuthModuleOptions = {
      publicKey: 'test-key',
      security: {
        rateLimit: { max: 2, windowMs: 60_000 },
      },
    };
    guard = new RateLimitGuard(reflector, options);

    const ctx1 = mockContext('1.1.1.1');
    const ctx2 = mockContext('2.2.2.2');

    expect(guard.canActivate(ctx1)).toBe(true);
    expect(guard.canActivate(ctx1)).toBe(true);
    expect(() => guard.canActivate(ctx1)).toThrow(HttpException);

    // Different IP should still work
    expect(guard.canActivate(ctx2)).toBe(true);
    guard.onModuleDestroy();
  });
});
