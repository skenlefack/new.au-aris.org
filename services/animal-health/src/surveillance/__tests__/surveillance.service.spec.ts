import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SurveillanceService } from '../surveillance.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

function mockPrisma() {
  return {
    surveillanceActivity: {
      create: vi.fn(),
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
    email: 'epi@ke.aris.africa',
    role: UserRole.DATA_STEWARD,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
  };
}

function surveillanceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'surv-001',
    tenantId: 'tenant-ke',
    type: 'ACTIVE',
    diseaseId: 'disease-fmd',
    designType: 'RISK_BASED',
    sampleSize: 500,
    positivityRate: 2.5,
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-03-31'),
    geoEntityId: 'geo-ke-rift',
    mapLayerId: null,
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    ...overrides,
  };
}

describe('SurveillanceService', () => {
  let service: SurveillanceService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new SurveillanceService(prisma as never, kafka as never, audit as never);
  });

  describe('create', () => {
    it('should create surveillance activity and publish event', async () => {
      prisma.surveillanceActivity.create.mockResolvedValue(surveillanceFixture());

      const result = await service.create(
        {
          type: 'ACTIVE',
          diseaseId: 'disease-fmd',
          designType: 'RISK_BASED',
          sampleSize: 500,
          positivityRate: 2.5,
          periodStart: '2026-01-01T00:00:00.000Z',
          periodEnd: '2026-03-31T00:00:00.000Z',
          geoEntityId: 'geo-ke-rift',
        },
        msUser(),
      );

      expect(result.data.id).toBe('surv-001');
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.health.surveillance.reported.v1',
        'surv-001',
        expect.any(Object),
        expect.any(Object),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'SurveillanceActivity',
        'surv-001',
        'CREATE',
        expect.any(Object),
        DataClassification.PARTNER,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PARTNER', async () => {
      prisma.surveillanceActivity.create.mockResolvedValue(surveillanceFixture());

      await service.create(
        {
          type: 'PASSIVE',
          diseaseId: 'd1',
          sampleSize: 100,
          periodStart: '2026-01-01T00:00:00.000Z',
          periodEnd: '2026-06-30T00:00:00.000Z',
          geoEntityId: 'g1',
        },
        msUser(),
      );

      expect(prisma.surveillanceActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.PARTNER,
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should filter by type', async () => {
      prisma.surveillanceActivity.findMany.mockResolvedValue([]);
      prisma.surveillanceActivity.count.mockResolvedValue(0);

      await service.findAll(msUser(), {}, { type: 'ACTIVE' });

      expect(prisma.surveillanceActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'ACTIVE' }),
        }),
      );
    });

    it('should filter by disease', async () => {
      prisma.surveillanceActivity.findMany.mockResolvedValue([]);
      prisma.surveillanceActivity.count.mockResolvedValue(0);

      await service.findAll(msUser(), {}, { diseaseId: 'disease-fmd' });

      expect(prisma.surveillanceActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ diseaseId: 'disease-fmd' }),
        }),
      );
    });
  });
});
