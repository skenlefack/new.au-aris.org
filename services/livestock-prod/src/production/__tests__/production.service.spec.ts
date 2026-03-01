import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ProductionService } from '../production.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// -- Mock factories --

function mockPrisma() {
  return {
    productionRecord: {
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
    email: 'vet@ke.au-aris.org',
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
    speciesId: 'species-cattle',
    productType: 'MILK',
    quantity: 15000,
    unit: 'litres',
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-03-31'),
    geoEntityId: 'geo-nairobi',
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// -- Tests --

describe('ProductionService', () => {
  let service: ProductionService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new ProductionService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create a production record and publish Kafka event', async () => {
      const dto = {
        speciesId: 'species-cattle',
        productType: 'MILK' as const,
        quantity: 15000,
        unit: 'litres',
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-03-31T00:00:00.000Z',
        geoEntityId: 'geo-nairobi',
      };

      prisma.productionRecord.create.mockResolvedValue(productionFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('prod-001');
      expect(prisma.productionRecord.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.livestock.production.recorded.v1',
        'prod-001',
        expect.objectContaining({ speciesId: 'species-cattle' }),
        expect.objectContaining({ sourceService: 'livestock-prod-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'ProductionRecord',
        'prod-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PARTNER,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PARTNER', async () => {
      prisma.productionRecord.create.mockResolvedValue(productionFixture());

      await service.create(
        {
          speciesId: 'species-cattle',
          productType: 'MILK' as const,
          quantity: 15000,
          unit: 'litres',
          periodStart: '2026-01-01T00:00:00.000Z',
          periodEnd: '2026-03-31T00:00:00.000Z',
          geoEntityId: 'geo-nairobi',
        },
        msUser(),
      );

      expect(prisma.productionRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PARTNER,
          }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.productionRecord.create.mockResolvedValue(productionFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          speciesId: 'species-cattle',
          productType: 'MILK' as const,
          quantity: 15000,
          unit: 'litres',
          periodStart: '2026-01-01T00:00:00.000Z',
          periodEnd: '2026-03-31T00:00:00.000Z',
          geoEntityId: 'geo-nairobi',
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated production records for MEMBER_STATE user', async () => {
      const records = [productionFixture()];
      prisma.productionRecord.findMany.mockResolvedValue(records);
      prisma.productionRecord.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.productionRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.productionRecord.findMany.mockResolvedValue([]);
      prisma.productionRecord.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.productionRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply species and productType filters', async () => {
      prisma.productionRecord.findMany.mockResolvedValue([]);
      prisma.productionRecord.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { speciesId: 'species-cattle', productType: 'MILK' },
      );

      expect(prisma.productionRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            speciesId: 'species-cattle',
            productType: 'MILK',
          }),
        }),
      );
    });

    it('should apply period filters on periodStart', async () => {
      prisma.productionRecord.findMany.mockResolvedValue([]);
      prisma.productionRecord.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      );

      expect(prisma.productionRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            periodStart: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.productionRecord.findMany.mockResolvedValue([]);
      prisma.productionRecord.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return a production record', async () => {
      prisma.productionRecord.findUnique.mockResolvedValue(productionFixture());

      const result = await service.findOne('prod-001', msUser());

      expect(result.data.id).toBe('prod-001');
      expect(prisma.productionRecord.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-001' },
      });
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.productionRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.productionRecord.findUnique.mockResolvedValue(
        productionFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('prod-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.productionRecord.findUnique.mockResolvedValue(
        productionFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('prod-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update production record and publish Kafka event', async () => {
      const updated = productionFixture({ quantity: 20000 });
      prisma.productionRecord.findUnique.mockResolvedValue(productionFixture());
      prisma.productionRecord.update.mockResolvedValue(updated);

      const result = await service.update('prod-001', { quantity: 20000 }, msUser());

      expect(result.data.quantity).toBe(20000);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.livestock.production.updated.v1',
        'prod-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'livestock-prod-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'ProductionRecord',
        'prod-001',
        'UPDATE',
        expect.any(Object),
        DataClassification.PARTNER,
        expect.objectContaining({
          previousVersion: expect.any(Object),
          newVersion: expect.any(Object),
        }),
      );
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.productionRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { quantity: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.productionRecord.findUnique.mockResolvedValue(productionFixture());
      prisma.productionRecord.update.mockResolvedValue(productionFixture({ quantity: 25000 }));

      await service.update('prod-001', { quantity: 25000 }, msUser());

      expect(prisma.productionRecord.update).toHaveBeenCalledWith({
        where: { id: 'prod-001' },
        data: expect.objectContaining({ quantity: 25000, updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.productionRecord.findUnique.mockResolvedValue(
        productionFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('prod-001', { quantity: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
