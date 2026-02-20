import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ProtectedAreaService } from '../protected-area.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

function mockPrisma() {
  return {
    protectedArea: {
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
    email: 'wildlife@ke.aris.africa',
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

function areaFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pa-001',
    tenantId: 'tenant-ke',
    name: 'Tsavo National Park',
    wdpaId: 'WDPA-555',
    iucnCategory: 'II',
    geoEntityId: 'geo-tsavo',
    areaKm2: 20812,
    designationDate: new Date('1948-04-01'),
    managingAuthority: 'Kenya Wildlife Service',
    coordinates: { lat: -2.98, lng: 38.47 },
    isActive: true,
    dataClassification: DataClassification.PUBLIC,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

describe('ProtectedAreaService', () => {
  let service: ProtectedAreaService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new ProtectedAreaService(prisma as never, kafka as never, audit as never);
  });

  describe('create', () => {
    it('should create a protected area and publish Kafka event', async () => {
      prisma.protectedArea.create.mockResolvedValue(areaFixture());

      const result = await service.create(
        {
          name: 'Tsavo National Park',
          iucnCategory: 'II',
          geoEntityId: 'geo-tsavo',
          areaKm2: 20812,
          managingAuthority: 'Kenya Wildlife Service',
        },
        msUser(),
      );

      expect(result.data.id).toBe('pa-001');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.wildlife.protected-area.created.v1',
        'pa-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'wildlife-service' }),
      );
    });

    it('should default dataClassification to PUBLIC', async () => {
      prisma.protectedArea.create.mockResolvedValue(areaFixture());

      await service.create(
        {
          name: 'Test Park',
          iucnCategory: 'IV',
          geoEntityId: 'geo-test',
          areaKm2: 100,
          managingAuthority: 'Test Authority',
        },
        msUser(),
      );

      expect(prisma.protectedArea.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PUBLIC,
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated areas for MEMBER_STATE user', async () => {
      prisma.protectedArea.findMany.mockResolvedValue([areaFixture()]);
      prisma.protectedArea.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should apply iucnCategory filter', async () => {
      prisma.protectedArea.findMany.mockResolvedValue([]);
      prisma.protectedArea.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, { iucnCategory: 'II' });

      expect(prisma.protectedArea.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ iucnCategory: 'II' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a protected area', async () => {
      prisma.protectedArea.findUnique.mockResolvedValue(areaFixture());

      const result = await service.findOne('pa-001', msUser());
      expect(result.data.id).toBe('pa-001');
    });

    it('should throw NotFoundException for nonexistent area', async () => {
      prisma.protectedArea.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.protectedArea.findUnique.mockResolvedValue(
        areaFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(service.findOne('pa-001', msUser())).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update area and publish Kafka event', async () => {
      const updated = areaFixture({ areaKm2: 25000 });
      prisma.protectedArea.findUnique.mockResolvedValue(areaFixture());
      prisma.protectedArea.update.mockResolvedValue(updated);

      const result = await service.update('pa-001', { areaKm2: 25000 }, msUser());

      expect(result.data.areaKm2).toBe(25000);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.wildlife.protected-area.updated.v1',
        'pa-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'wildlife-service' }),
      );
    });

    it('should throw NotFoundException for nonexistent area on update', async () => {
      prisma.protectedArea.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { areaKm2: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
