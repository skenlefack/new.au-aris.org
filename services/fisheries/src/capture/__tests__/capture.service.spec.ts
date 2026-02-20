import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CaptureService } from '../capture.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

function mockPrisma() {
  return {
    fishCapture: {
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
    email: 'fish@ke.aris.africa',
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

function captureFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'capture-001',
    tenantId: 'tenant-ke',
    geoEntityId: 'geo-mombasa',
    speciesId: 'species-tilapia',
    faoAreaCode: '51',
    vesselId: 'vessel-001',
    captureDate: new Date('2026-01-15'),
    quantityKg: 2500,
    gearType: 'Trawl',
    landingSite: 'Mombasa Port',
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    ...overrides,
  };
}

describe('CaptureService', () => {
  let service: CaptureService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new CaptureService(prisma as never, kafka as never, audit as never);
  });

  describe('create', () => {
    it('should create a capture record and publish Kafka event', async () => {
      const dto = {
        geoEntityId: 'geo-mombasa',
        speciesId: 'species-tilapia',
        faoAreaCode: '51',
        vesselId: 'vessel-001',
        captureDate: '2026-01-15',
        quantityKg: 2500,
        gearType: 'Trawl',
        landingSite: 'Mombasa Port',
      };

      prisma.fishCapture.create.mockResolvedValue(captureFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('capture-001');
      expect(prisma.fishCapture.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.fisheries.capture.recorded.v1',
        'capture-001',
        expect.objectContaining({ speciesId: 'species-tilapia' }),
        expect.objectContaining({ sourceService: 'fisheries-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'FishCapture',
        'capture-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PARTNER,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PARTNER', async () => {
      prisma.fishCapture.create.mockResolvedValue(captureFixture());

      await service.create(
        {
          geoEntityId: 'geo-mombasa',
          speciesId: 'species-tilapia',
          faoAreaCode: '51',
          captureDate: '2026-01-15',
          quantityKg: 2500,
          gearType: 'Trawl',
          landingSite: 'Mombasa Port',
        },
        msUser(),
      );

      expect(prisma.fishCapture.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PARTNER,
          }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.fishCapture.create.mockResolvedValue(captureFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          geoEntityId: 'geo-mombasa',
          speciesId: 'species-tilapia',
          faoAreaCode: '51',
          captureDate: '2026-01-15',
          quantityKg: 2500,
          gearType: 'Trawl',
          landingSite: 'Mombasa Port',
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated captures for MEMBER_STATE user', async () => {
      const records = [captureFixture()];
      prisma.fishCapture.findMany.mockResolvedValue(records);
      prisma.fishCapture.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.fishCapture.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.fishCapture.findMany.mockResolvedValue([]);
      prisma.fishCapture.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.fishCapture.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply species and area filters', async () => {
      prisma.fishCapture.findMany.mockResolvedValue([]);
      prisma.fishCapture.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { speciesId: 'species-tilapia', faoAreaCode: '51' },
      );

      expect(prisma.fishCapture.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            speciesId: 'species-tilapia',
            faoAreaCode: '51',
          }),
        }),
      );
    });

    it('should apply period filters on captureDate', async () => {
      prisma.fishCapture.findMany.mockResolvedValue([]);
      prisma.fishCapture.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      );

      expect(prisma.fishCapture.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            captureDate: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.fishCapture.findMany.mockResolvedValue([]);
      prisma.fishCapture.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  describe('findOne', () => {
    it('should return a capture record', async () => {
      prisma.fishCapture.findUnique.mockResolvedValue(captureFixture());

      const result = await service.findOne('capture-001', msUser());

      expect(result.data.id).toBe('capture-001');
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.fishCapture.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.fishCapture.findUnique.mockResolvedValue(
        captureFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('capture-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.fishCapture.findUnique.mockResolvedValue(
        captureFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('capture-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update capture record and publish Kafka event', async () => {
      const updated = captureFixture({ quantityKg: 3000 });
      prisma.fishCapture.findUnique.mockResolvedValue(captureFixture());
      prisma.fishCapture.update.mockResolvedValue(updated);

      const result = await service.update('capture-001', { quantityKg: 3000 }, msUser());

      expect(result.data.quantityKg).toBe(3000);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.fisheries.capture.updated.v1',
        'capture-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'fisheries-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'FishCapture',
        'capture-001',
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
      prisma.fishCapture.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { quantityKg: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.fishCapture.findUnique.mockResolvedValue(captureFixture());
      prisma.fishCapture.update.mockResolvedValue(captureFixture({ quantityKg: 5000 }));

      await service.update('capture-001', { quantityKg: 5000 }, msUser());

      expect(prisma.fishCapture.update).toHaveBeenCalledWith({
        where: { id: 'capture-001' },
        data: expect.objectContaining({ quantityKg: 5000, updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.fishCapture.findUnique.mockResolvedValue(
        captureFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('capture-001', { quantityKg: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
