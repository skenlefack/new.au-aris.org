import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole, TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { ApiaryService, HttpError as ApiaryHttpError } from '../services/apiary.service';
import { ProductionService, HttpError as ProductionHttpError } from '../services/production.service';
import { ColonyHealthService, HttpError as ColonyHttpError } from '../services/colony-health.service';
import { TrainingService, HttpError as TrainingHttpError } from '../services/training.service';
import {
  TOPIC_MS_APICULTURE_APIARY_CREATED,
  TOPIC_MS_APICULTURE_PRODUCTION_RECORDED,
  TOPIC_MS_APICULTURE_HEALTH_INSPECTED,
  TOPIC_MS_APICULTURE_TRAINING_CREATED,
  TOPIC_MS_APICULTURE_TRAINING_UPDATED,
} from '../kafka-topics';

// -- Fixtures --

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

// -- Mock factories --

function createMockPrisma() {
  return {
    apiary: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    honeyProduction: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    colonyHealth: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    beekeeperTraining: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  } as any;
}

function createMockKafka() {
  return { send: vi.fn().mockResolvedValue([]) } as any;
}

function createMockAudit() {
  return { log: vi.fn() } as any;
}

// -- ApiaryService --

describe('ApiaryService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;
  let audit: ReturnType<typeof createMockAudit>;
  let service: ApiaryService;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    audit = createMockAudit();
    service = new ApiaryService(prisma as never, kafka as never, audit as never);
  });

  it('create — creates apiary with default PARTNER classification and publishes Kafka event', async () => {
    const dto = {
      name: 'Nairobi Apiary',
      geoEntityId: 'geo-1',
      latitude: -1.286389,
      longitude: 36.817223,
      hiveCount: 50,
      hiveType: 'LANGSTROTH' as const,
      ownerName: 'John Doe',
    };

    const created = {
      id: 'apiary-uuid-1',
      tenantId: nationalAdmin.tenantId,
      ...dto,
      dataClassification: 'PARTNER',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.apiary.create.mockResolvedValue(created);

    const result = await service.create(dto as any, nationalAdmin);

    expect(result.data).toEqual(created);
    expect(prisma.apiary.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        dataClassification: 'PARTNER',
        createdBy: nationalAdmin.userId,
        name: 'Nairobi Apiary',
        hiveType: 'LANGSTROTH',
        hiveCount: 50,
      }),
    });
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_APICULTURE_APIARY_CREATED,
      'apiary-uuid-1',
      created,
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        userId: nationalAdmin.userId,
        sourceService: 'apiculture-service',
        schemaVersion: '1',
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      'Apiary',
      'apiary-uuid-1',
      'CREATE',
      nationalAdmin,
      'PARTNER',
      expect.objectContaining({ newVersion: created }),
    );
  });

  it('findAll — returns paginated results filtered by tenantId for MEMBER_STATE user', async () => {
    const rows = [
      { id: 'a1', tenantId: nationalAdmin.tenantId, name: 'Apiary A' },
      { id: 'a2', tenantId: nationalAdmin.tenantId, name: 'Apiary B' },
    ];
    prisma.apiary.findMany.mockResolvedValue(rows);
    prisma.apiary.count.mockResolvedValue(2);

    const result = await service.findAll(nationalAdmin, {} as any);

    expect(result.data).toEqual(rows);
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 20 });
    expect(prisma.apiary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: nationalAdmin.tenantId }),
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('findOne — throws HttpError 404 when apiary not found', async () => {
    prisma.apiary.findUnique.mockResolvedValue(null);

    await expect(service.findOne('nonexistent-id', nationalAdmin)).rejects.toThrow(ApiaryHttpError);
    await expect(service.findOne('nonexistent-id', nationalAdmin)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Apiary nonexistent-id not found',
    });
  });
});

// -- ProductionService --

describe('ProductionService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;
  let audit: ReturnType<typeof createMockAudit>;
  let service: ProductionService;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    audit = createMockAudit();
    service = new ProductionService(prisma as never, kafka as never, audit as never);
  });

  it('create — records honey production and publishes Kafka event', async () => {
    const dto = {
      apiaryId: 'apiary-uuid-1',
      harvestDate: '2025-06-15T00:00:00Z',
      quantity: 120,
      unit: 'kg',
      quality: 'GRADE_A' as const,
      floralSource: 'Acacia',
    };

    const created = {
      id: 'prod-uuid-1',
      tenantId: nationalAdmin.tenantId,
      ...dto,
      dataClassification: 'PARTNER',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.honeyProduction.create.mockResolvedValue(created);

    const result = await service.create(dto as any, nationalAdmin);

    expect(result.data).toEqual(created);
    expect(prisma.honeyProduction.create).toHaveBeenCalledOnce();
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_APICULTURE_PRODUCTION_RECORDED,
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
      quality: 'GRADE_B',
    };

    prisma.honeyProduction.findUnique.mockResolvedValue(record);

    await expect(service.findOne('prod-uuid-2', nationalAdmin)).rejects.toThrow(ProductionHttpError);
    await expect(service.findOne('prod-uuid-2', nationalAdmin)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Honey production record prod-uuid-2 not found',
    });
  });
});

// -- ColonyHealthService --

describe('ColonyHealthService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;
  let audit: ReturnType<typeof createMockAudit>;
  let service: ColonyHealthService;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    audit = createMockAudit();
    service = new ColonyHealthService(prisma as never, kafka as never, audit as never);
  });

  it('create — creates colony health inspection and publishes Kafka event', async () => {
    const dto = {
      apiaryId: 'apiary-uuid-1',
      inspectionDate: '2025-07-01T10:00:00Z',
      colonyStrength: 'STRONG' as const,
      diseases: ['NONE' as const],
      treatments: ['sugar syrup'],
    };

    const created = {
      id: 'health-uuid-1',
      tenantId: nationalAdmin.tenantId,
      ...dto,
      dataClassification: 'PARTNER',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.colonyHealth.create.mockResolvedValue(created);

    const result = await service.create(dto as any, nationalAdmin);

    expect(result.data).toEqual(created);
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_APICULTURE_HEALTH_INSPECTED,
      'health-uuid-1',
      created,
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
      }),
    );
  });

  it('findAll — builds disease filter with { has: disease } when disease query param provided', async () => {
    prisma.colonyHealth.findMany.mockResolvedValue([]);
    prisma.colonyHealth.count.mockResolvedValue(0);

    await service.findAll(superAdmin, { disease: 'VARROA' } as any);

    expect(prisma.colonyHealth.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          diseases: { has: 'VARROA' },
        }),
      }),
    );
  });
});

// -- TrainingService --

describe('TrainingService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;
  let audit: ReturnType<typeof createMockAudit>;
  let service: TrainingService;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    audit = createMockAudit();
    service = new TrainingService(prisma as never, kafka as never, audit as never);
  });

  it('create — creates beekeeper training with default PUBLIC classification', async () => {
    const dto = {
      beekeeperId: 'beekeeper-1',
      trainingType: 'BASIC_BEEKEEPING',
      completedDate: '2025-03-15T00:00:00Z',
      certificationNumber: 'CERT-001',
    };

    const created = {
      id: 'training-uuid-1',
      tenantId: nationalAdmin.tenantId,
      ...dto,
      dataClassification: 'PUBLIC',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.beekeeperTraining.create.mockResolvedValue(created);

    const result = await service.create(dto as any, nationalAdmin);

    expect(result.data).toEqual(created);
    expect(prisma.beekeeperTraining.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        dataClassification: 'PUBLIC',
        beekeeperId: 'beekeeper-1',
        trainingType: 'BASIC_BEEKEEPING',
      }),
    });
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_APICULTURE_TRAINING_CREATED,
      'training-uuid-1',
      created,
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
      }),
    );
  });

  it('update — updates partial fields and publishes TOPIC_MS_APICULTURE_TRAINING_UPDATED', async () => {
    const existing = {
      id: 'training-uuid-2',
      tenantId: nationalAdmin.tenantId,
      beekeeperId: 'beekeeper-2',
      trainingType: 'BASIC_BEEKEEPING',
      completedDate: '2025-01-01T00:00:00Z',
      dataClassification: 'PUBLIC',
    };

    const updated = {
      ...existing,
      trainingType: 'ADVANCED_BEEKEEPING',
      updatedBy: nationalAdmin.userId,
    };

    prisma.beekeeperTraining.findUnique.mockResolvedValue(existing);
    prisma.beekeeperTraining.update.mockResolvedValue(updated);

    const result = await service.update(
      'training-uuid-2',
      { trainingType: 'ADVANCED_BEEKEEPING' } as any,
      nationalAdmin,
    );

    expect(result.data).toEqual(updated);
    expect(prisma.beekeeperTraining.update).toHaveBeenCalledWith({
      where: { id: 'training-uuid-2' },
      data: {
        trainingType: 'ADVANCED_BEEKEEPING',
        updatedBy: nationalAdmin.userId,
      },
    });
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_APICULTURE_TRAINING_UPDATED,
      'training-uuid-2',
      updated,
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
      }),
    );
  });

  it('findOne — throws HttpError 404 when training not found', async () => {
    prisma.beekeeperTraining.findUnique.mockResolvedValue(null);

    await expect(service.findOne('nonexistent-id', nationalAdmin)).rejects.toThrow(TrainingHttpError);
    await expect(service.findOne('nonexistent-id', nationalAdmin)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Beekeeper training nonexistent-id not found',
    });
  });
});
