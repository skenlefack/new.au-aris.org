import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReportService } from './report.service';
import { PrismaService } from '../prisma.service';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole, TenantLevel } from '@aris/shared-types';

const continentalUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'admin@au-aris.org',
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

const mockReport = {
  id: '00000000-0000-0000-0000-000000000100',
  recordId: 'rec-1',
  entityType: 'Outbreak',
  domain: 'health',
  tenantId: '00000000-0000-0000-0000-000000000020',
  overallStatus: 'PASSED',
  totalDurationMs: 15,
  checkedAt: new Date(),
  submittedBy: msUser.userId,
  dataContractId: null,
  createdAt: new Date(),
  gateResults: [],
  violations: [],
  correction: null,
};

describe('ReportService', () => {
  let service: ReportService;
  let prisma: {
    qualityReport: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      qualityReport: {
        findMany: vi.fn().mockResolvedValue([mockReport]),
        findUnique: vi.fn().mockResolvedValue(mockReport),
        count: vi.fn().mockResolvedValue(1),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ReportService);
  });

  describe('findAll', () => {
    it('should return paginated reports', async () => {
      const result = await service.findAll(continentalUser, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should filter by tenant for non-continental users', async () => {
      await service.findAll(msUser, {});

      const findManyCall = prisma.qualityReport.findMany.mock.calls[0][0];
      expect(findManyCall.where).toHaveProperty('tenantId', msUser.tenantId);
    });

    it('should not filter by tenant for continental users', async () => {
      await service.findAll(continentalUser, {});

      const findManyCall = prisma.qualityReport.findMany.mock.calls[0][0];
      expect(findManyCall.where).not.toHaveProperty('tenantId');
    });

    it('should apply domain and status filters', async () => {
      await service.findAll(continentalUser, { domain: 'health', status: 'FAILED' });

      const findManyCall = prisma.qualityReport.findMany.mock.calls[0][0];
      expect(findManyCall.where).toHaveProperty('domain', 'health');
      expect(findManyCall.where).toHaveProperty('overallStatus', 'FAILED');
    });

    it('should apply recordId filter', async () => {
      await service.findAll(continentalUser, { recordId: 'rec-42' });

      const findManyCall = prisma.qualityReport.findMany.mock.calls[0][0];
      expect(findManyCall.where).toHaveProperty('recordId', 'rec-42');
    });

    it('should respect page and limit', async () => {
      await service.findAll(continentalUser, { page: 3, limit: 5 });

      const findManyCall = prisma.qualityReport.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(10);
      expect(findManyCall.take).toBe(5);
    });

    it('should cap limit at MAX_LIMIT', async () => {
      await service.findAll(continentalUser, { limit: 500 });

      const findManyCall = prisma.qualityReport.findMany.mock.calls[0][0];
      expect(findManyCall.take).toBe(100);
    });
  });

  describe('findOne', () => {
    it('should return a single report', async () => {
      const result = await service.findOne(mockReport.id, continentalUser);

      expect(result.data.id).toBe(mockReport.id);
    });

    it('should throw NotFoundException when report does not exist', async () => {
      prisma.qualityReport.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent-id', continentalUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation for MS users', async () => {
      prisma.qualityReport.findUnique.mockResolvedValue({
        ...mockReport,
        tenantId: 'different-tenant-id',
      });

      await expect(
        service.findOne(mockReport.id, msUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow continental users to see any report', async () => {
      prisma.qualityReport.findUnique.mockResolvedValue({
        ...mockReport,
        tenantId: 'any-tenant-id',
      });

      const result = await service.findOne(mockReport.id, continentalUser);
      expect(result.data).toBeDefined();
    });
  });
});
