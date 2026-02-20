import { describe, it, expect, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { TenantGuard } from '../tenant.guard';
import { TenantLevel, UserRole } from '@aris/shared-types';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../../interfaces/jwt-payload.interface';

function createMockContext(
  user: AuthenticatedUser | undefined,
  params: Record<string, string> = {},
  query: Record<string, string> = {},
): ExecutionContext {
  const request = { user, params, query };
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
    role: UserRole.NATIONAL_ADMIN,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

describe('TenantGuard', () => {
  let guard: TenantGuard;

  beforeEach(() => {
    guard = new TenantGuard();
  });

  it('should throw ForbiddenException when user is not set', () => {
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow CONTINENTAL user to access any tenant', () => {
    const user = createUser({
      tenantLevel: TenantLevel.CONTINENTAL,
      tenantId: 'tenant-au',
    });
    const context = createMockContext(user, { tenantId: 'tenant-ke' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow user to access own tenant', () => {
    const user = createUser({ tenantId: 'tenant-ke' });
    const context = createMockContext(user, { tenantId: 'tenant-ke' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow when no tenantId is requested', () => {
    const user = createUser();
    const context = createMockContext(user);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should block MEMBER_STATE user from accessing other tenant', () => {
    const user = createUser({
      tenantLevel: TenantLevel.MEMBER_STATE,
      tenantId: 'tenant-ke',
    });
    const context = createMockContext(user, { tenantId: 'tenant-ng' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow REC user to access child tenants (defers to service layer)', () => {
    const user = createUser({
      tenantLevel: TenantLevel.REC,
      tenantId: 'tenant-igad',
    });
    const context = createMockContext(user, { tenantId: 'tenant-ke' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should read tenantId from query if not in params', () => {
    const user = createUser({
      tenantLevel: TenantLevel.MEMBER_STATE,
      tenantId: 'tenant-ke',
    });
    const context = createMockContext(user, {}, { tenantId: 'tenant-ng' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
