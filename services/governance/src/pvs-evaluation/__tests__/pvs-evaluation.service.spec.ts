import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PvsEvaluationService } from '../pvs-evaluation.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { PVSEvaluationType } from '../entities/pvs-evaluation.entity';

// -- Mock factories --

function mockPrisma() {
  return {
    pVSEvaluation: {
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

function pvsFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pvs-001',
    tenantId: 'tenant-ke',
    evaluationType: PVSEvaluationType.PVS,
    evaluationDate: new Date('2025-06-15'),
    overallScore: 3.2,
    criticalCompetencies: { 'II-1': 3, 'II-2': 4, 'III-1': 2 },
    recommendations: ['Strengthen lab capacity', 'Improve border controls'],
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// -- Tests --

describe('PvsEvaluationService', () => {
  let service: PvsEvaluationService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new PvsEvaluationService(prisma as never, kafka as never, audit as never);
  });

  // -- create --

  describe('create', () => {
    it('should create a PVS evaluation and publish Kafka event', async () => {
      const dto = {
        evaluationType: PVSEvaluationType.PVS,
        evaluationDate: '2025-06-15',
        overallScore: 3.2,
        criticalCompetencies: { 'II-1': 3, 'II-2': 4, 'III-1': 2 },
        recommendations: ['Strengthen lab capacity', 'Improve border controls'],
      };

      prisma.pVSEvaluation.create.mockResolvedValue(pvsFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('pvs-001');
      expect(prisma.pVSEvaluation.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.governance.pvs.evaluated.v1',
        'pvs-001',
        expect.objectContaining({ evaluationType: PVSEvaluationType.PVS }),
        expect.objectContaining({ sourceService: 'governance-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'PVSEvaluation',
        'pvs-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PARTNER,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PARTNER', async () => {
      prisma.pVSEvaluation.create.mockResolvedValue(pvsFixture());

      await service.create(
        {
          evaluationType: PVSEvaluationType.PVS,
          evaluationDate: '2025-06-15',
          overallScore: 3.2,
          criticalCompetencies: { 'II-1': 3 },
          recommendations: ['Test'],
        },
        msUser(),
      );

      expect(prisma.pVSEvaluation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PARTNER,
          }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.pVSEvaluation.create.mockResolvedValue(pvsFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          evaluationType: PVSEvaluationType.PVS,
          evaluationDate: '2025-06-15',
          overallScore: 3.2,
          criticalCompetencies: { 'II-1': 3 },
          recommendations: ['Test'],
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // -- findAll --

  describe('findAll', () => {
    it('should return paginated PVS evaluations for MEMBER_STATE user', async () => {
      const records = [pvsFixture()];
      prisma.pVSEvaluation.findMany.mockResolvedValue(records);
      prisma.pVSEvaluation.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.pVSEvaluation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.pVSEvaluation.findMany.mockResolvedValue([]);
      prisma.pVSEvaluation.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.pVSEvaluation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply evaluationType filter', async () => {
      prisma.pVSEvaluation.findMany.mockResolvedValue([]);
      prisma.pVSEvaluation.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { evaluationType: PVSEvaluationType.PVS_GAP },
      );

      expect(prisma.pVSEvaluation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            evaluationType: PVSEvaluationType.PVS_GAP,
          }),
        }),
      );
    });

    it('should apply period filters on evaluationDate', async () => {
      prisma.pVSEvaluation.findMany.mockResolvedValue([]);
      prisma.pVSEvaluation.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2025-01-01', periodEnd: '2025-12-31' },
      );

      expect(prisma.pVSEvaluation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            evaluationDate: {
              gte: new Date('2025-01-01'),
              lte: new Date('2025-12-31'),
            },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.pVSEvaluation.findMany.mockResolvedValue([]);
      prisma.pVSEvaluation.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // -- findOne --

  describe('findOne', () => {
    it('should return a PVS evaluation', async () => {
      prisma.pVSEvaluation.findUnique.mockResolvedValue(pvsFixture());

      const result = await service.findOne('pvs-001', msUser());

      expect(result.data.id).toBe('pvs-001');
      expect(prisma.pVSEvaluation.findUnique).toHaveBeenCalledWith({
        where: { id: 'pvs-001' },
      });
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.pVSEvaluation.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.pVSEvaluation.findUnique.mockResolvedValue(
        pvsFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('pvs-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any record', async () => {
      prisma.pVSEvaluation.findUnique.mockResolvedValue(
        pvsFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('pvs-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // -- update --

  describe('update', () => {
    it('should update PVS evaluation and publish Kafka event', async () => {
      const updated = pvsFixture({ overallScore: 4.0 });
      prisma.pVSEvaluation.findUnique.mockResolvedValue(pvsFixture());
      prisma.pVSEvaluation.update.mockResolvedValue(updated);

      const result = await service.update('pvs-001', { overallScore: 4.0 }, msUser());

      expect(result.data.overallScore).toBe(4.0);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.governance.pvs.updated.v1',
        'pvs-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'governance-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'PVSEvaluation',
        'pvs-001',
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
      prisma.pVSEvaluation.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { overallScore: 4.0 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.pVSEvaluation.findUnique.mockResolvedValue(pvsFixture());
      prisma.pVSEvaluation.update.mockResolvedValue(pvsFixture({ overallScore: 4.5 }));

      await service.update('pvs-001', { overallScore: 4.5 }, msUser());

      expect(prisma.pVSEvaluation.update).toHaveBeenCalledWith({
        where: { id: 'pvs-001' },
        data: expect.objectContaining({ overallScore: 4.5, updatedBy: 'user-ke' }),
      });
    });

    it('should deny access to other tenant for MS user on update', async () => {
      prisma.pVSEvaluation.findUnique.mockResolvedValue(
        pvsFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('pvs-001', { overallScore: 4.0 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
