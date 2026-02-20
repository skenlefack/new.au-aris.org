import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CitesPermitService } from '../cites-permit.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

function mockPrisma() {
  return {
    citesPermit: {
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

function permitFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'permit-001',
    tenantId: 'tenant-ke',
    permitNumber: 'KE-CITES-2026-001',
    permitType: 'Export',
    speciesId: 'species-ivory',
    quantity: 50,
    unit: 'kg',
    purpose: 'Scientific research',
    applicant: 'National Museum of Kenya',
    exportCountry: 'KE',
    importCountry: 'US',
    issueDate: new Date('2026-01-15'),
    expiryDate: new Date('2026-07-15'),
    status: 'issued',
    dataClassification: DataClassification.RESTRICTED,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    ...overrides,
  };
}

describe('CitesPermitService', () => {
  let service: CitesPermitService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new CitesPermitService(prisma as never, kafka as never, audit as never);
  });

  describe('create', () => {
    it('should issue a CITES permit and publish Kafka event', async () => {
      prisma.citesPermit.findFirst.mockResolvedValue(null);
      prisma.citesPermit.create.mockResolvedValue(permitFixture());

      const result = await service.create(
        {
          permitNumber: 'KE-CITES-2026-001',
          permitType: 'Export',
          speciesId: 'species-ivory',
          quantity: 50,
          unit: 'kg',
          purpose: 'Scientific research',
          applicant: 'National Museum of Kenya',
          exportCountry: 'KE',
          importCountry: 'US',
          issueDate: '2026-01-15',
          expiryDate: '2026-07-15',
        },
        msUser(),
      );

      expect(result.data.id).toBe('permit-001');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.wildlife.cites.issued.v1',
        'permit-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'wildlife-service' }),
      );
    });

    it('should throw ConflictException for duplicate permit number', async () => {
      prisma.citesPermit.findFirst.mockResolvedValue(permitFixture());

      await expect(
        service.create(
          {
            permitNumber: 'KE-CITES-2026-001',
            permitType: 'Export',
            speciesId: 'species-ivory',
            quantity: 50,
            unit: 'kg',
            purpose: 'Scientific research',
            applicant: 'National Museum of Kenya',
            exportCountry: 'KE',
            importCountry: 'US',
            issueDate: '2026-01-15',
            expiryDate: '2026-07-15',
          },
          msUser(),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should default dataClassification to RESTRICTED', async () => {
      prisma.citesPermit.findFirst.mockResolvedValue(null);
      prisma.citesPermit.create.mockResolvedValue(permitFixture());

      await service.create(
        {
          permitNumber: 'KE-CITES-2026-002',
          permitType: 'Import',
          speciesId: 'species-parrot',
          quantity: 10,
          unit: 'specimens',
          purpose: 'Breeding',
          applicant: 'Zoo Kenya',
          exportCountry: 'TZ',
          importCountry: 'KE',
          issueDate: '2026-02-01',
          expiryDate: '2026-08-01',
        },
        msUser(),
      );

      expect(prisma.citesPermit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.RESTRICTED,
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated permits for MS user', async () => {
      prisma.citesPermit.findMany.mockResolvedValue([permitFixture()]);
      prisma.citesPermit.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should apply permitType and status filters', async () => {
      prisma.citesPermit.findMany.mockResolvedValue([]);
      prisma.citesPermit.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { permitType: 'Export', status: 'issued' },
      );

      expect(prisma.citesPermit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            permitType: 'Export',
            status: 'issued',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a permit', async () => {
      prisma.citesPermit.findUnique.mockResolvedValue(permitFixture());

      const result = await service.findOne('permit-001', msUser());
      expect(result.data.id).toBe('permit-001');
    });

    it('should throw NotFoundException for nonexistent permit', async () => {
      prisma.citesPermit.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.citesPermit.findUnique.mockResolvedValue(
        permitFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(service.findOne('permit-001', msUser())).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update permit and publish Kafka event', async () => {
      const updated = permitFixture({ status: 'revoked' });
      prisma.citesPermit.findUnique.mockResolvedValue(permitFixture());
      prisma.citesPermit.update.mockResolvedValue(updated);

      const result = await service.update('permit-001', { status: 'revoked' }, msUser());

      expect(result.data.status).toBe('revoked');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.wildlife.cites.updated.v1',
        'permit-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'wildlife-service' }),
      );
    });

    it('should throw NotFoundException on update of nonexistent permit', async () => {
      prisma.citesPermit.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { status: 'revoked' }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
