import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { VesselService } from '../vessel.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

function mockPrisma() {
  return {
    fishingVessel: {
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
    email: 'fish@ke.au-aris.org',
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

function vesselFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vessel-001',
    tenantId: 'tenant-ke',
    name: 'MV Ocean Star',
    registrationNumber: 'KE-FV-2025-001',
    flagState: 'KE',
    vesselType: 'Trawler',
    lengthMeters: 25,
    tonnageGt: 120,
    homePort: 'Mombasa',
    licenseNumber: 'LIC-001',
    licenseExpiry: new Date('2027-12-31'),
    isActive: true,
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

describe('VesselService', () => {
  let service: VesselService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new VesselService(prisma as never, kafka as never, audit as never);
  });

  describe('create', () => {
    it('should register a vessel and publish Kafka event', async () => {
      const dto = {
        name: 'MV Ocean Star',
        registrationNumber: 'KE-FV-2025-001',
        flagState: 'KE',
        vesselType: 'Trawler',
        lengthMeters: 25,
        tonnageGt: 120,
        homePort: 'Mombasa',
      };

      prisma.fishingVessel.findFirst.mockResolvedValue(null);
      prisma.fishingVessel.create.mockResolvedValue(vesselFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('vessel-001');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.fisheries.vessel.registered.v1',
        'vessel-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'fisheries-service' }),
      );
    });

    it('should throw ConflictException if duplicate registration', async () => {
      prisma.fishingVessel.findFirst.mockResolvedValue(vesselFixture());

      await expect(
        service.create(
          {
            name: 'MV Ocean Star',
            registrationNumber: 'KE-FV-2025-001',
            flagState: 'KE',
            vesselType: 'Trawler',
            lengthMeters: 25,
            tonnageGt: 120,
            homePort: 'Mombasa',
          },
          msUser(),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should not fail if Kafka publish errors', async () => {
      prisma.fishingVessel.findFirst.mockResolvedValue(null);
      prisma.fishingVessel.create.mockResolvedValue(vesselFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          name: 'MV Ocean Star',
          registrationNumber: 'KE-FV-2025-001',
          flagState: 'KE',
          vesselType: 'Trawler',
          lengthMeters: 25,
          tonnageGt: 120,
          homePort: 'Mombasa',
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated vessels for MEMBER_STATE user', async () => {
      prisma.fishingVessel.findMany.mockResolvedValue([vesselFixture()]);
      prisma.fishingVessel.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.fishingVessel.findMany.mockResolvedValue([]);
      prisma.fishingVessel.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.fishingVessel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply filters', async () => {
      prisma.fishingVessel.findMany.mockResolvedValue([]);
      prisma.fishingVessel.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { flagState: 'KE', vesselType: 'Trawler' },
      );

      expect(prisma.fishingVessel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            flagState: 'KE',
            vesselType: 'Trawler',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a vessel', async () => {
      prisma.fishingVessel.findUnique.mockResolvedValue(vesselFixture());

      const result = await service.findOne('vessel-001', msUser());
      expect(result.data.id).toBe('vessel-001');
    });

    it('should throw NotFoundException for nonexistent vessel', async () => {
      prisma.fishingVessel.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.fishingVessel.findUnique.mockResolvedValue(
        vesselFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(service.findOne('vessel-001', msUser())).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update vessel and publish Kafka event', async () => {
      const updated = vesselFixture({ tonnageGt: 150 });
      prisma.fishingVessel.findUnique.mockResolvedValue(vesselFixture());
      prisma.fishingVessel.update.mockResolvedValue(updated);

      const result = await service.update('vessel-001', { tonnageGt: 150 }, msUser());

      expect(result.data.tonnageGt).toBe(150);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.fisheries.vessel.updated.v1',
        'vessel-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'fisheries-service' }),
      );
    });

    it('should throw NotFoundException on update of nonexistent vessel', async () => {
      prisma.fishingVessel.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { tonnageGt: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.fishingVessel.findUnique.mockResolvedValue(
        vesselFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('vessel-001', { tonnageGt: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
