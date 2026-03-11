import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole, TenantLevel, TOPIC_MS_LIVESTOCK_SLAUGHTER_CREATED, TOPIC_MS_LIVESTOCK_TRANSHUMANCE_CREATED } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { SlaughterService, HttpError } from '../services/slaughter.service.js';
import { TranshumanceService, HttpError as TransHttpError } from '../services/transhumance.service.js';

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

// ── SlaughterService ──────────────────────────────────────────────────

describe('SlaughterService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: SlaughterService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new SlaughterService(prisma as never, kafka as never);
  });

  it('create — creates slaughter record with default PARTNER classification', async () => {
    const dto = {
      speciesId: 'species-cattle',
      facilityId: 'facility-nairobi-1',
      count: 1200,
      condemnations: 15,
      periodStart: '2025-01-01T00:00:00Z',
      periodEnd: '2025-03-31T23:59:59Z',
      geoEntityId: 'geo-nairobi',
    };

    const created = {
      id: 'slaughter-uuid-1',
      tenantId: nationalAdmin.tenantId,
      speciesId: dto.speciesId,
      facilityId: dto.facilityId,
      count: dto.count,
      condemnations: dto.condemnations,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      geoEntityId: dto.geoEntityId,
      dataClassification: 'PARTNER',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.slaughterRecord.create.mockResolvedValue(created);

    const result = await service.create(dto as any, nationalAdmin);

    expect(result.data).toEqual(created);

    // Verify default classification is PARTNER
    expect(prisma.slaughterRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        dataClassification: 'PARTNER',
        count: 1200,
        condemnations: 15,
        createdBy: nationalAdmin.userId,
      }),
    });

    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_LIVESTOCK_SLAUGHTER_CREATED,
      'slaughter-uuid-1',
      created,
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        userId: nationalAdmin.userId,
      }),
    );
  });

  it('findAll — CONTINENTAL user sees all data without tenantId in where clause', async () => {
    const rows = [
      { id: 's1', tenantId: 'tenant-ke', count: 100 },
      { id: 's2', tenantId: 'tenant-et', count: 200 },
    ];
    prisma.slaughterRecord.findMany.mockResolvedValue(rows);
    prisma.slaughterRecord.count.mockResolvedValue(2);

    const result = await service.findAll(superAdmin, {} as any);

    expect(result.data).toEqual(rows);
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 20 });

    // CONTINENTAL user: where clause must NOT contain tenantId
    const whereArg = prisma.slaughterRecord.findMany.mock.calls[0][0].where;
    expect(whereArg).not.toHaveProperty('tenantId');
  });

  it('update — throws 404 when slaughter record not found', async () => {
    prisma.slaughterRecord.findUnique.mockResolvedValue(null);

    await expect(
      service.update('nonexistent-id', { count: 999 } as any, nationalAdmin),
    ).rejects.toThrow(HttpError);

    await expect(
      service.update('nonexistent-id', { count: 999 } as any, nationalAdmin),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Slaughter record nonexistent-id not found',
    });

    // Verify no update or Kafka call happened
    expect(prisma.slaughterRecord.update).not.toHaveBeenCalled();
    expect(kafka.send).not.toHaveBeenCalled();
  });
});

// ── TranshumanceService ───────────────────────────────────────────────

describe('TranshumanceService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: TranshumanceService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new TranshumanceService(prisma as never, kafka as never);
  });

  it('create — creates transhumance corridor and stores route as JSON', async () => {
    const route = {
      type: 'LineString',
      coordinates: [
        [36.8219, -1.2921],
        [38.7469, 9.0192],
      ],
    };

    const dto = {
      name: 'Nairobi-Addis Corridor',
      route,
      speciesId: 'species-cattle',
      seasonality: 'DRY_SEASON',
      crossBorder: true,
    };

    const created = {
      id: 'corridor-uuid-1',
      tenantId: nationalAdmin.tenantId,
      name: dto.name,
      route: dto.route,
      speciesId: dto.speciesId,
      seasonality: dto.seasonality,
      crossBorder: true,
      dataClassification: 'PARTNER',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.transhumanceCorridor.create.mockResolvedValue(created);

    const result = await service.create(dto as any, nationalAdmin);

    expect(result.data).toEqual(created);

    // Verify the route JSON object is passed through to Prisma
    expect(prisma.transhumanceCorridor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Nairobi-Addis Corridor',
        route,
        crossBorder: true,
        tenantId: nationalAdmin.tenantId,
      }),
    });

    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_LIVESTOCK_TRANSHUMANCE_CREATED,
      'corridor-uuid-1',
      created,
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
      }),
    );
  });

  it('findAll — filters by crossBorder when provided', async () => {
    const corridors = [
      { id: 'c1', name: 'Cross-border A', crossBorder: true },
    ];
    prisma.transhumanceCorridor.findMany.mockResolvedValue(corridors);
    prisma.transhumanceCorridor.count.mockResolvedValue(1);

    const result = await service.findAll(nationalAdmin, { crossBorder: true } as any);

    expect(result.data).toEqual(corridors);

    // Verify crossBorder filter is applied in where clause
    const whereArg = prisma.transhumanceCorridor.findMany.mock.calls[0][0].where;
    expect(whereArg).toHaveProperty('crossBorder', true);
    expect(whereArg).toHaveProperty('tenantId', nationalAdmin.tenantId);
  });

  it('findOne — returns corridor data for same-tenant user', async () => {
    const corridor = {
      id: 'corridor-uuid-2',
      tenantId: nationalAdmin.tenantId,
      name: 'Rift Valley Corridor',
      route: {
        type: 'LineString',
        coordinates: [
          [36.0, -1.0],
          [37.0, -0.5],
        ],
      },
      speciesId: 'species-cattle',
      seasonality: 'WET_SEASON',
      crossBorder: false,
      dataClassification: 'PARTNER',
    };

    prisma.transhumanceCorridor.findUnique.mockResolvedValue(corridor);

    const result = await service.findOne('corridor-uuid-2', nationalAdmin);

    expect(result.data).toEqual(corridor);
    expect(prisma.transhumanceCorridor.findUnique).toHaveBeenCalledWith({
      where: { id: 'corridor-uuid-2' },
    });
  });
});
