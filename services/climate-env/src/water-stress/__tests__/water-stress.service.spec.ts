import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { WaterStressService } from '../water-stress.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// -- Mock factories --

function mockPrisma() {
  return {
    waterStressIndex: {
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
    email: 'vet@ke.aris.africa',
    role: UserRole.NATIONAL_ADMIN,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

function continentalUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-au',
    email: 'admin@aris.africa',
    role: UserRole.SUPER_ADMIN,
    tenantId: 'tenant-au',
    tenantLevel: TenantLevel.CONTINENTAL,
    ...overrides,
  };
}

function waterStressFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ws-001',
    tenantId: 'tenant-ke',
    geoEntityId: 'geo-nairobi',
    period: '2026-Q1',
    index: 3.2,
    waterAvailability: 'LOW',
    irrigatedAreaPct: 15.5,
    source: 'National Water Authority',
    dataClassification: DataClassification.PUBLIC,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// -- Tests --

describe('WaterStressService', () => {
  let service: WaterStressService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new WaterStressService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create a water stress record and publish Kafka event', async () => {
      const dto = {
        geoEntityId: 'geo-nairobi',
        period: '2026-Q1',
        index: 3.2,
        waterAvailability: 'LOW',
        irrigatedAreaPct: 15.5,
        source: 'National Water Authority',
      };

      prisma.waterStressIndex.findFirst.mockResolvedValue(null);
      prisma.waterStressIndex.create.mockResolvedValue(waterStressFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('ws-001');
      expect(prisma.waterStressIndex.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.climate.water-stress.created.v1',
        'ws-001',
        expect.objectContaining({ geoEntityId: 'geo-nairobi' }),
        expect.objectContaining({ sourceService: 'climate-env-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'WaterStressIndex',
        'ws-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PUBLIC,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PUBLIC', async () => {
      prisma.waterStressIndex.findFirst.mockResolvedValue(null);
      prisma.waterStressIndex.create.mockResolvedValue(waterStressFixture());

      await service.create(
        {
          geoEntityId: 'geo-nairobi',
          period: '2026-Q1',
          index: 3.2,
          waterAvailability: 'LOW',
          irrigatedAreaPct: 15.5,
          source: 'National Water Authority',
        },
        msUser(),
      );

      expect(prisma.waterStressIndex.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PUBLIC,
          }),
        }),
      );
    });

    it('should throw ConflictException if duplicate record exists', async () => {
      prisma.waterStressIndex.findFirst.mockResolvedValue(waterStressFixture());

      await expect(
        service.create(
          {
            geoEntityId: 'geo-nairobi',
            period: '2026-Q1',
            index: 3.2,
            waterAvailability: 'LOW',
            irrigatedAreaPct: 15.5,
            source: 'National Water Authority',
          },
          msUser(),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.waterStressIndex.findFirst.mockResolvedValue(null);
      prisma.waterStressIndex.create.mockResolvedValue(waterStressFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          geoEntityId: 'geo-nairobi',
          period: '2026-Q1',
          index: 3.2,
          waterAvailability: 'LOW',
          irrigatedAreaPct: 15.5,
          source: 'National Water Authority',
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated water stress records for MEMBER_STATE user', async () => {
      const records = [waterStressFixture()];
      prisma.waterStressIndex.findMany.mockResolvedValue(records);
      prisma.waterStressIndex.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.waterStressIndex.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.waterStressIndex.findMany.mockResolvedValue([]);
      prisma.waterStressIndex.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.waterStressIndex.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply geoEntityId and period filters', async () => {
      prisma.waterStressIndex.findMany.mockResolvedValue([]);
      prisma.waterStressIndex.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { geoEntityId: 'geo-nairobi', period: '2026-Q1' },
      );

      expect(prisma.waterStressIndex.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            geoEntityId: 'geo-nairobi',
            period: '2026-Q1',
          }),
        }),
      );
    });

    it('should apply minIndex and maxIndex filters', async () => {
      prisma.waterStressIndex.findMany.mockResolvedValue([]);
      prisma.waterStressIndex.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { minIndex: 2, maxIndex: 4 },
      );

      expect(prisma.waterStressIndex.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            index: { gte: 2, lte: 4 },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.waterStressIndex.findMany.mockResolvedValue([]);
      prisma.waterStressIndex.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return a water stress record', async () => {
      prisma.waterStressIndex.findUnique.mockResolvedValue(waterStressFixture());

      const result = await service.findOne('ws-001', msUser());

      expect(result.data.id).toBe('ws-001');
      expect(prisma.waterStressIndex.findUnique).toHaveBeenCalledWith({
        where: { id: 'ws-001' },
      });
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.waterStressIndex.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.waterStressIndex.findUnique.mockResolvedValue(
        waterStressFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('ws-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.waterStressIndex.findUnique.mockResolvedValue(
        waterStressFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('ws-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update water stress record and publish Kafka event', async () => {
      const updated = waterStressFixture({ index: 4.0 });
      prisma.waterStressIndex.findUnique.mockResolvedValue(waterStressFixture());
      prisma.waterStressIndex.update.mockResolvedValue(updated);

      const result = await service.update('ws-001', { index: 4.0 }, msUser());

      expect(result.data.index).toBe(4.0);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.climate.water-stress.updated.v1',
        'ws-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'climate-env-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'WaterStressIndex',
        'ws-001',
        'UPDATE',
        expect.any(Object),
        DataClassification.PUBLIC,
        expect.objectContaining({
          previousVersion: expect.any(Object),
          newVersion: expect.any(Object),
        }),
      );
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.waterStressIndex.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { index: 1.0 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.waterStressIndex.findUnique.mockResolvedValue(waterStressFixture());
      prisma.waterStressIndex.update.mockResolvedValue(waterStressFixture({ index: 4.5 }));

      await service.update('ws-001', { index: 4.5 }, msUser());

      expect(prisma.waterStressIndex.update).toHaveBeenCalledWith({
        where: { id: 'ws-001' },
        data: expect.objectContaining({ index: 4.5, updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.waterStressIndex.findUnique.mockResolvedValue(
        waterStressFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('ws-001', { index: 1.0 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
