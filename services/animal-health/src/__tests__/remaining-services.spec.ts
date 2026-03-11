import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SurveillanceService } from '../services/surveillance.service.js';
import { VaccinationService } from '../services/vaccination.service.js';
import { CapacityService, HttpError } from '../services/capacity.service.js';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  UserRole,
  TenantLevel,
  TOPIC_MS_HEALTH_SURVEILLANCE_REPORTED,
  TOPIC_MS_HEALTH_VACCINATION_COMPLETED,
} from '@aris/shared-types';

/* ── Fixtures ── */

const nationalAdmin: AuthenticatedUser = {
  userId: '10000000-0000-4000-a000-000000000101',
  email: 'admin@ke.au-aris.org',
  firstName: 'Kenya',
  lastName: 'Admin',
  role: UserRole.NATIONAL_ADMIN,
  tenantId: '00000000-0000-4000-a000-000000000101',
  tenantLevel: TenantLevel.MEMBER_STATE,
} as AuthenticatedUser;

const superAdmin: AuthenticatedUser = {
  userId: '10000000-0000-4000-a000-000000000001',
  email: 'admin@au-aris.org',
  firstName: 'Super',
  lastName: 'Admin',
  role: UserRole.SUPER_ADMIN,
  tenantId: '00000000-0000-4000-a000-000000000001',
  tenantLevel: TenantLevel.CONTINENTAL,
} as AuthenticatedUser;

/* ── Mock Data ── */

const mockSurveillance = {
  id: 'surv-001',
  type: 'ACTIVE',
  diseaseId: 'disease-1',
  designType: 'SENTINEL',
  sampleSize: 500,
  positivityRate: 0.12,
  periodStart: new Date('2025-01-01'),
  periodEnd: new Date('2025-06-30'),
  geoEntityId: 'geo-ke-1',
  mapLayerId: null,
  dataClassification: 'PARTNER',
  tenantId: nationalAdmin.tenantId,
  createdBy: nationalAdmin.userId,
  updatedBy: nationalAdmin.userId,
  createdAt: new Date(),
};

const mockVaccination = {
  id: 'vacc-001',
  diseaseId: 'disease-1',
  speciesId: 'species-1',
  vaccineType: 'INACTIVATED',
  vaccineBatch: 'BATCH-2025-A',
  dosesDelivered: 10000,
  dosesUsed: 8000,
  targetPopulation: 10000,
  coverageEstimate: 80.0,
  pveSerologyDone: true,
  periodStart: new Date('2025-01-01'),
  periodEnd: new Date('2025-03-31'),
  geoEntityId: 'geo-ke-1',
  dataClassification: 'PARTNER',
  tenantId: nationalAdmin.tenantId,
  createdBy: nationalAdmin.userId,
  updatedBy: nationalAdmin.userId,
  createdAt: new Date(),
};

const mockCapacity = {
  id: 'cap-001',
  year: 2025,
  epiStaff: 45,
  labStaff: 30,
  labTestsAvailable: 120,
  vaccineProductionCapacity: 50000,
  pvsScore: 3.5,
  dataClassification: 'PARTNER',
  tenantId: nationalAdmin.tenantId,
  createdBy: nationalAdmin.userId,
  updatedBy: nationalAdmin.userId,
  createdAt: new Date(),
};

/* ── Helpers ── */

function makeSurveillancePrisma() {
  return {
    surveillanceActivity: {
      create: vi.fn().mockResolvedValue(mockSurveillance),
      findMany: vi.fn().mockResolvedValue([mockSurveillance]),
      findUnique: vi.fn().mockResolvedValue(mockSurveillance),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(mockSurveillance),
    },
  };
}

function makeVaccinationPrisma() {
  return {
    vaccinationCampaign: {
      create: vi.fn().mockResolvedValue(mockVaccination),
      findMany: vi.fn().mockResolvedValue([mockVaccination]),
      findUnique: vi.fn().mockResolvedValue(mockVaccination),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(mockVaccination),
    },
  };
}

function makeCapacityPrisma() {
  return {
    sVCapacity: {
      create: vi.fn().mockResolvedValue(mockCapacity),
      findMany: vi.fn().mockResolvedValue([mockCapacity]),
      findUnique: vi.fn().mockResolvedValue(mockCapacity),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(mockCapacity),
    },
  };
}

function makeKafka() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

/* ── Tests ── */

describe('SurveillanceService', () => {
  let service: SurveillanceService;
  let prisma: ReturnType<typeof makeSurveillancePrisma>;
  let kafka: ReturnType<typeof makeKafka>;

  beforeEach(() => {
    prisma = makeSurveillancePrisma();
    kafka = makeKafka();
    service = new SurveillanceService(prisma as never, kafka as never);
  });

  it('create — should create a surveillance activity and publish Kafka event', async () => {
    const dto = {
      type: 'ACTIVE',
      diseaseId: 'disease-1',
      designType: 'SENTINEL',
      sampleSize: 500,
      positivityRate: 0.12,
      periodStart: '2025-01-01',
      periodEnd: '2025-06-30',
      geoEntityId: 'geo-ke-1',
    };

    const result = await service.create(dto as never, nationalAdmin);

    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('surv-001');
    expect(prisma.surveillanceActivity.create).toHaveBeenCalledOnce();
    expect(prisma.surveillanceActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'ACTIVE',
          diseaseId: 'disease-1',
          dataClassification: 'PARTNER',
          tenantId: nationalAdmin.tenantId,
          createdBy: nationalAdmin.userId,
        }),
      }),
    );
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_HEALTH_SURVEILLANCE_REPORTED,
      'surv-001',
      expect.objectContaining({ id: 'surv-001' }),
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
      }),
    );
  });
});

describe('VaccinationService', () => {
  let service: VaccinationService;
  let prisma: ReturnType<typeof makeVaccinationPrisma>;
  let kafka: ReturnType<typeof makeKafka>;

  beforeEach(() => {
    prisma = makeVaccinationPrisma();
    kafka = makeKafka();
    service = new VaccinationService(prisma as never, kafka as never);
  });

  it('create — should auto-calculate coverageEstimate as (dosesUsed / targetPopulation) * 100', async () => {
    const dto = {
      diseaseId: 'disease-1',
      speciesId: 'species-1',
      vaccineType: 'INACTIVATED',
      vaccineBatch: 'BATCH-2025-A',
      dosesDelivered: 10000,
      dosesUsed: 8000,
      targetPopulation: 10000,
      pveSerologyDone: true,
      periodStart: '2025-01-01',
      periodEnd: '2025-03-31',
      geoEntityId: 'geo-ke-1',
    };

    await service.create(dto as never, nationalAdmin);

    expect(prisma.vaccinationCampaign.create).toHaveBeenCalledOnce();
    const createCall = prisma.vaccinationCampaign.create.mock.calls[0][0];
    // coverageEstimate = (8000 / 10000) * 100 = 80
    expect(createCall.data.coverageEstimate).toBe(80);
    expect(createCall.data.tenantId).toBe(nationalAdmin.tenantId);
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_HEALTH_VACCINATION_COMPLETED,
      expect.any(String),
      expect.objectContaining({ id: 'vacc-001' }),
      expect.any(Object),
    );
  });
});

describe('CapacityService', () => {
  let service: CapacityService;
  let prisma: ReturnType<typeof makeCapacityPrisma>;
  let kafka: ReturnType<typeof makeKafka>;

  beforeEach(() => {
    prisma = makeCapacityPrisma();
    kafka = makeKafka();
    service = new CapacityService(prisma as never, kafka as never);
  });

  it('create — should throw 409 on duplicate tenant + year', async () => {
    // Simulate existing capacity report for the same year
    prisma.sVCapacity.findFirst.mockResolvedValue(mockCapacity);

    const dto = {
      year: 2025,
      epiStaff: 45,
      labStaff: 30,
      labTestsAvailable: 120,
    };

    await expect(service.create(dto as never, nationalAdmin)).rejects.toThrow(HttpError);
    await expect(service.create(dto as never, nationalAdmin)).rejects.toThrow(
      'SV capacity report for year 2025 already exists for this tenant',
    );
    // Should NOT call sVCapacity.create
    expect(prisma.sVCapacity.create).not.toHaveBeenCalled();
  });

  it('findAll — CONTINENTAL user should see all data (no tenant filter)', async () => {
    const result = await service.findAll(superAdmin, { page: 1, limit: 20 }, {});

    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });

    // CONTINENTAL user should have no tenantId filter
    const findManyCall = prisma.sVCapacity.findMany.mock.calls[0][0];
    expect(findManyCall.where).not.toHaveProperty('tenantId');

    const countCall = prisma.sVCapacity.count.mock.calls[0][0];
    expect(countCall.where).not.toHaveProperty('tenantId');
  });
});
