import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

vi.mock('@aris/shared-types', () => ({
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    CONTINENTAL_ADMIN: 'CONTINENTAL_ADMIN',
    REC_ADMIN: 'REC_ADMIN',
    NATIONAL_ADMIN: 'NATIONAL_ADMIN',
    DATA_STEWARD: 'DATA_STEWARD',
    WAHIS_FOCAL_POINT: 'WAHIS_FOCAL_POINT',
    ANALYST: 'ANALYST',
    FIELD_AGENT: 'FIELD_AGENT',
  },
  TenantLevel: {
    CONTINENTAL: 'CONTINENTAL',
    REC: 'REC',
    MEMBER_STATE: 'MEMBER_STATE',
  },
}));

import { rolesHook, tenantHook } from '../roles.hook';
import { UserRole, TenantLevel } from '@aris/shared-types';

function makeRequest(user?: any, params?: Record<string, string>, query?: Record<string, string>): FastifyRequest {
  return {
    user,
    params: params ?? {},
    query: query ?? {},
    log: { warn: vi.fn() },
  } as unknown as FastifyRequest;
}

function makeReply(): FastifyReply {
  const reply = {
    code: vi.fn(),
    send: vi.fn(),
  } as unknown as FastifyReply;
  (reply.code as any).mockReturnValue(reply);
  return reply;
}

describe('rolesHook', () => {
  it('should return 403 when request.user is undefined', async () => {
    const hook = rolesHook(UserRole.SUPER_ADMIN);
    const request = makeRequest(undefined);
    const reply = makeReply();

    await hook(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'User not authenticated' }),
    );
  });

  it('should pass through when requiredRoles is empty', async () => {
    const hook = rolesHook();
    const request = makeRequest({
      userId: 'u1',
      role: UserRole.FIELD_AGENT,
      tenantId: 't1',
      tenantLevel: TenantLevel.MEMBER_STATE,
    });
    const reply = makeReply();

    const result = await hook(request, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('should pass through when user role matches', async () => {
    const hook = rolesHook(UserRole.NATIONAL_ADMIN, UserRole.SUPER_ADMIN);
    const request = makeRequest({
      userId: 'u1',
      role: UserRole.NATIONAL_ADMIN,
      tenantId: 't1',
      tenantLevel: TenantLevel.MEMBER_STATE,
    });
    const reply = makeReply();

    await hook(request, reply);

    expect(reply.code).not.toHaveBeenCalled();
  });

  it('should return 403 with message when role not authorized', async () => {
    const hook = rolesHook(UserRole.SUPER_ADMIN);
    const request = makeRequest({
      userId: 'u1',
      role: UserRole.FIELD_AGENT,
      tenantId: 't1',
      tenantLevel: TenantLevel.MEMBER_STATE,
    });
    const reply = makeReply();

    await hook(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('FIELD_AGENT'),
      }),
    );
  });
});

describe('tenantHook', () => {
  it('should pass through for CONTINENTAL level', async () => {
    const hook = tenantHook();
    const request = makeRequest(
      {
        userId: 'u1',
        role: UserRole.CONTINENTAL_ADMIN,
        tenantId: 'au-ibar',
        tenantLevel: TenantLevel.CONTINENTAL,
      },
      { tenantId: 'any-tenant' },
    );
    const reply = makeReply();

    await hook(request, reply);

    expect(reply.code).not.toHaveBeenCalled();
  });

  it('should return 403 for MEMBER_STATE accessing different tenant', async () => {
    const hook = tenantHook();
    const request = makeRequest(
      {
        userId: 'u1',
        role: UserRole.NATIONAL_ADMIN,
        tenantId: 'tenant-ke',
        tenantLevel: TenantLevel.MEMBER_STATE,
      },
      { tenantId: 'tenant-ng' },
    );
    const reply = makeReply();

    await hook(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Member state users cannot access other tenants',
      }),
    );
  });

  it('should pass through for REC level', async () => {
    const hook = tenantHook();
    const request = makeRequest(
      {
        userId: 'u1',
        role: UserRole.REC_ADMIN,
        tenantId: 'igad',
        tenantLevel: TenantLevel.REC,
      },
      { tenantId: 'tenant-ke' },
    );
    const reply = makeReply();

    await hook(request, reply);

    expect(reply.code).not.toHaveBeenCalled();
  });
});
