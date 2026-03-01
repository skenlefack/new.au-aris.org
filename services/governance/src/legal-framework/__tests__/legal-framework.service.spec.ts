import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { LegalFrameworkService } from '../legal-framework.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { FrameworkType, FrameworkStatus } from '../entities/legal-framework.entity';

// -- Mock factories --

function mockPrisma() {
  return {
    legalFramework: {
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

function frameworkFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'framework-001',
    tenantId: 'tenant-ke',
    title: 'Veterinary Surgeons Act',
    type: FrameworkType.LAW,
    domain: 'Animal Health',
    adoptionDate: null,
    status: FrameworkStatus.DRAFT,
    documentFileId: null,
    dataClassification: DataClassification.PUBLIC,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// -- Tests --

describe('LegalFrameworkService', () => {
  let service: LegalFrameworkService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new LegalFrameworkService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create a legal framework and publish Kafka event', async () => {
      const dto = {
        title: 'Veterinary Surgeons Act',
        type: FrameworkType.LAW,
        domain: 'Animal Health',
        status: FrameworkStatus.DRAFT,
      };

      prisma.legalFramework.create.mockResolvedValue(frameworkFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('framework-001');
      expect(prisma.legalFramework.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.governance.framework.created.v1',
        'framework-001',
        expect.objectContaining({ title: 'Veterinary Surgeons Act' }),
        expect.objectContaining({ sourceService: 'governance-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'LegalFramework',
        'framework-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PUBLIC,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PUBLIC', async () => {
      prisma.legalFramework.create.mockResolvedValue(frameworkFixture());

      await service.create(
        {
          title: 'Veterinary Surgeons Act',
          type: FrameworkType.LAW,
          domain: 'Animal Health',
          status: FrameworkStatus.DRAFT,
        },
        msUser(),
      );

      expect(prisma.legalFramework.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PUBLIC,
          }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.legalFramework.create.mockResolvedValue(frameworkFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          title: 'Veterinary Surgeons Act',
          type: FrameworkType.LAW,
          domain: 'Animal Health',
          status: FrameworkStatus.DRAFT,
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated legal frameworks for MEMBER_STATE user', async () => {
      const records = [frameworkFixture()];
      prisma.legalFramework.findMany.mockResolvedValue(records);
      prisma.legalFramework.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.legalFramework.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.legalFramework.findMany.mockResolvedValue([]);
      prisma.legalFramework.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.legalFramework.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply type and domain filters', async () => {
      prisma.legalFramework.findMany.mockResolvedValue([]);
      prisma.legalFramework.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { type: FrameworkType.LAW, domain: 'Animal Health' },
      );

      expect(prisma.legalFramework.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: FrameworkType.LAW,
            domain: 'Animal Health',
          }),
        }),
      );
    });

    it('should apply status filter', async () => {
      prisma.legalFramework.findMany.mockResolvedValue([]);
      prisma.legalFramework.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { status: FrameworkStatus.IN_FORCE },
      );

      expect(prisma.legalFramework.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: FrameworkStatus.IN_FORCE,
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.legalFramework.findMany.mockResolvedValue([]);
      prisma.legalFramework.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return a legal framework', async () => {
      prisma.legalFramework.findUnique.mockResolvedValue(frameworkFixture());

      const result = await service.findOne('framework-001', msUser());

      expect(result.data.id).toBe('framework-001');
      expect(prisma.legalFramework.findUnique).toHaveBeenCalledWith({
        where: { id: 'framework-001' },
      });
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.legalFramework.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.legalFramework.findUnique.mockResolvedValue(
        frameworkFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('framework-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.legalFramework.findUnique.mockResolvedValue(
        frameworkFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('framework-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update legal framework and publish Kafka event', async () => {
      const updated = frameworkFixture({ title: 'Updated Act' });
      prisma.legalFramework.findUnique.mockResolvedValue(frameworkFixture());
      prisma.legalFramework.update.mockResolvedValue(updated);

      const result = await service.update('framework-001', { title: 'Updated Act' }, msUser());

      expect(result.data.title).toBe('Updated Act');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.governance.framework.updated.v1',
        'framework-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'governance-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'LegalFramework',
        'framework-001',
        'UPDATE',
        expect.any(Object),
        DataClassification.PUBLIC,
        expect.objectContaining({
          previousVersion: expect.any(Object),
          newVersion: expect.any(Object),
        }),
      );
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.legalFramework.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { title: 'Test' }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.legalFramework.findUnique.mockResolvedValue(frameworkFixture());
      prisma.legalFramework.update.mockResolvedValue(frameworkFixture({ title: 'New Title' }));

      await service.update('framework-001', { title: 'New Title' }, msUser());

      expect(prisma.legalFramework.update).toHaveBeenCalledWith({
        where: { id: 'framework-001' },
        data: expect.objectContaining({ title: 'New Title', updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.legalFramework.findUnique.mockResolvedValue(
        frameworkFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('framework-001', { title: 'Test' }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -- adopt --

  describe('adopt', () => {
    it('should set status to ADOPTED and publish FRAMEWORK_ADOPTED event', async () => {
      const adopted = frameworkFixture({
        status: FrameworkStatus.ADOPTED,
        adoptionDate: new Date('2026-02-20'),
      });
      prisma.legalFramework.findUnique.mockResolvedValue(frameworkFixture());
      prisma.legalFramework.update.mockResolvedValue(adopted);

      const result = await service.adopt('framework-001', msUser());

      expect(result.data.status).toBe(FrameworkStatus.ADOPTED);
      expect(prisma.legalFramework.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'framework-001' },
          data: expect.objectContaining({
            status: FrameworkStatus.ADOPTED,
            adoptionDate: expect.any(Date),
            updatedBy: 'user-ke',
          }),
        }),
      );
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.governance.framework.adopted.v1',
        'framework-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'governance-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'LegalFramework',
        'framework-001',
        'VALIDATE',
        expect.any(Object),
        DataClassification.PUBLIC,
        expect.objectContaining({
          previousVersion: expect.any(Object),
          newVersion: expect.any(Object),
        }),
      );
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.legalFramework.findUnique.mockResolvedValue(null);

      await expect(
        service.adopt('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user on adopt', async () => {
      prisma.legalFramework.findUnique.mockResolvedValue(
        frameworkFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.adopt('framework-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
