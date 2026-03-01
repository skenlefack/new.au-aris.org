import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ComplianceService } from '../compliance.service';
import { TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { QualitySla } from '../../contract/entities/contract.entity';

// ── Mock factories ──

function mockPrismaService() {
  return {
    dataContract: {
      findUnique: vi.fn(),
    },
    complianceRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
}

function continentalUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-au',
    email: 'admin@au-aris.org',
    role: UserRole.SUPER_ADMIN,
    tenantId: 'tenant-au',
    tenantLevel: TenantLevel.CONTINENTAL,
    ...overrides,
  };
}

function msUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-ke',
    email: 'admin@ke.au-aris.org',
    role: UserRole.NATIONAL_ADMIN,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

const DEFAULT_QUALITY_SLA: QualitySla = {
  correctionDeadline: 48,
  escalationDeadline: 72,
  minPassRate: 0.85,
};

const periodFrom = new Date('2024-01-01');
const periodTo = new Date('2024-01-31');

// ── Tests ──

describe('ComplianceService', () => {
  let service: ComplianceService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(() => {
    prisma = mockPrismaService();
    service = new ComplianceService(prisma as never);
  });

  // ── calculateMetrics (pure logic) ──

  describe('calculateMetrics', () => {
    it('should return perfect compliance with no records', () => {
      const metrics = service.calculateMetrics(
        'contract-1',
        'Test Contract',
        24,
        DEFAULT_QUALITY_SLA,
        [],
        periodFrom,
        periodTo,
      );

      expect(metrics.totalSubmissions).toBe(0);
      expect(metrics.timelinessRate).toBe(1); // No records = compliant
      expect(metrics.qualityPassRate).toBe(1);
      expect(metrics.slaMet).toBe(true);
      expect(metrics.overdueCount).toBe(0);
    });

    it('should calculate 100% timeliness when all submissions are on time', () => {
      const records = [
        { timeliness_hours: 12, sla_met: true, quality_passed: true, submission_time: new Date() },
        { timeliness_hours: 18, sla_met: true, quality_passed: true, submission_time: new Date() },
        { timeliness_hours: 23, sla_met: true, quality_passed: true, submission_time: new Date() },
      ];

      const metrics = service.calculateMetrics(
        'contract-1',
        'Test',
        24,
        DEFAULT_QUALITY_SLA,
        records,
        periodFrom,
        periodTo,
      );

      expect(metrics.onTimeSubmissions).toBe(3);
      expect(metrics.lateSubmissions).toBe(0);
      expect(metrics.timelinessRate).toBe(1);
      expect(metrics.slaMet).toBe(true);
    });

    it('should calculate partial timeliness when some submissions are late', () => {
      const records = [
        { timeliness_hours: 12, sla_met: true, quality_passed: true, submission_time: new Date() },
        { timeliness_hours: 30, sla_met: false, quality_passed: true, submission_time: new Date() },
        { timeliness_hours: 48, sla_met: false, quality_passed: true, submission_time: new Date() },
        { timeliness_hours: 20, sla_met: true, quality_passed: true, submission_time: new Date() },
      ];

      const metrics = service.calculateMetrics(
        'contract-1',
        'Test',
        24,
        DEFAULT_QUALITY_SLA,
        records,
        periodFrom,
        periodTo,
      );

      expect(metrics.onTimeSubmissions).toBe(2);
      expect(metrics.lateSubmissions).toBe(2);
      expect(metrics.timelinessRate).toBe(0.5);
      expect(metrics.slaMet).toBe(false); // 50% < 90% threshold
    });

    it('should calculate average timeliness hours correctly', () => {
      const records = [
        { timeliness_hours: 10, sla_met: true, quality_passed: true, submission_time: new Date() },
        { timeliness_hours: 20, sla_met: true, quality_passed: true, submission_time: new Date() },
        { timeliness_hours: 30, sla_met: false, quality_passed: true, submission_time: new Date() },
      ];

      const metrics = service.calculateMetrics(
        'contract-1',
        'Test',
        24,
        DEFAULT_QUALITY_SLA,
        records,
        periodFrom,
        periodTo,
      );

      expect(metrics.averageTimelinessHours).toBe(20); // (10+20+30)/3
    });

    it('should calculate quality pass rate correctly', () => {
      const records = [
        { timeliness_hours: 12, sla_met: true, quality_passed: true, submission_time: new Date() },
        { timeliness_hours: 12, sla_met: true, quality_passed: true, submission_time: new Date() },
        { timeliness_hours: 12, sla_met: true, quality_passed: false, submission_time: new Date() },
        { timeliness_hours: 12, sla_met: true, quality_passed: true, submission_time: new Date() },
        { timeliness_hours: 12, sla_met: true, quality_passed: false, submission_time: new Date() },
      ];

      const metrics = service.calculateMetrics(
        'contract-1',
        'Test',
        24,
        DEFAULT_QUALITY_SLA,
        records,
        periodFrom,
        periodTo,
      );

      expect(metrics.qualityPassCount).toBe(3);
      expect(metrics.qualityFailCount).toBe(2);
      expect(metrics.qualityPassRate).toBe(0.6);
      expect(metrics.slaMet).toBe(false); // 0.6 < 0.85 minPassRate
    });

    it('should mark SLA as met when both timeliness and quality meet thresholds', () => {
      // 9/10 on time (90%) and 9/10 quality pass (90% > 85% minPassRate)
      const records = Array.from({ length: 10 }, (_, i) => ({
        timeliness_hours: i < 9 ? 12 : 30,
        sla_met: i < 9,
        quality_passed: i < 9,
        submission_time: new Date(),
      }));

      const metrics = service.calculateMetrics(
        'contract-1',
        'Test',
        24,
        DEFAULT_QUALITY_SLA,
        records,
        periodFrom,
        periodTo,
      );

      expect(metrics.timelinessRate).toBe(0.9);
      expect(metrics.qualityPassRate).toBe(0.9);
      expect(metrics.slaMet).toBe(true);
    });

    it('should mark SLA as NOT met when timeliness is below 90%', () => {
      // 8/10 on time (80%)
      const records = Array.from({ length: 10 }, (_, i) => ({
        timeliness_hours: i < 8 ? 12 : 30,
        sla_met: i < 8,
        quality_passed: true,
        submission_time: new Date(),
      }));

      const metrics = service.calculateMetrics(
        'contract-1',
        'Test',
        24,
        DEFAULT_QUALITY_SLA,
        records,
        periodFrom,
        periodTo,
      );

      expect(metrics.timelinessRate).toBe(0.8);
      expect(metrics.slaMet).toBe(false);
    });

    it('should mark SLA as NOT met when quality pass rate is below minPassRate', () => {
      // 100% on time but 80% quality (below 85% minPassRate)
      const records = Array.from({ length: 10 }, (_, i) => ({
        timeliness_hours: 12,
        sla_met: true,
        quality_passed: i < 8,
        submission_time: new Date(),
      }));

      const metrics = service.calculateMetrics(
        'contract-1',
        'Test',
        24,
        DEFAULT_QUALITY_SLA,
        records,
        periodFrom,
        periodTo,
      );

      expect(metrics.qualityPassRate).toBe(0.8);
      expect(metrics.slaMet).toBe(false);
    });

    it('should count overdue records (no submission_time)', () => {
      const records = [
        { timeliness_hours: 12, sla_met: true, quality_passed: true, submission_time: new Date() },
        { timeliness_hours: null, sla_met: null, quality_passed: null, submission_time: null },
        { timeliness_hours: null, sla_met: null, quality_passed: null, submission_time: null },
      ];

      const metrics = service.calculateMetrics(
        'contract-1',
        'Test',
        24,
        DEFAULT_QUALITY_SLA,
        records,
        periodFrom,
        periodTo,
      );

      expect(metrics.overdueCount).toBe(2);
    });

    it('should flag atRisk when quality pass rate is near min threshold', () => {
      // 100% on time, quality at 0.90 (within 0.1 of minPassRate 0.85)
      const records = Array.from({ length: 10 }, (_, i) => ({
        timeliness_hours: 12,
        sla_met: true,
        quality_passed: i < 9,
        submission_time: new Date(),
      }));

      const metrics = service.calculateMetrics(
        'contract-1',
        'Test',
        24,
        DEFAULT_QUALITY_SLA,
        records,
        periodFrom,
        periodTo,
      );

      expect(metrics.qualityPassRate).toBe(0.9);
      expect(metrics.slaMet).toBe(true);
      expect(metrics.atRisk).toBe(true); // 0.90 < 0.85 + 0.10
    });

    it('should flag atRisk when average timeliness approaches SLA limit', () => {
      // All on time but averaging 80% of SLA hours
      const records = Array.from({ length: 5 }, () => ({
        timeliness_hours: 20, // 20h avg with 24h SLA → 83% > 80%
        sla_met: true,
        quality_passed: true,
        submission_time: new Date(),
      }));

      const metrics = service.calculateMetrics(
        'contract-1',
        'Test',
        24,
        DEFAULT_QUALITY_SLA,
        records,
        periodFrom,
        periodTo,
      );

      expect(metrics.averageTimelinessHours).toBe(20);
      expect(metrics.atRisk).toBe(true); // 20 > 24 * 0.8 = 19.2
    });

    it('should NOT flag atRisk when all metrics are well within bounds', () => {
      const records = Array.from({ length: 10 }, () => ({
        timeliness_hours: 6, // Well within 24h SLA
        sla_met: true,
        quality_passed: true,
        submission_time: new Date(),
      }));

      const metrics = service.calculateMetrics(
        'contract-1',
        'Test',
        24,
        DEFAULT_QUALITY_SLA,
        records,
        periodFrom,
        periodTo,
      );

      expect(metrics.timelinessRate).toBe(1);
      expect(metrics.qualityPassRate).toBe(1);
      expect(metrics.averageTimelinessHours).toBe(6);
      expect(metrics.slaMet).toBe(true);
      expect(metrics.atRisk).toBe(false);
    });

    it('should handle records with null quality_passed (quality pending)', () => {
      const records = [
        { timeliness_hours: 12, sla_met: true, quality_passed: null, submission_time: new Date() },
        { timeliness_hours: 12, sla_met: true, quality_passed: true, submission_time: new Date() },
      ];

      const metrics = service.calculateMetrics(
        'contract-1',
        'Test',
        24,
        DEFAULT_QUALITY_SLA,
        records,
        periodFrom,
        periodTo,
      );

      // Only 1 record has quality result
      expect(metrics.qualityPassCount).toBe(1);
      expect(metrics.qualityFailCount).toBe(0);
      expect(metrics.qualityPassRate).toBe(1);
    });

    it('should handle mixed null and non-null timeliness records', () => {
      const records = [
        { timeliness_hours: 12, sla_met: true, quality_passed: true, submission_time: new Date() },
        { timeliness_hours: null, sla_met: null, quality_passed: true, submission_time: null },
      ];

      const metrics = service.calculateMetrics(
        'contract-1',
        'Test',
        24,
        DEFAULT_QUALITY_SLA,
        records,
        periodFrom,
        periodTo,
      );

      // Only 1 record with timeliness data
      expect(metrics.onTimeSubmissions).toBe(1);
      expect(metrics.lateSubmissions).toBe(0);
      expect(metrics.timelinessRate).toBe(1);
      expect(metrics.averageTimelinessHours).toBe(12);
    });

    it('should round metrics to specified precision', () => {
      const records = [
        { timeliness_hours: 10, sla_met: true, quality_passed: true, submission_time: new Date() },
        { timeliness_hours: 15, sla_met: true, quality_passed: true, submission_time: new Date() },
        { timeliness_hours: 30, sla_met: false, quality_passed: false, submission_time: new Date() },
      ];

      const metrics = service.calculateMetrics(
        'contract-1',
        'Test',
        24,
        DEFAULT_QUALITY_SLA,
        records,
        periodFrom,
        periodTo,
      );

      // timelinessRate = 2/3 = 0.6667
      expect(metrics.timelinessRate).toBe(0.6667);
      // qualityPassRate = 2/3 = 0.6667
      expect(metrics.qualityPassRate).toBe(0.6667);
      // averageTimelinessHours = (10+15+30)/3 = 18.33
      expect(metrics.averageTimelinessHours).toBe(18.33);
    });
  });

  // ── getCompliance ──

  describe('getCompliance', () => {
    it('should return compliance metrics for a contract', async () => {
      prisma.dataContract.findUnique.mockResolvedValue({
        id: 'contract-1',
        name: 'Test',
        tenant_id: 'tenant-au',
        timeliness_sla: 24,
        quality_sla: DEFAULT_QUALITY_SLA,
      });
      prisma.complianceRecord.findMany.mockResolvedValue([]);

      const result = await service.getCompliance(
        'contract-1',
        continentalUser(),
        30,
      );

      expect(result.data.contractId).toBe('contract-1');
      expect(result.data.totalSubmissions).toBe(0);
      expect(result.data.slaMet).toBe(true);
    });

    it('should throw NotFoundException for nonexistent contract', async () => {
      prisma.dataContract.findUnique.mockResolvedValue(null);

      await expect(
        service.getCompliance('nonexistent', continentalUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny MS user access to another tenant compliance', async () => {
      prisma.dataContract.findUnique.mockResolvedValue({
        id: 'contract-1',
        name: 'Test',
        tenant_id: 'tenant-ng',
        timeliness_sla: 24,
        quality_sla: DEFAULT_QUALITY_SLA,
      });

      await expect(
        service.getCompliance('contract-1', msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── recordSubmission ──

  describe('recordSubmission', () => {
    it('should create a compliance record with SLA met', async () => {
      prisma.dataContract.findUnique.mockResolvedValue({
        id: 'contract-1',
        timeliness_sla: 24,
      });

      const eventTime = new Date('2024-01-15T08:00:00Z');
      const submitTime = new Date('2024-01-15T18:00:00Z'); // 10h later

      await service.recordSubmission({
        contractId: 'contract-1',
        tenantId: 'tenant-ke',
        recordId: 'rec-1',
        eventType: 'form_submitted',
        eventTimestamp: eventTime,
        submissionTime: submitTime,
      });

      expect(prisma.complianceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contract_id: 'contract-1',
          timeliness_hours: 10,
          sla_met: true,
        }),
      });
    });

    it('should create a compliance record with SLA breached', async () => {
      prisma.dataContract.findUnique.mockResolvedValue({
        id: 'contract-1',
        timeliness_sla: 24,
      });

      const eventTime = new Date('2024-01-15T08:00:00Z');
      const submitTime = new Date('2024-01-17T08:00:00Z'); // 48h later

      await service.recordSubmission({
        contractId: 'contract-1',
        tenantId: 'tenant-ke',
        recordId: 'rec-2',
        eventType: 'form_submitted',
        eventTimestamp: eventTime,
        submissionTime: submitTime,
      });

      expect(prisma.complianceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          timeliness_hours: 48,
          sla_met: false,
        }),
      });
    });

    it('should skip if contract not found', async () => {
      prisma.dataContract.findUnique.mockResolvedValue(null);

      await service.recordSubmission({
        contractId: 'nonexistent',
        tenantId: 'tenant-ke',
        recordId: 'rec-1',
        eventType: 'form_submitted',
        eventTimestamp: new Date(),
        submissionTime: new Date(),
      });

      expect(prisma.complianceRecord.create).not.toHaveBeenCalled();
    });
  });

  // ── recordQualityResult ──

  describe('recordQualityResult', () => {
    it('should update existing compliance record with quality result', async () => {
      prisma.complianceRecord.findFirst.mockResolvedValue({
        id: 'comp-1',
        contract_id: 'contract-1',
        record_id: 'rec-1',
      });

      await service.recordQualityResult({
        contractId: 'contract-1',
        tenantId: 'tenant-ke',
        recordId: 'rec-1',
        passed: true,
        qualityReportId: 'qr-1',
      });

      expect(prisma.complianceRecord.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: {
          quality_passed: true,
          quality_report_id: 'qr-1',
        },
      });
    });

    it('should create new compliance record if no existing one found', async () => {
      prisma.complianceRecord.findFirst.mockResolvedValue(null);

      await service.recordQualityResult({
        contractId: 'contract-1',
        tenantId: 'tenant-ke',
        recordId: 'rec-new',
        passed: false,
        qualityReportId: 'qr-2',
      });

      expect(prisma.complianceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contract_id: 'contract-1',
          record_id: 'rec-new',
          quality_passed: false,
          quality_report_id: 'qr-2',
        }),
      });
    });
  });
});
