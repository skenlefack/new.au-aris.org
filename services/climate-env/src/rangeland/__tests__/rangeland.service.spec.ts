import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { RangelandService } from '../rangeland.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// -- Mock factories --

function mockPrisma() {
  return {
    rangelandCondition: {
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

function rangelandFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rl-001',
    tenantId: 'tenant-ke',
    geoEntityId: 'geo-turkana',
    assessmentDate: new Date('2026-02-15'),
    ndviIndex: 0.45,
    biomassTonsPerHa: 2.8,
    degradationLevel: 'MODERATE',
    carryingCapacity: 150,
    dataClassification: DataClassification.PUBLIC,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// -- Tests --

describe('RangelandService', () => {
  let service: RangelandService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new RangelandService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create a rangeland condition and publish Kafka event', async () => {
      const dto = {
        geoEntityId: 'geo-turkana',
        assessmentDate: '2026-02-15T00:00:00.000Z',
        ndviIndex: 0.45,
        biomassTonsPerHa: 2.8,
        degradationLevel: 'MODERATE' as const,
        carryingCapacity: 150,
      };

      prisma.rangelandCondition.create.mockResolvedValue(rangelandFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('rl-001');
      expect(prisma.rangelandCondition.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.climate.rangeland.assessed.v1',
        'rl-001',
        expect.objectContaining({ geoEntityId: 'geo-turkana' }),
        expect.objectContaining({ sourceService: 'climate-env-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'RangelandCondition',
        'rl-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PUBLIC,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PUBLIC', async () => {
      prisma.rangelandCondition.create.mockResolvedValue(rangelandFixture());

      await service.create(
        {
          geoEntityId: 'geo-turkana',
          assessmentDate: '2026-02-15T00:00:00.000Z',
          ndviIndex: 0.45,
          biomassTonsPerHa: 2.8,
          degradationLevel: 'MODERATE' as const,
          carryingCapacity: 150,
        },
        msUser(),
      );

      expect(prisma.rangelandCondition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PUBLIC,
          }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.rangelandCondition.create.mockResolvedValue(rangelandFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          geoEntityId: 'geo-turkana',
          assessmentDate: '2026-02-15T00:00:00.000Z',
          ndviIndex: 0.45,
          biomassTonsPerHa: 2.8,
          degradationLevel: 'MODERATE' as const,
          carryingCapacity: 150,
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated rangeland conditions for MEMBER_STATE user', async () => {
      const records = [rangelandFixture()];
      prisma.rangelandCondition.findMany.mockResolvedValue(records);
      prisma.rangelandCondition.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.rangelandCondition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.rangelandCondition.findMany.mockResolvedValue([]);
      prisma.rangelandCondition.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.rangelandCondition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply degradationLevel filter', async () => {
      prisma.rangelandCondition.findMany.mockResolvedValue([]);
      prisma.rangelandCondition.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { degradationLevel: 'SEVERE' },
      );

      expect(prisma.rangelandCondition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            degradationLevel: 'SEVERE',
          }),
        }),
      );
    });

    it('should apply period filters on assessmentDate', async () => {
      prisma.rangelandCondition.findMany.mockResolvedValue([]);
      prisma.rangelandCondition.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      );

      expect(prisma.rangelandCondition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assessmentDate: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.rangelandCondition.findMany.mockResolvedValue([]);
      prisma.rangelandCondition.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return a rangeland condition', async () => {
      prisma.rangelandCondition.findUnique.mockResolvedValue(rangelandFixture());

      const result = await service.findOne('rl-001', msUser());

      expect(result.data.id).toBe('rl-001');
      expect(prisma.rangelandCondition.findUnique).toHaveBeenCalledWith({
        where: { id: 'rl-001' },
      });
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.rangelandCondition.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.rangelandCondition.findUnique.mockResolvedValue(
        rangelandFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('rl-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.rangelandCondition.findUnique.mockResolvedValue(
        rangelandFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('rl-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update rangeland condition and publish Kafka event', async () => {
      const updated = rangelandFixture({ ndviIndex: 0.6 });
      prisma.rangelandCondition.findUnique.mockResolvedValue(rangelandFixture());
      prisma.rangelandCondition.update.mockResolvedValue(updated);

      const result = await service.update('rl-001', { ndviIndex: 0.6 }, msUser());

      expect(result.data.ndviIndex).toBe(0.6);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.climate.rangeland.updated.v1',
        'rl-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'climate-env-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'RangelandCondition',
        'rl-001',
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
      prisma.rangelandCondition.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { ndviIndex: 0.5 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.rangelandCondition.findUnique.mockResolvedValue(rangelandFixture());
      prisma.rangelandCondition.update.mockResolvedValue(rangelandFixture({ biomassTonsPerHa: 3.5 }));

      await service.update('rl-001', { biomassTonsPerHa: 3.5 }, msUser());

      expect(prisma.rangelandCondition.update).toHaveBeenCalledWith({
        where: { id: 'rl-001' },
        data: expect.objectContaining({ biomassTonsPerHa: 3.5, updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.rangelandCondition.findUnique.mockResolvedValue(
        rangelandFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('rl-001', { ndviIndex: 0.5 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
