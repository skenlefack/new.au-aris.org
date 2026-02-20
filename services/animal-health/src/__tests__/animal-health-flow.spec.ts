import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { HealthEventService } from '../health-event/health-event.service';
import { LabResultService } from '../lab-result/lab-result.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

/**
 * Integration test: Event → Lab Result → Confirm → Outbreak Alert flow.
 *
 * Uses mocked Prisma/Kafka to verify the full business workflow:
 * 1. Create a SUSPECT health event
 * 2. Create a POSITIVE lab result linked to the event
 * 3. Confirm the event → triggers outbreak alert
 * 4. Attempting to re-confirm throws BadRequestException
 */

function mockPrisma() {
  const store: Record<string, Record<string, unknown>> = {};

  return {
    healthEvent: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const record = { id: 'evt-int-001', ...args.data, createdAt: new Date(), updatedAt: new Date() };
        store['evt-int-001'] = record;
        return record;
      }),
      findUnique: vi.fn(async (args: { where: { id: string }; include?: unknown }) => {
        return store[args.where.id] ?? null;
      }),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = store[args.where.id];
        if (!existing) return null;
        const updated = { ...existing, ...args.data, updatedAt: new Date() };
        store[args.where.id] = updated;
        return updated;
      }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    labResult: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const record = { id: 'lab-int-001', ...args.data, createdAt: new Date(), updatedAt: new Date() };
        store['lab-int-001'] = record;
        return record;
      }),
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        return store[args.where.id] ?? null;
      }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    _store: store,
  };
}

function mockKafkaProducer() {
  return {
    send: vi.fn().mockResolvedValue([]),
    publishedTopics: [] as string[],
  };
}

function mockAudit() {
  return {
    log: vi.fn(),
    entries: [] as string[],
  };
}

const user: AuthenticatedUser = {
  userId: 'user-ke-vet',
  email: 'vet@ke.aris.africa',
  role: UserRole.NATIONAL_ADMIN,
  tenantId: 'tenant-ke',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

describe('Animal Health Integration: Event → Lab → Confirm → Alert', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;
  let eventService: HealthEventService;
  let labService: LabResultService;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    eventService = new HealthEventService(prisma as never, kafka as never, audit as never);
    labService = new LabResultService(prisma as never, kafka as never, audit as never);
  });

  it('should execute the full event → lab → confirm → alert flow', async () => {
    // Step 1: Create a SUSPECT health event
    const createResult = await eventService.create(
      {
        diseaseId: 'disease-rinderpest',
        eventType: 'SUSPECT',
        speciesIds: ['species-cattle'],
        dateSuspicion: '2026-01-10T00:00:00.000Z',
        geoEntityId: 'geo-nairobi',
        holdingsAffected: 3,
        susceptible: 150,
        cases: 8,
        deaths: 2,
        killed: 0,
        slaughtered: 0,
        confidenceLevel: 'VERIFIED',
      },
      user,
    );

    expect(createResult.data.eventType).toBe('SUSPECT');
    expect(createResult.data.id).toBe('evt-int-001');

    // Kafka: ms.health.event.created.v1
    expect(kafka.send).toHaveBeenCalledWith(
      'ms.health.event.created.v1',
      'evt-int-001',
      expect.any(Object),
      expect.any(Object),
    );

    // Step 2: Create a POSITIVE lab result linked to the event
    const labResult = await labService.create(
      {
        sampleId: 'SAMP-INT-001',
        sampleType: 'blood',
        dateCollected: '2026-01-11T00:00:00.000Z',
        dateReceived: '2026-01-12T00:00:00.000Z',
        testType: 'PCR',
        result: 'POSITIVE',
        labId: 'lab-nairobi',
        turnaroundDays: 2,
        eqaFlag: true,
        healthEventId: 'evt-int-001',
      },
      user,
    );

    expect(labResult.data.id).toBe('lab-int-001');
    expect(labResult.data.result).toBe('POSITIVE');

    // Kafka: ms.health.lab.result.created.v1
    expect(kafka.send).toHaveBeenCalledWith(
      'ms.health.lab.result.created.v1',
      'lab-int-001',
      expect.any(Object),
      expect.any(Object),
    );

    // Step 3: Confirm the event
    kafka.send.mockClear(); // Clear to count only confirm-related calls

    const confirmed = await eventService.confirm('evt-int-001', user);

    expect(confirmed.data.eventType).toBe('CONFIRMED');
    expect(confirmed.data.confidenceLevel).toBe('CONFIRMED');

    // Kafka: ms.health.event.confirmed.v1 + rec.health.outbreak.alert.v1
    expect(kafka.send).toHaveBeenCalledTimes(2);
    expect(kafka.send).toHaveBeenCalledWith(
      'ms.health.event.confirmed.v1',
      'evt-int-001',
      expect.any(Object),
      expect.any(Object),
    );
    expect(kafka.send).toHaveBeenCalledWith(
      'rec.health.outbreak.alert.v1',
      'evt-int-001',
      expect.any(Object),
      expect.any(Object),
    );

    // Audit trail: CREATE → CREATE (lab) → VALIDATE
    expect(audit.log).toHaveBeenCalledTimes(3);
    const auditCalls = audit.log.mock.calls;
    expect(auditCalls[0]![1]).toBe('evt-int-001');
    expect(auditCalls[0]![2]).toBe('CREATE');
    expect(auditCalls[1]![1]).toBe('lab-int-001');
    expect(auditCalls[1]![2]).toBe('CREATE');
    expect(auditCalls[2]![1]).toBe('evt-int-001');
    expect(auditCalls[2]![2]).toBe('VALIDATE');

    // Step 4: Re-confirming should fail
    await expect(
      eventService.confirm('evt-int-001', user),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject confirm on nonexistent event', async () => {
    await expect(
      eventService.confirm('nonexistent', user),
    ).rejects.toThrow(NotFoundException);
  });
});
