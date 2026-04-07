import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantLevel, SHARE_STATUSES } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { DashboardService } from '../dashboard.service';

const REC_TENANT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function buildUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-1',
    tenantId: REC_TENANT,
    tenantLevel: TenantLevel.CONTINENTAL,
    roles: ['CONTINENTAL_ADMIN'],
    email: 'admin@au-aris.org',
    ...overrides,
  } as AuthenticatedUser;
}

function makeService() {
  const prismaMock = {
    dataShareAgreement: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    dataShareAccessLog: {
      count: vi.fn(),
    },
  } as any;
  return { service: new DashboardService(prismaMock), prismaMock };
}

function mockDashboardQueries(
  prisma: any,
  opts: {
    total?: number;
    statusGroups?: Array<{ status: string; count: number }>;
    domainGroups?: Array<{ data_domain: string; count: number }>;
    active?: number;
    expiring?: number;
    owners?: Array<{ owner_tenant_id: string; count: number }>;
    recipients?: Array<{ recipient_tenant_id: string; count: number }>;
    accesses?: number;
    exports?: number;
  } = {},
) {
  prisma.dataShareAgreement.count
    .mockResolvedValueOnce(opts.total ?? 0) // totalAgreements
    .mockResolvedValueOnce(opts.active ?? 0) // activeAgreements
    .mockResolvedValueOnce(opts.expiring ?? 0); // expiringWithin30Days

  prisma.dataShareAgreement.groupBy
    .mockResolvedValueOnce(
      (opts.statusGroups ?? []).map((g) => ({
        status: g.status,
        _count: { _all: g.count },
      })),
    )
    .mockResolvedValueOnce(
      (opts.domainGroups ?? []).map((g) => ({
        data_domain: g.data_domain,
        _count: { _all: g.count },
      })),
    )
    .mockResolvedValueOnce(
      (opts.owners ?? []).map((g) => ({
        owner_tenant_id: g.owner_tenant_id,
        _count: { _all: g.count },
      })),
    )
    .mockResolvedValueOnce(
      (opts.recipients ?? []).map((g) => ({
        recipient_tenant_id: g.recipient_tenant_id,
        _count: { _all: g.count },
      })),
    );

  prisma.dataShareAccessLog.count
    .mockResolvedValueOnce(opts.accesses ?? 0)
    .mockResolvedValueOnce(opts.exports ?? 0);
}

describe('DashboardService.getStats', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('returns stats for CONTINENTAL user with no tenant filter', async () => {
    mockDashboardQueries(ctx.prismaMock, {
      total: 10,
      statusGroups: [
        { status: 'ACTIVE', count: 5 },
        { status: 'DRAFT', count: 2 },
      ],
      domainGroups: [{ data_domain: 'animal-health', count: 7 }],
      active: 5,
      expiring: 1,
      owners: [{ owner_tenant_id: 'o1', count: 3 }],
      recipients: [{ recipient_tenant_id: 'r1', count: 4 }],
      accesses: 20,
      exports: 5,
    });

    const stats = await ctx.service.getStats(buildUser());
    expect(stats.totalAgreements).toBe(10);
    expect(stats.activeAgreements).toBe(5);
    expect(stats.expiringWithin30Days).toBe(1);
    expect(stats.byStatus.ACTIVE).toBe(5);
    expect(stats.byStatus.DRAFT).toBe(2);
    expect(stats.byDomain['animal-health']).toBe(7);
    expect(stats.topOwners).toEqual([{ tenantId: 'o1', count: 3 }]);
    expect(stats.topRecipients).toEqual([{ tenantId: 'r1', count: 4 }]);
    expect(stats.totalAccessesLast30Days).toBe(20);
    expect(stats.totalExportsLast30Days).toBe(5);

    // CONTINENTAL should not restrict the count base where
    const baseWhere = ctx.prismaMock.dataShareAgreement.count.mock.calls[0][0].where;
    expect(baseWhere.OR).toBeUndefined();
  });

  it('restricts REC user to agreements where they are a party', async () => {
    mockDashboardQueries(ctx.prismaMock);
    ctx.prismaMock.dataShareAgreement.findMany.mockResolvedValueOnce([]);

    await ctx.service.getStats(
      buildUser({ tenantLevel: TenantLevel.REC, roles: ['REC_ADMIN'] }),
    );

    const baseWhere = ctx.prismaMock.dataShareAgreement.count.mock.calls[0][0].where;
    expect(baseWhere.OR).toEqual([
      { owner_tenant_id: REC_TENANT },
      { recipient_tenant_id: REC_TENANT },
    ]);
  });

  it('throws 403 for MEMBER_STATE users', async () => {
    await expect(
      ctx.service.getStats(
        buildUser({ tenantLevel: TenantLevel.MEMBER_STATE, roles: ['NATIONAL_ADMIN'] }),
      ),
    ).rejects.toThrow(/restricted/);
  });

  it('byStatus contains all 7 statuses with 0 defaults when no data', async () => {
    mockDashboardQueries(ctx.prismaMock);
    const stats = await ctx.service.getStats(buildUser());
    for (const s of SHARE_STATUSES) {
      expect(stats.byStatus[s]).toBe(0);
    }
    expect(Object.keys(stats.byStatus)).toHaveLength(7);
  });
});
