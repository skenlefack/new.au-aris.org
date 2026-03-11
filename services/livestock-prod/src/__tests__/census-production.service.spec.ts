import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole, TenantLevel, TOPIC_MS_LIVESTOCK_CENSUS_CREATED, TOPIC_MS_LIVESTOCK_PRODUCTION_CREATED, TOPIC_MS_LIVESTOCK_PRODUCTION_UPDATED } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { CensusService, HttpError } from '../services/census.service.js';
import { ProductionService, HttpError as ProdHttpError } from '../services/production.service.js';

// ── Fixtures ──────────────────────────────────────────────────────────

const nationalAdmin: AuthenticatedUser = {
  userId: '10000000-0000-4000-a000-000000000101',
  email: 'admin@ke.au-aris.org',
  firstName: 'Kenya',
  lastName: 'Admin',
  role: UserRole.NATIONAL_ADMIN,
  tenantId: '00000000-0000-4000-a000-000000000101',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

const superAdmin: AuthenticatedUser = {
  userId: '10000000-0000-4000-a000-000000000001',
  email: 'admin@au-aris.org',
  firstName: 'Super',
  lastName: 'Admin',
  role: UserRole.SUPER_ADMIN,
  tenantId: '00000000-0000-4000-a000-000000000001',
  tenantLevel: TenantLevel.CONTINENTAL,
};

// ── Mock factories ────────────────────────────────────────────────────

function makePrisma() {
  return {
    livestockCensus: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    productionRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    slaughterRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    transhumanceCorridor: {
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

// ── CensusService ─────────────────────────────────────────────────────

describe('CensusService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: CensusService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new CensusService(prisma as never, kafka as never);
  });

  it('create — creates census with default PUBLIC classification and publishes Kafka event', async () => {
    const dto = {
      geoEntityId: 'geo-1',
      speciesId: 'species-cattle',
      year: 2025,
      population: 5000000,
      methodology: 'aerial survey',
      source: 'DVS Kenya',
    };

    const created = {
      id: 'census-uuid-1',
      tenantId: nationalAdmin.tenantId,
      ...dto,
      dataClassification: 'PUBLIC',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.livestockCensus.create.mockResolvedValue(created);

    const result = await service.create(dto as any, nationalAdmin);

    expect(result.data).toEqual(created);

    // Verify prisma was called with correct tenantId and default classification
    expect(prisma.livestockCensus.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        dataClassification: 'PUBLIC',
        createdBy: nationalAdmin.userId,
        speciesId: 'species-cattle',
        year: 2025,
        population: 5000000,
      }),
    });

    // Verify Kafka event published
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_LIVESTOCK_CENSUS_CREATED,
      'census-uuid-1',
      created,
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        userId: nationalAdmin.userId,
        sourceService: 'livestock-prod-service',
        schemaVersion: '1',
      }),
    );
  });

  it('findAll — returns paginated results with default page=1 limit=20 and filters by tenantId for MEMBER_STATE', async () => {
    const rows = [
      { id: 'c1', tenantId: nationalAdmin.tenantId, year: 2025, population: 100 },
      { id: 'c2', tenantId: nationalAdmin.tenantId, year: 2024, population: 200 },
    ];
    prisma.livestockCensus.findMany.mockResolvedValue(rows);
    prisma.livestockCensus.count.mockResolvedValue(2);

    const result = await service.findAll(nationalAdmin, {} as any);

    expect(result.data).toEqual(rows);
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 20 });

    // MEMBER_STATE user: tenantId must be in where clause
    expect(prisma.livestockCensus.findMany).toHaveBeenCalledWith(
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

  it('findOne — throws HttpError 404 when census not found', async () => {
    prisma.livestockCensus.findUnique.mockResolvedValue(null);

    await expect(service.findOne('nonexistent-id', nationalAdmin)).rejects.toThrow(HttpError);
    await expect(service.findOne('nonexistent-id', nationalAdmin)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Census nonexistent-id not found',
    });
  });
});

// ── ProductionService ─────────────────────────────────────────────────

describe('ProductionService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: ProductionService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new ProductionService(prisma as never, kafka as never);
  });

  it('create — creates production record and publishes TOPIC_MS_LIVESTOCK_PRODUCTION_CREATED', async () => {
    const dto = {
      speciesId: 'species-cattle',
      productType: 'MILK',
      quantity: 50000,
      unit: 'litres',
      periodStart: '2025-01-01T00:00:00Z',
      periodEnd: '2025-06-30T23:59:59Z',
      geoEntityId: 'geo-1',
    };

    const created = {
      id: 'prod-uuid-1',
      tenantId: nationalAdmin.tenantId,
      speciesId: dto.speciesId,
      productType: dto.productType,
      quantity: dto.quantity,
      unit: dto.unit,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      geoEntityId: dto.geoEntityId,
      dataClassification: 'PUBLIC',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.productionRecord.create.mockResolvedValue(created);

    const result = await service.create(dto as any, nationalAdmin);

    expect(result.data).toEqual(created);
    expect(prisma.productionRecord.create).toHaveBeenCalledOnce();
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_LIVESTOCK_PRODUCTION_CREATED,
      'prod-uuid-1',
      created,
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        userId: nationalAdmin.userId,
      }),
    );
  });

  it('findOne — throws 404 when tenant does not match for non-CONTINENTAL user', async () => {
    const otherTenantId = '00000000-0000-4000-a000-000000000999';
    const record = {
      id: 'prod-uuid-2',
      tenantId: otherTenantId,
      productType: 'MEAT',
    };

    prisma.productionRecord.findUnique.mockResolvedValue(record);

    // nationalAdmin has a different tenantId and is MEMBER_STATE level
    await expect(service.findOne('prod-uuid-2', nationalAdmin)).rejects.toThrow(ProdHttpError);
    await expect(service.findOne('prod-uuid-2', nationalAdmin)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Production record prod-uuid-2 not found',
    });
  });

  it('update — updates partial fields and publishes TOPIC_MS_LIVESTOCK_PRODUCTION_UPDATED', async () => {
    const existing = {
      id: 'prod-uuid-3',
      tenantId: nationalAdmin.tenantId,
      speciesId: 'species-cattle',
      productType: 'MILK',
      quantity: 50000,
      unit: 'litres',
    };

    const updated = {
      ...existing,
      quantity: 75000,
      updatedBy: nationalAdmin.userId,
    };

    prisma.productionRecord.findUnique.mockResolvedValue(existing);
    prisma.productionRecord.update.mockResolvedValue(updated);

    const result = await service.update(
      'prod-uuid-3',
      { quantity: 75000 } as any,
      nationalAdmin,
    );

    expect(result.data).toEqual(updated);

    // Verify only the partial fields plus updatedBy are in the update data
    expect(prisma.productionRecord.update).toHaveBeenCalledWith({
      where: { id: 'prod-uuid-3' },
      data: {
        quantity: 75000,
        updatedBy: nationalAdmin.userId,
      },
    });

    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_LIVESTOCK_PRODUCTION_UPDATED,
      'prod-uuid-3',
      updated,
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
      }),
    );
  });
});
