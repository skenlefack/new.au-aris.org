import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { WorkflowService } from '../workflow.service';
import { TenantLevel, UserRole, WorkflowLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// ── Mock factories ──

function mockPrismaService() {
  return {
    workflowInstance: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    workflowTransition: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

function mockKafkaProducer() {
  return {
    send: vi.fn().mockResolvedValue([]),
  };
}

function dataSteward(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-steward-ke',
    email: 'steward@ke.au-aris.org',
    role: UserRole.DATA_STEWARD,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

function nationalAdmin(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-cvo-ke',
    email: 'cvo@ke.au-aris.org',
    role: UserRole.NATIONAL_ADMIN,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

function recAdmin(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-igad',
    email: 'coord@igad.au-aris.org',
    role: UserRole.REC_ADMIN,
    tenantId: 'tenant-igad',
    tenantLevel: TenantLevel.REC,
    ...overrides,
  };
}

function continentalAdmin(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-au',
    email: 'admin@au-aris.org',
    role: UserRole.CONTINENTAL_ADMIN,
    tenantId: 'tenant-au',
    tenantLevel: TenantLevel.CONTINENTAL,
    ...overrides,
  };
}

function superAdmin(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-super',
    email: 'super@au-aris.org',
    role: UserRole.SUPER_ADMIN,
    tenantId: 'tenant-au',
    tenantLevel: TenantLevel.CONTINENTAL,
    ...overrides,
  };
}

function analyst(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-analyst',
    email: 'analyst@ke.au-aris.org',
    role: UserRole.ANALYST,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

function instanceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wf-1',
    tenant_id: 'tenant-ke',
    entity_type: 'submission',
    entity_id: 'sub-1',
    domain: 'health',
    current_level: 'NATIONAL_TECHNICAL',
    status: 'PENDING',
    data_contract_id: null,
    quality_report_id: null,
    wahis_ready: false,
    analytics_ready: false,
    sla_deadline: null,
    created_by: 'user-ke',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  };
}

function instanceWithTransitions(overrides: Record<string, unknown> = {}) {
  return {
    ...instanceFixture(overrides),
    transitions: [],
    ...(overrides.transitions !== undefined ? { transitions: overrides.transitions } : {}),
  };
}

// ── Tests ──

function mockEventPublisher() {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
  };
}

describe('WorkflowService', () => {
  let service: WorkflowService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let eventPublisher: ReturnType<typeof mockEventPublisher>;

  beforeEach(() => {
    prisma = mockPrismaService();
    kafka = mockKafkaProducer();
    eventPublisher = mockEventPublisher();
    service = new WorkflowService(prisma as never, kafka as never, eventPublisher as never);
  });

  // ── create ──

  describe('create', () => {
    it('should create a workflow instance at NATIONAL_TECHNICAL level', async () => {
      prisma.workflowInstance.create.mockResolvedValue(instanceFixture());

      const result = await service.create(
        { entityType: 'submission', entityId: 'sub-1', domain: 'health' },
        dataSteward(),
      );

      expect(result.data.currentLevel).toBe('NATIONAL_TECHNICAL');
      expect(result.data.status).toBe('PENDING');
      expect(kafka.send).toHaveBeenCalledWith(
        'au.workflow.validation.submitted.v1',
        'wf-1',
        expect.anything(),
        expect.objectContaining({ sourceService: 'workflow-service' }),
      );
    });

    it('should not fail if Kafka publish errors', async () => {
      prisma.workflowInstance.create.mockResolvedValue(instanceFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        { entityType: 'submission', entityId: 'sub-1', domain: 'health' },
        dataSteward(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // ── approve ──

  describe('approve', () => {
    it('should advance from NATIONAL_TECHNICAL to NATIONAL_OFFICIAL', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({ current_level: 'NATIONAL_TECHNICAL', status: 'PENDING' }),
      );

      const updated = instanceWithTransitions({
        current_level: 'NATIONAL_OFFICIAL',
        status: 'PENDING',
      });
      prisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.approve('wf-1', 'Looks good', dataSteward());

      expect(result.data.currentLevel).toBe('NATIONAL_OFFICIAL');
      expect(result.data.status).toBe('PENDING');
      expect(kafka.send).toHaveBeenCalledWith(
        'au.workflow.validation.approved.v1',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should set wahisReady=true when Level 2 (NATIONAL_OFFICIAL) is approved', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({ current_level: 'NATIONAL_OFFICIAL', status: 'PENDING', tenant_id: 'tenant-ke' }),
      );

      const updated = instanceWithTransitions({
        current_level: 'REC_HARMONIZATION',
        status: 'PENDING',
        wahis_ready: true,
      });
      prisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.approve('wf-1', undefined, nationalAdmin());

      expect(result.data.wahisReady).toBe(true);
      // Should publish approval event + WAHIS ready event via kafkaProducer.send
      expect(kafka.send).toHaveBeenCalledWith(
        'au.workflow.wahis.ready.v1',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      // Should also publish typed flag event via eventPublisher
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'au.workflow.wahis.ready.v1',
        expect.objectContaining({ payload: expect.objectContaining({ flag: 'wahisReady' }) }),
        expect.anything(),
      );
    });

    it('should set analyticsReady=true when Level 4 (CONTINENTAL_PUBLICATION) is approved', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({
          current_level: 'CONTINENTAL_PUBLICATION',
          status: 'PENDING',
          wahis_ready: true,
          tenant_id: 'tenant-au',
        }),
      );

      const updated = instanceWithTransitions({
        current_level: 'CONTINENTAL_PUBLICATION',
        status: 'APPROVED',
        wahis_ready: true,
        analytics_ready: true,
      });
      prisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.approve('wf-1', 'Published', continentalAdmin());

      expect(result.data.analyticsReady).toBe(true);
      expect(result.data.status).toBe('APPROVED');
      expect(kafka.send).toHaveBeenCalledWith(
        'au.workflow.analytics.ready.v1',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should throw NotFoundException for nonexistent instance', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(null);

      await expect(
        service.approve('nonexistent', undefined, dataSteward()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when instance is REJECTED', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({ status: 'REJECTED' }),
      );

      await expect(
        service.approve('wf-1', undefined, dataSteward()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when instance is already APPROVED', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({ status: 'APPROVED' }),
      );

      await expect(
        service.approve('wf-1', undefined, dataSteward()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow action on RETURNED instances', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({ status: 'RETURNED' }),
      );

      const updated = instanceWithTransitions({
        current_level: 'NATIONAL_OFFICIAL',
        status: 'PENDING',
      });
      prisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.approve('wf-1', 'Fixed', dataSteward());
      expect(result.data).toBeDefined();
    });

    it('should allow action on ESCALATED instances', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({ status: 'ESCALATED' }),
      );

      const updated = instanceWithTransitions({
        current_level: 'NATIONAL_OFFICIAL',
        status: 'PENDING',
      });
      prisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.approve('wf-1', 'Resolving escalation', dataSteward());
      expect(result.data).toBeDefined();
    });
  });

  // ── reject ──

  describe('reject', () => {
    it('should reject an instance with mandatory reason', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({ status: 'PENDING' }),
      );

      const updated = instanceWithTransitions({ status: 'REJECTED' });
      prisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.reject('wf-1', 'Data quality insufficient', dataSteward());

      expect(result.data.status).toBe('REJECTED');
      expect(kafka.send).toHaveBeenCalledWith(
        'au.workflow.validation.rejected.v1',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should throw NotFoundException for nonexistent instance', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(null);

      await expect(
        service.reject('nonexistent', 'reason', dataSteward()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── return ──

  describe('returnForCorrection', () => {
    it('should return instance to previous level', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({
          current_level: 'NATIONAL_OFFICIAL',
          status: 'PENDING',
        }),
      );

      const updated = instanceWithTransitions({
        current_level: 'NATIONAL_TECHNICAL',
        status: 'RETURNED',
      });
      prisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.returnForCorrection(
        'wf-1',
        'Missing GPS data',
        nationalAdmin(),
      );

      expect(result.data.currentLevel).toBe('NATIONAL_TECHNICAL');
      expect(result.data.status).toBe('RETURNED');
    });

    it('should stay at NATIONAL_TECHNICAL when returning from Level 1', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({
          current_level: 'NATIONAL_TECHNICAL',
          status: 'PENDING',
        }),
      );

      const updated = instanceWithTransitions({
        current_level: 'NATIONAL_TECHNICAL',
        status: 'RETURNED',
      });
      prisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.returnForCorrection(
        'wf-1',
        'Resubmit corrected data',
        dataSteward(),
      );

      expect(result.data.currentLevel).toBe('NATIONAL_TECHNICAL');
    });

    it('should return from REC_HARMONIZATION to NATIONAL_OFFICIAL', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({
          current_level: 'REC_HARMONIZATION',
          status: 'PENDING',
          tenant_id: 'tenant-igad',
        }),
      );

      const updated = instanceWithTransitions({
        current_level: 'NATIONAL_OFFICIAL',
        status: 'RETURNED',
      });
      prisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.returnForCorrection(
        'wf-1',
        'Cross-border inconsistency',
        recAdmin(),
      );

      expect(result.data.currentLevel).toBe('NATIONAL_OFFICIAL');
    });
  });

  // ── escalate ──

  describe('escalate', () => {
    it('should escalate to next level', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({ status: 'PENDING' }),
      );
      prisma.$transaction.mockResolvedValue([{}, {}]);

      await service.escalate('wf-1', 'SLA breach');

      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'au.workflow.validation.escalated.v1',
        'wf-1',
        expect.objectContaining({ reason: 'SLA breach' }),
        expect.anything(),
      );
    });

    it('should skip already approved instances', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({ status: 'APPROVED' }),
      );

      await service.escalate('wf-1', 'SLA breach');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should skip already rejected instances', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({ status: 'REJECTED' }),
      );

      await service.escalate('wf-1', 'SLA breach');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── RBAC checks ──

  describe('RBAC per level', () => {
    describe('Level 1 (NATIONAL_TECHNICAL)', () => {
      it('should allow DATA_STEWARD', () => {
        expect(() => service.verifyRoleForLevel(dataSteward(), 'NATIONAL_TECHNICAL'))
          .not.toThrow();
      });

      it('should allow NATIONAL_ADMIN', () => {
        expect(() => service.verifyRoleForLevel(nationalAdmin(), 'NATIONAL_TECHNICAL'))
          .not.toThrow();
      });

      it('should deny ANALYST', () => {
        expect(() => service.verifyRoleForLevel(analyst(), 'NATIONAL_TECHNICAL'))
          .toThrow(ForbiddenException);
      });

      it('should deny REC_ADMIN', () => {
        expect(() => service.verifyRoleForLevel(recAdmin(), 'NATIONAL_TECHNICAL'))
          .toThrow(ForbiddenException);
      });
    });

    describe('Level 2 (NATIONAL_OFFICIAL)', () => {
      it('should allow NATIONAL_ADMIN', () => {
        expect(() => service.verifyRoleForLevel(nationalAdmin(), 'NATIONAL_OFFICIAL'))
          .not.toThrow();
      });

      it('should allow WAHIS_FOCAL_POINT', () => {
        const wahis: AuthenticatedUser = {
          userId: 'user-wahis',
          email: 'wahis@ke.au-aris.org',
          role: UserRole.WAHIS_FOCAL_POINT,
          tenantId: 'tenant-ke',
          tenantLevel: TenantLevel.MEMBER_STATE,
        };
        expect(() => service.verifyRoleForLevel(wahis, 'NATIONAL_OFFICIAL'))
          .not.toThrow();
      });

      it('should deny DATA_STEWARD', () => {
        expect(() => service.verifyRoleForLevel(dataSteward(), 'NATIONAL_OFFICIAL'))
          .toThrow(ForbiddenException);
      });
    });

    describe('Level 3 (REC_HARMONIZATION)', () => {
      it('should allow REC_ADMIN', () => {
        expect(() => service.verifyRoleForLevel(recAdmin(), 'REC_HARMONIZATION'))
          .not.toThrow();
      });

      it('should allow DATA_STEWARD (REC level)', () => {
        expect(() => service.verifyRoleForLevel(dataSteward(), 'REC_HARMONIZATION'))
          .not.toThrow();
      });

      it('should deny NATIONAL_ADMIN', () => {
        expect(() => service.verifyRoleForLevel(nationalAdmin(), 'REC_HARMONIZATION'))
          .toThrow(ForbiddenException);
      });
    });

    describe('Level 4 (CONTINENTAL_PUBLICATION)', () => {
      it('should allow CONTINENTAL_ADMIN', () => {
        expect(() => service.verifyRoleForLevel(continentalAdmin(), 'CONTINENTAL_PUBLICATION'))
          .not.toThrow();
      });

      it('should allow SUPER_ADMIN', () => {
        expect(() => service.verifyRoleForLevel(superAdmin(), 'CONTINENTAL_PUBLICATION'))
          .not.toThrow();
      });

      it('should deny REC_ADMIN', () => {
        expect(() => service.verifyRoleForLevel(recAdmin(), 'CONTINENTAL_PUBLICATION'))
          .toThrow(ForbiddenException);
      });

      it('should deny NATIONAL_ADMIN', () => {
        expect(() => service.verifyRoleForLevel(nationalAdmin(), 'CONTINENTAL_PUBLICATION'))
          .toThrow(ForbiddenException);
      });
    });
  });

  // ── findAll ──

  describe('findAll', () => {
    it('should return instances with pagination', async () => {
      prisma.workflowInstance.findMany.mockResolvedValue([instanceFixture()]);
      prisma.workflowInstance.count.mockResolvedValue(1);

      const result = await service.findAll(continentalAdmin(), {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should filter by level and status', async () => {
      prisma.workflowInstance.findMany.mockResolvedValue([]);
      prisma.workflowInstance.count.mockResolvedValue(0);

      await service.findAll(continentalAdmin(), {
        level: 'NATIONAL_TECHNICAL',
        status: 'PENDING',
        domain: 'health',
      });

      expect(prisma.workflowInstance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            current_level: 'NATIONAL_TECHNICAL',
            status: 'PENDING',
            domain: 'health',
          }),
        }),
      );
    });
  });

  // ── findOne ──

  describe('findOne', () => {
    it('should return instance with transitions', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceWithTransitions({
          transitions: [
            {
              id: 'tr-1',
              instance_id: 'wf-1',
              from_level: 'NATIONAL_TECHNICAL',
              to_level: 'NATIONAL_OFFICIAL',
              from_status: 'PENDING',
              to_status: 'PENDING',
              action: 'APPROVE',
              actor_user_id: 'user-steward',
              actor_role: 'DATA_STEWARD',
              comment: null,
              created_at: new Date(),
            },
          ],
        }),
      );

      const result = await service.findOne('wf-1', continentalAdmin());

      expect(result.data.transitions).toHaveLength(1);
      expect(result.data.transitions![0].action).toBe('APPROVE');
    });

    it('should throw NotFoundException for nonexistent instance', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', continentalAdmin()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny MS user access to another tenant instance', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceWithTransitions({ tenant_id: 'tenant-ng' }),
      );

      await expect(
        service.findOne('wf-1', dataSteward()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Tenant access ──

  describe('tenant access', () => {
    it('should allow CONTINENTAL to access any tenant', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceWithTransitions({ tenant_id: 'tenant-ng' }),
      );

      const result = await service.findOne('wf-1', continentalAdmin());
      expect(result.data).toBeDefined();
    });

    it('should allow user to access own tenant', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceWithTransitions({ tenant_id: 'tenant-ke' }),
      );

      const result = await service.findOne('wf-1', dataSteward());
      expect(result.data).toBeDefined();
    });
  });

  // ── Domain service callbacks ──

  describe('domain service callbacks via events', () => {
    it('should publish wahisReady event when Level 2 approved', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({
          current_level: 'NATIONAL_OFFICIAL',
          status: 'PENDING',
          tenant_id: 'tenant-ke',
        }),
      );

      const updated = instanceWithTransitions({
        current_level: 'REC_HARMONIZATION',
        status: 'PENDING',
        wahis_ready: true,
      });
      prisma.$transaction.mockResolvedValue([updated, {}]);

      await service.approve('wf-1', undefined, nationalAdmin());

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'au.workflow.wahis.ready.v1',
        expect.objectContaining({
          payload: expect.objectContaining({
            entityType: 'submission',
            entityId: 'sub-1',
            flag: 'wahisReady',
          }),
        }),
        expect.anything(),
      );
    });

    it('should publish analyticsReady event when Level 4 approved', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({
          current_level: 'CONTINENTAL_PUBLICATION',
          status: 'PENDING',
          wahis_ready: true,
          tenant_id: 'tenant-au',
        }),
      );

      const updated = instanceWithTransitions({
        current_level: 'CONTINENTAL_PUBLICATION',
        status: 'APPROVED',
        wahis_ready: true,
        analytics_ready: true,
      });
      prisma.$transaction.mockResolvedValue([updated, {}]);

      await service.approve('wf-1', 'Published', continentalAdmin());

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'au.workflow.analytics.ready.v1',
        expect.objectContaining({
          payload: expect.objectContaining({
            entityType: 'submission',
            entityId: 'sub-1',
            flag: 'analyticsReady',
          }),
        }),
        expect.anything(),
      );
    });

    it('should NOT fail workflow approval if event publishing fails', async () => {
      eventPublisher.publish.mockRejectedValue(new Error('Kafka unavailable'));

      prisma.workflowInstance.findUnique.mockResolvedValue(
        instanceFixture({
          current_level: 'NATIONAL_OFFICIAL',
          status: 'PENDING',
          tenant_id: 'tenant-ke',
        }),
      );

      const updated = instanceWithTransitions({
        current_level: 'REC_HARMONIZATION',
        status: 'PENDING',
        wahis_ready: true,
      });
      prisma.$transaction.mockResolvedValue([updated, {}]);

      // Should not throw
      const result = await service.approve('wf-1', undefined, nationalAdmin());
      expect(result.data.wahisReady).toBe(true);
    });
  });

  // ── autoAdvanceLevel1 ──

  describe('autoAdvanceLevel1', () => {
    it('should auto-advance Level 1 when quality passes', async () => {
      prisma.workflowInstance.findFirst.mockResolvedValue(
        instanceFixture({
          current_level: 'NATIONAL_TECHNICAL',
          status: 'PENDING',
        }),
      );
      prisma.$transaction.mockResolvedValue([{}, {}]);

      await service.autoAdvanceLevel1('sub-1', 'qr-001');

      expect(prisma.$transaction).toHaveBeenCalledOnce();
    });

    it('should skip if no pending Level 1 instance found', async () => {
      prisma.workflowInstance.findFirst.mockResolvedValue(null);

      await service.autoAdvanceLevel1('sub-1', 'qr-001');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should query for NATIONAL_TECHNICAL level with actionable status', async () => {
      prisma.workflowInstance.findFirst.mockResolvedValue(null);

      await service.autoAdvanceLevel1('sub-1', 'qr-001');

      expect(prisma.workflowInstance.findFirst).toHaveBeenCalledWith({
        where: {
          entity_id: 'sub-1',
          current_level: 'NATIONAL_TECHNICAL',
          status: { in: ['PENDING', 'IN_REVIEW', 'RETURNED'] },
        },
      });
    });
  });

  // ── toEntity mapping ──

  describe('toEntity', () => {
    it('should map snake_case to camelCase', () => {
      const entity = service.toEntity(instanceFixture());

      expect(entity.tenantId).toBe('tenant-ke');
      expect(entity.entityType).toBe('submission');
      expect(entity.entityId).toBe('sub-1');
      expect(entity.currentLevel).toBe('NATIONAL_TECHNICAL');
      expect(entity.wahisReady).toBe(false);
      expect(entity.analyticsReady).toBe(false);
    });
  });
});
