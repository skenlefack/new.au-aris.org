import { describe, it, expect, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../roles.guard';
import { UserRole, TenantLevel } from '@aris/shared-types';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../../interfaces/jwt-payload.interface';

function createMockContext(user?: AuthenticatedUser): ExecutionContext {
  const request = { user };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-1',
    email: 'test@au-aris.org',
    role: UserRole.ANALYST,
    tenantId: 'tenant-1',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access when no roles are required', () => {
    reflector.getAllAndOverride = () => undefined;
    const context = createMockContext(createUser());
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has required role', () => {
    reflector.getAllAndOverride = () => [UserRole.ANALYST, UserRole.DATA_STEWARD];
    const context = createMockContext(createUser({ role: UserRole.ANALYST }));
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user lacks required role', () => {
    reflector.getAllAndOverride = () => [UserRole.SUPER_ADMIN];
    const context = createMockContext(createUser({ role: UserRole.FIELD_AGENT }));
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is not set', () => {
    reflector.getAllAndOverride = () => [UserRole.ANALYST];
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow SUPER_ADMIN when SUPER_ADMIN is required', () => {
    reflector.getAllAndOverride = () => [UserRole.SUPER_ADMIN];
    const context = createMockContext(createUser({ role: UserRole.SUPER_ADMIN }));
    expect(guard.canActivate(context)).toBe(true);
  });
});
