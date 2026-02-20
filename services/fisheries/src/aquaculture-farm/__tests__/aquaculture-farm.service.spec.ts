import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AquacultureFarmService } from '../aquaculture-farm.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

function mockPrisma() {
  return {
    aquacultureFarm: {
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
    email: 'fish@ke.aris.africa',
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

function farmFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'farm-001',
    tenantId: 'tenant-ke',
    name: 'Lake Victoria Tilapia Farm',
    geoEntityId: 'geo-kisumu',
    coordinates: { lat: -0.1, lng: 34.75 },
    farmType: 'Cage',
    waterSource: 'Lake',
    areaHectares: 5,
    speciesIds: ['species-tilapia'],
    productionCapacityTonnes: 100,
    isActive: true,
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

describe('AquacultureFarmService', () => {
  let service: AquacultureFarmService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new AquacultureFarmService(prisma as never, kafka as never, audit as never);
  });

  describe('create', () => {
    it('should create a farm and publish Kafka event', async () => {
      prisma.aquacultureFarm.create.mockResolvedValue(farmFixture());

      const result = await service.create(
        {
          name: 'Lake Victoria Tilapia Farm',
          geoEntityId: 'geo-kisumu',
          farmType: 'Cage',
          waterSource: 'Lake',
          areaHectares: 5,
          speciesIds: ['species-tilapia'],
          productionCapacityTonnes: 100,
        },
        msUser(),
      );

      expect(result.data.id).toBe('farm-001');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.fisheries.farm.created.v1',
        'farm-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'fisheries-service' }),
      );
    });

    it('should default dataClassification to PARTNER', async () => {
      prisma.aquacultureFarm.create.mockResolvedValue(farmFixture());

      await service.create(
        {
          name: 'Test Farm',
          geoEntityId: 'geo-kisumu',
          farmType: 'Pond',
          waterSource: 'River',
          areaHectares: 2,
          speciesIds: ['species-catfish'],
          productionCapacityTonnes: 50,
        },
        msUser(),
      );

      expect(prisma.aquacultureFarm.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PARTNER,
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated farms for MEMBER_STATE user', async () => {
      prisma.aquacultureFarm.findMany.mockResolvedValue([farmFixture()]);
      prisma.aquacultureFarm.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.aquacultureFarm.findMany.mockResolvedValue([]);
      prisma.aquacultureFarm.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.aquacultureFarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply farmType filter', async () => {
      prisma.aquacultureFarm.findMany.mockResolvedValue([]);
      prisma.aquacultureFarm.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, { farmType: 'Cage' });

      expect(prisma.aquacultureFarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ farmType: 'Cage' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a farm', async () => {
      prisma.aquacultureFarm.findUnique.mockResolvedValue(farmFixture());

      const result = await service.findOne('farm-001', msUser());
      expect(result.data.id).toBe('farm-001');
    });

    it('should throw NotFoundException for nonexistent farm', async () => {
      prisma.aquacultureFarm.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.aquacultureFarm.findUnique.mockResolvedValue(
        farmFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(service.findOne('farm-001', msUser())).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update farm and publish Kafka event', async () => {
      const updated = farmFixture({ areaHectares: 10 });
      prisma.aquacultureFarm.findUnique.mockResolvedValue(farmFixture());
      prisma.aquacultureFarm.update.mockResolvedValue(updated);

      const result = await service.update('farm-001', { areaHectares: 10 }, msUser());

      expect(result.data.areaHectares).toBe(10);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.fisheries.farm.updated.v1',
        'farm-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'fisheries-service' }),
      );
    });

    it('should throw NotFoundException for nonexistent farm on update', async () => {
      prisma.aquacultureFarm.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { areaHectares: 10 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
