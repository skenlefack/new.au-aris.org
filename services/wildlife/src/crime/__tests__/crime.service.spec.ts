import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CrimeService } from '../crime.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

function mockPrisma() {
  return {
    wildlifeCrime: {
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
    email: 'wildlife@ke.au-aris.org',
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

function crimeFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'crime-001',
    tenantId: 'tenant-ke',
    incidentDate: new Date('2026-01-18'),
    geoEntityId: 'geo-tsavo',
    coordinates: { lat: -2.9, lng: 38.5 },
    crimeType: 'Poaching',
    speciesIds: ['species-elephant'],
    description: 'Ivory poaching incident in Tsavo East',
    suspectsCount: 3,
    seizureDescription: 'Raw ivory tusks',
    seizureQuantity: 45,
    seizureUnit: 'kg',
    status: 'reported',
    reportingAgency: 'Kenya Wildlife Service',
    dataClassification: DataClassification.RESTRICTED,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-18'),
    updatedAt: new Date('2026-01-18'),
    ...overrides,
  };
}

describe('CrimeService', () => {
  let service: CrimeService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new CrimeService(prisma as never, kafka as never, audit as never);
  });

  describe('create', () => {
    it('should report a wildlife crime and publish Kafka event', async () => {
      prisma.wildlifeCrime.create.mockResolvedValue(crimeFixture());

      const result = await service.create(
        {
          incidentDate: '2026-01-18',
          geoEntityId: 'geo-tsavo',
          crimeType: 'Poaching',
          speciesIds: ['species-elephant'],
          description: 'Ivory poaching incident in Tsavo East',
          suspectsCount: 3,
          reportingAgency: 'Kenya Wildlife Service',
        },
        msUser(),
      );

      expect(result.data.id).toBe('crime-001');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.wildlife.crime.reported.v1',
        'crime-001',
        expect.objectContaining({ crimeType: 'Poaching' }),
        expect.objectContaining({ sourceService: 'wildlife-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'WildlifeCrime',
        'crime-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.RESTRICTED,
        expect.any(Object),
      );
    });

    it('should default dataClassification to RESTRICTED', async () => {
      prisma.wildlifeCrime.create.mockResolvedValue(crimeFixture());

      await service.create(
        {
          incidentDate: '2026-01-18',
          geoEntityId: 'geo-tsavo',
          crimeType: 'Poaching',
          speciesIds: ['species-elephant'],
          description: 'Test incident',
          reportingAgency: 'KWS',
        },
        msUser(),
      );

      expect(prisma.wildlifeCrime.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.RESTRICTED,
          }),
        }),
      );
    });

    it('should not fail if Kafka publish errors', async () => {
      prisma.wildlifeCrime.create.mockResolvedValue(crimeFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          incidentDate: '2026-01-18',
          geoEntityId: 'geo-tsavo',
          crimeType: 'Poaching',
          speciesIds: ['species-elephant'],
          description: 'Test incident',
          reportingAgency: 'KWS',
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated crimes for MEMBER_STATE user', async () => {
      prisma.wildlifeCrime.findMany.mockResolvedValue([crimeFixture()]);
      prisma.wildlifeCrime.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should apply crimeType and status filters', async () => {
      prisma.wildlifeCrime.findMany.mockResolvedValue([]);
      prisma.wildlifeCrime.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { crimeType: 'Poaching', status: 'reported' },
      );

      expect(prisma.wildlifeCrime.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            crimeType: 'Poaching',
            status: 'reported',
          }),
        }),
      );
    });

    it('should apply period filters on incidentDate', async () => {
      prisma.wildlifeCrime.findMany.mockResolvedValue([]);
      prisma.wildlifeCrime.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      );

      expect(prisma.wildlifeCrime.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            incidentDate: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a crime report', async () => {
      prisma.wildlifeCrime.findUnique.mockResolvedValue(crimeFixture());

      const result = await service.findOne('crime-001', msUser());
      expect(result.data.id).toBe('crime-001');
    });

    it('should throw NotFoundException for nonexistent crime', async () => {
      prisma.wildlifeCrime.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.wildlifeCrime.findUnique.mockResolvedValue(
        crimeFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(service.findOne('crime-001', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.wildlifeCrime.findUnique.mockResolvedValue(
        crimeFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('crime-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update crime report and publish Kafka event', async () => {
      const updated = crimeFixture({ status: 'under_investigation' });
      prisma.wildlifeCrime.findUnique.mockResolvedValue(crimeFixture());
      prisma.wildlifeCrime.update.mockResolvedValue(updated);

      const result = await service.update('crime-001', { status: 'under_investigation' }, msUser());

      expect(result.data.status).toBe('under_investigation');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.wildlife.crime.updated.v1',
        'crime-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'wildlife-service' }),
      );
    });

    it('should throw NotFoundException for nonexistent crime on update', async () => {
      prisma.wildlifeCrime.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { status: 'closed' }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.wildlifeCrime.findUnique.mockResolvedValue(
        crimeFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('crime-001', { status: 'closed' }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
