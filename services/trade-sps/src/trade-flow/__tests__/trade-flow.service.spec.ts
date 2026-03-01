import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TradeFlowService } from '../trade-flow.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// ── Mock factories ──

function mockPrisma() {
  return {
    tradeFlow: {
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
    email: 'trade@ke.au-aris.org',
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

function flowFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'flow-001',
    tenantId: 'tenant-ke',
    exportCountryId: 'country-ke',
    importCountryId: 'country-ug',
    speciesId: 'species-cattle',
    commodity: 'Live cattle',
    flowDirection: 'EXPORT',
    quantity: 500,
    unit: 'heads',
    valueFob: 250000,
    currency: 'USD',
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-03-31'),
    hsCode: '0102.29',
    spsStatus: 'CLEARED',
    dataClassification: DataClassification.PARTNER,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    ...overrides,
  };
}

// ── Tests ──

describe('TradeFlowService', () => {
  let service: TradeFlowService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new TradeFlowService(prisma as never, kafka as never, audit as never);
  });

  // ── create ──

  describe('create', () => {
    it('should create a trade flow and publish Kafka event', async () => {
      const dto = {
        exportCountryId: 'country-ke',
        importCountryId: 'country-ug',
        speciesId: 'species-cattle',
        commodity: 'Live cattle',
        flowDirection: 'EXPORT' as const,
        quantity: 500,
        unit: 'heads',
        valueFob: 250000,
        currency: 'USD',
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-03-31T00:00:00.000Z',
      };

      prisma.tradeFlow.create.mockResolvedValue(flowFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('flow-001');
      expect(prisma.tradeFlow.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.trade.flow.created.v1',
        'flow-001',
        expect.objectContaining({ commodity: 'Live cattle' }),
        expect.objectContaining({ sourceService: 'trade-sps-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'TradeFlow',
        'flow-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PARTNER,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PARTNER', async () => {
      prisma.tradeFlow.create.mockResolvedValue(flowFixture());
      await service.create(
        {
          exportCountryId: 'c1', importCountryId: 'c2', speciesId: 's1',
          commodity: 'x', flowDirection: 'EXPORT', quantity: 1, unit: 'heads',
          currency: 'USD', periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-03-31T00:00:00.000Z',
        },
        msUser(),
      );
      expect(prisma.tradeFlow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dataClassification: DataClassification.PARTNER }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.tradeFlow.create.mockResolvedValue(flowFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));
      const result = await service.create(
        {
          exportCountryId: 'c1', importCountryId: 'c2', speciesId: 's1',
          commodity: 'x', flowDirection: 'EXPORT', quantity: 1, unit: 'heads',
          currency: 'USD', periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-03-31T00:00:00.000Z',
        },
        msUser(),
      );
      expect(result.data).toBeDefined();
    });
  });

  // ── findAll ──

  describe('findAll', () => {
    it('should return paginated flows for MEMBER_STATE user', async () => {
      prisma.tradeFlow.findMany.mockResolvedValue([flowFixture()]);
      prisma.tradeFlow.count.mockResolvedValue(1);
      const result = await service.findAll(msUser(), {}, {});
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.tradeFlow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.tradeFlow.findMany.mockResolvedValue([]);
      prisma.tradeFlow.count.mockResolvedValue(0);
      await service.findAll(continentalUser(), {}, {});
      expect(prisma.tradeFlow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply commodity and direction filters', async () => {
      prisma.tradeFlow.findMany.mockResolvedValue([]);
      prisma.tradeFlow.count.mockResolvedValue(0);
      await service.findAll(continentalUser(), {}, { commodity: 'Live cattle', flowDirection: 'EXPORT' });
      expect(prisma.tradeFlow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ commodity: 'Live cattle', flowDirection: 'EXPORT' }),
        }),
      );
    });

    it('should apply period filters on periodStart', async () => {
      prisma.tradeFlow.findMany.mockResolvedValue([]);
      prisma.tradeFlow.count.mockResolvedValue(0);
      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      );
      expect(prisma.tradeFlow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            periodStart: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.tradeFlow.findMany.mockResolvedValue([]);
      prisma.tradeFlow.count.mockResolvedValue(0);
      const result = await service.findAll(continentalUser(), { limit: 500 }, {});
      expect(result.meta.limit).toBe(100);
    });
  });

  // ── findOne ──

  describe('findOne', () => {
    it('should return flow by id', async () => {
      prisma.tradeFlow.findUnique.mockResolvedValue(flowFixture());
      const result = await service.findOne('flow-001', msUser());
      expect(result.data.id).toBe('flow-001');
    });

    it('should throw NotFoundException for nonexistent flow', async () => {
      prisma.tradeFlow.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.tradeFlow.findUnique.mockResolvedValue(flowFixture({ tenantId: 'tenant-ng' }));
      await expect(service.findOne('flow-001', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any flow', async () => {
      prisma.tradeFlow.findUnique.mockResolvedValue(flowFixture({ tenantId: 'tenant-ng' }));
      const result = await service.findOne('flow-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // ── update ──

  describe('update', () => {
    it('should update flow and publish Kafka event', async () => {
      const updated = flowFixture({ quantity: 800 });
      prisma.tradeFlow.findUnique.mockResolvedValue(flowFixture());
      prisma.tradeFlow.update.mockResolvedValue(updated);
      const result = await service.update('flow-001', { quantity: 800 }, msUser());
      expect(result.data.quantity).toBe(800);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.trade.flow.updated.v1',
        'flow-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'trade-sps-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'TradeFlow',
        'flow-001',
        'UPDATE',
        expect.any(Object),
        DataClassification.PARTNER,
        expect.objectContaining({
          previousVersion: expect.any(Object),
          newVersion: expect.any(Object),
        }),
      );
    });

    it('should throw NotFoundException for nonexistent flow', async () => {
      prisma.tradeFlow.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', { quantity: 5 }, msUser())).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.tradeFlow.findUnique.mockResolvedValue(flowFixture());
      prisma.tradeFlow.update.mockResolvedValue(flowFixture({ quantity: 999 }));

      await service.update('flow-001', { quantity: 999 }, msUser());

      expect(prisma.tradeFlow.update).toHaveBeenCalledWith({
        where: { id: 'flow-001' },
        data: expect.objectContaining({ quantity: 999, updatedBy: 'user-ke' }),
      });
    });
  });
});
