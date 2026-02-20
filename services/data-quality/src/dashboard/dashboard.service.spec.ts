import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma.service';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole, TenantLevel } from '@aris/shared-types';

const continentalUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'admin@au-ibar.org',
  role: UserRole.CONTINENTAL_ADMIN,
  tenantId: '00000000-0000-0000-0000-000000000010',
  tenantLevel: TenantLevel.CONTINENTAL,
};

const msUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000002',
  email: 'steward@ke.gov',
  role: UserRole.DATA_STEWARD,
  tenantId: '00000000-0000-0000-0000-000000000020',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    qualityReport: {
      count: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
    correctionTracker: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    qualityViolation: {
      groupBy: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      qualityReport: {
        count: vi.fn().mockResolvedValue(100),
        aggregate: vi.fn().mockResolvedValue({ _avg: { totalDurationMs: 25 } }),
        groupBy: vi.fn().mockResolvedValue([
          { domain: 'health', _count: { id: 60 } },
          { domain: 'livestock', _count: { id: 40 } },
        ]),
      },
      correctionTracker: {
        count: vi.fn().mockResolvedValue(5),
        findMany: vi.fn().mockResolvedValue([]),
      },
      qualityViolation: {
        groupBy: vi.fn().mockResolvedValue([
          { gate: 'COMPLETENESS', severity: 'FAIL', _count: { id: 12 } },
          { gate: 'COMPLETENESS', severity: 'WARNING', _count: { id: 3 } },
          { gate: 'TEMPORAL_CONSISTENCY', severity: 'FAIL', _count: { id: 5 } },
        ]),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  describe('getKpis', () => {
    it('should return dashboard KPIs', async () => {
      // Mock count to return different values based on the where clause
      let callIndex = 0;
      prisma.qualityReport.count.mockImplementation(() => {
        const values = [100, 70, 20, 10, 50, 10, 20, 6, 14];
        return Promise.resolve(values[callIndex++] ?? 0);
      });

      const result = await service.getKpis(continentalUser, {});

      expect(result.data).toBeDefined();
      expect(result.data.totalReports).toBe(100);
      expect(result.data.passRate).toBeDefined();
      expect(result.data.failRate).toBeDefined();
      expect(result.data.warningRate).toBeDefined();
      expect(result.data.avgDurationMs).toBe(25);
      expect(result.data.pendingCorrections).toBeDefined();
      expect(result.data.byDomain).toBeInstanceOf(Array);
      expect(result.data.byGate).toBeInstanceOf(Array);
    });

    it('should filter by tenant for MS users', async () => {
      let callIndex = 0;
      prisma.qualityReport.count.mockImplementation(() => {
        return Promise.resolve([10, 7, 2, 1][callIndex++] ?? 0);
      });
      prisma.qualityReport.groupBy.mockResolvedValue([]);
      prisma.qualityViolation.groupBy.mockResolvedValue([]);

      await service.getKpis(msUser, {});

      // First count call should include tenantId
      const firstCall = prisma.qualityReport.count.mock.calls[0][0];
      expect(firstCall.where).toHaveProperty('tenantId', msUser.tenantId);
    });

    it('should handle zero reports without dividing by zero', async () => {
      prisma.qualityReport.count.mockResolvedValue(0);
      prisma.qualityReport.aggregate.mockResolvedValue({ _avg: { totalDurationMs: null } });
      prisma.qualityReport.groupBy.mockResolvedValue([]);
      prisma.qualityViolation.groupBy.mockResolvedValue([]);

      const result = await service.getKpis(continentalUser, {});

      // Should not throw — passRate uses total || 1
      expect(result.data.totalReports).toBe(0);
      expect(result.data.avgDurationMs).toBe(0);
    });

    it('should compute gate violation stats', async () => {
      prisma.qualityReport.count.mockResolvedValue(0);
      prisma.qualityReport.aggregate.mockResolvedValue({ _avg: { totalDurationMs: null } });
      prisma.qualityReport.groupBy.mockResolvedValue([]);

      const result = await service.getKpis(continentalUser, {});

      const completeness = result.data.byGate.find((g: { gate: string }) => g.gate === 'COMPLETENESS');
      expect(completeness).toBeDefined();
      expect(completeness!.failCount).toBe(12);
      expect(completeness!.warningCount).toBe(3);
    });

    it('should apply date range filters', async () => {
      prisma.qualityReport.count.mockResolvedValue(0);
      prisma.qualityReport.aggregate.mockResolvedValue({ _avg: { totalDurationMs: null } });
      prisma.qualityReport.groupBy.mockResolvedValue([]);
      prisma.qualityViolation.groupBy.mockResolvedValue([]);

      await service.getKpis(continentalUser, {
        from: '2024-01-01',
        to: '2024-12-31',
      });

      const firstCall = prisma.qualityReport.count.mock.calls[0][0];
      expect(firstCall.where).toHaveProperty('checkedAt');
    });

    it('should compute average correction time for corrected trackers', async () => {
      prisma.qualityReport.count.mockResolvedValue(0);
      prisma.qualityReport.aggregate.mockResolvedValue({ _avg: { totalDurationMs: null } });
      prisma.qualityReport.groupBy.mockResolvedValue([]);
      prisma.qualityViolation.groupBy.mockResolvedValue([]);

      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      prisma.correctionTracker.findMany.mockResolvedValue([
        { createdAt: twoHoursAgo, correctedAt: now },
      ]);

      const result = await service.getKpis(continentalUser, {});

      expect(result.data.avgCorrectionTimeHours).toBeCloseTo(2, 0);
    });
  });
});
