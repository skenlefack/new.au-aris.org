import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UserRole,
  TenantLevel,
  TOPIC_MS_WILDLIFE_INVENTORY_CREATED,
  TOPIC_MS_WILDLIFE_PROTECTED_AREA_CREATED,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { InventoryService, HttpError as InventoryHttpError } from '../services/inventory.service.js';
import { ProtectedAreaService, HttpError as ProtectedAreaHttpError } from '../services/protected-area.service.js';

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
    wildlifeInventory: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    protectedArea: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    citesPermit: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    wildlifeCrime: {
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

// ── InventoryService ──────────────────────────────────────────────────

describe('InventoryService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: InventoryService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new InventoryService(prisma as never, kafka as never);
  });

  it('create -- creates inventory with default RESTRICTED classification and publishes Kafka event', async () => {
    const created = {
      id: 'inv-001',
      speciesId: 'species-elephant',
      geoEntityId: 'geo-tsavo',
      surveyDate: new Date('2026-02-01'),
      populationEstimate: 8500,
      methodology: 'Aerial census',
      conservationStatus: 'Vulnerable',
      threatLevel: 'High',
      dataClassification: 'RESTRICTED',
      tenantId: nationalAdmin.tenantId,
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };
    prisma.wildlifeInventory.create.mockResolvedValue(created);

    const result = await service.create(
      {
        speciesId: 'species-elephant',
        geoEntityId: 'geo-tsavo',
        surveyDate: '2026-02-01',
        populationEstimate: 8500,
        methodology: 'Aerial census',
        conservationStatus: 'Vulnerable',
        threatLevel: 'High',
      },
      nationalAdmin,
    );

    expect(result).toEqual({ data: created });

    // Prisma call uses default RESTRICTED classification
    expect(prisma.wildlifeInventory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataClassification: 'RESTRICTED',
          tenantId: nationalAdmin.tenantId,
          createdBy: nationalAdmin.userId,
        }),
      }),
    );

    // Kafka event published with correct topic and key
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_WILDLIFE_INVENTORY_CREATED,
      'inv-001',
      expect.objectContaining({ id: 'inv-001' }),
      expect.objectContaining({
        sourceService: 'wildlife-service',
        tenantId: nationalAdmin.tenantId,
      }),
    );
  });

  it('findAll -- paginates and filters by conservationStatus with tenant scoping for MEMBER_STATE', async () => {
    const records = [
      { id: 'inv-001', conservationStatus: 'Vulnerable', tenantId: nationalAdmin.tenantId },
    ];
    prisma.wildlifeInventory.findMany.mockResolvedValue(records);
    prisma.wildlifeInventory.count.mockResolvedValue(1);

    const result = await service.findAll(
      nationalAdmin,
      { page: 1, limit: 10 },
      { conservationStatus: 'Vulnerable' },
    );

    expect(result.data).toEqual(records);
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 10 });

    // MEMBER_STATE user gets tenant-scoped query
    expect(prisma.wildlifeInventory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: nationalAdmin.tenantId,
          conservationStatus: 'Vulnerable',
        }),
        skip: 0,
        take: 10,
      }),
    );
  });

  it('findOne -- throws HttpError 404 when inventory not found', async () => {
    prisma.wildlifeInventory.findUnique.mockResolvedValue(null);

    await expect(service.findOne('nonexistent-id', nationalAdmin)).rejects.toThrow(
      expect.objectContaining({
        statusCode: 404,
        message: expect.stringContaining('not found'),
      }),
    );

    // Verify it is the correct error type
    try {
      await service.findOne('nonexistent-id', nationalAdmin);
    } catch (err) {
      expect(err).toBeInstanceOf(InventoryHttpError);
      expect((err as InventoryHttpError).statusCode).toBe(404);
    }
  });
});

// ── ProtectedAreaService ──────────────────────────────────────────────

describe('ProtectedAreaService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: ProtectedAreaService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new ProtectedAreaService(prisma as never, kafka as never);
  });

  it('create -- creates protected area with default PUBLIC classification and publishes Kafka event', async () => {
    const created = {
      id: 'pa-001',
      name: 'Tsavo National Park',
      iucnCategory: 'II',
      geoEntityId: 'geo-tsavo',
      areaKm2: 20812,
      managingAuthority: 'KWS',
      isActive: true,
      dataClassification: 'PUBLIC',
      tenantId: nationalAdmin.tenantId,
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };
    prisma.protectedArea.create.mockResolvedValue(created);

    const result = await service.create(
      {
        name: 'Tsavo National Park',
        iucnCategory: 'II',
        geoEntityId: 'geo-tsavo',
        areaKm2: 20812,
        managingAuthority: 'KWS',
      },
      nationalAdmin,
    );

    expect(result).toEqual({ data: created });

    // Prisma call uses default PUBLIC classification
    expect(prisma.protectedArea.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataClassification: 'PUBLIC',
          tenantId: nationalAdmin.tenantId,
        }),
      }),
    );

    // Kafka event published
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_WILDLIFE_PROTECTED_AREA_CREATED,
      'pa-001',
      expect.objectContaining({ id: 'pa-001' }),
      expect.objectContaining({ sourceService: 'wildlife-service' }),
    );
  });

  it('findAll -- filters by iucnCategory', async () => {
    const records = [
      { id: 'pa-001', iucnCategory: 'II', tenantId: nationalAdmin.tenantId },
      { id: 'pa-002', iucnCategory: 'II', tenantId: nationalAdmin.tenantId },
    ];
    prisma.protectedArea.findMany.mockResolvedValue(records);
    prisma.protectedArea.count.mockResolvedValue(2);

    const result = await service.findAll(
      nationalAdmin,
      { page: 1, limit: 20 },
      { iucnCategory: 'II' },
    );

    expect(result.data).toHaveLength(2);
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 20 });

    expect(prisma.protectedArea.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          iucnCategory: 'II',
        }),
      }),
    );
  });

  it('update -- throws 404 when different tenant tries to update (MEMBER_STATE with wrong tenantId)', async () => {
    // Existing record belongs to a different tenant (Nigeria)
    const existingRecord = {
      id: 'pa-099',
      name: 'Yankari Game Reserve',
      tenantId: '00000000-0000-4000-a000-000000000999', // different tenant
      iucnCategory: 'II',
    };
    prisma.protectedArea.findUnique.mockResolvedValue(existingRecord);

    // Kenya nationalAdmin tries to update a record belonging to another tenant
    await expect(
      service.update('pa-099', { name: 'Updated Name' }, nationalAdmin),
    ).rejects.toThrow(
      expect.objectContaining({
        statusCode: 404,
        message: 'Resource not found',
      }),
    );

    // Verify update was never called
    expect(prisma.protectedArea.update).not.toHaveBeenCalled();
  });
});
