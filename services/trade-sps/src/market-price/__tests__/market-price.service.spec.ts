import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { MarketPriceService } from '../market-price.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// ── Mock factories ──

function mockPrisma() {
  return {
    marketPrice: {
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
    email: 'market@ke.aris.africa',
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

function priceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'price-001',
    tenantId: 'tenant-ke',
    marketId: 'market-nairobi',
    speciesId: 'species-cattle',
    commodity: 'Live cattle',
    priceType: 'WHOLESALE',
    price: 85000,
    currency: 'KES',
    unit: 'head',
    date: new Date('2026-02-10'),
    source: 'KNBS',
    dataClassification: DataClassification.PUBLIC,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-02-10'),
    updatedAt: new Date('2026-02-10'),
    ...overrides,
  };
}

// ── Tests ──

describe('MarketPriceService', () => {
  let service: MarketPriceService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new MarketPriceService(prisma as never, kafka as never, audit as never);
  });

  // ── create ──

  describe('create', () => {
    it('should create a market price and publish Kafka event', async () => {
      const dto = {
        marketId: 'market-nairobi',
        speciesId: 'species-cattle',
        commodity: 'Live cattle',
        priceType: 'WHOLESALE' as const,
        price: 85000,
        currency: 'KES',
        unit: 'head',
        date: '2026-02-10T00:00:00.000Z',
        source: 'KNBS',
      };

      prisma.marketPrice.create.mockResolvedValue(priceFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('price-001');
      expect(prisma.marketPrice.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.trade.price.recorded.v1',
        'price-001',
        expect.objectContaining({ commodity: 'Live cattle' }),
        expect.objectContaining({ sourceService: 'trade-sps-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'MarketPrice',
        'price-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.PUBLIC,
        expect.any(Object),
      );
    });

    it('should default dataClassification to PUBLIC', async () => {
      prisma.marketPrice.create.mockResolvedValue(priceFixture());
      await service.create(
        {
          marketId: 'm1', speciesId: 's1', commodity: 'x', priceType: 'RETAIL',
          price: 100, currency: 'USD', unit: 'kg', date: '2026-02-10T00:00:00.000Z',
        },
        msUser(),
      );
      expect(prisma.marketPrice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dataClassification: DataClassification.PUBLIC }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.marketPrice.create.mockResolvedValue(priceFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));
      const result = await service.create(
        {
          marketId: 'm1', speciesId: 's1', commodity: 'x', priceType: 'RETAIL',
          price: 100, currency: 'USD', unit: 'kg', date: '2026-02-10T00:00:00.000Z',
        },
        msUser(),
      );
      expect(result.data).toBeDefined();
    });
  });

  // ── findAll ──

  describe('findAll', () => {
    it('should return paginated prices for MEMBER_STATE user', async () => {
      prisma.marketPrice.findMany.mockResolvedValue([priceFixture()]);
      prisma.marketPrice.count.mockResolvedValue(1);
      const result = await service.findAll(msUser(), {}, {});
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.marketPrice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.marketPrice.findMany.mockResolvedValue([]);
      prisma.marketPrice.count.mockResolvedValue(0);
      await service.findAll(continentalUser(), {}, {});
      expect(prisma.marketPrice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply commodity and priceType filters', async () => {
      prisma.marketPrice.findMany.mockResolvedValue([]);
      prisma.marketPrice.count.mockResolvedValue(0);
      await service.findAll(continentalUser(), {}, { commodity: 'Live cattle', priceType: 'WHOLESALE' });
      expect(prisma.marketPrice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ commodity: 'Live cattle', priceType: 'WHOLESALE' }),
        }),
      );
    });

    it('should apply period filters on date', async () => {
      prisma.marketPrice.findMany.mockResolvedValue([]);
      prisma.marketPrice.count.mockResolvedValue(0);
      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      );
      expect(prisma.marketPrice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.marketPrice.findMany.mockResolvedValue([]);
      prisma.marketPrice.count.mockResolvedValue(0);
      const result = await service.findAll(continentalUser(), { limit: 500 }, {});
      expect(result.meta.limit).toBe(100);
    });
  });

  // ── findOne ──

  describe('findOne', () => {
    it('should return price by id', async () => {
      prisma.marketPrice.findUnique.mockResolvedValue(priceFixture());
      const result = await service.findOne('price-001', msUser());
      expect(result.data.id).toBe('price-001');
    });

    it('should throw NotFoundException for nonexistent price', async () => {
      prisma.marketPrice.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.marketPrice.findUnique.mockResolvedValue(priceFixture({ tenantId: 'tenant-ng' }));
      await expect(service.findOne('price-001', msUser())).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any price', async () => {
      prisma.marketPrice.findUnique.mockResolvedValue(priceFixture({ tenantId: 'tenant-ng' }));
      const result = await service.findOne('price-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // ── update ──

  describe('update', () => {
    it('should update price and publish Kafka event', async () => {
      const updated = priceFixture({ price: 90000 });
      prisma.marketPrice.findUnique.mockResolvedValue(priceFixture());
      prisma.marketPrice.update.mockResolvedValue(updated);
      const result = await service.update('price-001', { price: 90000 }, msUser());
      expect(result.data.price).toBe(90000);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.trade.price.updated.v1',
        'price-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'trade-sps-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'MarketPrice',
        'price-001',
        'UPDATE',
        expect.any(Object),
        DataClassification.PUBLIC,
        expect.objectContaining({
          previousVersion: expect.any(Object),
          newVersion: expect.any(Object),
        }),
      );
    });

    it('should throw NotFoundException for nonexistent price', async () => {
      prisma.marketPrice.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', { price: 5 }, msUser())).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.marketPrice.findUnique.mockResolvedValue(priceFixture());
      prisma.marketPrice.update.mockResolvedValue(priceFixture({ price: 95000 }));

      await service.update('price-001', { price: 95000 }, msUser());

      expect(prisma.marketPrice.update).toHaveBeenCalledWith({
        where: { id: 'price-001' },
        data: expect.objectContaining({ price: 95000, updatedBy: 'user-ke' }),
      });
    });
  });
});
