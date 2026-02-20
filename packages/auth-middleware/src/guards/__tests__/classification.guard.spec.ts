import { describe, it, expect, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClassificationGuard } from '../classification.guard';
import { DataClassification, UserRole, TenantLevel } from '@aris/shared-types';
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
    email: 'test@aris.africa',
    role: UserRole.ANALYST,
    tenantId: 'tenant-1',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

describe('ClassificationGuard', () => {
  let guard: ClassificationGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new ClassificationGuard(reflector);
  });

  it('should allow access when no classification is required', () => {
    reflector.getAllAndOverride = () => undefined;
    const context = createMockContext(createUser());
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow ANALYST to access PUBLIC data', () => {
    reflector.getAllAndOverride = () => DataClassification.PUBLIC;
    const context = createMockContext(createUser({ role: UserRole.ANALYST }));
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow ANALYST to access PARTNER data', () => {
    reflector.getAllAndOverride = () => DataClassification.PARTNER;
    const context = createMockContext(createUser({ role: UserRole.ANALYST }));
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny ANALYST access to RESTRICTED data', () => {
    reflector.getAllAndOverride = () => DataClassification.RESTRICTED;
    const context = createMockContext(createUser({ role: UserRole.ANALYST }));
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should deny FIELD_AGENT access to PARTNER data', () => {
    reflector.getAllAndOverride = () => DataClassification.PARTNER;
    const context = createMockContext(createUser({ role: UserRole.FIELD_AGENT }));
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow SUPER_ADMIN access to CONFIDENTIAL data', () => {
    reflector.getAllAndOverride = () => DataClassification.CONFIDENTIAL;
    const context = createMockContext(createUser({ role: UserRole.SUPER_ADMIN }));
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny NATIONAL_ADMIN access to CONFIDENTIAL data', () => {
    reflector.getAllAndOverride = () => DataClassification.CONFIDENTIAL;
    const context = createMockContext(createUser({ role: UserRole.NATIONAL_ADMIN }));
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow WAHIS_FOCAL_POINT access to RESTRICTED data', () => {
    reflector.getAllAndOverride = () => DataClassification.RESTRICTED;
    const context = createMockContext(
      createUser({ role: UserRole.WAHIS_FOCAL_POINT }),
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user is not set', () => {
    reflector.getAllAndOverride = () => DataClassification.PUBLIC;
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
