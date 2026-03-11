import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UserRole,
  TenantLevel,
  TOPIC_MS_FISHERIES_AQUACULTURE_FARM_CREATED,
  TOPIC_MS_FISHERIES_AQUACULTURE_PRODUCTION_CREATED,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { AquacultureFarmService, HttpError } from '../services/aquaculture-farm.service.js';
import {
  AquacultureProductionService,
  HttpError as ProductionHttpError,
} from '../services/aquaculture-production.service.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

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

// ── Mock factories ────────────────────────────────────────────────────────────

function makePrisma() {
  return {
    fishCapture: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    fishingVessel: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    aquacultureFarm: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    aquacultureProduction: {
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

// ── AquacultureFarmService ────────────────────────────────────────────────────

describe('AquacultureFarmService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: AquacultureFarmService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new AquacultureFarmService(prisma as never, kafka as never);
  });

  it('create — creates aquaculture farm with coordinates as JSON and publishes Kafka event', async () => {
    const dto = {
      name: 'Lake Victoria Farm A',
      farmType: 'CAGE',
      waterSource: 'FRESHWATER',
      areaHectares: 5.5,
      speciesIds: ['species-tilapia', 'species-catfish'],
      productionCapacityTonnes: 200,
      geoEntityId: 'geo-ke-lakevictoria',
      coordinates: { lat: -0.3, lng: 34.75 },
    };

    const createdFarm = {
      id: 'farm-uuid-001',
      tenantId: nationalAdmin.tenantId,
      ...dto,
      dataClassification: 'PARTNER',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.aquacultureFarm.create.mockResolvedValue(createdFarm);

    const result = await service.create(dto, nationalAdmin);

    expect(result.data).toEqual(createdFarm);

    // Verify Prisma call includes coordinates as JSON
    const createArg = prisma.aquacultureFarm.create.mock.calls[0][0];
    expect(createArg.data.coordinates).toEqual({ lat: -0.3, lng: 34.75 });
    expect(createArg.data.tenantId).toBe(nationalAdmin.tenantId);
    expect(createArg.data.speciesIds).toEqual(['species-tilapia', 'species-catfish']);

    // Verify Kafka event
    expect(kafka.send).toHaveBeenCalledOnce();
    expect(kafka.send.mock.calls[0][0]).toBe(TOPIC_MS_FISHERIES_AQUACULTURE_FARM_CREATED);
    expect(kafka.send.mock.calls[0][1]).toBe(createdFarm.id);
  });

  it('findAll — filters by farmType and waterType (mapped to waterSource)', async () => {
    const farms = [
      { id: 'farm-1', farmType: 'CAGE', waterSource: 'FRESHWATER', tenantId: nationalAdmin.tenantId },
    ];

    prisma.aquacultureFarm.findMany.mockResolvedValue(farms);
    prisma.aquacultureFarm.count.mockResolvedValue(1);

    const result = await service.findAll(nationalAdmin, {
      page: 1,
      limit: 20,
      farmType: 'CAGE',
      waterType: 'FRESHWATER',
    });

    expect(result.data).toEqual(farms);
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });

    // Verify where clause includes both farmType and waterSource (mapped from waterType)
    const findManyArg = prisma.aquacultureFarm.findMany.mock.calls[0][0];
    expect(findManyArg.where.farmType).toBe('CAGE');
    expect(findManyArg.where.waterSource).toBe('FRESHWATER');
    expect(findManyArg.where.tenantId).toBe(nationalAdmin.tenantId);
  });

  it('update — partial update succeeds; throws 404 for wrong tenant', async () => {
    const existingFarm = {
      id: 'farm-uuid-002',
      tenantId: 'other-tenant-id',
      name: 'Old Farm Name',
      farmType: 'POND',
      waterSource: 'FRESHWATER',
    };

    prisma.aquacultureFarm.findUnique.mockResolvedValue(existingFarm);

    // National admin from Kenya tries to update a farm from a different tenant
    await expect(
      service.update(existingFarm.id, { name: 'New Farm Name' }, nationalAdmin),
    ).rejects.toThrow(HttpError);

    try {
      await service.update(existingFarm.id, { name: 'New Farm Name' }, nationalAdmin);
    } catch (err) {
      expect((err as HttpError).statusCode).toBe(404);
      expect((err as HttpError).message).toBe('Resource not found');
    }

    // Update should NOT have been called since tenant access is denied
    expect(prisma.aquacultureFarm.update).not.toHaveBeenCalled();
  });
});

// ── AquacultureProductionService ──────────────────────────────────────────────

describe('AquacultureProductionService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: AquacultureProductionService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new AquacultureProductionService(prisma as never, kafka as never);
  });

  it('create — creates production record after validating farm exists and publishes Kafka event', async () => {
    const farm = {
      id: 'farm-uuid-001',
      tenantId: nationalAdmin.tenantId,
      name: 'Lake Victoria Farm A',
    };

    const dto = {
      farmId: farm.id,
      speciesId: 'species-tilapia',
      quantityKg: 5000,
      harvestDate: '2026-02-20',
      methodOfCulture: 'CAGE',
    };

    const createdProduction = {
      id: 'prod-uuid-001',
      tenantId: nationalAdmin.tenantId,
      ...dto,
      harvestDate: new Date(dto.harvestDate),
      feedUsedKg: null,
      fcr: null,
      batchId: null,
      dataClassification: 'PARTNER',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    // Farm lookup succeeds
    prisma.aquacultureFarm.findUnique.mockResolvedValue(farm);
    prisma.aquacultureProduction.create.mockResolvedValue(createdProduction);

    const result = await service.create(dto, nationalAdmin);

    expect(result.data).toEqual(createdProduction);

    // Verify farm validation was called
    expect(prisma.aquacultureFarm.findUnique).toHaveBeenCalledWith({ where: { id: farm.id } });

    // Verify production record created with correct data
    const createArg = prisma.aquacultureProduction.create.mock.calls[0][0];
    expect(createArg.data.farmId).toBe(farm.id);
    expect(createArg.data.dataClassification).toBe('PARTNER');
    expect(createArg.data.tenantId).toBe(nationalAdmin.tenantId);

    // Verify Kafka event
    expect(kafka.send).toHaveBeenCalledOnce();
    expect(kafka.send.mock.calls[0][0]).toBe(TOPIC_MS_FISHERIES_AQUACULTURE_PRODUCTION_CREATED);
    expect(kafka.send.mock.calls[0][1]).toBe(createdProduction.id);
  });

  it('create — throws 404 when referenced farm does not exist', async () => {
    const dto = {
      farmId: 'non-existent-farm',
      speciesId: 'species-tilapia',
      quantityKg: 5000,
      harvestDate: '2026-02-20',
      methodOfCulture: 'CAGE',
    };

    // Farm lookup returns null
    prisma.aquacultureFarm.findUnique.mockResolvedValue(null);

    await expect(service.create(dto, nationalAdmin)).rejects.toThrow(ProductionHttpError);

    try {
      await service.create(dto, nationalAdmin);
    } catch (err) {
      expect((err as ProductionHttpError).statusCode).toBe(404);
      expect((err as ProductionHttpError).message).toContain(dto.farmId);
    }

    // Production record should NOT have been created
    expect(prisma.aquacultureProduction.create).not.toHaveBeenCalled();

    // No Kafka event should be published
    expect(kafka.send).not.toHaveBeenCalled();
  });

  it('findAll — filters by farmId and speciesId', async () => {
    const records = [
      {
        id: 'prod-1',
        farmId: 'farm-uuid-001',
        speciesId: 'species-tilapia',
        quantityKg: 3000,
        tenantId: nationalAdmin.tenantId,
      },
    ];

    prisma.aquacultureProduction.findMany.mockResolvedValue(records);
    prisma.aquacultureProduction.count.mockResolvedValue(1);

    const result = await service.findAll(nationalAdmin, {
      page: 1,
      limit: 20,
      farmId: 'farm-uuid-001',
      speciesId: 'species-tilapia',
    });

    expect(result.data).toEqual(records);
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });

    // Verify where clause includes farmId, speciesId, and tenantId
    const findManyArg = prisma.aquacultureProduction.findMany.mock.calls[0][0];
    expect(findManyArg.where.farmId).toBe('farm-uuid-001');
    expect(findManyArg.where.speciesId).toBe('species-tilapia');
    expect(findManyArg.where.tenantId).toBe(nationalAdmin.tenantId);

    // Verify pagination
    expect(findManyArg.skip).toBe(0);
    expect(findManyArg.take).toBe(20);
  });
});
