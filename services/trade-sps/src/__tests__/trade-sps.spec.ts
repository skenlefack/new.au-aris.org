import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole, TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { TradeFlowService, HttpError as TradeFlowHttpError } from '../services/trade-flow.service.js';
import { SpsCertificateService, HttpError as SpsHttpError } from '../services/sps-certificate.service.js';
import { MarketPriceService } from '../services/market-price.service.js';
import { AuditService } from '../services/audit.service.js';
import {
  TOPIC_MS_TRADE_FLOW_CREATED,
  TOPIC_MS_TRADE_SPS_CERTIFIED,
  TOPIC_MS_TRADE_PRICE_RECORDED,
} from '../kafka-topics.js';

// ── Fixtures ──────────────────────────────────────────────────────────

const nationalAdmin: AuthenticatedUser = {
  userId: '10000000-0000-4000-a000-000000000101',
  email: 'admin@ke.au-aris.org',
  role: UserRole.NATIONAL_ADMIN,
  tenantId: '00000000-0000-4000-a000-000000000101',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

const otherTenantAdmin: AuthenticatedUser = {
  userId: '10000000-0000-4000-a000-000000000201',
  email: 'admin@ng.au-aris.org',
  role: UserRole.NATIONAL_ADMIN,
  tenantId: '00000000-0000-4000-a000-000000000201',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

// ── Mock factories ────────────────────────────────────────────────────

function makePrisma() {
  return {
    tradeFlow: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    spsCertificate: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    marketPrice: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  };
}

function makeKafka() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

function makeAudit() {
  return { log: vi.fn() } as unknown as AuditService;
}

// ── TradeFlowService ─────────────────────────────────────────────────

describe('TradeFlowService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let audit: AuditService;
  let service: TradeFlowService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    audit = makeAudit();
    service = new TradeFlowService(prisma as never, kafka as never, audit);
  });

  it('1. create — creates trade flow with tenant isolation', async () => {
    const dto = {
      exportCountryId: 'country-ke',
      importCountryId: 'country-ug',
      speciesId: 'species-cattle',
      commodity: 'Live cattle',
      flowDirection: 'EXPORT' as const,
      quantity: 5000,
      unit: 'heads',
    };

    const created = {
      id: 'flow-uuid-1',
      tenantId: nationalAdmin.tenantId,
      ...dto,
      dataClassification: 'PARTNER',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.tradeFlow.create.mockResolvedValue(created);

    const result = await service.create(dto as any, nationalAdmin);

    expect(result.data).toEqual(created);
    expect(prisma.tradeFlow.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        dataClassification: 'PARTNER',
        createdBy: nationalAdmin.userId,
        exportCountryId: 'country-ke',
        importCountryId: 'country-ug',
      }),
    });
  });

  it('2. create — publishes Kafka event on trade flow creation', async () => {
    const dto = {
      exportCountryId: 'country-ke',
      importCountryId: 'country-ug',
      speciesId: 'species-cattle',
      commodity: 'Live cattle',
      flowDirection: 'EXPORT' as const,
      quantity: 5000,
      unit: 'heads',
    };

    const created = {
      id: 'flow-uuid-2',
      tenantId: nationalAdmin.tenantId,
      ...dto,
      dataClassification: 'PARTNER',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.tradeFlow.create.mockResolvedValue(created);

    await service.create(dto as any, nationalAdmin);

    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_TRADE_FLOW_CREATED,
      'flow-uuid-2',
      created,
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        userId: nationalAdmin.userId,
        sourceService: 'trade-sps-service',
        schemaVersion: '1',
      }),
    );
  });

  it('3. findAll — returns paginated results with default page=1 limit=20', async () => {
    const rows = [
      { id: 'f1', tenantId: nationalAdmin.tenantId, commodity: 'Live cattle' },
      { id: 'f2', tenantId: nationalAdmin.tenantId, commodity: 'Beef' },
    ];
    prisma.tradeFlow.findMany.mockResolvedValue(rows);
    prisma.tradeFlow.count.mockResolvedValue(2);

    const result = await service.findAll(nationalAdmin, {} as any);

    expect(result.data).toEqual(rows);
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 20 });

    expect(prisma.tradeFlow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: nationalAdmin.tenantId,
        }),
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('4. findAll — filters trade flows by direction', async () => {
    prisma.tradeFlow.findMany.mockResolvedValue([]);
    prisma.tradeFlow.count.mockResolvedValue(0);

    await service.findAll(nationalAdmin, { flowDirection: 'IMPORT' } as any);

    expect(prisma.tradeFlow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: nationalAdmin.tenantId,
          flowDirection: 'IMPORT',
        }),
      }),
    );
  });
});

// ── SpsCertificateService ─────────────────────────────────────────────

describe('SpsCertificateService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let audit: AuditService;
  let service: SpsCertificateService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    audit = makeAudit();
    service = new SpsCertificateService(prisma as never, kafka as never, audit);
  });

  it('5. create — creates SPS certificate with DRAFT status', async () => {
    const dto = {
      certificateNumber: 'SPS-KE-2025-001',
      exporterId: 'exporter-uuid',
      importerId: 'importer-uuid',
      speciesId: 'species-cattle',
      commodity: 'Frozen beef',
      quantity: 2000,
      unit: 'kg',
      originCountryId: 'country-ke',
      destinationCountryId: 'country-ug',
    };

    const created = {
      id: 'cert-uuid-1',
      tenantId: nationalAdmin.tenantId,
      ...dto,
      status: 'DRAFT',
      inspectionResult: 'PENDING',
      dataClassification: 'RESTRICTED',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.spsCertificate.create.mockResolvedValue(created);

    const result = await service.create(dto as any, nationalAdmin);

    expect(result.data).toEqual(created);
    expect(prisma.spsCertificate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        status: 'DRAFT',
        dataClassification: 'RESTRICTED',
        certificateNumber: 'SPS-KE-2025-001',
      }),
    });
  });

  it('6. issue — transitions SPS certificate from DRAFT to ISSUED', async () => {
    const existing = {
      id: 'cert-uuid-2',
      tenantId: nationalAdmin.tenantId,
      status: 'DRAFT',
      certificateNumber: 'SPS-KE-2025-002',
    };

    const issued = {
      ...existing,
      status: 'ISSUED',
      certifiedAt: new Date(),
      certifiedBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.spsCertificate.findUnique.mockResolvedValue(existing);
    prisma.spsCertificate.update.mockResolvedValue(issued);

    const result = await service.issue('cert-uuid-2', nationalAdmin);

    expect(result.data).toEqual(issued);
    expect(prisma.spsCertificate.update).toHaveBeenCalledWith({
      where: { id: 'cert-uuid-2' },
      data: expect.objectContaining({
        status: 'ISSUED',
        certifiedBy: nationalAdmin.userId,
      }),
    });

    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_TRADE_SPS_CERTIFIED,
      'cert-uuid-2',
      issued,
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        userId: nationalAdmin.userId,
      }),
    );
  });

  it('7. issue — throws 400 when certificate is already ISSUED', async () => {
    const existing = {
      id: 'cert-uuid-3',
      tenantId: nationalAdmin.tenantId,
      status: 'ISSUED',
      certificateNumber: 'SPS-KE-2025-003',
    };

    prisma.spsCertificate.findUnique.mockResolvedValue(existing);

    await expect(service.issue('cert-uuid-3', nationalAdmin)).rejects.toThrow(SpsHttpError);
    await expect(service.issue('cert-uuid-3', nationalAdmin)).rejects.toMatchObject({
      statusCode: 400,
      message: 'SPS certificate cert-uuid-3 is already ISSUED',
    });

    expect(prisma.spsCertificate.update).not.toHaveBeenCalled();
  });
});

// ── MarketPriceService ────────────────────────────────────────────────

describe('MarketPriceService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let audit: AuditService;
  let service: MarketPriceService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    audit = makeAudit();
    service = new MarketPriceService(prisma as never, kafka as never, audit);
  });

  it('8. create — creates market price with default PUBLIC classification', async () => {
    const dto = {
      marketId: 'market-nairobi',
      speciesId: 'species-cattle',
      commodity: 'Live cattle',
      priceType: 'WHOLESALE',
      price: 150000,
      currency: 'KES',
      unit: 'head',
      source: 'ILRI market survey',
    };

    const created = {
      id: 'price-uuid-1',
      tenantId: nationalAdmin.tenantId,
      ...dto,
      date: new Date(),
      dataClassification: 'PUBLIC',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.marketPrice.create.mockResolvedValue(created);

    const result = await service.create(dto as any, nationalAdmin);

    expect(result.data).toEqual(created);
    expect(prisma.marketPrice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        dataClassification: 'PUBLIC',
        commodity: 'Live cattle',
        price: 150000,
      }),
    });

    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_TRADE_PRICE_RECORDED,
      'price-uuid-1',
      created,
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
      }),
    );
  });

  it('9. findAll — filters market prices by commodity', async () => {
    prisma.marketPrice.findMany.mockResolvedValue([]);
    prisma.marketPrice.count.mockResolvedValue(0);

    await service.findAll(nationalAdmin, { commodity: 'beef' } as any);

    expect(prisma.marketPrice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: nationalAdmin.tenantId,
          commodity: { contains: 'beef', mode: 'insensitive' },
        }),
      }),
    );
  });
});

// ── Cross-service: SPS Certificate Update with Audit Trail ────────────

describe('SpsCertificateService — audit trail', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let audit: AuditService;
  let service: SpsCertificateService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    audit = makeAudit();
    service = new SpsCertificateService(prisma as never, kafka as never, audit);
  });

  it('10. update — updates SPS certificate and logs audit trail', async () => {
    const existing = {
      id: 'cert-uuid-10',
      tenantId: nationalAdmin.tenantId,
      status: 'DRAFT',
      certificateNumber: 'SPS-KE-2025-010',
      commodity: 'Frozen beef',
      remarks: null,
    };

    const updated = {
      ...existing,
      remarks: 'Inspection passed with conditions',
      updatedBy: nationalAdmin.userId,
    };

    prisma.spsCertificate.findUnique.mockResolvedValue(existing);
    prisma.spsCertificate.update.mockResolvedValue(updated);

    const result = await service.update(
      'cert-uuid-10',
      { remarks: 'Inspection passed with conditions' } as any,
      nationalAdmin,
    );

    expect(result.data).toEqual(updated);

    // Verify audit trail was logged
    expect((audit.log as any)).toHaveBeenCalledWith(
      'SpsCertificate',
      'cert-uuid-10',
      'UPDATE',
      nationalAdmin,
      'RESTRICTED',
      expect.objectContaining({
        previousVersion: existing,
        newVersion: updated,
      }),
    );
  });
});
