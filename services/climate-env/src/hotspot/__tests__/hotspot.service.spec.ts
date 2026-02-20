import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { HotspotService } from '../hotspot.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// -- Mock factories --

function mockPrisma() {
  return {
    environmentalHotspot: {
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

function hotspotFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hs-001',
    tenantId: 'tenant-ke',
    geoEntityId: 'geo-marsabit',
    type: 'DROUGHT',
    severity: 'HIGH',
    detectedDate: new Date('2026-02-01'),
    satelliteSource: 'Sentinel-2',
    affectedSpecies: ['cattle', 'goats'],
    dataClassification: DataClassification.PUBLIC,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// -- Tests --

describe('HotspotService', () => {
  let service: HotspotService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new HotspotService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create an environmental hotspot and publish Kafka event', async () => {
      const dto = {
        geoEntityId: 'geo-marsabit',
        type: 'DROUGHT' as const,
        severity: 'HIGH' as const,
        detectedDate: '2026-02-01T00:00:00.000Z',
        satelliteSource: 'Sentinel-2',
        affectedSpecies: ['cattle', 'goats'],
      };

      prisma.environmentalHotspot.create.mockResolvedValue(hotspotFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('hs-001');
      expect(prisma.environmentalHotspot.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.climate.hotspot.detected.v1',
        'hs-001',
        expect.objectContaining({ geoEntityId: 'geo-marsabit' }),
        expect.objectContaining({ sourceService: 'climate-env-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'EnvironmentalHotspot',
        'hs-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PUBLIC,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PUBLIC', async () => {
      prisma.environmentalHotspot.create.mockResolvedValue(hotspotFixture());

      await service.create(
        {
          geoEntityId: 'geo-marsabit',
          type: 'DROUGHT' as const,
          severity: 'HIGH' as const,
          detectedDate: '2026-02-01T00:00:00.000Z',
          satelliteSource: 'Sentinel-2',
          affectedSpecies: ['cattle', 'goats'],
        },
        msUser(),
      );

      expect(prisma.environmentalHotspot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PUBLIC,
          }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.environmentalHotspot.create.mockResolvedValue(hotspotFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          geoEntityId: 'geo-marsabit',
          type: 'DROUGHT' as const,
          severity: 'HIGH' as const,
          detectedDate: '2026-02-01T00:00:00.000Z',
          satelliteSource: 'Sentinel-2',
          affectedSpecies: ['cattle', 'goats'],
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated hotspots for MEMBER_STATE user', async () => {
      const records = [hotspotFixture()];
      prisma.environmentalHotspot.findMany.mockResolvedValue(records);
      prisma.environmentalHotspot.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.environmentalHotspot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.environmentalHotspot.findMany.mockResolvedValue([]);
      prisma.environmentalHotspot.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.environmentalHotspot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply type and severity filters', async () => {
      prisma.environmentalHotspot.findMany.mockResolvedValue([]);
      prisma.environmentalHotspot.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { type: 'FLOODING', severity: 'CRITICAL' },
      );

      expect(prisma.environmentalHotspot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'FLOODING',
            severity: 'CRITICAL',
          }),
        }),
      );
    });

    it('should apply period filters on detectedDate', async () => {
      prisma.environmentalHotspot.findMany.mockResolvedValue([]);
      prisma.environmentalHotspot.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      );

      expect(prisma.environmentalHotspot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            detectedDate: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.environmentalHotspot.findMany.mockResolvedValue([]);
      prisma.environmentalHotspot.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return an environmental hotspot', async () => {
      prisma.environmentalHotspot.findUnique.mockResolvedValue(hotspotFixture());

      const result = await service.findOne('hs-001', msUser());

      expect(result.data.id).toBe('hs-001');
      expect(prisma.environmentalHotspot.findUnique).toHaveBeenCalledWith({
        where: { id: 'hs-001' },
      });
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.environmentalHotspot.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.environmentalHotspot.findUnique.mockResolvedValue(
        hotspotFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('hs-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.environmentalHotspot.findUnique.mockResolvedValue(
        hotspotFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('hs-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update environmental hotspot and publish Kafka event', async () => {
      const updated = hotspotFixture({ severity: 'CRITICAL' });
      prisma.environmentalHotspot.findUnique.mockResolvedValue(hotspotFixture());
      prisma.environmentalHotspot.update.mockResolvedValue(updated);

      const result = await service.update('hs-001', { severity: 'CRITICAL' as const }, msUser());

      expect(result.data.severity).toBe('CRITICAL');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.climate.hotspot.updated.v1',
        'hs-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'climate-env-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'EnvironmentalHotspot',
        'hs-001',
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
      prisma.environmentalHotspot.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { severity: 'LOW' as const }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.environmentalHotspot.findUnique.mockResolvedValue(hotspotFixture());
      prisma.environmentalHotspot.update.mockResolvedValue(hotspotFixture({ severity: 'CRITICAL' }));

      await service.update('hs-001', { severity: 'CRITICAL' as const }, msUser());

      expect(prisma.environmentalHotspot.update).toHaveBeenCalledWith({
        where: { id: 'hs-001' },
        data: expect.objectContaining({ severity: 'CRITICAL', updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.environmentalHotspot.findUnique.mockResolvedValue(
        hotspotFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('hs-001', { severity: 'LOW' as const }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
