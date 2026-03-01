import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CapacityService } from '../capacity.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// -- Mock factories --

function mockPrisma() {
  return {
    institutionalCapacity: {
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

function capacityFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'capacity-001',
    tenantId: 'tenant-ke',
    year: 2025,
    organizationName: 'DVS Kenya',
    staffCount: 150,
    budgetUsd: 500000,
    pvsSelfAssessmentScore: 3.5,
    oieStatus: 'Active',
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// -- Tests --

describe('CapacityService', () => {
  let service: CapacityService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new CapacityService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create a capacity record and publish Kafka event', async () => {
      const dto = {
        year: 2025,
        organizationName: 'DVS Kenya',
        staffCount: 150,
        budgetUsd: 500000,
      };

      prisma.institutionalCapacity.findFirst.mockResolvedValue(null);
      prisma.institutionalCapacity.create.mockResolvedValue(capacityFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('capacity-001');
      expect(prisma.institutionalCapacity.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.governance.capacity.created.v1',
        'capacity-001',
        expect.objectContaining({ organizationName: 'DVS Kenya' }),
        expect.objectContaining({ sourceService: 'governance-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'InstitutionalCapacity',
        'capacity-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PARTNER,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PARTNER', async () => {
      prisma.institutionalCapacity.findFirst.mockResolvedValue(null);
      prisma.institutionalCapacity.create.mockResolvedValue(capacityFixture());

      await service.create(
        {
          year: 2025,
          organizationName: 'DVS Kenya',
          staffCount: 150,
          budgetUsd: 500000,
        },
        msUser(),
      );

      expect(prisma.institutionalCapacity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PARTNER,
          }),
        }),
      );
    });

    it('should throw ConflictException if duplicate capacity exists', async () => {
      prisma.institutionalCapacity.findFirst.mockResolvedValue(capacityFixture());

      await expect(
        service.create(
          {
            year: 2025,
            organizationName: 'DVS Kenya',
            staffCount: 150,
            budgetUsd: 500000,
          },
          msUser(),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.institutionalCapacity.findFirst.mockResolvedValue(null);
      prisma.institutionalCapacity.create.mockResolvedValue(capacityFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          year: 2025,
          organizationName: 'DVS Kenya',
          staffCount: 150,
          budgetUsd: 500000,
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated capacity records for MEMBER_STATE user', async () => {
      const records = [capacityFixture()];
      prisma.institutionalCapacity.findMany.mockResolvedValue(records);
      prisma.institutionalCapacity.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.institutionalCapacity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.institutionalCapacity.findMany.mockResolvedValue([]);
      prisma.institutionalCapacity.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.institutionalCapacity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply year and organizationName filters', async () => {
      prisma.institutionalCapacity.findMany.mockResolvedValue([]);
      prisma.institutionalCapacity.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { year: 2025, organizationName: 'DVS Kenya' },
      );

      expect(prisma.institutionalCapacity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            year: 2025,
            organizationName: 'DVS Kenya',
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.institutionalCapacity.findMany.mockResolvedValue([]);
      prisma.institutionalCapacity.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return a capacity record', async () => {
      prisma.institutionalCapacity.findUnique.mockResolvedValue(capacityFixture());

      const result = await service.findOne('capacity-001', msUser());

      expect(result.data.id).toBe('capacity-001');
      expect(prisma.institutionalCapacity.findUnique).toHaveBeenCalledWith({
        where: { id: 'capacity-001' },
      });
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.institutionalCapacity.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.institutionalCapacity.findUnique.mockResolvedValue(
        capacityFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('capacity-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.institutionalCapacity.findUnique.mockResolvedValue(
        capacityFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('capacity-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update capacity record and publish Kafka event', async () => {
      const updated = capacityFixture({ staffCount: 200 });
      prisma.institutionalCapacity.findUnique.mockResolvedValue(capacityFixture());
      prisma.institutionalCapacity.update.mockResolvedValue(updated);

      const result = await service.update('capacity-001', { staffCount: 200 }, msUser());

      expect(result.data.staffCount).toBe(200);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.governance.capacity.updated.v1',
        'capacity-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'governance-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'InstitutionalCapacity',
        'capacity-001',
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
      prisma.institutionalCapacity.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { staffCount: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.institutionalCapacity.findUnique.mockResolvedValue(capacityFixture());
      prisma.institutionalCapacity.update.mockResolvedValue(capacityFixture({ staffCount: 200 }));

      await service.update('capacity-001', { staffCount: 200 }, msUser());

      expect(prisma.institutionalCapacity.update).toHaveBeenCalledWith({
        where: { id: 'capacity-001' },
        data: expect.objectContaining({ staffCount: 200, updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.institutionalCapacity.findUnique.mockResolvedValue(
        capacityFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('capacity-001', { staffCount: 100 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
