import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SpsCertificateService } from '../sps-certificate.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// ── Mock factories ──

function mockPrisma() {
  return {
    spsCertificate: {
      create: vi.fn(),
      findUnique: vi.fn(),
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
    email: 'sps@ke.au-aris.org',
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

function certFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cert-001',
    tenantId: 'tenant-ke',
    certificateNumber: 'SPS-KE-2026-0001',
    consignmentId: 'consign-001',
    exporterId: 'exporter-001',
    importerId: 'importer-001',
    speciesId: 'species-cattle',
    commodity: 'Beef carcasses',
    quantity: 200,
    unit: 'tonnes',
    originCountryId: 'country-ke',
    destinationCountryId: 'country-ae',
    inspectionResult: 'PASS',
    inspectionDate: new Date('2026-02-01'),
    certifiedBy: 'inspector-001',
    certifiedAt: null,
    status: 'DRAFT',
    validUntil: null,
    remarks: null,
    dataClassification: DataClassification.RESTRICTED,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
    ...overrides,
  };
}

// ── Tests ──

describe('SpsCertificateService', () => {
  let service: SpsCertificateService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new SpsCertificateService(prisma as never, kafka as never, audit as never);
  });

  // ── create ──

  describe('create', () => {
    it('should create a certificate and publish Kafka event', async () => {
      const dto = {
        certificateNumber: 'SPS-KE-2026-0001',
        consignmentId: 'consign-001',
        exporterId: 'exporter-001',
        importerId: 'importer-001',
        speciesId: 'species-cattle',
        commodity: 'Beef carcasses',
        quantity: 200,
        unit: 'tonnes',
        originCountryId: 'country-ke',
        destinationCountryId: 'country-ae',
        inspectionResult: 'PASS' as const,
        inspectionDate: '2026-02-01T00:00:00.000Z',
        certifiedBy: 'inspector-001',
      };

      prisma.spsCertificate.create.mockResolvedValue(certFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('cert-001');
      expect(prisma.spsCertificate.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.trade.sps.certified.v1',
        'cert-001',
        expect.objectContaining({ commodity: 'Beef carcasses' }),
        expect.objectContaining({ sourceService: 'trade-sps-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'SpsCertificate',
        'cert-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.RESTRICTED,
        expect.any(Object),
      );
    });

    it('should default dataClassification to RESTRICTED', async () => {
      prisma.spsCertificate.create.mockResolvedValue(certFixture());
      await service.create(
        {
          certificateNumber: 'SPS-001', consignmentId: 'c1', exporterId: 'e1',
          importerId: 'i1', speciesId: 's1', commodity: 'x', quantity: 1,
          unit: 'kg', originCountryId: 'o1', destinationCountryId: 'd1',
          inspectionResult: 'PENDING', inspectionDate: '2026-02-01T00:00:00.000Z',
          certifiedBy: 'cb1',
        },
        msUser(),
      );
      expect(prisma.spsCertificate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dataClassification: DataClassification.RESTRICTED }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.spsCertificate.create.mockResolvedValue(certFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));
      const result = await service.create(
        {
          certificateNumber: 'SPS-001', consignmentId: 'c1', exporterId: 'e1',
          importerId: 'i1', speciesId: 's1', commodity: 'x', quantity: 1,
          unit: 'kg', originCountryId: 'o1', destinationCountryId: 'd1',
          inspectionResult: 'PENDING', inspectionDate: '2026-02-01T00:00:00.000Z',
          certifiedBy: 'cb1',
        },
        msUser(),
      );
      expect(result.data).toBeDefined();
    });
  });

  // ── findAll ──

  describe('findAll', () => {
    it('should return paginated certificates for MEMBER_STATE user', async () => {
      prisma.spsCertificate.findMany.mockResolvedValue([certFixture()]);
      prisma.spsCertificate.count.mockResolvedValue(1);
      const result = await service.findAll(msUser(), {}, {});
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.spsCertificate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.spsCertificate.findMany.mockResolvedValue([]);
      prisma.spsCertificate.count.mockResolvedValue(0);
      await service.findAll(continentalUser(), {}, {});
      expect(prisma.spsCertificate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply inspectionResult and status filters', async () => {
      prisma.spsCertificate.findMany.mockResolvedValue([]);
      prisma.spsCertificate.count.mockResolvedValue(0);
      await service.findAll(continentalUser(), {}, { inspectionResult: 'PASS', status: 'DRAFT' });
      expect(prisma.spsCertificate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ inspectionResult: 'PASS', status: 'DRAFT' }),
        }),
      );
    });

    it('should apply period filters on inspectionDate', async () => {
      prisma.spsCertificate.findMany.mockResolvedValue([]);
      prisma.spsCertificate.count.mockResolvedValue(0);
      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      );
      expect(prisma.spsCertificate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            inspectionDate: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.spsCertificate.findMany.mockResolvedValue([]);
      prisma.spsCertificate.count.mockResolvedValue(0);
      const result = await service.findAll(continentalUser(), { limit: 500 }, {});
      expect(result.meta.limit).toBe(100);
    });
  });

  // ── findOne ──

  describe('findOne', () => {
    it('should return certificate by id', async () => {
      prisma.spsCertificate.findUnique.mockResolvedValue(certFixture());
      const result = await service.findOne('cert-001', msUser());
      expect(result.data.id).toBe('cert-001');
    });

    it('should throw NotFoundException for nonexistent certificate', async () => {
      prisma.spsCertificate.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.spsCertificate.findUnique.mockResolvedValue(certFixture({ tenantId: 'tenant-ng' }));
      await expect(service.findOne('cert-001', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any certificate', async () => {
      prisma.spsCertificate.findUnique.mockResolvedValue(certFixture({ tenantId: 'tenant-ng' }));
      const result = await service.findOne('cert-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // ── update ──

  describe('update', () => {
    it('should update certificate and publish Kafka event', async () => {
      const updated = certFixture({ commodity: 'Frozen beef' });
      prisma.spsCertificate.findUnique.mockResolvedValue(certFixture());
      prisma.spsCertificate.update.mockResolvedValue(updated);
      const result = await service.update('cert-001', { commodity: 'Frozen beef' }, msUser());
      expect(result.data.commodity).toBe('Frozen beef');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.trade.sps.updated.v1',
        'cert-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'trade-sps-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'SpsCertificate',
        'cert-001',
        'UPDATE',
        expect.any(Object),
        DataClassification.RESTRICTED,
        expect.objectContaining({
          previousVersion: expect.any(Object),
          newVersion: expect.any(Object),
        }),
      );
    });

    it('should throw NotFoundException for nonexistent certificate', async () => {
      prisma.spsCertificate.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', { commodity: 'x' }, msUser())).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.spsCertificate.findUnique.mockResolvedValue(certFixture());
      prisma.spsCertificate.update.mockResolvedValue(certFixture({ quantity: 300 }));

      await service.update('cert-001', { quantity: 300 }, msUser());

      expect(prisma.spsCertificate.update).toHaveBeenCalledWith({
        where: { id: 'cert-001' },
        data: expect.objectContaining({ quantity: 300, updatedBy: 'user-ke' }),
      });
    });
  });

  // ── issue ──

  describe('issue', () => {
    it('should issue a draft certificate', async () => {
      const issued = certFixture({ status: 'ISSUED', certifiedAt: new Date() });
      prisma.spsCertificate.findUnique.mockResolvedValue(certFixture());
      prisma.spsCertificate.update.mockResolvedValue(issued);

      const result = await service.issue('cert-001', msUser());

      expect(result.data.status).toBe('ISSUED');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.trade.sps.certified.v1',
        'cert-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'trade-sps-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'SpsCertificate',
        'cert-001',
        'VALIDATE',
        expect.any(Object),
        DataClassification.RESTRICTED,
        expect.objectContaining({
          previousVersion: expect.any(Object),
          newVersion: expect.any(Object),
        }),
      );
    });

    it('should throw BadRequestException if already issued', async () => {
      prisma.spsCertificate.findUnique.mockResolvedValue(
        certFixture({ status: 'ISSUED' }),
      );

      await expect(
        service.issue('cert-001', msUser()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for nonexistent certificate', async () => {
      prisma.spsCertificate.findUnique.mockResolvedValue(null);

      await expect(
        service.issue('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.spsCertificate.findUnique.mockResolvedValue(
        certFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.issue('cert-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to issue any certificate', async () => {
      const issued = certFixture({ tenantId: 'tenant-ng', status: 'ISSUED', certifiedAt: new Date() });
      prisma.spsCertificate.findUnique.mockResolvedValue(certFixture({ tenantId: 'tenant-ng' }));
      prisma.spsCertificate.update.mockResolvedValue(issued);

      const result = await service.issue('cert-001', continentalUser());
      expect(result.data.status).toBe('ISSUED');
    });
  });
});
