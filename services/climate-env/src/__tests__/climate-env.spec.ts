import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole, TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { WaterStressService, HttpError as WaterStressHttpError } from '../services/water-stress.service.js';
import { RangelandService, HttpError as RangelandHttpError } from '../services/rangeland.service.js';
import { HotspotService, HttpError as HotspotHttpError } from '../services/hotspot.service.js';
import { ClimateDataService, HttpError as ClimateDataHttpError } from '../services/climate-data.service.js';
import {
  TOPIC_MS_CLIMATE_WATER_STRESS_CREATED,
  TOPIC_MS_CLIMATE_RANGELAND_ASSESSED,
  TOPIC_MS_CLIMATE_HOTSPOT_DETECTED,
  TOPIC_MS_CLIMATE_DATA_RECORDED,
  TOPIC_MS_CLIMATE_DATA_UPDATED,
} from '../kafka-topics.js';

// -- Fixtures ------------------------------------------------------------------

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

// -- Mock factories ------------------------------------------------------------

function makePrisma() {
  return {
    waterStressIndex: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    rangelandCondition: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    environmentalHotspot: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    climateDataPoint: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  };
}

function makeKafka() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

// == 1. Create water stress with tenant isolation ==============================

describe('WaterStressService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: WaterStressService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new WaterStressService(prisma as never, kafka as never);
  });

  it('create -- creates water stress index with tenant isolation and default PUBLIC classification', async () => {
    const dto = {
      geoEntityId: 'geo-arid-zone-01',
      period: '2026-Q1',
      index: 3.5,
      waterAvailability: 'Low',
      irrigatedAreaPct: 12.5,
      source: 'FAO-AQUASTAT',
    };

    const created = {
      id: 'ws-001',
      ...dto,
      dataClassification: 'PUBLIC',
      tenantId: nationalAdmin.tenantId,
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.waterStressIndex.findFirst.mockResolvedValue(null);
    prisma.waterStressIndex.create.mockResolvedValue(created);

    const result = await service.create(dto, nationalAdmin);

    expect(result).toEqual({ data: created });

    // Verify tenant isolation in create
    expect(prisma.waterStressIndex.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataClassification: 'PUBLIC',
          tenantId: nationalAdmin.tenantId,
          createdBy: nationalAdmin.userId,
        }),
      }),
    );

    // Verify Kafka event
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_CLIMATE_WATER_STRESS_CREATED,
      'ws-001',
      expect.objectContaining({ id: 'ws-001' }),
      expect.objectContaining({
        sourceService: 'climate-env-service',
        tenantId: nationalAdmin.tenantId,
      }),
    );
  });

  // == 2. Water stress unique constraint (throws 409) ===========================

  it('create -- throws 409 when water stress index already exists for tenant+geoEntity+period', async () => {
    const dto = {
      geoEntityId: 'geo-arid-zone-01',
      period: '2026-Q1',
      index: 3.5,
      waterAvailability: 'Low',
      irrigatedAreaPct: 12.5,
      source: 'FAO-AQUASTAT',
    };

    // Duplicate found
    prisma.waterStressIndex.findFirst.mockResolvedValue({
      id: 'ws-existing',
      tenantId: nationalAdmin.tenantId,
      geoEntityId: dto.geoEntityId,
      period: dto.period,
    });

    await expect(service.create(dto, nationalAdmin)).rejects.toThrow(WaterStressHttpError);

    try {
      await service.create(dto, nationalAdmin);
    } catch (err) {
      expect((err as WaterStressHttpError).statusCode).toBe(409);
      expect((err as WaterStressHttpError).message).toContain(dto.geoEntityId);
    }

    // Should NOT have been created
    expect(prisma.waterStressIndex.create).not.toHaveBeenCalled();

    // No Kafka event should be published
    expect(kafka.send).not.toHaveBeenCalled();
  });
});

// == 3. Create rangeland assessment ============================================

describe('RangelandService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: RangelandService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new RangelandService(prisma as never, kafka as never);
  });

  it('create -- creates rangeland assessment with default PUBLIC classification and publishes Kafka event', async () => {
    const dto = {
      geoEntityId: 'geo-sahel-01',
      assessmentDate: '2026-02-15T00:00:00.000Z',
      ndviIndex: 0.35,
      biomassTonsPerHa: 2.8,
      degradationLevel: 'Moderate',
      carryingCapacity: 5,
    };

    const created = {
      id: 'rl-001',
      ...dto,
      assessmentDate: new Date(dto.assessmentDate),
      dataClassification: 'PUBLIC',
      tenantId: nationalAdmin.tenantId,
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.rangelandCondition.create.mockResolvedValue(created);

    const result = await service.create(dto, nationalAdmin);

    expect(result).toEqual({ data: created });

    // Verify Prisma was called with correct data
    expect(prisma.rangelandCondition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataClassification: 'PUBLIC',
          tenantId: nationalAdmin.tenantId,
          degradationLevel: 'Moderate',
        }),
      }),
    );

    // Verify Kafka event
    expect(kafka.send).toHaveBeenCalledOnce();
    expect(kafka.send.mock.calls[0][0]).toBe(TOPIC_MS_CLIMATE_RANGELAND_ASSESSED);
    expect(kafka.send.mock.calls[0][1]).toBe('rl-001');
  });

  // == 4. Filter rangeland by degradation level ==================================

  it('findAll -- filters by degradation level with MEMBER_STATE tenant scoping', async () => {
    const records = [
      { id: 'rl-001', degradationLevel: 'Severe', tenantId: nationalAdmin.tenantId },
      { id: 'rl-002', degradationLevel: 'Severe', tenantId: nationalAdmin.tenantId },
    ];

    prisma.rangelandCondition.findMany.mockResolvedValue(records);
    prisma.rangelandCondition.count.mockResolvedValue(2);

    const result = await service.findAll(
      nationalAdmin,
      { page: 1, limit: 20 },
      { degradationLevel: 'Severe' },
    );

    expect(result.data).toEqual(records);
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 20 });

    // Verify tenant scoping + degradation filter
    expect(prisma.rangelandCondition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: nationalAdmin.tenantId,
          degradationLevel: 'Severe',
        }),
      }),
    );
  });
});

// == 5. Create environmental hotspot ===========================================

describe('HotspotService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: HotspotService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new HotspotService(prisma as never, kafka as never);
  });

  it('create -- creates environmental hotspot with affectedSpecies array and publishes Kafka event', async () => {
    const dto = {
      geoEntityId: 'geo-savanna-01',
      type: 'WILDFIRE',
      severity: 'HIGH',
      detectedDate: '2026-02-20T10:30:00.000Z',
      satelliteSource: 'MODIS-Terra',
      affectedSpecies: ['Loxodonta africana', 'Giraffa camelopardalis'],
    };

    const created = {
      id: 'hs-001',
      ...dto,
      detectedDate: new Date(dto.detectedDate),
      dataClassification: 'PUBLIC',
      tenantId: nationalAdmin.tenantId,
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.environmentalHotspot.create.mockResolvedValue(created);

    const result = await service.create(dto, nationalAdmin);

    expect(result).toEqual({ data: created });

    // Verify the affectedSpecies array is passed through
    expect(prisma.environmentalHotspot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          affectedSpecies: ['Loxodonta africana', 'Giraffa camelopardalis'],
          type: 'WILDFIRE',
          severity: 'HIGH',
        }),
      }),
    );

    // Verify Kafka event
    expect(kafka.send).toHaveBeenCalledOnce();
    expect(kafka.send.mock.calls[0][0]).toBe(TOPIC_MS_CLIMATE_HOTSPOT_DETECTED);
    expect(kafka.send.mock.calls[0][1]).toBe('hs-001');
  });

  // == 6. Filter hotspots by type and severity ===================================

  it('findAll -- filters by type and severity with tenant scoping', async () => {
    const records = [
      { id: 'hs-001', type: 'DROUGHT', severity: 'CRITICAL', tenantId: nationalAdmin.tenantId },
    ];

    prisma.environmentalHotspot.findMany.mockResolvedValue(records);
    prisma.environmentalHotspot.count.mockResolvedValue(1);

    const result = await service.findAll(
      nationalAdmin,
      { page: 1, limit: 10 },
      { type: 'DROUGHT', severity: 'CRITICAL' },
    );

    expect(result.data).toEqual(records);
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 10 });

    // Verify type + severity filters applied with tenant scoping
    expect(prisma.environmentalHotspot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: nationalAdmin.tenantId,
          type: 'DROUGHT',
          severity: 'CRITICAL',
        }),
      }),
    );
  });
});

// == 7-10. ClimateDataService ==================================================

describe('ClimateDataService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: ClimateDataService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new ClimateDataService(prisma as never, kafka as never);
  });

  // == 7. Create climate data point =============================================

  it('create -- creates climate data point with default PUBLIC classification and publishes Kafka event', async () => {
    const dto = {
      geoEntityId: 'geo-nairobi-01',
      date: '2026-02-25T12:00:00.000Z',
      temperature: 28.5,
      rainfall: 15.2,
      humidity: 65,
      windSpeed: 12.3,
      source: 'Kenya Met Dept',
    };

    const created = {
      id: 'cd-001',
      ...dto,
      date: new Date(dto.date),
      dataClassification: 'PUBLIC',
      tenantId: nationalAdmin.tenantId,
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.climateDataPoint.create.mockResolvedValue(created);

    const result = await service.create(dto, nationalAdmin);

    expect(result).toEqual({ data: created });

    // Verify Prisma create with default PUBLIC
    expect(prisma.climateDataPoint.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataClassification: 'PUBLIC',
          tenantId: nationalAdmin.tenantId,
          temperature: 28.5,
          rainfall: 15.2,
          source: 'Kenya Met Dept',
        }),
      }),
    );

    // Verify Kafka event
    expect(kafka.send).toHaveBeenCalledOnce();
    expect(kafka.send.mock.calls[0][0]).toBe(TOPIC_MS_CLIMATE_DATA_RECORDED);
    expect(kafka.send.mock.calls[0][1]).toBe('cd-001');
  });

  // == 8. Filter climate data by date range =====================================

  it('findAll -- filters climate data by date range (periodStart/periodEnd)', async () => {
    const records = [
      {
        id: 'cd-001',
        date: new Date('2026-02-15'),
        temperature: 30,
        tenantId: nationalAdmin.tenantId,
      },
      {
        id: 'cd-002',
        date: new Date('2026-02-20'),
        temperature: 28,
        tenantId: nationalAdmin.tenantId,
      },
    ];

    prisma.climateDataPoint.findMany.mockResolvedValue(records);
    prisma.climateDataPoint.count.mockResolvedValue(2);

    const result = await service.findAll(
      nationalAdmin,
      { page: 1, limit: 20 },
      { periodStart: '2026-02-01T00:00:00.000Z', periodEnd: '2026-02-28T23:59:59.999Z' },
    );

    expect(result.data).toHaveLength(2);
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 20 });

    // Verify date range filter applied
    const findManyArg = prisma.climateDataPoint.findMany.mock.calls[0][0];
    expect(findManyArg.where.date).toBeDefined();
    expect(findManyArg.where.date.gte).toEqual(new Date('2026-02-01T00:00:00.000Z'));
    expect(findManyArg.where.date.lte).toEqual(new Date('2026-02-28T23:59:59.999Z'));
  });

  // == 9. Update climate data with audit trail ==================================

  it('update -- updates climate data and publishes Kafka event (audit trail via service)', async () => {
    const existing = {
      id: 'cd-001',
      geoEntityId: 'geo-nairobi-01',
      date: new Date('2026-02-25'),
      temperature: 28.5,
      rainfall: 15.2,
      humidity: 65,
      windSpeed: 12.3,
      source: 'Kenya Met Dept',
      dataClassification: 'PUBLIC',
      tenantId: nationalAdmin.tenantId,
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    const updated = {
      ...existing,
      temperature: 29.0,
      rainfall: 18.5,
      updatedBy: nationalAdmin.userId,
    };

    prisma.climateDataPoint.findUnique.mockResolvedValue(existing);
    prisma.climateDataPoint.update.mockResolvedValue(updated);

    const result = await service.update(
      'cd-001',
      { temperature: 29.0, rainfall: 18.5 },
      nationalAdmin,
    );

    expect(result).toEqual({ data: updated });

    // Verify update was called with correct fields
    expect(prisma.climateDataPoint.update).toHaveBeenCalledWith({
      where: { id: 'cd-001' },
      data: expect.objectContaining({
        temperature: 29.0,
        rainfall: 18.5,
        updatedBy: nationalAdmin.userId,
      }),
    });

    // Verify Kafka update event
    expect(kafka.send).toHaveBeenCalledOnce();
    expect(kafka.send.mock.calls[0][0]).toBe(TOPIC_MS_CLIMATE_DATA_UPDATED);
    expect(kafka.send.mock.calls[0][1]).toBe('cd-001');
  });

  // == 10. Continental user sees all tenants ====================================

  it('findAll -- CONTINENTAL user sees all tenants (no tenantId filter)', async () => {
    const records = [
      { id: 'cd-001', tenantId: '00000000-0000-4000-a000-000000000101', source: 'Kenya Met' },
      { id: 'cd-002', tenantId: '00000000-0000-4000-a000-000000000102', source: 'Ethiopia Met' },
      { id: 'cd-003', tenantId: '00000000-0000-4000-a000-000000000103', source: 'Nigeria Met' },
    ];

    prisma.climateDataPoint.findMany.mockResolvedValue(records);
    prisma.climateDataPoint.count.mockResolvedValue(3);

    const result = await service.findAll(
      superAdmin,
      { page: 1, limit: 20 },
      {},
    );

    expect(result.data).toHaveLength(3);
    expect(result.meta).toEqual({ total: 3, page: 1, limit: 20 });

    // Verify NO tenantId filter for CONTINENTAL user
    const findManyArg = prisma.climateDataPoint.findMany.mock.calls[0][0];
    expect(findManyArg.where.tenantId).toBeUndefined();
  });
});
