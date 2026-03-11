import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LabResultService, HttpError } from '../services/lab-result.service.js';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  UserRole,
  TenantLevel,
  TOPIC_MS_HEALTH_LAB_RESULT_CREATED,
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

const mockLabResult = {
  id: 'lab-001',
  sampleId: 'SAMPLE-2025-001',
  sampleType: 'BLOOD',
  dateCollected: new Date('2025-01-20'),
  dateReceived: new Date('2025-01-22'),
  testType: 'PCR',
  result: 'POSITIVE',
  labId: 'lab-nairobi-01',
  turnaroundDays: 2,
  eqaFlag: true,
  healthEventId: 'he-001',
  dataClassification: 'RESTRICTED',
  tenantId: nationalAdmin.tenantId,
  createdBy: nationalAdmin.userId,
  updatedBy: nationalAdmin.userId,
  createdAt: new Date(),
};

const mockHealthEvent = {
  id: 'he-001',
  tenantId: nationalAdmin.tenantId,
  eventType: 'SUSPECTED',
};

/* ── Helpers ── */

function makePrisma() {
  return {
    labResult: {
      create: vi.fn().mockResolvedValue(mockLabResult),
      findMany: vi.fn().mockResolvedValue([mockLabResult]),
      findUnique: vi.fn().mockResolvedValue(mockLabResult),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(mockLabResult),
    },
    healthEvent: {
      findUnique: vi.fn().mockResolvedValue(mockHealthEvent),
    },
  };
}

function makeKafka() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

/* ── Tests ── */

describe('LabResultService', () => {
  let service: LabResultService;
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new LabResultService(prisma as never, kafka as never);
  });

  it('create — should create lab result linked to health event and publish Kafka event', async () => {
    const dto = {
      sampleId: 'SAMPLE-2025-001',
      sampleType: 'BLOOD',
      dateCollected: '2025-01-20',
      dateReceived: '2025-01-22',
      testType: 'PCR',
      result: 'POSITIVE',
      labId: 'lab-nairobi-01',
      turnaroundDays: 2,
      eqaFlag: true,
      healthEventId: 'he-001',
    };

    const result = await service.create(dto as never, nationalAdmin);

    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('lab-001');
    // Should check that the linked health event exists
    expect(prisma.healthEvent.findUnique).toHaveBeenCalledWith({
      where: { id: 'he-001' },
    });
    expect(prisma.labResult.create).toHaveBeenCalledOnce();
    expect(prisma.labResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          healthEventId: 'he-001',
          dataClassification: 'RESTRICTED',
          tenantId: nationalAdmin.tenantId,
        }),
      }),
    );
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_HEALTH_LAB_RESULT_CREATED,
      'lab-001',
      expect.objectContaining({ id: 'lab-001' }),
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        userId: nationalAdmin.userId,
      }),
    );
  });

  it('create — should throw 404 if linked healthEvent does not exist', async () => {
    prisma.healthEvent.findUnique.mockResolvedValue(null);

    const dto = {
      sampleId: 'SAMPLE-2025-002',
      sampleType: 'BLOOD',
      dateCollected: '2025-01-20',
      dateReceived: '2025-01-22',
      testType: 'ELISA',
      result: 'NEGATIVE',
      labId: 'lab-nairobi-01',
      turnaroundDays: 3,
      eqaFlag: false,
      healthEventId: 'nonexistent-event',
    };

    await expect(service.create(dto as never, nationalAdmin)).rejects.toThrow(HttpError);
    await expect(service.create(dto as never, nationalAdmin)).rejects.toThrow(
      'Health event nonexistent-event not found',
    );
    // Should NOT call labResult.create
    expect(prisma.labResult.create).not.toHaveBeenCalled();
  });

  it('findAll — should filter by healthEventId', async () => {
    const result = await service.findAll(
      nationalAdmin,
      { page: 1, limit: 20 },
      { healthEventId: 'he-001' },
    );

    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    expect(prisma.labResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: nationalAdmin.tenantId,
          healthEventId: 'he-001',
        }),
      }),
    );
  });
});
