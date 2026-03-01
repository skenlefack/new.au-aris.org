import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ColonyHealthService } from '../colony-health.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// -- Mock factories --

function mockPrisma() {
  return {
    colonyHealth: {
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

function colonyHealthFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'health-001',
    tenantId: 'tenant-ke',
    apiaryId: 'apiary-001',
    inspectionDate: new Date('2026-02-01'),
    colonyStrength: 'STRONG',
    diseases: ['NONE'],
    treatments: [],
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// -- Tests --

describe('ColonyHealthService', () => {
  let service: ColonyHealthService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new ColonyHealthService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create a colony health inspection and publish Kafka event', async () => {
      const dto = {
        apiaryId: 'apiary-001',
        inspectionDate: '2026-02-01',
        colonyStrength: 'STRONG' as const,
        diseases: ['NONE' as const],
        treatments: [],
      };

      prisma.colonyHealth.create.mockResolvedValue(colonyHealthFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('health-001');
      expect(prisma.colonyHealth.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.apiculture.health.inspected.v1',
        'health-001',
        expect.objectContaining({ apiaryId: 'apiary-001' }),
        expect.objectContaining({ sourceService: 'apiculture-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'ColonyHealth',
        'health-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PARTNER,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PARTNER', async () => {
      prisma.colonyHealth.create.mockResolvedValue(colonyHealthFixture());

      await service.create(
        {
          apiaryId: 'apiary-001',
          inspectionDate: '2026-02-01',
          colonyStrength: 'STRONG' as const,
          diseases: ['NONE' as const],
          treatments: [],
        },
        msUser(),
      );

      expect(prisma.colonyHealth.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PARTNER,
          }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.colonyHealth.create.mockResolvedValue(colonyHealthFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          apiaryId: 'apiary-001',
          inspectionDate: '2026-02-01',
          colonyStrength: 'STRONG' as const,
          diseases: ['NONE' as const],
          treatments: [],
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated colony health inspections for MEMBER_STATE user', async () => {
      const records = [colonyHealthFixture()];
      prisma.colonyHealth.findMany.mockResolvedValue(records);
      prisma.colonyHealth.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.colonyHealth.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.colonyHealth.findMany.mockResolvedValue([]);
      prisma.colonyHealth.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.colonyHealth.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply apiaryId and colonyStrength filters', async () => {
      prisma.colonyHealth.findMany.mockResolvedValue([]);
      prisma.colonyHealth.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { apiaryId: 'apiary-001', colonyStrength: 'STRONG' as never },
      );

      expect(prisma.colonyHealth.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            apiaryId: 'apiary-001',
            colonyStrength: 'STRONG',
          }),
        }),
      );
    });

    it('should apply disease filter with has operator', async () => {
      prisma.colonyHealth.findMany.mockResolvedValue([]);
      prisma.colonyHealth.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { disease: 'VARROA' as never },
      );

      expect(prisma.colonyHealth.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            diseases: { has: 'VARROA' },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.colonyHealth.findMany.mockResolvedValue([]);
      prisma.colonyHealth.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return a colony health inspection', async () => {
      prisma.colonyHealth.findUnique.mockResolvedValue(colonyHealthFixture());

      const result = await service.findOne('health-001', msUser());

      expect(result.data.id).toBe('health-001');
      expect(prisma.colonyHealth.findUnique).toHaveBeenCalledWith({
        where: { id: 'health-001' },
      });
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.colonyHealth.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.colonyHealth.findUnique.mockResolvedValue(
        colonyHealthFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('health-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.colonyHealth.findUnique.mockResolvedValue(
        colonyHealthFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('health-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update colony health inspection and publish Kafka event', async () => {
      const updated = colonyHealthFixture({ colonyStrength: 'WEAK' });
      prisma.colonyHealth.findUnique.mockResolvedValue(colonyHealthFixture());
      prisma.colonyHealth.update.mockResolvedValue(updated);

      const result = await service.update('health-001', { colonyStrength: 'WEAK' as const }, msUser());

      expect(result.data.colonyStrength).toBe('WEAK');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.apiculture.health.updated.v1',
        'health-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'apiculture-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'ColonyHealth',
        'health-001',
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
      prisma.colonyHealth.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { colonyStrength: 'WEAK' as const }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.colonyHealth.findUnique.mockResolvedValue(colonyHealthFixture());
      prisma.colonyHealth.update.mockResolvedValue(colonyHealthFixture({ colonyStrength: 'MEDIUM' }));

      await service.update('health-001', { colonyStrength: 'MEDIUM' as const }, msUser());

      expect(prisma.colonyHealth.update).toHaveBeenCalledWith({
        where: { id: 'health-001' },
        data: expect.objectContaining({ colonyStrength: 'MEDIUM', updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.colonyHealth.findUnique.mockResolvedValue(
        colonyHealthFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('health-001', { colonyStrength: 'WEAK' as const }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
