import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { LabResultService } from '../lab-result.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

function mockPrisma() {
  return {
    healthEvent: { findUnique: vi.fn() },
    labResult: {
      create: vi.fn(),
      findUnique: vi.fn(),
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

function msUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-ke',
    email: 'lab@ke.au-aris.org',
    role: UserRole.DATA_STEWARD,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

function labFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lab-001',
    tenantId: 'tenant-ke',
    sampleId: 'SAMP-2026-001',
    sampleType: 'blood',
    dateCollected: new Date('2026-01-12'),
    dateReceived: new Date('2026-01-13'),
    testType: 'PCR',
    result: 'POSITIVE',
    labId: 'lab-nairobi',
    turnaroundDays: 3,
    eqaFlag: true,
    healthEventId: 'evt-001',
    dataClassification: DataClassification.RESTRICTED,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-13'),
    updatedAt: new Date('2026-01-13'),
    ...overrides,
  };
}

describe('LabResultService', () => {
  let service: LabResultService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new LabResultService(prisma as never, kafka as never, audit as never);
  });

  describe('create', () => {
    it('should create a lab result linked to a health event', async () => {
      prisma.healthEvent.findUnique.mockResolvedValue({ id: 'evt-001' });
      prisma.labResult.create.mockResolvedValue(labFixture());

      const result = await service.create(
        {
          sampleId: 'SAMP-2026-001',
          sampleType: 'blood',
          dateCollected: '2026-01-12T00:00:00.000Z',
          dateReceived: '2026-01-13T00:00:00.000Z',
          testType: 'PCR',
          result: 'POSITIVE',
          labId: 'lab-nairobi',
          turnaroundDays: 3,
          eqaFlag: true,
          healthEventId: 'evt-001',
        },
        msUser(),
      );

      expect(result.data.id).toBe('lab-001');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.health.lab.result.created.v1',
        'lab-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'animal-health-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'LabResult',
        'lab-001',
        'CREATE',
        expect.any(Object),
        DataClassification.RESTRICTED,
        expect.any(Object),
      );
    });

    it('should throw NotFoundException if linked health event does not exist', async () => {
      prisma.healthEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            sampleId: 'S1',
            sampleType: 'blood',
            dateCollected: '2026-01-12T00:00:00.000Z',
            dateReceived: '2026-01-13T00:00:00.000Z',
            testType: 'PCR',
            result: 'NEGATIVE',
            labId: 'lab-1',
            turnaroundDays: 1,
            eqaFlag: false,
            healthEventId: 'nonexistent',
          },
          msUser(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow creating without health event link', async () => {
      prisma.labResult.create.mockResolvedValue(
        labFixture({ healthEventId: null }),
      );

      const result = await service.create(
        {
          sampleId: 'S1',
          sampleType: 'serum',
          dateCollected: '2026-01-12T00:00:00.000Z',
          dateReceived: '2026-01-13T00:00:00.000Z',
          testType: 'ELISA',
          result: 'NEGATIVE',
          labId: 'lab-1',
          turnaroundDays: 2,
          eqaFlag: false,
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
      expect(prisma.healthEvent.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should filter by healthEventId', async () => {
      prisma.labResult.findMany.mockResolvedValue([]);
      prisma.labResult.count.mockResolvedValue(0);

      await service.findAll(msUser(), {}, { healthEventId: 'evt-001' });

      expect(prisma.labResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ healthEventId: 'evt-001' }),
        }),
      );
    });

    it('should filter by result type', async () => {
      prisma.labResult.findMany.mockResolvedValue([]);
      prisma.labResult.count.mockResolvedValue(0);

      await service.findAll(msUser(), {}, { result: 'POSITIVE' });

      expect(prisma.labResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ result: 'POSITIVE' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return lab result by ID', async () => {
      prisma.labResult.findUnique.mockResolvedValue(labFixture());

      const result = await service.findOne('lab-001', msUser());

      expect(result.data.sampleId).toBe('SAMP-2026-001');
    });

    it('should throw NotFoundException for nonexistent lab result', async () => {
      prisma.labResult.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant', async () => {
      prisma.labResult.findUnique.mockResolvedValue(
        labFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('lab-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
