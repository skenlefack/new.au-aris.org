import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { AgreementService, HttpError } from '../agreement.service';
import type { AccessLogService } from '../access-log.service';

const OWNER_TENANT = '11111111-1111-1111-1111-111111111111';
const RECIPIENT_TENANT = '22222222-2222-2222-2222-222222222222';
const AGREEMENT_ID = '33333333-3333-3333-3333-333333333333';

function buildUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-1',
    tenantId: OWNER_TENANT,
    tenantLevel: TenantLevel.MEMBER_STATE,
    roles: ['NATIONAL_ADMIN'],
    email: 'owner@au-aris.org',
    ...overrides,
  } as AuthenticatedUser;
}

function buildRow(overrides: Record<string, unknown> = {}): any {
  return {
    id: AGREEMENT_ID,
    title: 'Test',
    description: null,
    reference: 'DSA-2026-000001',
    owner_tenant_id: OWNER_TENANT,
    owner_user_id: 'user-1',
    recipient_tenant_id: RECIPIENT_TENANT,
    recipient_user_id: null,
    data_domain: 'animal-health',
    data_scope: { entities: ['outbreaks'] },
    data_classification: 'RESTRICTED',
    purpose: 'Surveillance sharing',
    legal_basis: null,
    valid_from: new Date('2026-01-01'),
    valid_until: new Date('2027-01-01'),
    can_consult: true,
    can_export: false,
    can_modify: false,
    can_redistribute: false,
    max_records_per_query: null,
    max_exports_per_month: null,
    require_mfa: false,
    allowed_ip_ranges: [],
    status: 'DRAFT',
    submitted_at: null,
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
    revoked_at: null,
    revoked_by: null,
    revocation_reason: null,
    expired_at: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeService() {
  const prismaMock = {
    dataShareAgreement: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    dataShareAccessLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  } as any;
  const kafkaMock = { send: vi.fn().mockResolvedValue(undefined) } as any;
  const accessLogMock = {
    log: vi.fn().mockResolvedValue({}),
    findByAgreement: vi.fn(),
  } as unknown as AccessLogService;

  const service = new AgreementService(prismaMock, kafkaMock, accessLogMock);
  return { service, prismaMock, kafkaMock, accessLogMock };
}

describe('AgreementService.create', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('creates a DRAFT agreement, generates reference, publishes Kafka event', async () => {
    ctx.prismaMock.dataShareAgreement.count.mockResolvedValueOnce(41);
    const newRow = buildRow({ reference: 'DSA-2026-000042' });
    ctx.prismaMock.dataShareAgreement.create.mockResolvedValueOnce(newRow);

    const res = await ctx.service.create(
      {
        title: 'Share outbreaks',
        recipientTenantId: RECIPIENT_TENANT,
        dataDomain: 'animal-health',
        dataScope: { entities: ['outbreaks'] },
        purpose: 'Sharing',
        validFrom: '2026-01-01',
      },
      buildUser(),
    );

    expect(ctx.prismaMock.dataShareAgreement.create).toHaveBeenCalledTimes(1);
    const createArg = ctx.prismaMock.dataShareAgreement.create.mock.calls[0][0];
    expect(createArg.data.status).toBe('DRAFT');
    expect(createArg.data.owner_tenant_id).toBe(OWNER_TENANT);
    expect(createArg.data.recipient_tenant_id).toBe(RECIPIENT_TENANT);
    expect(createArg.data.reference).toMatch(/^DSA-\d{4}-\d{6}$/);
    expect(createArg.data.can_consult).toBe(true);
    expect(createArg.data.can_export).toBe(false);
    expect(ctx.kafkaMock.send).toHaveBeenCalledTimes(1);
    expect(res.data.id).toBe(AGREEMENT_ID);
  });

  it('rejects when recipientTenantId equals owner tenant', async () => {
    await expect(
      ctx.service.create(
        {
          title: 'x',
          recipientTenantId: OWNER_TENANT,
          dataDomain: 'animal-health',
          dataScope: { entities: ['outbreaks'] },
          purpose: 'x',
          validFrom: '2026-01-01',
        },
        buildUser(),
      ),
    ).rejects.toThrow(HttpError);
    expect(ctx.prismaMock.dataShareAgreement.create).not.toHaveBeenCalled();
  });

  it('swallows Kafka errors without failing the operation', async () => {
    ctx.prismaMock.dataShareAgreement.count.mockResolvedValueOnce(0);
    ctx.prismaMock.dataShareAgreement.create.mockResolvedValueOnce(buildRow());
    ctx.kafkaMock.send.mockRejectedValueOnce(new Error('broker down'));

    await expect(
      ctx.service.create(
        {
          title: 't',
          recipientTenantId: RECIPIENT_TENANT,
          dataDomain: 'animal-health',
          dataScope: { entities: ['outbreaks'] },
          purpose: 'p',
          validFrom: '2026-01-01',
        },
        buildUser(),
      ),
    ).resolves.toBeDefined();
  });
});

describe('AgreementService.update', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('rejects when status is not DRAFT', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce(
      buildRow({ status: 'SUBMITTED' }),
    );
    await expect(
      ctx.service.update(AGREEMENT_ID, { title: 'x' }, buildUser()),
    ).rejects.toThrow(/DRAFT/);
  });

  it('rejects when user is not the owner tenant', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce(buildRow());
    await expect(
      ctx.service.update(
        AGREEMENT_ID,
        { title: 'x' },
        buildUser({ tenantId: RECIPIENT_TENANT }),
      ),
    ).rejects.toThrow(/owner/);
  });

  it('applies partial updates when owner + DRAFT', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce(buildRow());
    ctx.prismaMock.dataShareAgreement.update.mockResolvedValueOnce(
      buildRow({ title: 'New title' }),
    );

    const res = await ctx.service.update(
      AGREEMENT_ID,
      { title: 'New title', canExport: true },
      buildUser(),
    );
    expect(res.data.title).toBe('New title');
    const arg = ctx.prismaMock.dataShareAgreement.update.mock.calls[0][0];
    expect(arg.data.title).toBe('New title');
    expect(arg.data.can_export).toBe(true);
  });
});

describe('AgreementService.submit', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('transitions DRAFT -> SUBMITTED and publishes event', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce(buildRow());
    ctx.prismaMock.dataShareAgreement.update.mockResolvedValueOnce(
      buildRow({ status: 'SUBMITTED', submitted_at: new Date() }),
    );

    const res = await ctx.service.submit(AGREEMENT_ID, buildUser());
    expect(res.data.status).toBe('SUBMITTED');
    expect(ctx.kafkaMock.send).toHaveBeenCalledTimes(1);
  });

  it('rejects submit when status is not DRAFT', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce(
      buildRow({ status: 'ACTIVE' }),
    );
    await expect(ctx.service.submit(AGREEMENT_ID, buildUser())).rejects.toThrow(
      /DRAFT/,
    );
  });
});

describe('AgreementService.accept', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('rejects if user is not the recipient', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce(
      buildRow({ status: 'SUBMITTED' }),
    );
    await expect(
      ctx.service.accept(AGREEMENT_ID, buildUser()),
    ).rejects.toThrow(/recipient/);
  });

  it('transitions SUBMITTED -> ACTIVE when validFrom is in the past', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce(
      buildRow({ status: 'SUBMITTED', valid_from: new Date('2020-01-01') }),
    );
    ctx.prismaMock.dataShareAgreement.update.mockResolvedValueOnce(
      buildRow({ status: 'ACTIVE' }),
    );

    const res = await ctx.service.accept(
      AGREEMENT_ID,
      buildUser({ tenantId: RECIPIENT_TENANT }),
    );
    expect(res.data.status).toBe('ACTIVE');
    const arg = ctx.prismaMock.dataShareAgreement.update.mock.calls[0][0];
    expect(arg.data.status).toBe('ACTIVE');
    expect(ctx.kafkaMock.send).toHaveBeenCalled();
  });

  it('transitions SUBMITTED -> ACCEPTED when validFrom is in the future', async () => {
    const futureFrom = new Date(Date.now() + 30 * 86400000);
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce(
      buildRow({ status: 'SUBMITTED', valid_from: futureFrom }),
    );
    ctx.prismaMock.dataShareAgreement.update.mockResolvedValueOnce(
      buildRow({ status: 'ACCEPTED' }),
    );

    const res = await ctx.service.accept(
      AGREEMENT_ID,
      buildUser({ tenantId: RECIPIENT_TENANT }),
    );
    const arg = ctx.prismaMock.dataShareAgreement.update.mock.calls[0][0];
    expect(arg.data.status).toBe('ACCEPTED');
    expect(res.data.status).toBe('ACCEPTED');
  });
});

describe('AgreementService.reject', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('requires a rejection reason', async () => {
    await expect(
      ctx.service.reject(
        AGREEMENT_ID,
        { rejectionReason: '' },
        buildUser({ tenantId: RECIPIENT_TENANT }),
      ),
    ).rejects.toThrow(/rejectionReason/);
  });

  it('transitions SUBMITTED -> REJECTED with reason', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce(
      buildRow({ status: 'SUBMITTED' }),
    );
    ctx.prismaMock.dataShareAgreement.update.mockResolvedValueOnce(
      buildRow({ status: 'REJECTED', rejection_reason: 'not needed' }),
    );

    const res = await ctx.service.reject(
      AGREEMENT_ID,
      { rejectionReason: 'not needed' },
      buildUser({ tenantId: RECIPIENT_TENANT }),
    );
    expect(res.data.status).toBe('REJECTED');
    expect(res.data.rejectionReason).toBe('not needed');
  });
});

describe('AgreementService.revoke', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('sets revocation fields on ACTIVE agreement', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce(
      buildRow({ status: 'ACTIVE' }),
    );
    ctx.prismaMock.dataShareAgreement.update.mockResolvedValueOnce(
      buildRow({
        status: 'REVOKED',
        revoked_at: new Date(),
        revoked_by: 'user-1',
        revocation_reason: 'policy change',
      }),
    );

    const res = await ctx.service.revoke(
      AGREEMENT_ID,
      { revocationReason: 'policy change' },
      buildUser(),
    );
    expect(res.data.status).toBe('REVOKED');
    expect(res.data.revocationReason).toBe('policy change');
    expect(res.data.revokedBy).toBe('user-1');
  });

  it('rejects revoke on DRAFT agreement', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce(buildRow());
    await expect(
      ctx.service.revoke(
        AGREEMENT_ID,
        { revocationReason: 'x' },
        buildUser(),
      ),
    ).rejects.toThrow(/SUBMITTED/);
  });
});

describe('AgreementService.findAll', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('applies OR tenant filter for non-CONTINENTAL users', async () => {
    ctx.prismaMock.dataShareAgreement.findMany.mockResolvedValueOnce([buildRow()]);
    ctx.prismaMock.dataShareAgreement.count.mockResolvedValueOnce(1);

    const res = await ctx.service.findAll(buildUser(), {});
    const arg = ctx.prismaMock.dataShareAgreement.findMany.mock.calls[0][0];
    expect(arg.where.OR).toBeDefined();
    expect(res.data).toHaveLength(1);
    expect(res.meta.total).toBe(1);
  });

  it('applies no tenant filter for CONTINENTAL users', async () => {
    ctx.prismaMock.dataShareAgreement.findMany.mockResolvedValueOnce([]);
    ctx.prismaMock.dataShareAgreement.count.mockResolvedValueOnce(0);

    await ctx.service.findAll(
      buildUser({ tenantLevel: TenantLevel.CONTINENTAL }),
      {},
    );
    const arg = ctx.prismaMock.dataShareAgreement.findMany.mock.calls[0][0];
    expect(arg.where.OR).toBeUndefined();
  });

  it('filters by role=sent', async () => {
    ctx.prismaMock.dataShareAgreement.findMany.mockResolvedValueOnce([]);
    ctx.prismaMock.dataShareAgreement.count.mockResolvedValueOnce(0);

    await ctx.service.findAll(buildUser(), { role: 'sent' });
    const arg = ctx.prismaMock.dataShareAgreement.findMany.mock.calls[0][0];
    expect(arg.where.owner_tenant_id).toBe(OWNER_TENANT);
    expect(arg.where.OR).toBeUndefined();
  });
});

describe('AgreementService.findOne', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('returns the agreement for the owner', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce(buildRow());
    const res = await ctx.service.findOne(AGREEMENT_ID, buildUser());
    expect(res.data.id).toBe(AGREEMENT_ID);
  });

  it('returns 404 when user is neither owner nor recipient', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce(buildRow());
    await expect(
      ctx.service.findOne(
        AGREEMENT_ID,
        buildUser({ tenantId: '99999999-9999-9999-9999-999999999999' }),
      ),
    ).rejects.toThrow(/not found/);
  });

  it('returns 404 when agreement does not exist', async () => {
    ctx.prismaMock.dataShareAgreement.findUnique.mockResolvedValueOnce(null);
    await expect(
      ctx.service.findOne(AGREEMENT_ID, buildUser()),
    ).rejects.toThrow(/not found/);
  });
});
