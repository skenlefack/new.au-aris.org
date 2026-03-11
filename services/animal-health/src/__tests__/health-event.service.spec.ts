import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthEventService, HttpError } from '../services/health-event.service.js';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  UserRole,
  TenantLevel,
  TOPIC_MS_HEALTH_EVENT_CREATED,
  TOPIC_MS_HEALTH_EVENT_CONFIRMED,
  TOPIC_REC_HEALTH_OUTBREAK_ALERT,
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

const mockHealthEvent = {
  id: 'he-001',
  tenantId: nationalAdmin.tenantId,
  diseaseId: 'disease-1',
  eventType: 'SUSPECTED',
  speciesIds: ['species-1'],
  dateSuspicion: new Date('2025-01-15'),
  dateOnset: null,
  dateConfirmation: null,
  dateClosure: null,
  geoEntityId: 'geo-ke-1',
  latitude: -1.28,
  longitude: 36.82,
  holdingsAffected: 5,
  susceptible: 100,
  cases: 10,
  deaths: 2,
  killed: 0,
  slaughtered: 0,
  controlMeasures: ['QUARANTINE'],
  confidenceLevel: 'PROBABLE',
  dataClassification: 'RESTRICTED',
  wahisReady: false,
  createdBy: nationalAdmin.userId,
  updatedBy: nationalAdmin.userId,
  createdAt: new Date(),
};

/* ── Helpers ── */

function makePrisma() {
  return {
    healthEvent: {
      create: vi.fn().mockResolvedValue(mockHealthEvent),
      findMany: vi.fn().mockResolvedValue([mockHealthEvent]),
      findUnique: vi.fn().mockResolvedValue(mockHealthEvent),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(mockHealthEvent),
    },
  };
}

function makeKafka() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

/* ── Tests ── */

describe('HealthEventService', () => {
  let service: HealthEventService;
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new HealthEventService(prisma as never, kafka as never);
  });

  it('create — should create a health event with default RESTRICTED classification and publish Kafka event', async () => {
    const dto = {
      diseaseId: 'disease-1',
      eventType: 'SUSPECTED',
      speciesIds: ['species-1'],
      dateSuspicion: '2025-01-15',
      geoEntityId: 'geo-ke-1',
      latitude: -1.28,
      longitude: 36.82,
      holdingsAffected: 5,
      susceptible: 100,
      cases: 10,
      deaths: 2,
      killed: 0,
      slaughtered: 0,
      controlMeasures: ['QUARANTINE'],
      confidenceLevel: 'PROBABLE',
    };

    const result = await service.create(dto as never, nationalAdmin);

    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('he-001');
    expect(prisma.healthEvent.create).toHaveBeenCalledOnce();
    expect(prisma.healthEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataClassification: 'RESTRICTED',
          tenantId: nationalAdmin.tenantId,
          createdBy: nationalAdmin.userId,
        }),
      }),
    );
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_HEALTH_EVENT_CREATED,
      'he-001',
      expect.objectContaining({ id: 'he-001' }),
      expect.objectContaining({
        tenantId: nationalAdmin.tenantId,
        userId: nationalAdmin.userId,
      }),
    );
  });

  it('findAll — should paginate results with tenant scoping for MEMBER_STATE user', async () => {
    const result = await service.findAll(nationalAdmin, { page: 1, limit: 10 }, {});

    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 10 });
    expect(prisma.healthEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: nationalAdmin.tenantId }),
        skip: 0,
        take: 10,
      }),
    );
    expect(prisma.healthEvent.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: nationalAdmin.tenantId }),
      }),
    );
  });

  it('findOne — should throw HttpError 404 when not found', async () => {
    prisma.healthEvent.findUnique.mockResolvedValue(null);

    await expect(service.findOne('nonexistent', nationalAdmin)).rejects.toThrow(HttpError);
    await expect(service.findOne('nonexistent', nationalAdmin)).rejects.toThrow(
      'Health event nonexistent not found',
    );
  });

  it('confirm — should set eventType to CONFIRMED and publish confirmation + outbreak alert', async () => {
    const confirmedEvent = {
      ...mockHealthEvent,
      eventType: 'CONFIRMED',
      confidenceLevel: 'CONFIRMED',
      dateConfirmation: new Date(),
    };
    prisma.healthEvent.update.mockResolvedValue(confirmedEvent);

    const result = await service.confirm('he-001', nationalAdmin);

    expect(result.data.eventType).toBe('CONFIRMED');
    expect(prisma.healthEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'he-001' },
        data: expect.objectContaining({
          eventType: 'CONFIRMED',
          confidenceLevel: 'CONFIRMED',
          updatedBy: nationalAdmin.userId,
        }),
      }),
    );
    // Should publish both the confirmed event and the outbreak alert
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_MS_HEALTH_EVENT_CONFIRMED,
      expect.any(String),
      expect.objectContaining({ eventType: 'CONFIRMED' }),
      expect.any(Object),
    );
    expect(kafka.send).toHaveBeenCalledWith(
      TOPIC_REC_HEALTH_OUTBREAK_ALERT,
      expect.any(String),
      expect.objectContaining({ eventType: 'CONFIRMED' }),
      expect.any(Object),
    );
  });

  it('confirm — should throw HttpError 400 when already confirmed', async () => {
    const alreadyConfirmed = { ...mockHealthEvent, eventType: 'CONFIRMED' };
    prisma.healthEvent.findUnique.mockResolvedValue(alreadyConfirmed);

    await expect(service.confirm('he-001', nationalAdmin)).rejects.toThrow(HttpError);
    await expect(service.confirm('he-001', nationalAdmin)).rejects.toThrow(
      'already confirmed',
    );
  });
});
