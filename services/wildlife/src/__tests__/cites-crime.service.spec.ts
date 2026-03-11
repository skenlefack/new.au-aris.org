import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UserRole,
  TenantLevel,
  TOPIC_MS_WILDLIFE_CITES_PERMIT_CREATED,
  TOPIC_MS_WILDLIFE_CRIME_CREATED,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { CitesPermitService, HttpError as CitesHttpError } from '../services/cites-permit.service.js';
import { CrimeService, HttpError as CrimeHttpError } from '../services/crime.service.js';

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

// ── CitesPermitService ────────────────────────────────────────────────

describe('CitesPermitService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: CitesPermitService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new CitesPermitService(prisma as never, kafka as never);
  });

  it('create -- creates permit with default status PENDING and classification RESTRICTED, publishes Kafka', async () => {
    // No duplicate exists
    prisma.citesPermit.findFirst.mockResolvedValue(null);

    const created = {
      id: 'cites-001',
      permitNumber: 'KE-CITES-2026-0001',
      permitType: 'EXPORT',
      speciesId: 'species-pangolin',
      quantity: 10,
      unit: 'specimens',
      purpose: 'Scientific',
      applicant: 'National Museum of Kenya',
      exportCountry: 'KE',
      importCountry: 'GB',
      issueDate: new Date('2026-03-01'),
      expiryDate: new Date('2026-09-01'),
      status: 'PENDING',
      dataClassification: 'RESTRICTED',
      tenantId: nationalAdmin.tenantId,
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };
    prisma.citesPermit.create.mockResolvedValue(created);

    const result = await service.create(
      {
        permitNumber: 'KE-CITES-2026-0001',
        permitType: 'EXPORT',
        speciesId: 'species-pangolin',
        quantity: 10,
        unit: 'specimens',
        purpose: 'Scientific',
        applicant: 'National Museum of Kenya',
        exportCountry: 'KE',
        importCountry: 'GB',
        issueDate: '2026-03-01',
        expiryDate: '2026-09-01',
      },
      nationalAdmin,
    );

    expect(result).toEqual({ data: created });

    // Verify default status and classification
    expect(prisma.citesPermit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          dataClassification: 'RESTRICTED',
          tenantId: nationalAdmin.tenantId,
        }),
      }),
    );

    // Kafka event published
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_WILDLIFE_CITES_PERMIT_CREATED,
      'cites-001',
      expect.objectContaining({ id: 'cites-001' }),
      expect.objectContaining({
        sourceService: 'wildlife-service',
        tenantId: nationalAdmin.tenantId,
      }),
    );
  });

  it('create -- throws HttpError 409 when duplicate permitNumber exists for same tenant', async () => {
    // Simulate existing permit with same number for the same tenant
    prisma.citesPermit.findFirst.mockResolvedValue({
      id: 'cites-existing',
      permitNumber: 'KE-CITES-2026-0001',
      tenantId: nationalAdmin.tenantId,
    });

    await expect(
      service.create(
        {
          permitNumber: 'KE-CITES-2026-0001',
          permitType: 'EXPORT',
          speciesId: 'species-pangolin',
          quantity: 5,
          unit: 'specimens',
          purpose: 'Commercial',
          applicant: 'Wildlife Traders Ltd',
          exportCountry: 'KE',
          importCountry: 'CN',
          issueDate: '2026-04-01',
          expiryDate: '2026-10-01',
        },
        nationalAdmin,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        statusCode: 409,
        message: expect.stringContaining('KE-CITES-2026-0001'),
      }),
    );

    // Verify the duplicate check was performed correctly
    expect(prisma.citesPermit.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: nationalAdmin.tenantId,
        permitNumber: 'KE-CITES-2026-0001',
      },
    });

    // Verify create was never called
    expect(prisma.citesPermit.create).not.toHaveBeenCalled();
  });

  it('findOne -- CONTINENTAL user can access any permit', async () => {
    // Permit belongs to Kenya tenant but superAdmin (CONTINENTAL) should still access it
    const permit = {
      id: 'cites-002',
      permitNumber: 'KE-CITES-2026-0002',
      tenantId: nationalAdmin.tenantId, // Kenya tenant
      status: 'APPROVED',
      dataClassification: 'RESTRICTED',
    };
    prisma.citesPermit.findUnique.mockResolvedValue(permit);

    const result = await service.findOne('cites-002', superAdmin);

    expect(result).toEqual({ data: permit });
    expect(prisma.citesPermit.findUnique).toHaveBeenCalledWith({ where: { id: 'cites-002' } });
  });
});

// ── CrimeService ──────────────────────────────────────────────────────

describe('CrimeService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: CrimeService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new CrimeService(prisma as never, kafka as never);
  });

  it('create -- creates wildlife crime with default status REPORTED and classification RESTRICTED, publishes Kafka', async () => {
    const created = {
      id: 'crime-001',
      incidentDate: new Date('2026-02-15'),
      geoEntityId: 'geo-amboseli',
      crimeType: 'POACHING',
      speciesIds: ['species-elephant', 'species-rhino'],
      description: 'Elephant tusks seized at border checkpoint',
      suspectsCount: 3,
      seizureDescription: 'Ivory tusks',
      seizureQuantity: 12,
      seizureUnit: 'kg',
      status: 'REPORTED',
      reportingAgency: 'KWS',
      dataClassification: 'RESTRICTED',
      tenantId: nationalAdmin.tenantId,
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };
    prisma.wildlifeCrime.create.mockResolvedValue(created);

    const result = await service.create(
      {
        incidentDate: '2026-02-15',
        geoEntityId: 'geo-amboseli',
        crimeType: 'POACHING',
        speciesIds: ['species-elephant', 'species-rhino'],
        description: 'Elephant tusks seized at border checkpoint',
        suspectsCount: 3,
        seizureDescription: 'Ivory tusks',
        seizureQuantity: 12,
        seizureUnit: 'kg',
        reportingAgency: 'KWS',
      },
      nationalAdmin,
    );

    expect(result).toEqual({ data: created });

    // Verify defaults
    expect(prisma.wildlifeCrime.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REPORTED',
          dataClassification: 'RESTRICTED',
          tenantId: nationalAdmin.tenantId,
          createdBy: nationalAdmin.userId,
        }),
      }),
    );

    // Kafka event published with correct topic
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_WILDLIFE_CRIME_CREATED,
      'crime-001',
      expect.objectContaining({ id: 'crime-001' }),
      expect.objectContaining({
        sourceService: 'wildlife-service',
        tenantId: nationalAdmin.tenantId,
      }),
    );
  });

  it('findAll -- paginates and filters by crimeType and status', async () => {
    const records = [
      { id: 'crime-001', crimeType: 'POACHING', status: 'REPORTED', tenantId: nationalAdmin.tenantId },
      { id: 'crime-002', crimeType: 'POACHING', status: 'REPORTED', tenantId: nationalAdmin.tenantId },
    ];
    prisma.wildlifeCrime.findMany.mockResolvedValue(records);
    prisma.wildlifeCrime.count.mockResolvedValue(15);

    const result = await service.findAll(
      nationalAdmin,
      { page: 2, limit: 5 },
      { crimeType: 'POACHING', status: 'REPORTED' },
    );

    expect(result.data).toEqual(records);
    expect(result.meta).toEqual({ total: 15, page: 2, limit: 5 });

    // Verify where clause includes filters and tenant scoping
    expect(prisma.wildlifeCrime.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: nationalAdmin.tenantId,
          crimeType: 'POACHING',
          status: 'REPORTED',
        }),
        skip: 5, // (page 2 - 1) * limit 5
        take: 5,
      }),
    );

    // Count uses same where clause
    expect(prisma.wildlifeCrime.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          crimeType: 'POACHING',
          status: 'REPORTED',
        }),
      }),
    );
  });

  it('update -- throws 404 when wildlife crime not found', async () => {
    prisma.wildlifeCrime.findUnique.mockResolvedValue(null);

    await expect(
      service.update('nonexistent-id', { status: 'UNDER_INVESTIGATION' }, nationalAdmin),
    ).rejects.toThrow(
      expect.objectContaining({
        statusCode: 404,
        message: expect.stringContaining('not found'),
      }),
    );

    // Verify it is the correct error type
    try {
      await service.update('nonexistent-id', { status: 'CLOSED' }, nationalAdmin);
    } catch (err) {
      expect(err).toBeInstanceOf(CrimeHttpError);
      expect((err as CrimeHttpError).statusCode).toBe(404);
    }

    // Verify update was never called
    expect(prisma.wildlifeCrime.update).not.toHaveBeenCalled();
  });
});
