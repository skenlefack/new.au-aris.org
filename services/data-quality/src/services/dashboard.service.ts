import { PrismaClient } from '@prisma/client';
import { TenantLevel } from '@aris/shared-types';
import type { ApiResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export interface DashboardKpis {
  totalReports: number;
  passRate: number;
  failRate: number;
  warningRate: number;
  avgDurationMs: number;
  pendingCorrections: number;
  overdueCorrections: number;
  avgCorrectionTimeHours: number | null;
  byDomain: DomainStats[];
  byGate: GateStats[];
}

export interface DomainStats {
  domain: string;
  total: number;
  passed: number;
  failed: number;
  warning: number;
  passRate: number;
}

export interface GateStats {
  gate: string;
  failCount: number;
  warningCount: number;
}

export class DashboardService {
  constructor(private readonly prisma: PrismaClient) {}

  async getKpis(
    user: AuthenticatedUser,
    query: { domain?: string; from?: string; to?: string },
  ): Promise<ApiResponse<DashboardKpis>> {
    const where = this.buildFilter(user, query);
    const correctionWhere = this.buildCorrectionFilter(user);

    // Run all queries in parallel
    const [
      totalReports,
      passedCount,
      failedCount,
      warningCount,
      avgDuration,
      pendingCorrections,
      overdueCorrections,
      avgCorrectionTime,
      domainBreakdown,
      gateViolations,
    ] = await Promise.all([
      (this.prisma as any).qualityReport.count({ where }),
      (this.prisma as any).qualityReport.count({ where: { ...where, overallStatus: 'PASSED' } }),
      (this.prisma as any).qualityReport.count({ where: { ...where, overallStatus: 'FAILED' } }),
      (this.prisma as any).qualityReport.count({ where: { ...where, overallStatus: 'WARNING' } }),
      (this.prisma as any).qualityReport.aggregate({ where, _avg: { totalDurationMs: true } }),
      (this.prisma as any).correctionTracker.count({
        where: { ...correctionWhere, status: 'PENDING' },
      }),
      (this.prisma as any).correctionTracker.count({
        where: {
          ...correctionWhere,
          status: 'PENDING',
          correctionDeadline: { lt: new Date() },
        },
      }),
      this.computeAvgCorrectionTime(correctionWhere),
      (this.prisma as any).qualityReport.groupBy({
        by: ['domain'],
        where,
        _count: { id: true },
      }),
      (this.prisma as any).qualityViolation.groupBy({
        by: ['gate', 'severity'],
        _count: { id: true },
      }),
    ]);

    const total = totalReports || 1; // avoid divide by zero

    // Build domain stats
    const domainStatusCounts = await Promise.all(
      domainBreakdown.map(async (d: { domain: string; _count: { id: number } }) => {
        const domainWhere = { ...where, domain: d.domain };
        const [p, f, w] = await Promise.all([
          (this.prisma as any).qualityReport.count({ where: { ...domainWhere, overallStatus: 'PASSED' } }),
          (this.prisma as any).qualityReport.count({ where: { ...domainWhere, overallStatus: 'FAILED' } }),
          (this.prisma as any).qualityReport.count({ where: { ...domainWhere, overallStatus: 'WARNING' } }),
        ]);
        const t = p + f + w;
        return {
          domain: d.domain,
          total: t,
          passed: p,
          failed: f,
          warning: w,
          passRate: t > 0 ? Math.round((p / t) * 10000) / 100 : 0,
        };
      }),
    );

    // Build gate stats
    const gateMap = new Map<string, { failCount: number; warningCount: number }>();
    for (const v of gateViolations) {
      const existing = gateMap.get(v.gate) ?? { failCount: 0, warningCount: 0 };
      if (v.severity === 'FAIL') existing.failCount += v._count.id;
      if (v.severity === 'WARNING') existing.warningCount += v._count.id;
      gateMap.set(v.gate, existing);
    }

    return {
      data: {
        totalReports,
        passRate: Math.round((passedCount / total) * 10000) / 100,
        failRate: Math.round((failedCount / total) * 10000) / 100,
        warningRate: Math.round((warningCount / total) * 10000) / 100,
        avgDurationMs: Math.round(avgDuration._avg.totalDurationMs ?? 0),
        pendingCorrections,
        overdueCorrections,
        avgCorrectionTimeHours: avgCorrectionTime,
        byDomain: domainStatusCounts,
        byGate: Array.from(gateMap.entries()).map(([gate, stats]) => ({
          gate,
          ...stats,
        })),
      },
    };
  }

  private async computeAvgCorrectionTime(
    where: Record<string, unknown>,
  ): Promise<number | null> {
    const corrected = await (this.prisma as any).correctionTracker.findMany({
      where: { ...where, status: 'CORRECTED', correctedAt: { not: null } },
      select: { createdAt: true, correctedAt: true },
      take: 1000,
    });

    if (corrected.length === 0) return null;

    const totalMs = corrected.reduce((sum: number, c: { createdAt: Date; correctedAt: Date }) => {
      const diff = (c.correctedAt as Date).getTime() - c.createdAt.getTime();
      return sum + diff;
    }, 0);

    return Math.round((totalMs / corrected.length / (60 * 60 * 1000)) * 100) / 100;
  }

  private buildFilter(
    user: AuthenticatedUser,
    query: { domain?: string; from?: string; to?: string },
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where['tenantId'] = user.tenantId;
    }
    if (query.domain) where['domain'] = query.domain;
    if (query.from || query.to) {
      where['checkedAt'] = {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      };
    }
    return where;
  }

  private buildCorrectionFilter(user: AuthenticatedUser): Record<string, unknown> {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return {};
    return { report: { tenantId: user.tenantId } };
  }
}
