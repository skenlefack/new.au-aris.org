import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidateService } from './validate.service';
import { PrismaService } from '../prisma.service';
import { EngineService } from '../engine/engine.service';
import { KafkaProducerService } from '@aris/kafka-client';
import { QualityGateResult } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole, TenantLevel } from '@aris/shared-types';
import type { QualityReport as EngineReport } from '@aris/quality-rules';

const mockUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'steward@au-aris.org',
  role: UserRole.DATA_STEWARD,
  tenantId: '00000000-0000-0000-0000-000000000010',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

const mockPassReport: EngineReport = {
  recordId: 'rec-1',
  entityType: 'Outbreak',
  overallResult: QualityGateResult.PASS,
  gates: [
    { gate: 'COMPLETENESS' as any, result: QualityGateResult.PASS, violations: [], durationMs: 2 },
    { gate: 'TEMPORAL_CONSISTENCY' as any, result: QualityGateResult.PASS, violations: [], durationMs: 1 },
    { gate: 'GEOGRAPHIC_CONSISTENCY' as any, result: QualityGateResult.PASS, violations: [], durationMs: 1 },
    { gate: 'CODES_VOCABULARIES' as any, result: QualityGateResult.PASS, violations: [], durationMs: 1 },
    { gate: 'UNITS' as any, result: QualityGateResult.PASS, violations: [], durationMs: 1 },
    { gate: 'DEDUPLICATION' as any, result: QualityGateResult.PASS, violations: [], durationMs: 1 },
    { gate: 'AUDITABILITY' as any, result: QualityGateResult.PASS, violations: [], durationMs: 1 },
    { gate: 'CONFIDENCE_SCORE' as any, result: QualityGateResult.PASS, violations: [], durationMs: 1 },
  ],
  violations: [],
  totalDurationMs: 9,
  checkedAt: new Date().toISOString(),
};

const mockFailReport: EngineReport = {
  recordId: 'rec-2',
  entityType: 'Outbreak',
  overallResult: QualityGateResult.FAIL,
  gates: [
    {
      gate: 'COMPLETENESS' as any,
      result: QualityGateResult.FAIL,
      violations: [
        { gate: 'COMPLETENESS' as any, field: 'speciesCode', message: 'Field is required', severity: 'FAIL' },
      ],
      durationMs: 2,
    },
  ],
  violations: [
    { gate: 'COMPLETENESS' as any, field: 'speciesCode', message: 'Field is required', severity: 'FAIL' },
  ],
  totalDurationMs: 5,
  checkedAt: new Date().toISOString(),
};

describe('ValidateService', () => {
  let service: ValidateService;
  let prisma: {
    qualityReport: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    correctionTracker: {
      create: ReturnType<typeof vi.fn>;
    };
    customQualityRule: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };
  let engineService: { check: ReturnType<typeof vi.fn> };
  let kafkaProducer: { send: ReturnType<typeof vi.fn> };

  const mockPersistedReport = {
    id: '00000000-0000-0000-0000-000000000100',
    recordId: 'rec-1',
    entityType: 'Outbreak',
    domain: 'health',
    tenantId: mockUser.tenantId,
    overallStatus: 'PASSED',
    totalDurationMs: 9,
    checkedAt: new Date(),
    submittedBy: mockUser.userId,
    dataContractId: null,
    createdAt: new Date(),
    gateResults: [],
    violations: [],
  };

  beforeEach(async () => {
    prisma = {
      qualityReport: {
        create: vi.fn().mockResolvedValue(mockPersistedReport),
        findMany: vi.fn().mockResolvedValue([]),
      },
      correctionTracker: {
        create: vi.fn().mockResolvedValue({ id: 'tracker-1' }),
      },
      customQualityRule: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    engineService = { check: vi.fn().mockResolvedValue(mockPassReport) };
    kafkaProducer = { send: vi.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        ValidateService,
        { provide: PrismaService, useValue: prisma },
        { provide: EngineService, useValue: engineService },
        { provide: KafkaProducerService, useValue: kafkaProducer },
      ],
    }).compile();

    service = module.get(ValidateService);
  });

  describe('validate', () => {
    const baseDto = {
      recordId: 'rec-1',
      entityType: 'Outbreak',
      domain: 'health',
      record: { speciesCode: 'BOV', countryCode: 'KE' },
      requiredFields: ['speciesCode', 'countryCode'],
    };

    it('should run the engine, persist and return a PASSED report', async () => {
      const result = await service.validate(baseDto as any, mockUser);

      expect(result.data).toBeDefined();
      expect(result.data.id).toBe(mockPersistedReport.id);

      // Engine was called
      expect(engineService.check).toHaveBeenCalledOnce();

      // Report was persisted
      expect(prisma.qualityReport.create).toHaveBeenCalledOnce();

      // Kafka event published
      expect(kafkaProducer.send).toHaveBeenCalledOnce();
      expect(kafkaProducer.send).toHaveBeenCalledWith(
        'au.quality.record.validated.v1',
        expect.any(String),
        expect.objectContaining({ reportId: mockPersistedReport.id }),
        expect.any(Object),
      );

      // No correction tracker for PASSED reports
      expect(prisma.correctionTracker.create).not.toHaveBeenCalled();
    });

    it('should create a correction tracker for FAILED reports', async () => {
      engineService.check.mockResolvedValue(mockFailReport);
      prisma.qualityReport.create.mockResolvedValue({
        ...mockPersistedReport,
        id: '00000000-0000-0000-0000-000000000200',
        overallStatus: 'FAILED',
      });

      await service.validate(baseDto as any, mockUser);

      expect(prisma.correctionTracker.create).toHaveBeenCalledOnce();
      expect(prisma.correctionTracker.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reportId: '00000000-0000-0000-0000-000000000200',
          correctionDeadline: expect.any(Date),
          escalationDeadline: expect.any(Date),
        }),
      });

      // Kafka should publish to rejected topic
      expect(kafkaProducer.send).toHaveBeenCalledWith(
        'au.quality.record.rejected.v1',
        expect.any(String),
        expect.objectContaining({ overallStatus: 'FAILED' }),
        expect.any(Object),
      );
    });

    it('should merge custom rules from the database', async () => {
      prisma.customQualityRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          gate: 'COMPLETENESS',
          config: { requiredFields: ['diseaseCode'] },
          isActive: true,
        },
      ]);

      await service.validate(baseDto as any, mockUser);

      // Engine should have received merged config with requiredFields containing diseaseCode
      const callArgs = engineService.check.mock.calls[0];
      const config = callArgs[2];
      expect(config.requiredFields).toContain('speciesCode');
      expect(config.requiredFields).toContain('countryCode');
      expect(config.requiredFields).toContain('diseaseCode');
    });

    it('should not throw when Kafka publish fails (best-effort)', async () => {
      kafkaProducer.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.validate(baseDto as any, mockUser);
      expect(result.data).toBeDefined();
    });

    it('should load dedup existing records when dedupFields are provided', async () => {
      prisma.qualityReport.findMany.mockResolvedValue([
        { recordId: 'existing-1' },
        { recordId: 'existing-2' },
      ]);

      const dtoWithDedup = {
        ...baseDto,
        dedupFields: ['countryCode', 'speciesCode'],
      };

      await service.validate(dtoWithDedup as any, mockUser);

      const callArgs = engineService.check.mock.calls[0];
      const config = callArgs[2];
      expect(config.existingRecords).toHaveLength(2);
    });
  });
});
