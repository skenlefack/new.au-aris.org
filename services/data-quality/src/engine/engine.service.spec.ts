import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { EngineService } from './engine.service';
import { PrismaService } from '../prisma.service';
import { QualityGateResult } from '@aris/shared-types';

describe('EngineService', () => {
  let service: EngineService;
  let prisma: {
    geoEntity: { findMany: ReturnType<typeof vi.fn> };
    species: { findMany: ReturnType<typeof vi.fn> };
    disease: { findMany: ReturnType<typeof vi.fn> };
    unit: { findMany: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    prisma = {
      geoEntity: { findMany: vi.fn().mockResolvedValue([{ code: 'KE' }, { code: 'ET' }]) },
      species: { findMany: vi.fn().mockResolvedValue([{ code: 'BOV' }, { code: 'OVI' }]) },
      disease: { findMany: vi.fn().mockResolvedValue([{ code: 'FMD' }, { code: 'PPR' }]) },
      unit: { findMany: vi.fn().mockResolvedValue([{ code: 'HEAD' }, { code: 'KG' }]) },
    };

    const module = await Test.createTestingModule({
      providers: [
        EngineService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(EngineService);
  });

  describe('check', () => {
    it('should run quality check and return a report', async () => {
      const record = {
        id: 'rec-1',
        speciesCode: 'BOV',
        countryCode: 'KE',
        reportDate: '2024-06-01',
        confirmedDate: '2024-06-05',
        sourceSystem: 'ARIS',
        responsibleUnit: 'VetService',
        validationStatus: 'pending',
        confidenceLevel: 'confirmed',
        labConfirmed: true,
      };

      const config = {
        requiredFields: ['speciesCode', 'countryCode', 'reportDate'],
        auditFields: ['sourceSystem', 'responsibleUnit', 'validationStatus'],
        confidenceLevelField: 'confidenceLevel',
        confidenceEvidenceFields: ['labConfirmed'],
      };

      const result = await service.check(record, 'Outbreak', config);

      expect(result).toBeDefined();
      expect(result.entityType).toBe('Outbreak');
      expect(result.overallResult).toBeDefined();
      expect(result.gates).toBeInstanceOf(Array);
      expect(result.gates.length).toBe(8);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.checkedAt).toBeDefined();
    });

    it('should load master data codes on first call', async () => {
      const record = { id: 'rec-2' };
      await service.check(record, 'Test', {});

      expect(prisma.geoEntity.findMany).toHaveBeenCalledOnce();
      expect(prisma.species.findMany).toHaveBeenCalledOnce();
      expect(prisma.disease.findMany).toHaveBeenCalledOnce();
      expect(prisma.unit.findMany).toHaveBeenCalledOnce();
    });

    it('should use cached codes on subsequent calls within refresh interval', async () => {
      const record = { id: 'rec-3' };
      await service.check(record, 'Test', {});
      await service.check(record, 'Test', {});

      // Should only load once (cached)
      expect(prisma.geoEntity.findMany).toHaveBeenCalledTimes(1);
    });

    it('should fail COMPLETENESS when required fields are missing', async () => {
      const record = { id: 'rec-4' };
      const config = {
        requiredFields: ['speciesCode', 'countryCode'],
      };

      const result = await service.check(record, 'Outbreak', config);

      const completenessGate = result.gates.find((g) => g.gate === 'COMPLETENESS');
      expect(completenessGate).toBeDefined();
      expect(completenessGate!.result).toBe(QualityGateResult.FAIL);

      // Should have violations for missing fields
      const completenessViolations = result.violations.filter((v) => v.gate === 'COMPLETENESS');
      expect(completenessViolations.length).toBeGreaterThan(0);
    });

    it('should pass all gates for a complete valid record', async () => {
      const record = {
        id: 'rec-5',
        speciesCode: 'BOV',
        countryCode: 'KE',
        reportDate: '2024-06-01',
        confirmedDate: '2024-06-05',
        sourceSystem: 'ARIS',
        responsibleUnit: 'VetService',
        validationStatus: 'pending',
        confidenceLevel: 'confirmed',
        labConfirmed: true,
      };

      const config = {
        requiredFields: ['speciesCode', 'countryCode'],
        temporalPairs: [['reportDate', 'confirmedDate']] as [string, string][],
        auditFields: ['sourceSystem', 'responsibleUnit', 'validationStatus'],
        confidenceLevelField: 'confidenceLevel',
        confidenceEvidenceFields: ['labConfirmed'],
      };

      const result = await service.check(record, 'Outbreak', config);

      // Completeness should pass
      const completenessGate = result.gates.find((g) => g.gate === 'COMPLETENESS');
      expect(completenessGate!.result).toBe(QualityGateResult.PASS);

      // Temporal consistency should pass
      const temporalGate = result.gates.find((g) => g.gate === 'TEMPORAL_CONSISTENCY');
      expect(temporalGate!.result).toBe(QualityGateResult.PASS);
    });
  });

  describe('invalidateCache', () => {
    it('should force reload of codes on next check', async () => {
      const record = { id: 'rec-6' };
      await service.check(record, 'Test', {});

      service.invalidateCache();

      await service.check(record, 'Test', {});
      expect(prisma.geoEntity.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('code loading resilience', () => {
    it('should use cached values if refresh fails', async () => {
      const record = { id: 'rec-7' };
      // First call succeeds
      await service.check(record, 'Test', {});

      // Make refresh fail
      service.invalidateCache();
      prisma.geoEntity.findMany.mockRejectedValue(new Error('DB down'));

      // Should not throw, uses cached values
      await expect(service.check(record, 'Test', {})).resolves.toBeDefined();
    });
  });
});
