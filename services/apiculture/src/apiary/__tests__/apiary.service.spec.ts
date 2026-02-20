import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ApiaryService } from '../apiary.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// -- Mock factories --

function mockPrisma() {
  return {
    apiary: {
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

function apiaryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'apiary-001',
    tenantId: 'tenant-ke',
    name: 'Nairobi Apiary',
    geoEntityId: 'geo-nairobi',
    latitude: -1.2921,
    longitude: 36.8219,
    hiveCount: 50,
    hiveType: 'LANGSTROTH',
    ownerName: 'John Mwangi',
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// -- Tests --

describe('ApiaryService', () => {
  let service: ApiaryService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new ApiaryService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create an apiary and publish Kafka event', async () => {
      const dto = {
        name: 'Nairobi Apiary',
        geoEntityId: 'geo-nairobi',
        latitude: -1.2921,
        longitude: 36.8219,
        hiveCount: 50,
        hiveType: 'LANGSTROTH' as const,
        ownerName: 'John Mwangi',
      };

      prisma.apiary.create.mockResolvedValue(apiaryFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('apiary-001');
      expect(prisma.apiary.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.apiculture.apiary.created.v1',
        'apiary-001',
        expect.objectContaining({ name: 'Nairobi Apiary' }),
        expect.objectContaining({ sourceService: 'apiculture-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'Apiary',
        'apiary-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PARTNER,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PARTNER', async () => {
      prisma.apiary.create.mockResolvedValue(apiaryFixture());

      await service.create(
        {
          name: 'Nairobi Apiary',
          geoEntityId: 'geo-nairobi',
          hiveCount: 50,
          hiveType: 'LANGSTROTH' as const,
          ownerName: 'John Mwangi',
        },
        msUser(),
      );

      expect(prisma.apiary.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PARTNER,
          }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.apiary.create.mockResolvedValue(apiaryFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          name: 'Nairobi Apiary',
          geoEntityId: 'geo-nairobi',
          hiveCount: 50,
          hiveType: 'LANGSTROTH' as const,
          ownerName: 'John Mwangi',
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated apiaries for MEMBER_STATE user', async () => {
      const records = [apiaryFixture()];
      prisma.apiary.findMany.mockResolvedValue(records);
      prisma.apiary.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.apiary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.apiary.findMany.mockResolvedValue([]);
      prisma.apiary.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.apiary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply hiveType and geoEntityId filters', async () => {
      prisma.apiary.findMany.mockResolvedValue([]);
      prisma.apiary.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { hiveType: 'LANGSTROTH' as never, geoEntityId: 'geo-nairobi' },
      );

      expect(prisma.apiary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hiveType: 'LANGSTROTH',
            geoEntityId: 'geo-nairobi',
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.apiary.findMany.mockResolvedValue([]);
      prisma.apiary.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return an apiary', async () => {
      prisma.apiary.findUnique.mockResolvedValue(apiaryFixture());

      const result = await service.findOne('apiary-001', msUser());

      expect(result.data.id).toBe('apiary-001');
      expect(prisma.apiary.findUnique).toHaveBeenCalledWith({
        where: { id: 'apiary-001' },
      });
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.apiary.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.apiary.findUnique.mockResolvedValue(
        apiaryFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('apiary-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.apiary.findUnique.mockResolvedValue(
        apiaryFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('apiary-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update apiary and publish Kafka event', async () => {
      const updated = apiaryFixture({ hiveCount: 75 });
      prisma.apiary.findUnique.mockResolvedValue(apiaryFixture());
      prisma.apiary.update.mockResolvedValue(updated);

      const result = await service.update('apiary-001', { hiveCount: 75 }, msUser());

      expect(result.data.hiveCount).toBe(75);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.apiculture.apiary.updated.v1',
        'apiary-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'apiculture-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'Apiary',
        'apiary-001',
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
      prisma.apiary.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { hiveCount: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.apiary.findUnique.mockResolvedValue(apiaryFixture());
      prisma.apiary.update.mockResolvedValue(apiaryFixture({ hiveCount: 60 }));

      await service.update('apiary-001', { hiveCount: 60 }, msUser());

      expect(prisma.apiary.update).toHaveBeenCalledWith({
        where: { id: 'apiary-001' },
        data: expect.objectContaining({ hiveCount: 60, updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.apiary.findUnique.mockResolvedValue(
        apiaryFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('apiary-001', { hiveCount: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
