import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CensusService } from '../census.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// -- Mock factories --

function mockPrisma() {
  return {
    livestockCensus: {
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

function censusFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'census-001',
    tenantId: 'tenant-ke',
    geoEntityId: 'geo-nairobi',
    speciesId: 'species-cattle',
    year: 2025,
    population: 50000,
    methodology: 'Aerial survey',
    source: 'National Census 2025',
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// -- Tests --

describe('CensusService', () => {
  let service: CensusService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new CensusService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create a census record and publish Kafka event', async () => {
      const dto = {
        geoEntityId: 'geo-nairobi',
        speciesId: 'species-cattle',
        year: 2025,
        population: 50000,
        methodology: 'Aerial survey',
        source: 'National Census 2025',
      };

      prisma.livestockCensus.findFirst.mockResolvedValue(null);
      prisma.livestockCensus.create.mockResolvedValue(censusFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('census-001');
      expect(prisma.livestockCensus.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.livestock.census.created.v1',
        'census-001',
        expect.objectContaining({ speciesId: 'species-cattle' }),
        expect.objectContaining({ sourceService: 'livestock-prod-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'LivestockCensus',
        'census-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PARTNER,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PARTNER', async () => {
      prisma.livestockCensus.findFirst.mockResolvedValue(null);
      prisma.livestockCensus.create.mockResolvedValue(censusFixture());

      await service.create(
        {
          geoEntityId: 'geo-nairobi',
          speciesId: 'species-cattle',
          year: 2025,
          population: 50000,
          methodology: 'Aerial survey',
          source: 'National Census 2025',
        },
        msUser(),
      );

      expect(prisma.livestockCensus.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PARTNER,
          }),
        }),
      );
    });

    it('should throw ConflictException if duplicate census exists', async () => {
      prisma.livestockCensus.findFirst.mockResolvedValue(censusFixture());

      await expect(
        service.create(
          {
            geoEntityId: 'geo-nairobi',
            speciesId: 'species-cattle',
            year: 2025,
            population: 50000,
            methodology: 'Aerial survey',
            source: 'National Census 2025',
          },
          msUser(),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.livestockCensus.findFirst.mockResolvedValue(null);
      prisma.livestockCensus.create.mockResolvedValue(censusFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          geoEntityId: 'geo-nairobi',
          speciesId: 'species-cattle',
          year: 2025,
          population: 50000,
          methodology: 'Aerial survey',
          source: 'National Census 2025',
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated census records for MEMBER_STATE user', async () => {
      const records = [censusFixture()];
      prisma.livestockCensus.findMany.mockResolvedValue(records);
      prisma.livestockCensus.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.livestockCensus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.livestockCensus.findMany.mockResolvedValue([]);
      prisma.livestockCensus.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.livestockCensus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply species and year filters', async () => {
      prisma.livestockCensus.findMany.mockResolvedValue([]);
      prisma.livestockCensus.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { speciesId: 'species-cattle', year: 2025 },
      );

      expect(prisma.livestockCensus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            speciesId: 'species-cattle',
            year: 2025,
          }),
        }),
      );
    });

    it('should apply period filters on createdAt', async () => {
      prisma.livestockCensus.findMany.mockResolvedValue([]);
      prisma.livestockCensus.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      );

      expect(prisma.livestockCensus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.livestockCensus.findMany.mockResolvedValue([]);
      prisma.livestockCensus.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return a census record', async () => {
      prisma.livestockCensus.findUnique.mockResolvedValue(censusFixture());

      const result = await service.findOne('census-001', msUser());

      expect(result.data.id).toBe('census-001');
      expect(prisma.livestockCensus.findUnique).toHaveBeenCalledWith({
        where: { id: 'census-001' },
      });
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.livestockCensus.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.livestockCensus.findUnique.mockResolvedValue(
        censusFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('census-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.livestockCensus.findUnique.mockResolvedValue(
        censusFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('census-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update census record and publish Kafka event', async () => {
      const updated = censusFixture({ population: 55000 });
      prisma.livestockCensus.findUnique.mockResolvedValue(censusFixture());
      prisma.livestockCensus.update.mockResolvedValue(updated);

      const result = await service.update('census-001', { population: 55000 }, msUser());

      expect(result.data.population).toBe(55000);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.livestock.census.updated.v1',
        'census-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'livestock-prod-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'LivestockCensus',
        'census-001',
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
      prisma.livestockCensus.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { population: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.livestockCensus.findUnique.mockResolvedValue(censusFixture());
      prisma.livestockCensus.update.mockResolvedValue(censusFixture({ population: 60000 }));

      await service.update('census-001', { population: 60000 }, msUser());

      expect(prisma.livestockCensus.update).toHaveBeenCalledWith({
        where: { id: 'census-001' },
        data: expect.objectContaining({ population: 60000, updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.livestockCensus.findUnique.mockResolvedValue(
        censusFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('census-001', { population: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
