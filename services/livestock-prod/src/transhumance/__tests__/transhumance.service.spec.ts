import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TranshumanceService } from '../transhumance.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// -- Mock factories --

function mockPrisma() {
  return {
    transhumanceCorridor: {
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

function corridorFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'corridor-001',
    tenantId: 'tenant-ke',
    name: 'Maasai Mara - Serengeti Corridor',
    route: {
      type: 'LineString',
      coordinates: [
        [36.817, -1.286],
        [34.834, -2.333],
      ],
    },
    speciesId: 'species-cattle',
    seasonality: 'dry-season',
    crossBorder: true,
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// -- Tests --

describe('TranshumanceService', () => {
  let service: TranshumanceService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new TranshumanceService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create a transhumance corridor and publish Kafka event', async () => {
      const dto = {
        name: 'Maasai Mara - Serengeti Corridor',
        route: {
          type: 'LineString',
          coordinates: [
            [36.817, -1.286],
            [34.834, -2.333],
          ],
        },
        speciesId: 'species-cattle',
        seasonality: 'dry-season',
        crossBorder: true,
      };

      prisma.transhumanceCorridor.create.mockResolvedValue(corridorFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('corridor-001');
      expect(prisma.transhumanceCorridor.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.livestock.transhumance.created.v1',
        'corridor-001',
        expect.objectContaining({ speciesId: 'species-cattle' }),
        expect.objectContaining({ sourceService: 'livestock-prod-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'TranshumanceCorridor',
        'corridor-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PARTNER,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PARTNER', async () => {
      prisma.transhumanceCorridor.create.mockResolvedValue(corridorFixture());

      await service.create(
        {
          name: 'Test Corridor',
          route: { type: 'LineString', coordinates: [] },
          speciesId: 'species-cattle',
          seasonality: 'wet-season',
        },
        msUser(),
      );

      expect(prisma.transhumanceCorridor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PARTNER,
          }),
        }),
      );
    });

    it('should default crossBorder to false', async () => {
      prisma.transhumanceCorridor.create.mockResolvedValue(corridorFixture({ crossBorder: false }));

      await service.create(
        {
          name: 'Local Corridor',
          route: { type: 'LineString', coordinates: [] },
          speciesId: 'species-cattle',
          seasonality: 'dry-season',
        },
        msUser(),
      );

      expect(prisma.transhumanceCorridor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            crossBorder: false,
          }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.transhumanceCorridor.create.mockResolvedValue(corridorFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          name: 'Test Corridor',
          route: { type: 'LineString', coordinates: [] },
          speciesId: 'species-cattle',
          seasonality: 'wet-season',
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated corridors for MEMBER_STATE user', async () => {
      const records = [corridorFixture()];
      prisma.transhumanceCorridor.findMany.mockResolvedValue(records);
      prisma.transhumanceCorridor.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.transhumanceCorridor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.transhumanceCorridor.findMany.mockResolvedValue([]);
      prisma.transhumanceCorridor.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.transhumanceCorridor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply species and crossBorder filters', async () => {
      prisma.transhumanceCorridor.findMany.mockResolvedValue([]);
      prisma.transhumanceCorridor.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { speciesId: 'species-cattle', crossBorder: true },
      );

      expect(prisma.transhumanceCorridor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            speciesId: 'species-cattle',
            crossBorder: true,
          }),
        }),
      );
    });

    it('should apply seasonality filter', async () => {
      prisma.transhumanceCorridor.findMany.mockResolvedValue([]);
      prisma.transhumanceCorridor.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { seasonality: 'dry-season' },
      );

      expect(prisma.transhumanceCorridor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            seasonality: 'dry-season',
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.transhumanceCorridor.findMany.mockResolvedValue([]);
      prisma.transhumanceCorridor.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return a transhumance corridor', async () => {
      prisma.transhumanceCorridor.findUnique.mockResolvedValue(corridorFixture());

      const result = await service.findOne('corridor-001', msUser());

      expect(result.data.id).toBe('corridor-001');
      expect(prisma.transhumanceCorridor.findUnique).toHaveBeenCalledWith({
        where: { id: 'corridor-001' },
      });
    });

    it('should throw NotFoundException for nonexistent corridor', async () => {
      prisma.transhumanceCorridor.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.transhumanceCorridor.findUnique.mockResolvedValue(
        corridorFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('corridor-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any corridor', async () => {
      prisma.transhumanceCorridor.findUnique.mockResolvedValue(
        corridorFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('corridor-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update corridor and publish Kafka event', async () => {
      const updated = corridorFixture({ name: 'Updated Corridor Name' });
      prisma.transhumanceCorridor.findUnique.mockResolvedValue(corridorFixture());
      prisma.transhumanceCorridor.update.mockResolvedValue(updated);

      const result = await service.update('corridor-001', { name: 'Updated Corridor Name' }, msUser());

      expect(result.data.name).toBe('Updated Corridor Name');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.livestock.transhumance.updated.v1',
        'corridor-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'livestock-prod-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'TranshumanceCorridor',
        'corridor-001',
        'UPDATE',
        expect.any(Object),
        DataClassification.PARTNER,
        expect.objectContaining({
          previousVersion: expect.any(Object),
          newVersion: expect.any(Object),
        }),
      );
    });

    it('should throw NotFoundException for nonexistent corridor', async () => {
      prisma.transhumanceCorridor.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'test' }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.transhumanceCorridor.findUnique.mockResolvedValue(corridorFixture());
      prisma.transhumanceCorridor.update.mockResolvedValue(corridorFixture({ crossBorder: false }));

      await service.update('corridor-001', { crossBorder: false }, msUser());

      expect(prisma.transhumanceCorridor.update).toHaveBeenCalledWith({
        where: { id: 'corridor-001' },
        data: expect.objectContaining({ crossBorder: false, updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.transhumanceCorridor.findUnique.mockResolvedValue(
        corridorFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('corridor-001', { name: 'test' }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
