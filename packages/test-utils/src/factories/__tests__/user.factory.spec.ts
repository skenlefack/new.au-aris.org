import { describe, it, expect } from 'vitest';
import { createMockUser, createMockJwtPayload, createMockAuthenticatedUser } from '../user.factory';
import { UserRole, TenantLevel } from '@aris/shared-types';

describe('createMockUser', () => {
  it('should return a user with all required fields', () => {
    const user = createMockUser();

    expect(user.id).toBeDefined();
    expect(user.tenantId).toBeDefined();
    expect(user.email).toContain('@au-aris.org');
    expect(user.passwordHash).toBeDefined();
    expect(user.firstName).toBe('John');
    expect(user.lastName).toBe('Doe');
    expect(user.role).toBe(UserRole.NATIONAL_ADMIN);
    expect(user.mfaEnabled).toBe(false);
    expect(user.mfaSecret).toBeNull();
    expect(user.lastLoginAt).toBeNull();
    expect(user.isActive).toBe(true);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('should generate unique IDs on each call', () => {
    const user1 = createMockUser();
    const user2 = createMockUser();

    expect(user1.id).not.toBe(user2.id);
    expect(user1.tenantId).not.toBe(user2.tenantId);
  });

  it('should derive email from generated ID', () => {
    const user = createMockUser();
    const idPrefix = user.id.substring(0, 8);
    expect(user.email).toBe(`user-${idPrefix}@au-aris.org`);
  });

  it('should allow overriding individual fields', () => {
    const user = createMockUser({
      email: 'custom@test.org',
      role: UserRole.SUPER_ADMIN,
      firstName: 'Jane',
      mfaEnabled: true,
    });

    expect(user.email).toBe('custom@test.org');
    expect(user.role).toBe(UserRole.SUPER_ADMIN);
    expect(user.firstName).toBe('Jane');
    expect(user.mfaEnabled).toBe(true);
    // Non-overridden fields keep defaults
    expect(user.lastName).toBe('Doe');
    expect(user.isActive).toBe(true);
  });

  it('should allow overriding id and tenantId', () => {
    const fixedId = '00000000-0000-0000-0000-000000000001';
    const fixedTenantId = '00000000-0000-0000-0000-000000000002';
    const user = createMockUser({ id: fixedId, tenantId: fixedTenantId });

    expect(user.id).toBe(fixedId);
    expect(user.tenantId).toBe(fixedTenantId);
  });
});

describe('createMockJwtPayload', () => {
  it('should return a JWT payload with defaults', () => {
    const payload = createMockJwtPayload();

    expect(payload.userId).toBeDefined();
    expect(payload.email).toBe('admin@au-aris.org');
    expect(payload.role).toBe(UserRole.SUPER_ADMIN);
    expect(payload.tenantId).toBeDefined();
    expect(payload.tenantLevel).toBe(TenantLevel.CONTINENTAL);
  });

  it('should generate unique userId and tenantId on each call', () => {
    const p1 = createMockJwtPayload();
    const p2 = createMockJwtPayload();

    expect(p1.userId).not.toBe(p2.userId);
    expect(p1.tenantId).not.toBe(p2.tenantId);
  });

  it('should allow overriding fields', () => {
    const payload = createMockJwtPayload({
      role: UserRole.FIELD_AGENT,
      tenantLevel: TenantLevel.MEMBER_STATE,
      email: 'agent@ke.au-aris.org',
    });

    expect(payload.role).toBe(UserRole.FIELD_AGENT);
    expect(payload.tenantLevel).toBe(TenantLevel.MEMBER_STATE);
    expect(payload.email).toBe('agent@ke.au-aris.org');
  });
});

describe('createMockAuthenticatedUser', () => {
  it('should return the same shape as createMockJwtPayload', () => {
    const user = createMockAuthenticatedUser();

    expect(user.userId).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.role).toBeDefined();
    expect(user.tenantId).toBeDefined();
    expect(user.tenantLevel).toBeDefined();
  });

  it('should accept overrides', () => {
    const user = createMockAuthenticatedUser({
      role: UserRole.REC_ADMIN,
      tenantLevel: TenantLevel.REC,
    });

    expect(user.role).toBe(UserRole.REC_ADMIN);
    expect(user.tenantLevel).toBe(TenantLevel.REC);
  });
});
