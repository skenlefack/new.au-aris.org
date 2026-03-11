import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UserRole,
  TenantLevel,
  TOPIC_MS_FISHERIES_CAPTURE_CREATED,
  TOPIC_MS_FISHERIES_VESSEL_CREATED,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { CaptureService, HttpError } from '../services/capture.service.js';
import { VesselService, HttpError as VesselHttpError } from '../services/vessel.service.js';

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

// ── CaptureService ────────────────────────────────────────────────────────────

describe('CaptureService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: CaptureService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new CaptureService(prisma as never, kafka as never);
  });

  it('create — creates fish capture with default PARTNER classification and publishes Kafka event', async () => {
    const dto = {
      speciesId: 'species-001',
      faoAreaCode: '47.1',
      gearType: 'TRAWL',
      quantityKg: 1500,
      landingSite: 'Mombasa',
      captureDate: '2026-02-15',
      geoEntityId: 'geo-ke-01',
    };

    const createdCapture = {
      id: 'capture-uuid-001',
      tenantId: nationalAdmin.tenantId,
      ...dto,
      captureDate: new Date(dto.captureDate),
      vesselId: null,
      dataClassification: 'PARTNER',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.fishCapture.create.mockResolvedValue(createdCapture);

    const result = await service.create(dto, nationalAdmin);

    expect(result.data).toEqual(createdCapture);

    // Verify Prisma was called with correct data including default classification
    expect(prisma.fishCapture.create).toHaveBeenCalledOnce();
    const createArg = prisma.fishCapture.create.mock.calls[0][0];
    expect(createArg.data.dataClassification).toBe('PARTNER');
    expect(createArg.data.tenantId).toBe(nationalAdmin.tenantId);
    expect(createArg.data.createdBy).toBe(nationalAdmin.userId);

    // Verify Kafka event published
    expect(kafka.send).toHaveBeenCalledOnce();
    expect(kafka.send.mock.calls[0][0]).toBe(TOPIC_MS_FISHERIES_CAPTURE_CREATED);
    expect(kafka.send.mock.calls[0][1]).toBe(createdCapture.id);
  });

  it('findAll — paginates with tenant scoping for MEMBER_STATE', async () => {
    const captures = [
      { id: 'c-1', tenantId: nationalAdmin.tenantId, speciesId: 'sp-1' },
      { id: 'c-2', tenantId: nationalAdmin.tenantId, speciesId: 'sp-2' },
    ];

    prisma.fishCapture.findMany.mockResolvedValue(captures);
    prisma.fishCapture.count.mockResolvedValue(2);

    const result = await service.findAll(nationalAdmin, { page: 1, limit: 10 });

    expect(result.data).toEqual(captures);
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 10 });

    // Verify tenant scoping in where clause
    const findManyArg = prisma.fishCapture.findMany.mock.calls[0][0];
    expect(findManyArg.where.tenantId).toBe(nationalAdmin.tenantId);
    expect(findManyArg.skip).toBe(0);
    expect(findManyArg.take).toBe(10);
  });

  it('findOne — throws HttpError 404 when capture not found', async () => {
    prisma.fishCapture.findUnique.mockResolvedValue(null);

    await expect(service.findOne('non-existent-id', nationalAdmin)).rejects.toThrow(HttpError);

    try {
      await service.findOne('non-existent-id', nationalAdmin);
    } catch (err) {
      expect((err as HttpError).statusCode).toBe(404);
      expect((err as HttpError).message).toContain('not found');
    }
  });
});

// ── VesselService ─────────────────────────────────────────────────────────────

describe('VesselService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: VesselService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new VesselService(prisma as never, kafka as never);
  });

  it('create — creates vessel when registration number is unique, publishes Kafka event', async () => {
    const dto = {
      name: 'MV Kenya Star',
      registrationNumber: 'KE-FISH-001',
      flagState: 'KE',
      vesselType: 'TRAWLER',
      lengthMeters: 25,
      tonnageGt: 120,
      homePort: 'Mombasa',
    };

    const createdVessel = {
      id: 'vessel-uuid-001',
      tenantId: nationalAdmin.tenantId,
      ...dto,
      licenseNumber: null,
      licenseExpiry: null,
      dataClassification: 'PARTNER',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    // No duplicate found
    prisma.fishingVessel.findFirst.mockResolvedValue(null);
    prisma.fishingVessel.create.mockResolvedValue(createdVessel);

    const result = await service.create(dto, nationalAdmin);

    expect(result.data).toEqual(createdVessel);

    // Verify uniqueness check was performed
    expect(prisma.fishingVessel.findFirst).toHaveBeenCalledOnce();
    expect(prisma.fishingVessel.findFirst.mock.calls[0][0].where).toEqual({
      tenantId: nationalAdmin.tenantId,
      registrationNumber: dto.registrationNumber,
    });

    // Verify Kafka event
    expect(kafka.send).toHaveBeenCalledOnce();
    expect(kafka.send.mock.calls[0][0]).toBe(TOPIC_MS_FISHERIES_VESSEL_CREATED);
  });

  it('create — throws HttpError 409 when duplicate registration number exists', async () => {
    const dto = {
      name: 'MV Kenya Star',
      registrationNumber: 'KE-FISH-001',
      flagState: 'KE',
      vesselType: 'TRAWLER',
      lengthMeters: 25,
      tonnageGt: 120,
      homePort: 'Mombasa',
    };

    // Duplicate found
    prisma.fishingVessel.findFirst.mockResolvedValue({
      id: 'existing-vessel',
      registrationNumber: dto.registrationNumber,
      tenantId: nationalAdmin.tenantId,
    });

    await expect(service.create(dto, nationalAdmin)).rejects.toThrow(VesselHttpError);

    try {
      await service.create(dto, nationalAdmin);
    } catch (err) {
      expect((err as VesselHttpError).statusCode).toBe(409);
      expect((err as VesselHttpError).message).toContain(dto.registrationNumber);
    }

    // Vessel should NOT have been created
    expect(prisma.fishingVessel.create).not.toHaveBeenCalled();

    // No Kafka event should be published
    expect(kafka.send).not.toHaveBeenCalled();
  });

  it('findOne — CONTINENTAL user can access any vessel (verifyTenantAccess passes)', async () => {
    const vessel = {
      id: 'vessel-uuid-002',
      tenantId: nationalAdmin.tenantId, // Belongs to Kenya tenant
      name: 'MV Mombasa Explorer',
      registrationNumber: 'KE-FISH-002',
    };

    prisma.fishingVessel.findUnique.mockResolvedValue(vessel);

    // Super admin (CONTINENTAL) accesses a vessel belonging to a different tenant
    const result = await service.findOne(vessel.id, superAdmin);

    expect(result.data).toEqual(vessel);

    // Verify the lookup was done with the correct id
    expect(prisma.fishingVessel.findUnique).toHaveBeenCalledWith({ where: { id: vessel.id } });
  });
});
