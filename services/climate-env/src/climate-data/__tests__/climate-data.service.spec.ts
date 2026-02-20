import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ClimateDataService } from '../climate-data.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// -- Mock factories --

function mockPrisma() {
  return {
    climateDataPoint: {
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

function climateDataFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cd-001',
    tenantId: 'tenant-ke',
    geoEntityId: 'geo-nairobi',
    date: new Date('2026-02-10'),
    temperature: 28.5,
    rainfall: 12.3,
    humidity: 65,
    windSpeed: 15.2,
    source: 'Kenya Met Service',
    dataClassification: DataClassification.PUBLIC,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// -- Tests --

describe('ClimateDataService', () => {
  let service: ClimateDataService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new ClimateDataService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create a climate data point and publish Kafka event', async () => {
      const dto = {
        geoEntityId: 'geo-nairobi',
        date: '2026-02-10T00:00:00.000Z',
        temperature: 28.5,
        rainfall: 12.3,
        humidity: 65,
        windSpeed: 15.2,
        source: 'Kenya Met Service',
      };

      prisma.climateDataPoint.create.mockResolvedValue(climateDataFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('cd-001');
      expect(prisma.climateDataPoint.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.climate.data.recorded.v1',
        'cd-001',
        expect.objectContaining({ geoEntityId: 'geo-nairobi' }),
        expect.objectContaining({ sourceService: 'climate-env-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'ClimateDataPoint',
        'cd-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PUBLIC,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PUBLIC', async () => {
      prisma.climateDataPoint.create.mockResolvedValue(climateDataFixture());

      await service.create(
        {
          geoEntityId: 'geo-nairobi',
          date: '2026-02-10T00:00:00.000Z',
          temperature: 28.5,
          rainfall: 12.3,
          humidity: 65,
          windSpeed: 15.2,
          source: 'Kenya Met Service',
        },
        msUser(),
      );

      expect(prisma.climateDataPoint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PUBLIC,
          }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.climateDataPoint.create.mockResolvedValue(climateDataFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          geoEntityId: 'geo-nairobi',
          date: '2026-02-10T00:00:00.000Z',
          temperature: 28.5,
          rainfall: 12.3,
          humidity: 65,
          windSpeed: 15.2,
          source: 'Kenya Met Service',
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated climate data points for MEMBER_STATE user', async () => {
      const records = [climateDataFixture()];
      prisma.climateDataPoint.findMany.mockResolvedValue(records);
      prisma.climateDataPoint.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.climateDataPoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.climateDataPoint.findMany.mockResolvedValue([]);
      prisma.climateDataPoint.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.climateDataPoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply geoEntityId and source filters', async () => {
      prisma.climateDataPoint.findMany.mockResolvedValue([]);
      prisma.climateDataPoint.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { geoEntityId: 'geo-nairobi', source: 'Kenya Met Service' },
      );

      expect(prisma.climateDataPoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            geoEntityId: 'geo-nairobi',
            source: 'Kenya Met Service',
          }),
        }),
      );
    });

    it('should apply period filters on date', async () => {
      prisma.climateDataPoint.findMany.mockResolvedValue([]);
      prisma.climateDataPoint.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      );

      expect(prisma.climateDataPoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.climateDataPoint.findMany.mockResolvedValue([]);
      prisma.climateDataPoint.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return a climate data point', async () => {
      prisma.climateDataPoint.findUnique.mockResolvedValue(climateDataFixture());

      const result = await service.findOne('cd-001', msUser());

      expect(result.data.id).toBe('cd-001');
      expect(prisma.climateDataPoint.findUnique).toHaveBeenCalledWith({
        where: { id: 'cd-001' },
      });
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.climateDataPoint.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.climateDataPoint.findUnique.mockResolvedValue(
        climateDataFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('cd-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.climateDataPoint.findUnique.mockResolvedValue(
        climateDataFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('cd-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update climate data point and publish Kafka event', async () => {
      const updated = climateDataFixture({ temperature: 32.0 });
      prisma.climateDataPoint.findUnique.mockResolvedValue(climateDataFixture());
      prisma.climateDataPoint.update.mockResolvedValue(updated);

      const result = await service.update('cd-001', { temperature: 32.0 }, msUser());

      expect(result.data.temperature).toBe(32.0);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.climate.data.updated.v1',
        'cd-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'climate-env-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'ClimateDataPoint',
        'cd-001',
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
      prisma.climateDataPoint.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { temperature: 20.0 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.climateDataPoint.findUnique.mockResolvedValue(climateDataFixture());
      prisma.climateDataPoint.update.mockResolvedValue(climateDataFixture({ rainfall: 25.0 }));

      await service.update('cd-001', { rainfall: 25.0 }, msUser());

      expect(prisma.climateDataPoint.update).toHaveBeenCalledWith({
        where: { id: 'cd-001' },
        data: expect.objectContaining({ rainfall: 25.0, updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.climateDataPoint.findUnique.mockResolvedValue(
        climateDataFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('cd-001', { temperature: 20.0 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
