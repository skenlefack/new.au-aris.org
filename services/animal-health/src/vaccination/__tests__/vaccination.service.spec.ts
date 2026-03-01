import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { VaccinationService } from '../vaccination.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

function mockPrisma() {
  return {
    vaccinationCampaign: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

function mockKafkaProducer() {
  return { send: vi.fn().mockResolvedValue([]) };
}

function mockAudit() {
  return { log: vi.fn() };
}

function msUser(): AuthenticatedUser {
  return {
    userId: 'user-ke',
    email: 'vet@ke.au-aris.org',
    role: UserRole.NATIONAL_ADMIN,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
  };
}

function vaccinationFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vacc-001',
    tenantId: 'tenant-ke',
    diseaseId: 'disease-fmd',
    speciesId: 'species-cattle',
    vaccineType: 'FMD trivalent',
    vaccineBatch: 'BATCH-2026-001',
    dosesDelivered: 50000,
    dosesUsed: 42000,
    targetPopulation: 60000,
    coverageEstimate: 70,
    pveSerologyDone: false,
    periodStart: new Date('2026-02-01'),
    periodEnd: new Date('2026-04-30'),
    geoEntityId: 'geo-ke-central',
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
    ...overrides,
  };
}

describe('VaccinationService', () => {
  let service: VaccinationService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new VaccinationService(prisma as never, kafka as never, audit as never);
  });

  describe('create', () => {
    it('should create vaccination and calculate coverage', async () => {
      prisma.vaccinationCampaign.create.mockResolvedValue(vaccinationFixture());

      const result = await service.create(
        {
          diseaseId: 'disease-fmd',
          speciesId: 'species-cattle',
          vaccineType: 'FMD trivalent',
          vaccineBatch: 'BATCH-2026-001',
          dosesDelivered: 50000,
          dosesUsed: 42000,
          targetPopulation: 60000,
          pveSerologyDone: false,
          periodStart: '2026-02-01T00:00:00.000Z',
          periodEnd: '2026-04-30T00:00:00.000Z',
          geoEntityId: 'geo-ke-central',
        },
        msUser(),
      );

      expect(result.data.id).toBe('vacc-001');
      expect(prisma.vaccinationCampaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            coverageEstimate: 70, // 42000/60000 * 100
          }),
        }),
      );
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.health.vaccination.completed.v1',
        'vacc-001',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should handle zero target population', async () => {
      prisma.vaccinationCampaign.create.mockResolvedValue(
        vaccinationFixture({ coverageEstimate: 0 }),
      );

      await service.create(
        {
          diseaseId: 'd1',
          speciesId: 's1',
          vaccineType: 'vax',
          dosesDelivered: 100,
          dosesUsed: 50,
          targetPopulation: 0,
          pveSerologyDone: false,
          periodStart: '2026-01-01T00:00:00.000Z',
          periodEnd: '2026-03-01T00:00:00.000Z',
          geoEntityId: 'g1',
        },
        msUser(),
      );

      expect(prisma.vaccinationCampaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ coverageEstimate: 0 }),
        }),
      );
    });
  });

  describe('getCoverage', () => {
    it('should calculate coverage from campaign data', async () => {
      prisma.vaccinationCampaign.findUnique.mockResolvedValue(vaccinationFixture());

      const result = await service.getCoverage('vacc-001', msUser());

      expect(result.data.dosesUsed).toBe(42000);
      expect(result.data.denominator).toBe(60000);
      expect(result.data.coveragePercent).toBe(70);
      expect(result.data.denominatorSource).toBe('campaign-target');
    });

    it('should throw NotFoundException for nonexistent vaccination', async () => {
      prisma.vaccinationCampaign.findUnique.mockResolvedValue(null);

      await expect(
        service.getCoverage('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant', async () => {
      prisma.vaccinationCampaign.findUnique.mockResolvedValue(
        vaccinationFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.getCoverage('vacc-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle zero denominator gracefully', async () => {
      prisma.vaccinationCampaign.findUnique.mockResolvedValue(
        vaccinationFixture({ targetPopulation: 0, dosesUsed: 0 }),
      );

      const result = await service.getCoverage('vacc-001', msUser());

      expect(result.data.coveragePercent).toBe(0);
    });
  });

  describe('findAll', () => {
    it('should filter by disease and species', async () => {
      prisma.vaccinationCampaign.findMany.mockResolvedValue([]);
      prisma.vaccinationCampaign.count.mockResolvedValue(0);

      await service.findAll(msUser(), {}, {
        diseaseId: 'disease-fmd',
        speciesId: 'species-cattle',
      });

      expect(prisma.vaccinationCampaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            diseaseId: 'disease-fmd',
            speciesId: 'species-cattle',
          }),
        }),
      );
    });
  });
});
