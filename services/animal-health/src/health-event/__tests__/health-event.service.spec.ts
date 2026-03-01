import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { HealthEventService } from '../health-event.service';
import { DataClassification, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// ── Mock factories ──

function mockPrisma() {
  return {
    healthEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  };
}

function mockKafkaProducer() {
  return { send: vi.fn().mockResolvedValue([]) };
}

function mockAudit() {
  return { log: vi.fn() };
}

function msUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-ke',
    email: 'vet@ke.au-aris.org',
    role: UserRole.NATIONAL_ADMIN,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

function continentalUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-au',
    email: 'admin@au-aris.org',
    role: UserRole.SUPER_ADMIN,
    tenantId: 'tenant-au',
    tenantLevel: TenantLevel.CONTINENTAL,
    ...overrides,
  };
}

function eventFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-001',
    tenantId: 'tenant-ke',
    diseaseId: 'disease-rinderpest',
    eventType: 'SUSPECT',
    speciesIds: ['species-cattle'],
    dateOnset: null,
    dateSuspicion: new Date('2026-01-10'),
    dateConfirmation: null,
    dateClosure: null,
    geoEntityId: 'geo-nairobi',
    latitude: -1.286,
    longitude: 36.817,
    holdingsAffected: 5,
    susceptible: 200,
    cases: 12,
    deaths: 3,
    killed: 0,
    slaughtered: 0,
    controlMeasures: ['QUARANTINE'],
    confidenceLevel: 'VERIFIED',
    dataClassification: DataClassification.RESTRICTED,
    workflowInstanceId: null,
    wahisReady: false,
    createdBy: 'user-ke',
    updatedBy: 'user-ke',
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

// ── Tests ──

describe('HealthEventService', () => {
  let service: HealthEventService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafkaProducer();
    audit = mockAudit();
    service = new HealthEventService(prisma as never, kafka as never, audit as never);
  });

  // ── create ──

  describe('create', () => {
    it('should create a health event and publish Kafka event', async () => {
      const dto = {
        diseaseId: 'disease-rinderpest',
        eventType: 'SUSPECT' as const,
        speciesIds: ['species-cattle'],
        dateSuspicion: '2026-01-10T00:00:00.000Z',
        geoEntityId: 'geo-nairobi',
        holdingsAffected: 5,
        susceptible: 200,
        cases: 12,
        deaths: 3,
        killed: 0,
        slaughtered: 0,
        confidenceLevel: 'VERIFIED' as const,
      };

      prisma.healthEvent.create.mockResolvedValue(eventFixture());

      const result = await service.create(dto, msUser());

      expect(result.data.id).toBe('evt-001');
      expect(prisma.healthEvent.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.health.event.created.v1',
        'evt-001',
        expect.objectContaining({ diseaseId: 'disease-rinderpest' }),
        expect.objectContaining({ sourceService: 'animal-health-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'HealthEvent',
        'evt-001',
        'CREATE',
        expect.objectContaining({ userId: 'user-ke' }),
        DataClassification.RESTRICTED,
        expect.any(Object),
      );
    });

    it('should default dataClassification to RESTRICTED', async () => {
      prisma.healthEvent.create.mockResolvedValue(eventFixture());

      await service.create(
        {
          diseaseId: 'd1',
          eventType: 'SUSPECT',
          speciesIds: ['s1'],
          dateSuspicion: '2026-01-10T00:00:00.000Z',
          geoEntityId: 'g1',
          holdingsAffected: 0,
          susceptible: 0,
          cases: 0,
          deaths: 0,
          killed: 0,
          slaughtered: 0,
          confidenceLevel: 'RUMOR',
        },
        msUser(),
      );

      expect(prisma.healthEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dataClassification: DataClassification.RESTRICTED,
          }),
        }),
      );
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.healthEvent.create.mockResolvedValue(eventFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          diseaseId: 'd1',
          eventType: 'SUSPECT',
          speciesIds: ['s1'],
          dateSuspicion: '2026-01-10T00:00:00.000Z',
          geoEntityId: 'g1',
          holdingsAffected: 0,
          susceptible: 0,
          cases: 0,
          deaths: 0,
          killed: 0,
          slaughtered: 0,
          confidenceLevel: 'RUMOR',
        },
        msUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // ── findAll ──

  describe('findAll', () => {
    it('should return paginated events for MEMBER_STATE user', async () => {
      const events = [eventFixture()];
      prisma.healthEvent.findMany.mockResolvedValue(events);
      prisma.healthEvent.count.mockResolvedValue(1);

      const result = await service.findAll(msUser(), {}, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.healthEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-ke' }),
        }),
      );
    });

    it('should not add tenant filter for CONTINENTAL user', async () => {
      prisma.healthEvent.findMany.mockResolvedValue([]);
      prisma.healthEvent.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {}, {});

      expect(prisma.healthEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ tenantId: expect.anything() }),
        }),
      );
    });

    it('should apply disease and status filters', async () => {
      prisma.healthEvent.findMany.mockResolvedValue([]);
      prisma.healthEvent.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { diseaseId: 'd1', status: 'CONFIRMED' },
      );

      expect(prisma.healthEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            diseaseId: 'd1',
            eventType: 'CONFIRMED',
          }),
        }),
      );
    });

    it('should apply period filters on dateSuspicion', async () => {
      prisma.healthEvent.findMany.mockResolvedValue([]);
      prisma.healthEvent.count.mockResolvedValue(0);

      await service.findAll(
        continentalUser(),
        {},
        { periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      );

      expect(prisma.healthEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dateSuspicion: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.healthEvent.findMany.mockResolvedValue([]);
      prisma.healthEvent.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 }, {});

      expect(result.meta.limit).toBe(100);
    });
  });

  // ── findOne ──

  describe('findOne', () => {
    it('should return event with lab results', async () => {
      prisma.healthEvent.findUnique.mockResolvedValue({
        ...eventFixture(),
        labResults: [{ id: 'lab-001' }],
      });

      const result = await service.findOne('evt-001', msUser());

      expect(result.data.id).toBe('evt-001');
      expect(prisma.healthEvent.findUnique).toHaveBeenCalledWith({
        where: { id: 'evt-001' },
        include: { labResults: true },
      });
    });

    it('should throw NotFoundException for nonexistent event', async () => {
      prisma.healthEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny access to other tenant for MS user', async () => {
      prisma.healthEvent.findUnique.mockResolvedValue(
        eventFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('evt-001', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow CONTINENTAL user to see any event', async () => {
      prisma.healthEvent.findUnique.mockResolvedValue(
        eventFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne('evt-001', continentalUser());
      expect(result.data).toBeDefined();
    });
  });

  // ── update ──

  describe('update', () => {
    it('should update event and publish Kafka event', async () => {
      const updated = eventFixture({ cases: 20 });
      prisma.healthEvent.findUnique.mockResolvedValue(eventFixture());
      prisma.healthEvent.update.mockResolvedValue(updated);

      const result = await service.update('evt-001', { cases: 20 }, msUser());

      expect(result.data.cases).toBe(20);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.health.event.updated.v1',
        'evt-001',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'animal-health-service' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'HealthEvent',
        'evt-001',
        'UPDATE',
        expect.any(Object),
        DataClassification.RESTRICTED,
        expect.objectContaining({
          previousVersion: expect.any(Object),
          newVersion: expect.any(Object),
        }),
      );
    });

    it('should throw NotFoundException for nonexistent event', async () => {
      prisma.healthEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { cases: 5 }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.healthEvent.findUnique.mockResolvedValue(eventFixture());
      prisma.healthEvent.update.mockResolvedValue(eventFixture({ deaths: 10 }));

      await service.update('evt-001', { deaths: 10 }, msUser());

      expect(prisma.healthEvent.update).toHaveBeenCalledWith({
        where: { id: 'evt-001' },
        data: expect.objectContaining({ deaths: 10, updatedBy: 'user-ke' }),
      });
    });
  });

  // ── confirm ──

  describe('confirm', () => {
    it('should confirm a suspect event and publish confirmed + alert events', async () => {
      const confirmed = eventFixture({
        eventType: 'CONFIRMED',
        confidenceLevel: 'CONFIRMED',
        dateConfirmation: new Date(),
      });
      prisma.healthEvent.findUnique.mockResolvedValue(eventFixture());
      prisma.healthEvent.update.mockResolvedValue(confirmed);

      const result = await service.confirm('evt-001', msUser());

      expect(result.data.eventType).toBe('CONFIRMED');
      // Should publish both confirmed and outbreak alert
      expect(kafka.send).toHaveBeenCalledTimes(2);
      expect(kafka.send).toHaveBeenCalledWith(
        'ms.health.event.confirmed.v1',
        'evt-001',
        expect.any(Object),
        expect.any(Object),
      );
      expect(kafka.send).toHaveBeenCalledWith(
        'rec.health.outbreak.alert.v1',
        'evt-001',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should audit as VALIDATE action', async () => {
      prisma.healthEvent.findUnique.mockResolvedValue(eventFixture());
      prisma.healthEvent.update.mockResolvedValue(
        eventFixture({ eventType: 'CONFIRMED' }),
      );

      await service.confirm('evt-001', msUser());

      expect(audit.log).toHaveBeenCalledWith(
        'HealthEvent',
        'evt-001',
        'VALIDATE',
        expect.any(Object),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should throw BadRequestException if already confirmed', async () => {
      prisma.healthEvent.findUnique.mockResolvedValue(
        eventFixture({ eventType: 'CONFIRMED' }),
      );

      await expect(
        service.confirm('evt-001', msUser()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for nonexistent event', async () => {
      prisma.healthEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.confirm('nonexistent', msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── publishOutbreakAlertIfNeeded ──

  describe('publishOutbreakAlertIfNeeded', () => {
    it('should publish alert for CONFIRMED events', async () => {
      await service.publishOutbreakAlertIfNeeded(
        { id: 'evt-001', eventType: 'CONFIRMED', diseaseId: 'd1' },
        msUser(),
      );

      expect(kafka.send).toHaveBeenCalledWith(
        'rec.health.outbreak.alert.v1',
        'evt-001',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should NOT publish alert for SUSPECT events', async () => {
      await service.publishOutbreakAlertIfNeeded(
        { id: 'evt-001', eventType: 'SUSPECT', diseaseId: 'd1' },
        msUser(),
      );

      expect(kafka.send).not.toHaveBeenCalled();
    });
  });
});
