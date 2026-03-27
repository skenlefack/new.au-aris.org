import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UserRole,
  TenantLevel,
  TOPIC_MS_FISHERIES_EFFORT_CREATED,
  TOPIC_MS_FISHERIES_EFFORT_UPDATED,
  TOPIC_MS_FISHERIES_EFFORT_DELETED,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { EffortService, HttpError } from '../services/effort.service.js';

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
    fishingEffort: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

function makeKafka() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

// ── EffortService ─────────────────────────────────────────────────────────────

describe('EffortService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: EffortService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new EffortService(prisma as never, kafka as never);
  });

  it('1. create — creates fishing effort with PARTNER classification and publishes Kafka event', async () => {
    const dto = {
      effortType: 'DAYS_AT_SEA',
      effortValue: 5,
      effortUnit: 'DAYS',
      startDate: '2026-03-01T00:00:00Z',
      endDate: '2026-03-05T00:00:00Z',
      gearType: 'GILLNET',
      vesselId: 'vessel-uuid-001',
      crewSize: 8,
      faoAreaCode: '51',
    };

    const created = {
      id: 'effort-uuid-001',
      tenantId: nationalAdmin.tenantId,
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      captureId: null,
      dataClassification: 'PARTNER',
      createdBy: nationalAdmin.userId,
      updatedBy: nationalAdmin.userId,
    };

    prisma.fishingEffort.create.mockResolvedValue(created);

    const result = await service.create(dto, nationalAdmin);

    expect(result.data).toEqual(created);

    const createArg = prisma.fishingEffort.create.mock.calls[0][0];
    expect(createArg.data.dataClassification).toBe('PARTNER');
    expect(createArg.data.tenantId).toBe(nationalAdmin.tenantId);
    expect(createArg.data.createdBy).toBe(nationalAdmin.userId);
    expect(createArg.data.effortType).toBe('DAYS_AT_SEA');

    expect(kafka.send).toHaveBeenCalledOnce();
    expect(kafka.send.mock.calls[0][0]).toBe(TOPIC_MS_FISHERIES_EFFORT_CREATED);
  });

  it('2. findAll — paginates with tenant scoping for MEMBER_STATE', async () => {
    const efforts = [
      { id: 'e-1', tenantId: nationalAdmin.tenantId, effortType: 'DAYS_AT_SEA' },
      { id: 'e-2', tenantId: nationalAdmin.tenantId, effortType: 'HOURS_FISHED' },
    ];

    prisma.fishingEffort.findMany.mockResolvedValue(efforts);
    prisma.fishingEffort.count.mockResolvedValue(2);

    const result = await service.findAll(nationalAdmin, { page: 1, limit: 10 });

    expect(result.data).toEqual(efforts);
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 10 });

    const findManyArg = prisma.fishingEffort.findMany.mock.calls[0][0];
    expect(findManyArg.where.tenantId).toBe(nationalAdmin.tenantId);
    expect(findManyArg.skip).toBe(0);
    expect(findManyArg.take).toBe(10);
  });

  it('3. findOne — returns effort and verifies tenant access for CONTINENTAL', async () => {
    const effort = {
      id: 'effort-uuid-002',
      tenantId: nationalAdmin.tenantId,
      effortType: 'DAYS_AT_SEA',
      effortValue: 3,
    };

    prisma.fishingEffort.findUnique.mockResolvedValue(effort);

    const result = await service.findOne(effort.id, superAdmin);

    expect(result.data).toEqual(effort);
    expect(prisma.fishingEffort.findUnique).toHaveBeenCalledWith({ where: { id: effort.id } });
  });

  it('4. findOne — throws HttpError 404 when effort not found', async () => {
    prisma.fishingEffort.findUnique.mockResolvedValue(null);

    await expect(service.findOne('non-existent-id', nationalAdmin)).rejects.toThrow(HttpError);

    try {
      await service.findOne('non-existent-id', nationalAdmin);
    } catch (err) {
      expect((err as HttpError).statusCode).toBe(404);
      expect((err as HttpError).message).toContain('not found');
    }
  });

  it('5. update — updates effort fields and publishes UPDATED Kafka event', async () => {
    const existing = {
      id: 'effort-uuid-003',
      tenantId: nationalAdmin.tenantId,
      effortType: 'DAYS_AT_SEA',
      effortValue: 5,
      effortUnit: 'DAYS',
      gearType: 'GILLNET',
    };

    const updated = {
      ...existing,
      effortValue: 10,
      updatedBy: nationalAdmin.userId,
    };

    prisma.fishingEffort.findUnique.mockResolvedValue(existing);
    prisma.fishingEffort.update.mockResolvedValue(updated);

    const result = await service.update('effort-uuid-003', { effortValue: 10 }, nationalAdmin);

    expect(result.data).toEqual(updated);
    expect(prisma.fishingEffort.update).toHaveBeenCalledWith({
      where: { id: 'effort-uuid-003' },
      data: expect.objectContaining({
        effortValue: 10,
        updatedBy: nationalAdmin.userId,
      }),
    });

    expect(kafka.send).toHaveBeenCalledOnce();
    expect(kafka.send.mock.calls[0][0]).toBe(TOPIC_MS_FISHERIES_EFFORT_UPDATED);
  });

  it('6. delete — deletes effort and publishes DELETED Kafka event', async () => {
    const existing = {
      id: 'effort-uuid-004',
      tenantId: nationalAdmin.tenantId,
      effortType: 'HOURS_FISHED',
    };

    prisma.fishingEffort.findUnique.mockResolvedValue(existing);
    prisma.fishingEffort.delete.mockResolvedValue(existing);

    const result = await service.delete('effort-uuid-004', nationalAdmin);

    expect(result.data).toEqual({ id: 'effort-uuid-004', deleted: true });
    expect(prisma.fishingEffort.delete).toHaveBeenCalledWith({ where: { id: 'effort-uuid-004' } });

    expect(kafka.send).toHaveBeenCalledOnce();
    expect(kafka.send.mock.calls[0][0]).toBe(TOPIC_MS_FISHERIES_EFFORT_DELETED);
  });
});
