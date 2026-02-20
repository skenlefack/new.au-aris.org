import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { StakeholderService } from '../stakeholder.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { StakeholderType } from '../entities/stakeholder.entity';

// -- Mock factories --

function mockPrisma() {
  return {
    stakeholderRegistry: {
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

function stakeholderFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stakeholder-001',
    tenantId: 'tenant-ke',
    name: 'Kenya Veterinary Board',
    type: StakeholderType.GOVERNMENT,
    contactPerson: 'Dr. Jane Doe',
    email: 'info@kvb.go.ke',
    domains: ['Animal Health', 'Governance'],
    dataClassification: DataClassification.PUBLIC,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// -- Tests --

describe('StakeholderService', () => {
  let service: StakeholderService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new StakeholderService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create a stakeholder and publish Kafka event', async () => {
      const dto = {
        name: 'Kenya Veterinary Board',
        type: StakeholderType.GOVERNMENT,
        contactPerson: 'Dr. Jane Doe',
        email: 'info@kvb.go.ke',
        domains: ['Animal Health', 'Governance'],
      };

      prisma.stakeholderRegistry.create.mockResolvedValue(stakeholderFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('stakeholder-001');
      expect(prisma.stakeholderRegistry.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.governance.stakeholder.created.v1',
        'stakeholder-001',
        expect.objectContaining({ name: 'Kenya Veterinary Board' }),
        expect.objectContaining({ sourceService: 'governance-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'StakeholderRegistry',
        'stakeholder-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PUBLIC,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PUBLIC', async () => {
      prisma.stakeholderRegistry.create.mockResolvedValue(stakeholderFixture());

      await service.create(
        {
          name: 'Kenya Veterinary Board',
          type: StakeholderType.GOVERNMENT,
          domains: ['Animal Health'],
        },
        msUser(),
      );

      expect(prisma.stakeholderRegistry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PUBLIC,
          }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.stakeholderRegistry.create.mockResolvedValue(stakeholderFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          name: 'Kenya Veterinary Board',
          type: StakeholderType.GOVERNMENT,
          domains: ['Animal Health'],
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated stakeholders for MEMBER_STATE user', async () => {
      const records = [stakeholderFixture()];
      prisma.stakeholderRegistry.findMany.mockResolvedValue(records);
      prisma.stakeholderRegistry.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.stakeholderRegistry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.stakeholderRegistry.findMany.mockResolvedValue([]);
      prisma.stakeholderRegistry.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.stakeholderRegistry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply type filter', async () => {
      prisma.stakeholderRegistry.findMany.mockResolvedValue([]);
      prisma.stakeholderRegistry.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { type: StakeholderType.NGO },
      );

      expect(prisma.stakeholderRegistry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: StakeholderType.NGO,
          }),
        }),
      );
    });

    it('should apply domain filter using has operator', async () => {
      prisma.stakeholderRegistry.findMany.mockResolvedValue([]);
      prisma.stakeholderRegistry.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { domain: 'Animal Health' },
      );

      expect(prisma.stakeholderRegistry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            domains: { has: 'Animal Health' },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.stakeholderRegistry.findMany.mockResolvedValue([]);
      prisma.stakeholderRegistry.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return a stakeholder', async () => {
      prisma.stakeholderRegistry.findUnique.mockResolvedValue(stakeholderFixture());

      const result = await service.findOne('stakeholder-001', msUser());

      expect(result.data.id).toBe('stakeholder-001');
      expect(prisma.stakeholderRegistry.findUnique).toHaveBeenCalledWith({
        where: { id: 'stakeholder-001' },
      });
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.stakeholderRegistry.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.stakeholderRegistry.findUnique.mockResolvedValue(
        stakeholderFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('stakeholder-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.stakeholderRegistry.findUnique.mockResolvedValue(
        stakeholderFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('stakeholder-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update stakeholder and publish Kafka event', async () => {
      const updated = stakeholderFixture({ name: 'Kenya Vet Board (updated)' });
      prisma.stakeholderRegistry.findUnique.mockResolvedValue(stakeholderFixture());
      prisma.stakeholderRegistry.update.mockResolvedValue(updated);

      const result = await service.update('stakeholder-001', { name: 'Kenya Vet Board (updated)' }, msUser());

      expect(result.data.name).toBe('Kenya Vet Board (updated)');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.governance.stakeholder.updated.v1',
        'stakeholder-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'governance-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'StakeholderRegistry',
        'stakeholder-001',
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
      prisma.stakeholderRegistry.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.stakeholderRegistry.findUnique.mockResolvedValue(stakeholderFixture());
      prisma.stakeholderRegistry.update.mockResolvedValue(stakeholderFixture({ name: 'New Name' }));

      await service.update('stakeholder-001', { name: 'New Name' }, msUser());

      expect(prisma.stakeholderRegistry.update).toHaveBeenCalledWith({
        where: { id: 'stakeholder-001' },
        data: expect.objectContaining({ name: 'New Name', updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.stakeholderRegistry.findUnique.mockResolvedValue(
        stakeholderFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('stakeholder-001', { name: 'Test' }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
