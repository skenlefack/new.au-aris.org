import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AquacultureProductionService } from '../aquaculture-production.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

function mockPrisma() {
  return {
    aquacultureProduction: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
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

function msUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-ke',
    email: 'fish@ke.au-aris.org',
    role: UserRole.NATIONAL_ADMIN,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
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

function productionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-001',
    tenantId: 'tenant-ke',
    farmId: 'farm-001',
    speciesId: 'species-tilapia',
    harvestDate: new Date('2026-02-01'),
    quantityKg: 5000,
    methodOfCulture: 'Cage culture',
    feedUsedKg: 7500,
    fcr: 1.5,
    batchId: 'BATCH-2026-001',
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
    ...overrides,
  };
}

describe('AquacultureProductionService', () => {
  let service: AquacultureProductionService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new AquacultureProductionService(prisma as never, kafka as never, audit as never);
  });

  describe('create', () => {
    it('should record production and publish Kafka event', async () => {
      prisma.aquacultureProduction.create.mockResolvedValue(productionFixture());

      const result = await service.create(
        {
          farmId: 'farm-001',
          speciesId: 'species-tilapia',
          harvestDate: '2026-02-01',
          quantityKg: 5000,
          methodOfCulture: 'Cage culture',
          feedUsedKg: 7500,
          fcr: 1.5,
        },
        msUser(),
      );

      expect(result.data.id).toBe('prod-001');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.fisheries.aquaculture.harvested.v1',
        'prod-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'fisheries-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'AquacultureProduction',
        'prod-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PARTNER,
        expect.any(Object),
      );
    });

    it('should not fail if Kafka publish errors', async () => {
      prisma.aquacultureProduction.create.mockResolvedValue(productionFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          farmId: 'farm-001',
          speciesId: 'species-tilapia',
          harvestDate: '2026-02-01',
          quantityKg: 5000,
          methodOfCulture: 'Cage culture',
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated production records for MS user', async () => {
      prisma.aquacultureProduction.findMany.mockResolvedValue([productionFixture()]);
      prisma.aquacultureProduction.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should apply farmId and speciesId filters', async () => {
      prisma.aquacultureProduction.findMany.mockResolvedValue([]);
      prisma.aquacultureProduction.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { farmId: 'farm-001', speciesId: 'species-tilapia' },
      );

      expect(prisma.aquacultureProduction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            farmId: 'farm-001',
            speciesId: 'species-tilapia',
          }),
        }),
      );
    });

    it('should apply period filters on harvestDate', async () => {
      prisma.aquacultureProduction.findMany.mockResolvedValue([]);
      prisma.aquacultureProduction.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      );

      expect(prisma.aquacultureProduction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            harvestDate: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a production record', async () => {
      prisma.aquacultureProduction.findUnique.mockResolvedValue(productionFixture());

      const result = await service.findOne('prod-001', msUser());
      expect(result.data.id).toBe('prod-001');
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.aquacultureProduction.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.aquacultureProduction.findUnique.mockResolvedValue(
        productionFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(service.findOne('prod-001', msUser())).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update production and publish Kafka event', async () => {
      const updated = productionFixture({ quantityKg: 6000 });
      prisma.aquacultureProduction.findUnique.mockResolvedValue(productionFixture());
      prisma.aquacultureProduction.update.mockResolvedValue(updated);

      const result = await service.update('prod-001', { quantityKg: 6000 }, msUser());

      expect(result.data.quantityKg).toBe(6000);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.fisheries.aquaculture.updated.v1',
        'prod-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'fisheries-service' }),
      );
    });

    it('should throw NotFoundException for nonexistent record on update', async () => {
      prisma.aquacultureProduction.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { quantityKg: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.aquacultureProduction.findUnique.mockResolvedValue(
        productionFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('prod-001', { quantityKg: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
