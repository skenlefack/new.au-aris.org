import type { PrismaClient } from '@prisma/client';
import {
  TenantLevel,
  SHARE_STATUSES,
} from '@aris/shared-types';
import type {
  DataShareDashboardStats,
  ShareStatus,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { HttpError } from './agreement.service';

export class DashboardService {
  constructor(private readonly prisma: PrismaClient) {}

  async getStats(user: AuthenticatedUser): Promise<DataShareDashboardStats> {
    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      user.tenantLevel !== TenantLevel.REC
    ) {
      throw new HttpError(403, 'Dashboard is restricted to REC and Continental users');
    }

    const baseWhere: Record<string, unknown> =
      user.tenantLevel === TenantLevel.CONTINENTAL
        ? {}
        : {
            OR: [
              { owner_tenant_id: user.tenantId },
              { recipient_tenant_id: user.tenantId },
            ],
          };

    const now = new Date();
    const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const minus30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const prisma: any = this.prisma;

    const [
      totalAgreements,
      statusGroups,
      domainGroups,
      activeAgreements,
      expiringWithin30Days,
      ownerGroups,
      recipientGroups,
    ] = await Promise.all([
      prisma.dataShareAgreement.count({ where: baseWhere }),
      prisma.dataShareAgreement.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.dataShareAgreement.groupBy({
        by: ['data_domain'],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.dataShareAgreement.count({
        where: { ...baseWhere, status: 'ACTIVE' },
      }),
      prisma.dataShareAgreement.count({
        where: {
          ...baseWhere,
          status: 'ACTIVE',
          valid_until: { gte: now, lte: in30d },
        },
      }),
      prisma.dataShareAgreement.groupBy({
        by: ['owner_tenant_id'],
        where: baseWhere,
        _count: { _all: true },
        orderBy: { _count: { owner_tenant_id: 'desc' } },
        take: 10,
      }),
      prisma.dataShareAgreement.groupBy({
        by: ['recipient_tenant_id'],
        where: baseWhere,
        _count: { _all: true },
        orderBy: { _count: { recipient_tenant_id: 'desc' } },
        take: 10,
      }),
    ]);

    // Access log counts — scope logs to the subset of agreements this user can see.
    let logWhere: Record<string, unknown> = {
      created_at: { gte: minus30d },
    };
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      // Restrict to logs for agreements where this REC is party
      const agreementIds = await prisma.dataShareAgreement.findMany({
        where: baseWhere,
        select: { id: true },
      });
      logWhere = {
        ...logWhere,
        agreement_id: { in: agreementIds.map((a: any) => a.id) },
      };
    }

    const [totalAccessesLast30Days, totalExportsLast30Days] = await Promise.all([
      prisma.dataShareAccessLog.count({ where: logWhere }),
      prisma.dataShareAccessLog.count({ where: { ...logWhere, action: 'EXPORT' } }),
    ]);

    // byStatus with all 7 statuses defaulted to 0
    const byStatus = SHARE_STATUSES.reduce<Record<ShareStatus, number>>(
      (acc, s) => {
        acc[s] = 0;
        return acc;
      },
      {} as Record<ShareStatus, number>,
    );
    for (const g of statusGroups as any[]) {
      byStatus[g.status as ShareStatus] = g._count?._all ?? 0;
    }

    const byDomain: Record<string, number> = {};
    for (const g of domainGroups as any[]) {
      byDomain[g.data_domain] = g._count?._all ?? 0;
    }

    const topOwners = (ownerGroups as any[]).map((g) => ({
      tenantId: g.owner_tenant_id,
      count: g._count?._all ?? 0,
    }));
    const topRecipients = (recipientGroups as any[]).map((g) => ({
      tenantId: g.recipient_tenant_id,
      count: g._count?._all ?? 0,
    }));

    return {
      totalAgreements,
      byStatus,
      byDomain,
      activeAgreements,
      expiringWithin30Days,
      totalAccessesLast30Days,
      totalExportsLast30Days,
      topOwners,
      topRecipients,
    };
  }
}
