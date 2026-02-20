import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CorrectionService } from './correction.service';
import { PrismaService } from '../prisma.service';
import { KafkaProducerService } from '@aris/kafka-client';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole, TenantLevel } from '@aris/shared-types';

const msUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'steward@ke.gov',
  role: UserRole.DATA_STEWARD,
  tenantId: '00000000-0000-0000-0000-000000000020',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

const continentalUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000002',
  email: 'admin@au-ibar.org',
  role: UserRole.CONTINENTAL_ADMIN,
  tenantId: '00000000-0000-0000-0000-000000000010',
  tenantLevel: TenantLevel.CONTINENTAL,
};

const now = new Date();
const pastDeadline = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const futureDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

const mockTracker = {
  id: '00000000-0000-0000-0000-000000000100',
  reportId: '00000000-0000-0000-0000-000000000200',
  status: 'PENDING',
  correctionDeadline: futureDeadline,
  escalationDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
  correctedAt: null,
  escalatedAt: null,
  notifiedAt: null,
  assignedTo: null,
  createdAt: now,
  updatedAt: now,
};

const mockTrackerWithReport = {
  ...mockTracker,
  report: {
    id: mockTracker.reportId,
    recordId: 'rec-1',
    domain: 'health',
    entityType: 'Outbreak',
    tenantId: msUser.tenantId,
    submittedBy: msUser.userId,
    overallStatus: 'FAILED',
  },
};

describe('CorrectionService', () => {
  let service: CorrectionService;
  let prisma: {
    correctionTracker: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let kafkaProducer: { send: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      correctionTracker: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(mockTracker),
        count: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue({ ...mockTracker, status: 'CORRECTED', correctedAt: now }),
      },
    };
    kafkaProducer = { send: vi.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        CorrectionService,
        { provide: PrismaService, useValue: prisma },
        { provide: KafkaProducerService, useValue: kafkaProducer },
      ],
    }).compile();

    service = module.get(CorrectionService);
  });

  describe('markCorrected', () => {
    it('should mark a correction as CORRECTED', async () => {
      const result = await service.markCorrected(mockTracker.reportId);

      expect(result.data.status).toBe('CORRECTED');
      expect(prisma.correctionTracker.update).toHaveBeenCalledWith({
        where: { id: mockTracker.id },
        data: expect.objectContaining({
          status: 'CORRECTED',
          correctedAt: expect.any(Date),
        }),
      });
    });

    it('should return immediately if already corrected', async () => {
      prisma.correctionTracker.findUnique.mockResolvedValue({
        ...mockTracker,
        status: 'CORRECTED',
      });

      const result = await service.markCorrected(mockTracker.reportId);

      expect(result.data).toBeDefined();
      expect(prisma.correctionTracker.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when tracker not found', async () => {
      prisma.correctionTracker.findUnique.mockResolvedValue(null);

      await expect(
        service.markCorrected('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assign', () => {
    it('should assign a correction to a user', async () => {
      prisma.correctionTracker.update.mockResolvedValue({
        ...mockTracker,
        assignedTo: msUser.userId,
      });

      const result = await service.assign(mockTracker.reportId, msUser.userId);

      expect(result.data.assignedTo).toBe(msUser.userId);
    });

    it('should throw NotFoundException when tracker not found', async () => {
      prisma.correctionTracker.findUnique.mockResolvedValue(null);

      await expect(
        service.assign('nonexistent', msUser.userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated corrections', async () => {
      prisma.correctionTracker.findMany.mockResolvedValue([mockTrackerWithReport]);

      const result = await service.findAll(continentalUser, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should filter by status', async () => {
      await service.findAll(continentalUser, { status: 'ESCALATED' });

      const findManyCall = prisma.correctionTracker.findMany.mock.calls[0][0];
      expect(findManyCall.where).toHaveProperty('status', 'ESCALATED');
    });

    it('should filter by tenant for MS users', async () => {
      await service.findAll(msUser, {});

      const findManyCall = prisma.correctionTracker.findMany.mock.calls[0][0];
      expect(findManyCall.where).toHaveProperty('report', { tenantId: msUser.tenantId });
    });
  });

  describe('findByReportId', () => {
    it('should return tracker for a report', async () => {
      prisma.correctionTracker.findUnique.mockResolvedValue(mockTrackerWithReport);

      const result = await service.findByReportId(mockTracker.reportId, msUser);

      expect(result.data).toBeDefined();
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.correctionTracker.findUnique.mockResolvedValue(null);

      await expect(
        service.findByReportId('nonexistent', msUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation for MS users', async () => {
      prisma.correctionTracker.findUnique.mockResolvedValue({
        ...mockTrackerWithReport,
        report: { ...mockTrackerWithReport.report, tenantId: 'different-tenant' },
      });

      await expect(
        service.findByReportId(mockTracker.reportId, msUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleOverdueCorrections (cron)', () => {
    it('should escalate overdue PENDING corrections', async () => {
      const overdueTracker = {
        ...mockTracker,
        correctionDeadline: pastDeadline,
        report: mockTrackerWithReport.report,
      };

      prisma.correctionTracker.findMany
        .mockResolvedValueOnce([overdueTracker]) // overdue for escalation
        .mockResolvedValueOnce([]); // overdue for expiry

      await service.handleOverdueCorrections();

      expect(prisma.correctionTracker.update).toHaveBeenCalledWith({
        where: { id: overdueTracker.id },
        data: expect.objectContaining({
          status: 'ESCALATED',
          escalatedAt: expect.any(Date),
        }),
      });

      // Should publish Kafka overdue event
      expect(kafkaProducer.send).toHaveBeenCalledWith(
        'au.quality.correction.overdue.v1',
        expect.any(String),
        expect.objectContaining({
          trackerId: overdueTracker.id,
          reportId: overdueTracker.reportId,
          domain: 'health',
        }),
        expect.any(Object),
      );
    });

    it('should expire ESCALATED corrections past escalation deadline', async () => {
      const escalatedTracker = {
        ...mockTracker,
        status: 'ESCALATED',
        escalationDeadline: pastDeadline,
      };

      prisma.correctionTracker.findMany
        .mockResolvedValueOnce([])  // no overdue PENDING
        .mockResolvedValueOnce([escalatedTracker]); // overdue ESCALATED

      await service.handleOverdueCorrections();

      expect(prisma.correctionTracker.update).toHaveBeenCalledWith({
        where: { id: escalatedTracker.id },
        data: { status: 'EXPIRED' },
      });
    });

    it('should not throw when Kafka publish fails', async () => {
      const overdueTracker = {
        ...mockTracker,
        correctionDeadline: pastDeadline,
        report: mockTrackerWithReport.report,
      };

      prisma.correctionTracker.findMany
        .mockResolvedValueOnce([overdueTracker])
        .mockResolvedValueOnce([]);

      kafkaProducer.send.mockRejectedValue(new Error('Kafka down'));

      // Should not throw
      await expect(service.handleOverdueCorrections()).resolves.not.toThrow();
    });

    it('should do nothing when no overdue corrections exist', async () => {
      prisma.correctionTracker.findMany.mockResolvedValue([]);

      await service.handleOverdueCorrections();

      expect(prisma.correctionTracker.update).not.toHaveBeenCalled();
      expect(kafkaProducer.send).not.toHaveBeenCalled();
    });
  });
});
