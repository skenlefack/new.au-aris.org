import { describe, it, expect, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthGuard } from '../auth.guard';
import { UserRole, TenantLevel } from '@aris/shared-types';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthModuleOptions } from '../../interfaces/jwt-payload.interface';

// Generate RSA key pair for tests
const { privateKey, publicKey } = (() => {
  const crypto = require('crypto');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKey, publicKey };
})();

function createMockContext(authHeader?: string): ExecutionContext {
  const request = {
    headers: authHeader ? { authorization: authHeader } : {},
    user: undefined,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
    getArgs: () => [],
    getArgByIndex: () => ({}),
    switchToRpc: () => ({} as never),
    switchToWs: () => ({} as never),
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  const options: AuthModuleOptions = { publicKey };

  beforeEach(() => {
    guard = new AuthGuard(options);
  });

  it('should throw UnauthorizedException when no authorization header', () => {
    const context = createMockContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for malformed header', () => {
    const context = createMockContext('Basic abc123');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for invalid token', () => {
    const context = createMockContext('Bearer invalid.token.here');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for expired token', () => {
    const token = signToken({
      sub: 'user-1',
      email: 'test@aris.africa',
      role: UserRole.ANALYST,
      tenantId: 'tenant-1',
      tenantLevel: TenantLevel.MEMBER_STATE,
      exp: Math.floor(Date.now() / 1000) - 3600, // expired 1h ago
    });
    const context = createMockContext(`Bearer ${token}`);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should allow valid token and set user on request', () => {
    const token = signToken({
      sub: 'user-1',
      email: 'test@aris.africa',
      role: UserRole.NATIONAL_ADMIN,
      tenantId: 'tenant-1',
      tenantLevel: TenantLevel.MEMBER_STATE,
    });
    const context = createMockContext(`Bearer ${token}`);
    const result = guard.canActivate(context);

    expect(result).toBe(true);
    const request = context.switchToHttp().getRequest() as { user: unknown };
    expect(request.user).toEqual({
      userId: 'user-1',
      email: 'test@aris.africa',
      role: UserRole.NATIONAL_ADMIN,
      tenantId: 'tenant-1',
      tenantLevel: TenantLevel.MEMBER_STATE,
    });
  });
});
