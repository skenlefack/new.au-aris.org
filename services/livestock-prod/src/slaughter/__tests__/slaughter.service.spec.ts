import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { SlaughterService } from '../slaughter.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// -- Mock factories --

function mockPrisma() {
  return {
    slaughterRecord: {
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

function slaughterFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'slaughter-001',
    tenantId: 'tenant-ke',
    speciesId: 'species-cattle',
    facilityId: 'facility-nairobi-01',
    count: 250,
    condemnations: 5,
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-01-31'),
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

describe('SlaughterService', () => {
  let service: SlaughterService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new SlaughterService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create a slaughter record and publish Kafka event', async () => {
      const dto = {
        speciesId: 'species-cattle',
        facilityId: 'facility-nairobi-01',
        count: 250,
        condemnations: 5,
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-31T00:00:00.000Z',
        geoEntityId: 'geo-nairobi',
      };

      prisma.slaughterRecord.create.mockResolvedValue(slaughterFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('slaughter-001');
      expect(prisma.slaughterRecord.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.livestock.slaughter.recorded.v1',
        'slaughter-001',
        expect.objectContaining({ speciesId: 'species-cattle' }),
        expect.objectContaining({ sourceService: 'livestock-prod-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'SlaughterRecord',
        'slaughter-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PARTNER,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PARTNER', async () => {
      prisma.slaughterRecord.create.mockResolvedValue(slaughterFixture());

      await service.create(
        {
          speciesId: 'species-cattle',
          facilityId: 'facility-nairobi-01',
          count: 250,
          condemnations: 5,
          periodStart: '2026-01-01T00:00:00.000Z',
          periodEnd: '2026-01-31T00:00:00.000Z',
          geoEntityId: 'geo-nairobi',
        },
        msUser(),
      );

      expect(prisma.slaughterRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PARTNER,
          }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.slaughterRecord.create.mockResolvedValue(slaughterFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          speciesId: 'species-cattle',
          facilityId: 'facility-nairobi-01',
          count: 250,
          condemnations: 5,
          periodStart: '2026-01-01T00:00:00.000Z',
          periodEnd: '2026-01-31T00:00:00.000Z',
          geoEntityId: 'geo-nairobi',
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated slaughter records for MEMBER_STATE user', async () => {
      const records = [slaughterFixture()];
      prisma.slaughterRecord.findMany.mockResolvedValue(records);
      prisma.slaughterRecord.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.slaughterRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.slaughterRecord.findMany.mockResolvedValue([]);
      prisma.slaughterRecord.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.slaughterRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply species and facility filters', async () => {
      prisma.slaughterRecord.findMany.mockResolvedValue([]);
      prisma.slaughterRecord.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { speciesId: 'species-cattle', facilityId: 'facility-nairobi-01' },
      );

      expect(prisma.slaughterRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            speciesId: 'species-cattle',
            facilityId: 'facility-nairobi-01',
          }),
        }),
      );
    });

    it('should apply period filters on periodStart', async () => {
      prisma.slaughterRecord.findMany.mockResolvedValue([]);
      prisma.slaughterRecord.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      );

      expect(prisma.slaughterRecord.findMany).toHaveBeenCalledWith(
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
      prisma.slaughterRecord.findMany.mockResolvedValue([]);
      prisma.slaughterRecord.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return a slaughter record', async () => {
      prisma.slaughterRecord.findUnique.mockResolvedValue(slaughterFixture());

      const result = await service.findOne('slaughter-001', msUser());

      expect(result.data.id).toBe('slaughter-001');
      expect(prisma.slaughterRecord.findUnique).toHaveBeenCalledWith({
        where: { id: 'slaughter-001' },
      });
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.slaughterRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.slaughterRecord.findUnique.mockResolvedValue(
        slaughterFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('slaughter-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.slaughterRecord.findUnique.mockResolvedValue(
        slaughterFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('slaughter-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update slaughter record and publish Kafka event', async () => {
      const updated = slaughterFixture({ count: 300 });
      prisma.slaughterRecord.findUnique.mockResolvedValue(slaughterFixture());
      prisma.slaughterRecord.update.mockResolvedValue(updated);

      const result = await service.update('slaughter-001', { count: 300 }, msUser());

      expect(result.data.count).toBe(300);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.livestock.slaughter.updated.v1',
        'slaughter-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'livestock-prod-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'SlaughterRecord',
        'slaughter-001',
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
      prisma.slaughterRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { count: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.slaughterRecord.findUnique.mockResolvedValue(slaughterFixture());
      prisma.slaughterRecord.update.mockResolvedValue(slaughterFixture({ condemnations: 10 }));

      await service.update('slaughter-001', { condemnations: 10 }, msUser());

      expect(prisma.slaughterRecord.update).toHaveBeenCalledWith({
        where: { id: 'slaughter-001' },
        data: expect.objectContaining({ condemnations: 10, updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.slaughterRecord.findUnique.mockResolvedValue(
        slaughterFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('slaughter-001', { count: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
