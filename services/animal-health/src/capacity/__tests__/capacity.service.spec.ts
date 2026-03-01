import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { CapacityService } from '../capacity.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

function mockPrisma() {
  return {
    svCapacity: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
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

function msUser(): AuthenticatedUser {
  return {
    userId: 'user-ke',
    email: 'cvo@ke.au-aris.org',
    role: UserRole.NATIONAL_ADMIN,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
  };
}

function capacityFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cap-001',
    tenantId: 'tenant-ke',
    year: 2025,
    epiStaff: 45,
    labStaff: 30,
    labTestsAvailable: ['PCR', 'ELISA', 'RBT'],
    vaccineProductionCapacity: null,
    pvsScore: 3.2,
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    ...overrides,
  };
}

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

  describe('create', () => {
    it('should create SV capacity report', async () => {
      prisma.svCapacity.findFirst.mockResolvedValue(null);
      prisma.svCapacity.create.mockResolvedValue(capacityFixture());

      const result = await service.create(
        {
          year: 2025,
          epiStaff: 45,
          labStaff: 30,
          labTestsAvailable: ['PCR', 'ELISA', 'RBT'],
          pvsScore: 3.2,
        },
        msUser(),
      );

      expect(result.data.id).toBe('cap-001');
      expect(audit.log).toHaveBeenCalledWith(
        'SVCapacity',
        'cap-001',
        'CREATE',
        expect.any(Object),
        DataClassification.PARTNER,
        expect.any(Object),
      );
    });

    it('should throw ConflictException if year already reported for tenant', async () => {
      prisma.svCapacity.findFirst.mockResolvedValue(capacityFixture());

      await expect(
        service.create(
          {
            year: 2025,
            epiStaff: 40,
            labStaff: 25,
            labTestsAvailable: ['PCR'],
          },
          msUser(),
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should filter by year', async () => {
      prisma.svCapacity.findMany.mockResolvedValue([]);
      prisma.svCapacity.count.mockResolvedValue(0);

      await service.findAll(msUser(), {}, { year: 2025 });

      expect(prisma.svCapacity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ year: 2025 }),
        }),
      );
    });

    it('should scope to tenant for MEMBER_STATE', async () => {
      prisma.svCapacity.findMany.mockResolvedValue([]);
      prisma.svCapacity.count.mockResolvedValue(0);

      await service.findAll(msUser(), {}, {});

      expect(prisma.svCapacity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should return correct pagination meta', async () => {
      prisma.svCapacity.findMany.mockResolvedValue([]);
      prisma.svCapacity.count.mockResolvedValue(42);

      const result = await service.findAll(msUser(), { page: 2, limit: 10 }, {});

      expect(result.meta).toEqual({ total: 42, page: 2, limit: 10 });
    });
  });
});
