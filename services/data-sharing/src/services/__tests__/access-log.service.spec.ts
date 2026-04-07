import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { AccessLogService } from '../access-log.service';

const AGREEMENT_ID = '33333333-3333-3333-3333-333333333333';
const OWNER_TENANT = '11111111-1111-1111-1111-111111111111';
const RECIPIENT_TENANT = '22222222-2222-2222-2222-222222222222';

function buildUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-1',
    tenantId: RECIPIENT_TENANT,
    tenantLevel: TenantLevel.MEMBER_STATE,
    roles: ['NATIONAL_ADMIN'],
    email: 'recipient@au-aris.org',
    ...overrides,
  } as AuthenticatedUser;
}

function makeService() {
  const prismaMock = {
    dataShareAgreement: {
      findUnique: vi.fn(),
    },
    dataShareAccessLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  } as any;
  const kafkaMock = { send: vi.fn().mockResolvedValue(undefined) } as any;
  return { service: new AccessLogService(prismaMock, kafkaMock), prismaMock, kafkaMock };
}

describe('AccessLogService.log', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('persists a successful access log and publishes Kafka event', async () => {
    ctx.prismaMock.dataShareAccessLog.create.mockResolvedValueOnce({
      id: 'log-1',
      agreement_id: AGREEMENT_ID,
      user_id: 'user-1',
      tenant_id: RECIPIENT_TENANT,
      action: 'CONSULT',
      record_count: 5,
      query_filters: { country: 'KE' },
      ip_address: null,
      user_agent: null,
      success: true,
      error_message: null,
      created_at: new Date(),
    });

    const dto = await ctx.service.log({
      agreementId: AGREEMENT_ID,
      userId: 'user-1',
      tenantId: RECIPIENT_TENANT,
      action: 'CONSULT',
      recordCount: 5,
      queryFilters: { country: 'KE' },
      success: true,
    });

    expect(ctx.prismaMock.dataShareAccessLog.create).toHaveBeenCalledTimes(1);
    const arg = ctx.prismaMock.dataShareAccessLog.create.mock.calls[0][0];
    expect(arg.data.success).toBe(true);
    expect(arg.data.action).toBe('CONSULT');
    expect(ctx.kafkaMock.send).toHaveBeenCalledTimes(1);
    expect(dto.success).toBe(true);
    expect(dto.action).toBe('CONSULT');
  });

  it('persists a failure access log with errorMessage', async () => {
    ctx.prismaMock.dataShareAccessLog.create.mockResolvedValueOnce({
      id: 'log-2',
      agreement_id: AGREEMENT_ID,
      user_id: 'user-1',
      tenant_id: RECIPIENT_TENANT,
      action: 'EXPORT',
      record_count: null,
      query_filters: null,
      ip_address: null,
      user_agent: null,
      success: false,
      error_message: 'Quota exceeded',
      created_at: new Date(),
    });

    const dto = await ctx.service.log({
      agreementId: AGREEMENT_ID,
      userId: 'user-1',
      tenantId: RECIPIENT_TENANT,
      action: 'EXPORT',
      success: false,
      errorMessage: 'Quota exceeded',
    });

    expect(dto.success).toBe(false);
    expect(dto.errorMessage).toBe('Quota exceeded');
    const arg = ctx.prismaMock.dataShareAccessLog.create.mock.calls[0][0];
    expect(arg.data.error_message).toBe('Quota exceeded');
  });

  it('swallows Kafka publish errors without throwing', async () => {
    ctx.prismaMock.dataShareAccessLog.create.mockResolvedValueOnce({
      id: 'log-3',
      agreement_id: AGREEMENT_ID,
      user_id: 'user-1',
      tenant_id: RECIPIENT_TENANT,
      action: 'CONSULT',
      record_count: 0,
      query_filters: null,
      ip_address: null,
      user_agent: null,
      success: true,
      error_message: null,
      created_at: new Date(),
    });
    ctx.kafkaMock.send.mockRejectedValueOnce(new Error('down'));

    await expect(
      ctx.service.log({
        agreementId: AGREEMENT_ID,
        userId: 'user-1',
        tenantId: RECIPIENT_TENANT,
        action: 'CONSULT',
        success: true,
      }),
    ).resolves.toBeDefined();
  });
});

describe('AccessLogService.findByAgreement', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('returns paginated logs for the recipient tenant', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce({
      id: AGREEMENT_ID,
      owner_tenant_id: OWNER_TENANT,
      recipient_tenant_id: RECIPIENT_TENANT,
    });
    ctx.prismaMock.dataShareAccessLog.findMany.mockResolvedValueOnce([
      {
        id: 'log-1',
        agreement_id: AGREEMENT_ID,
        user_id: 'user-1',
        tenant_id: RECIPIENT_TENANT,
        action: 'CONSULT',
        record_count: 1,
        query_filters: null,
        ip_address: null,
        user_agent: null,
        success: true,
        error_message: null,
        created_at: new Date(),
      },
    ]);
    ctx.prismaMock.dataShareAccessLog.count.mockResolvedValueOnce(1);

    const res = await ctx.service.findByAgreement(AGREEMENT_ID, buildUser(), {
      page: 1,
      limit: 20,
    });
    expect(res.data).toHaveLength(1);
    expect(res.meta.total).toBe(1);
    expect(res.meta.page).toBe(1);
  });

  it('returns 404 when user is not party to the agreement', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce({
      id: AGREEMENT_ID,
      owner_tenant_id: OWNER_TENANT,
      recipient_tenant_id: RECIPIENT_TENANT,
    });
    await expect(
      ctx.service.findByAgreement(
        AGREEMENT_ID,
        buildUser({ tenantId: '99999999-9999-9999-9999-999999999999' }),
        {},
      ),
    ).rejects.toThrow(/not found/);
  });
});
