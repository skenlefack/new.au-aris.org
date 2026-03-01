import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TrainingService } from '../training.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// -- Mock factories --

function mockPrisma() {
  return {
    beekeeperTraining: {
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

function trainingFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'training-001',
    tenantId: 'tenant-ke',
    beekeeperId: 'beekeeper-001',
    trainingType: 'Modern Beekeeping',
    completedDate: new Date('2026-01-20'),
    certificationNumber: 'CERT-2026-001',
    dataClassification: DataClassification.PUBLIC,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// -- Tests --

describe('TrainingService', () => {
  let service: TrainingService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new TrainingService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create a beekeeper training and publish Kafka event', async () => {
      const dto = {
        beekeeperId: 'beekeeper-001',
        trainingType: 'Modern Beekeeping',
        completedDate: '2026-01-20',
        certificationNumber: 'CERT-2026-001',
      };

      prisma.beekeeperTraining.create.mockResolvedValue(trainingFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('training-001');
      expect(prisma.beekeeperTraining.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.apiculture.training.created.v1',
        'training-001',
        expect.objectContaining({ beekeeperId: 'beekeeper-001' }),
        expect.objectContaining({ sourceService: 'apiculture-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'BeekeeperTraining',
        'training-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PUBLIC,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PUBLIC', async () => {
      prisma.beekeeperTraining.create.mockResolvedValue(trainingFixture());

      await service.create(
        {
          beekeeperId: 'beekeeper-001',
          trainingType: 'Modern Beekeeping',
          completedDate: '2026-01-20',
        },
        msUser(),
      );

      expect(prisma.beekeeperTraining.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PUBLIC,
          }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.beekeeperTraining.create.mockResolvedValue(trainingFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          beekeeperId: 'beekeeper-001',
          trainingType: 'Modern Beekeeping',
          completedDate: '2026-01-20',
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated training records for MEMBER_STATE user', async () => {
      const records = [trainingFixture()];
      prisma.beekeeperTraining.findMany.mockResolvedValue(records);
      prisma.beekeeperTraining.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.beekeeperTraining.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.beekeeperTraining.findMany.mockResolvedValue([]);
      prisma.beekeeperTraining.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.beekeeperTraining.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply beekeeperId and trainingType filters', async () => {
      prisma.beekeeperTraining.findMany.mockResolvedValue([]);
      prisma.beekeeperTraining.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { beekeeperId: 'beekeeper-001', trainingType: 'Modern Beekeeping' },
      );

      expect(prisma.beekeeperTraining.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            beekeeperId: 'beekeeper-001',
            trainingType: 'Modern Beekeeping',
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.beekeeperTraining.findMany.mockResolvedValue([]);
      prisma.beekeeperTraining.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return a beekeeper training record', async () => {
      prisma.beekeeperTraining.findUnique.mockResolvedValue(trainingFixture());

      const result = await service.findOne('training-001', msUser());

      expect(result.data.id).toBe('training-001');
      expect(prisma.beekeeperTraining.findUnique).toHaveBeenCalledWith({
        where: { id: 'training-001' },
      });
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.beekeeperTraining.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.beekeeperTraining.findUnique.mockResolvedValue(
        trainingFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('training-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.beekeeperTraining.findUnique.mockResolvedValue(
        trainingFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('training-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update training record and publish Kafka event', async () => {
      const updated = trainingFixture({ trainingType: 'Advanced Beekeeping' });
      prisma.beekeeperTraining.findUnique.mockResolvedValue(trainingFixture());
      prisma.beekeeperTraining.update.mockResolvedValue(updated);

      const result = await service.update('training-001', { trainingType: 'Advanced Beekeeping' }, msUser());

      expect(result.data.trainingType).toBe('Advanced Beekeeping');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.apiculture.training.updated.v1',
        'training-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'apiculture-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'BeekeeperTraining',
        'training-001',
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
      prisma.beekeeperTraining.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { trainingType: 'Test' }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.beekeeperTraining.findUnique.mockResolvedValue(trainingFixture());
      prisma.beekeeperTraining.update.mockResolvedValue(trainingFixture({ trainingType: 'Queen Rearing' }));

      await service.update('training-001', { trainingType: 'Queen Rearing' }, msUser());

      expect(prisma.beekeeperTraining.update).toHaveBeenCalledWith({
        where: { id: 'training-001' },
        data: expect.objectContaining({ trainingType: 'Queen Rearing', updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.beekeeperTraining.findUnique.mockResolvedValue(
        trainingFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('training-001', { trainingType: 'Test' }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
