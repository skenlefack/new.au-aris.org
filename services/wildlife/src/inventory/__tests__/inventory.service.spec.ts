import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { InventoryService } from '../inventory.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

function mockPrisma() {
  return {
    wildlifeInventory: {
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
    email: 'wildlife@ke.au-aris.org',
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

function inventoryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-001',
    tenantId: 'tenant-ke',
    speciesId: 'species-elephant',
    geoEntityId: 'geo-tsavo',
    protectedAreaId: 'pa-001',
    surveyDate: new Date('2026-01-20'),
    populationEstimate: 12000,
    methodology: 'Aerial census',
    confidenceInterval: '95%',
    conservationStatus: 'Vulnerable',
    threatLevel: 'High',
    coordinates: { lat: -2.98, lng: 38.47 },
    dataClassification: DataClassification.RESTRICTED,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-01-20'),
    ...overrides,
  };
}

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new InventoryService(prisma as never, kafka as never, audit as never);
  });

  describe('create', () => {
    it('should create an inventory record and publish Kafka event', async () => {
      prisma.wildlifeInventory.create.mockResolvedValue(inventoryFixture());

      const result = await service.create(
        {
          speciesId: 'species-elephant',
          geoEntityId: 'geo-tsavo',
          protectedAreaId: 'pa-001',
          surveyDate: '2026-01-20',
          populationEstimate: 12000,
          methodology: 'Aerial census',
          conservationStatus: 'Vulnerable',
          threatLevel: 'High',
        },
        msUser(),
      );

      expect(result.data.id).toBe('inv-001');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.wildlife.inventory.created.v1',
        'inv-001',
        expect.objectContaining({ speciesId: 'species-elephant' }),
        expect.objectContaining({ sourceService: 'wildlife-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'WildlifeInventory',
        'inv-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.RESTRICTED,
        expect.any(Object),
      );
    });

    it('should default dataClassification to RESTRICTED', async () => {
      prisma.wildlifeInventory.create.mockResolvedValue(inventoryFixture());

      await service.create(
        {
          speciesId: 'species-elephant',
          geoEntityId: 'geo-tsavo',
          surveyDate: '2026-01-20',
          populationEstimate: 12000,
          methodology: 'Aerial census',
          conservationStatus: 'Vulnerable',
          threatLevel: 'High',
        },
        msUser(),
      );

      expect(prisma.wildlifeInventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.RESTRICTED,
          }),
        }),
      );
    });

    it('should not fail if Kafka publish errors', async () => {
      prisma.wildlifeInventory.create.mockResolvedValue(inventoryFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          speciesId: 'species-elephant',
          geoEntityId: 'geo-tsavo',
          surveyDate: '2026-01-20',
          populationEstimate: 12000,
          methodology: 'Aerial census',
          conservationStatus: 'Vulnerable',
          threatLevel: 'High',
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated inventories for MEMBER_STATE user', async () => {
      prisma.wildlifeInventory.findMany.mockResolvedValue([inventoryFixture()]);
      prisma.wildlifeInventory.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.wildlifeInventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.wildlifeInventory.findMany.mockResolvedValue([]);
      prisma.wildlifeInventory.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.wildlifeInventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply species and conservation status filters', async () => {
      prisma.wildlifeInventory.findMany.mockResolvedValue([]);
      prisma.wildlifeInventory.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { speciesId: 'species-elephant', conservationStatus: 'Vulnerable' },
      );

      expect(prisma.wildlifeInventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            speciesId: 'species-elephant',
            conservationStatus: 'Vulnerable',
          }),
        }),
      );
    });

    it('should apply period filters on surveyDate', async () => {
      prisma.wildlifeInventory.findMany.mockResolvedValue([]);
      prisma.wildlifeInventory.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      );

      expect(prisma.wildlifeInventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            surveyDate: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.wildlifeInventory.findMany.mockResolvedValue([]);
      prisma.wildlifeInventory.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  describe('findOne', () => {
    it('should return an inventory record', async () => {
      prisma.wildlifeInventory.findUnique.mockResolvedValue(inventoryFixture());

      const result = await service.findOne('inv-001', msUser());
      expect(result.data.id).toBe('inv-001');
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.wildlifeInventory.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.wildlifeInventory.findUnique.mockResolvedValue(
        inventoryFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(service.findOne('inv-001', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.wildlifeInventory.findUnique.mockResolvedValue(
        inventoryFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('inv-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update inventory and publish Kafka event', async () => {
      const updated = inventoryFixture({ populationEstimate: 13000 });
      prisma.wildlifeInventory.findUnique.mockResolvedValue(inventoryFixture());
      prisma.wildlifeInventory.update.mockResolvedValue(updated);

      const result = await service.update('inv-001', { populationEstimate: 13000 }, msUser());

      expect(result.data.populationEstimate).toBe(13000);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.wildlife.inventory.updated.v1',
        'inv-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'wildlife-service' }),
      );
    });

    it('should throw NotFoundException for nonexistent record on update', async () => {
      prisma.wildlifeInventory.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { populationEstimate: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.wildlifeInventory.findUnique.mockResolvedValue(
        inventoryFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('inv-001', { populationEstimate: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
