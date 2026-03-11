import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole, TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { LegalFrameworkService, HttpError as LFHttpError, FrameworkStatus } from '../services/legal-framework.service.js';
import { CapacityService, HttpError as CapHttpError } from '../services/capacity.service.js';
import { PvsEvaluationService, HttpError as PvsHttpError } from '../services/pvs-evaluation.service.js';
import { StakeholderService, HttpError as StkHttpError } from '../services/stakeholder.service.js';
import {
  TOPIC_MS_GOVERNANCE_FRAMEWORK_CREATED,
  TOPIC_MS_GOVERNANCE_FRAMEWORK_ADOPTED,
  TOPIC_MS_GOVERNANCE_FRAMEWORK_UPDATED,
  TOPIC_MS_GOVERNANCE_CAPACITY_CREATED,
  TOPIC_MS_GOVERNANCE_PVS_EVALUATED,
  TOPIC_MS_GOVERNANCE_STAKEHOLDER_CREATED,
} from '../kafka-topics.js';

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

function makePrisma() {
  return {
    legalFramework: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    institutionalCapacity: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    pVSEvaluation: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    stakeholderRegistry: {
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

// -- LegalFrameworkService --

describe('LegalFrameworkService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: LegalFrameworkService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new LegalFrameworkService(prisma as never, kafka as never);
  });

  it('create -- creates legal framework with tenant isolation and default PUBLIC classification', async () => {
    const created = {
      id: 'lf-001',
      title: 'Animal Health Act 2024',
      type: 'LAW',
      domain: 'animal-health',
      adoptionDate: null,
      status: 'DRAFT',
      documentFileId: null,
      dataClassification: 'PUBLIC',
      tenantId: nationalAdmin.tenantId,
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };
    prisma.legalFramework.create.mockResolvedValue(created);

    const result = await service.create(
      {
        title: 'Animal Health Act 2024',
        type: 'LAW',
        domain: 'animal-health',
        status: 'DRAFT',
      },
      nationalAdmin,
    );

    expect(result).toEqual({ data: created });

    expect(prisma.legalFramework.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataClassification: 'PUBLIC',
          tenantId: nationalAdmin.tenantId,
          createdBy: nationalAdmin.userId,
        }),
      }),
    );

    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_GOVERNANCE_FRAMEWORK_CREATED,
      'lf-001',
      expect.objectContaining({ id: 'lf-001' }),
      expect.objectContaining({
        sourceService: 'governance-service',
        tenantId: nationalAdmin.tenantId,
      }),
    );
  });

  it('adopt -- transitions legal framework to ADOPTED status and sets adoptionDate', async () => {
    const existing = {
      id: 'lf-002',
      title: 'Veterinary Code',
      type: 'REGULATION',
      domain: 'governance',
      status: 'DRAFT',
      dataClassification: 'PUBLIC',
      tenantId: nationalAdmin.tenantId,
    };
    prisma.legalFramework.findUnique.mockResolvedValue(existing);

    const adopted = {
      ...existing,
      status: 'ADOPTED',
      adoptionDate: new Date(),
    };
    prisma.legalFramework.update.mockResolvedValue(adopted);

    const result = await service.adopt('lf-002', nationalAdmin);

    expect(result.data.status).toBe('ADOPTED');

    expect(prisma.legalFramework.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lf-002' },
        data: expect.objectContaining({
          status: FrameworkStatus.ADOPTED,
          updatedBy: nationalAdmin.userId,
        }),
      }),
    );

    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_GOVERNANCE_FRAMEWORK_ADOPTED,
      'lf-002',
      expect.objectContaining({ id: 'lf-002', status: 'ADOPTED' }),
      expect.objectContaining({ sourceService: 'governance-service' }),
    );
  });

  it('update -- updates legal framework with audit trail', async () => {
    const existing = {
      id: 'lf-003',
      title: 'Old Title',
      type: 'POLICY',
      domain: 'trade',
      status: 'DRAFT',
      dataClassification: 'PUBLIC',
      tenantId: nationalAdmin.tenantId,
    };
    prisma.legalFramework.findUnique.mockResolvedValue(existing);

    const updated = {
      ...existing,
      title: 'New Title',
      updatedBy: nationalAdmin.userId,
    };
    prisma.legalFramework.update.mockResolvedValue(updated);

    const result = await service.update(
      'lf-003',
      { title: 'New Title' },
      nationalAdmin,
    );

    expect(result.data.title).toBe('New Title');

    expect(prisma.legalFramework.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lf-003' },
        data: expect.objectContaining({
          title: 'New Title',
          updatedBy: nationalAdmin.userId,
        }),
      }),
    );

    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_GOVERNANCE_FRAMEWORK_UPDATED,
      'lf-003',
      expect.objectContaining({ id: 'lf-003' }),
      expect.objectContaining({ sourceService: 'governance-service' }),
    );
  });
});

// -- CapacityService --

describe('CapacityService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: CapacityService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new CapacityService(prisma as never, kafka as never);
  });

  it('create -- creates capacity record with default PARTNER classification', async () => {
    prisma.institutionalCapacity.findFirst.mockResolvedValue(null);

    const created = {
      id: 'cap-001',
      year: 2025,
      organizationName: 'DVS Kenya',
      staffCount: 120,
      budgetUsd: 5000000,
      pvsSelfAssessmentScore: 3.2,
      oieStatus: null,
      dataClassification: 'PARTNER',
      tenantId: nationalAdmin.tenantId,
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };
    prisma.institutionalCapacity.create.mockResolvedValue(created);

    const result = await service.create(
      {
        year: 2025,
        organizationName: 'DVS Kenya',
        staffCount: 120,
        budgetUsd: 5000000,
        pvsSelfAssessmentScore: 3.2,
      },
      nationalAdmin,
    );

    expect(result).toEqual({ data: created });

    expect(prisma.institutionalCapacity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataClassification: 'PARTNER',
          tenantId: nationalAdmin.tenantId,
        }),
      }),
    );

    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_GOVERNANCE_CAPACITY_CREATED,
      'cap-001',
      expect.objectContaining({ id: 'cap-001' }),
      expect.objectContaining({ sourceService: 'governance-service' }),
    );
  });

  it('create -- throws 409 when capacity record already exists for same tenant+year+organization', async () => {
    prisma.institutionalCapacity.findFirst.mockResolvedValue({
      id: 'cap-existing',
      year: 2025,
      organizationName: 'DVS Kenya',
      tenantId: nationalAdmin.tenantId,
    });

    await expect(
      service.create(
        {
          year: 2025,
          organizationName: 'DVS Kenya',
          staffCount: 100,
          budgetUsd: 4000000,
        },
        nationalAdmin,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        statusCode: 409,
        message: expect.stringContaining('already exists'),
      }),
    );

    try {
      await service.create(
        { year: 2025, organizationName: 'DVS Kenya', staffCount: 100, budgetUsd: 4000000 },
        nationalAdmin,
      );
    } catch (err) {
      expect(err).toBeInstanceOf(CapHttpError);
      expect((err as CapHttpError).statusCode).toBe(409);
    }

    expect(prisma.institutionalCapacity.create).not.toHaveBeenCalled();
  });
});

// -- PvsEvaluationService --

describe('PvsEvaluationService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: PvsEvaluationService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new PvsEvaluationService(prisma as never, kafka as never);
  });

  it('create -- creates PVS evaluation with default PARTNER classification', async () => {
    const created = {
      id: 'pvs-001',
      evaluationType: 'PVS',
      evaluationDate: new Date('2025-06-15'),
      overallScore: 3.5,
      criticalCompetencies: { 'II-1': 3, 'II-2': 4, 'II-3': 3 },
      recommendations: ['Improve lab capacity', 'Strengthen border controls'],
      dataClassification: 'PARTNER',
      tenantId: nationalAdmin.tenantId,
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };
    prisma.pVSEvaluation.create.mockResolvedValue(created);

    const result = await service.create(
      {
        evaluationType: 'PVS',
        evaluationDate: '2025-06-15T00:00:00.000Z',
        overallScore: 3.5,
        criticalCompetencies: { 'II-1': 3, 'II-2': 4, 'II-3': 3 },
        recommendations: ['Improve lab capacity', 'Strengthen border controls'],
      },
      nationalAdmin,
    );

    expect(result).toEqual({ data: created });

    expect(prisma.pVSEvaluation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataClassification: 'PARTNER',
          tenantId: nationalAdmin.tenantId,
          evaluationType: 'PVS',
        }),
      }),
    );

    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_GOVERNANCE_PVS_EVALUATED,
      'pvs-001',
      expect.objectContaining({ id: 'pvs-001' }),
      expect.objectContaining({ sourceService: 'governance-service' }),
    );
  });

  it('findAll -- lists PVS evaluations with period filter', async () => {
    const records = [
      {
        id: 'pvs-001',
        evaluationType: 'PVS',
        evaluationDate: new Date('2025-06-15'),
        tenantId: nationalAdmin.tenantId,
      },
    ];
    prisma.pVSEvaluation.findMany.mockResolvedValue(records);
    prisma.pVSEvaluation.count.mockResolvedValue(1);

    const result = await service.findAll(
      nationalAdmin,
      { page: 1, limit: 10 },
      { periodStart: '2025-01-01T00:00:00.000Z', periodEnd: '2025-12-31T23:59:59.999Z' },
    );

    expect(result.data).toEqual(records);
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 10 });

    expect(prisma.pVSEvaluation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: nationalAdmin.tenantId,
          evaluationDate: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
      }),
    );
  });
});

// -- StakeholderService --

describe('StakeholderService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: StakeholderService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new StakeholderService(prisma as never, kafka as never);
  });

  it('create -- creates stakeholder with domains array and default PUBLIC classification', async () => {
    const created = {
      id: 'stk-001',
      name: 'Kenya Veterinary Association',
      type: 'NGO',
      contactPerson: 'Dr. Kimani',
      email: 'info@kva.co.ke',
      domains: ['animal-health', 'governance'],
      dataClassification: 'PUBLIC',
      tenantId: nationalAdmin.tenantId,
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };
    prisma.stakeholderRegistry.create.mockResolvedValue(created);

    const result = await service.create(
      {
        name: 'Kenya Veterinary Association',
        type: 'NGO',
        contactPerson: 'Dr. Kimani',
        email: 'info@kva.co.ke',
        domains: ['animal-health', 'governance'],
      },
      nationalAdmin,
    );

    expect(result).toEqual({ data: created });

    expect(prisma.stakeholderRegistry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataClassification: 'PUBLIC',
          tenantId: nationalAdmin.tenantId,
          domains: ['animal-health', 'governance'],
        }),
      }),
    );

    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_GOVERNANCE_STAKEHOLDER_CREATED,
      'stk-001',
      expect.objectContaining({ id: 'stk-001' }),
      expect.objectContaining({ sourceService: 'governance-service' }),
    );
  });

  it('findAll -- filters stakeholders by domain using { has } query', async () => {
    const records = [
      {
        id: 'stk-001',
        name: 'Kenya Veterinary Association',
        domains: ['animal-health', 'governance'],
        tenantId: nationalAdmin.tenantId,
      },
    ];
    prisma.stakeholderRegistry.findMany.mockResolvedValue(records);
    prisma.stakeholderRegistry.count.mockResolvedValue(1);

    const result = await service.findAll(
      nationalAdmin,
      { page: 1, limit: 20 },
      { domain: 'animal-health' },
    );

    expect(result.data).toEqual(records);
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });

    expect(prisma.stakeholderRegistry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: nationalAdmin.tenantId,
          domains: { has: 'animal-health' },
        }),
      }),
    );
  });
});

// -- Cross-cutting: Continental user sees all tenants --

describe('Cross-cutting', () => {
  it('continental user sees all tenants (no tenantId filter in where clause)', async () => {
    const prisma = makePrisma();
    const kafka = makeKafka();
    const service = new LegalFrameworkService(prisma as never, kafka as never);

    const records = [
      { id: 'lf-100', tenantId: '00000000-0000-4000-a000-000000000101' },
      { id: 'lf-200', tenantId: '00000000-0000-4000-a000-000000000201' },
    ];
    prisma.legalFramework.findMany.mockResolvedValue(records);
    prisma.legalFramework.count.mockResolvedValue(2);

    const result = await service.findAll(
      superAdmin,
      { page: 1, limit: 20 },
      {},
    );

    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(2);

    // CONTINENTAL user: where clause should NOT contain tenantId
    const callArgs = prisma.legalFramework.findMany.mock.calls[0]![0];
    expect(callArgs.where).not.toHaveProperty('tenantId');
  });
});
