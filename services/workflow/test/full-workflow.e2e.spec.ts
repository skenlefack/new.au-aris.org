import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

/**
 * E2E test — Full 4-level workflow validation with Testcontainers.
 *
 * Tests:
 *  1. Full 4-level approval: L1 → L2 (wahisReady) → L3 → L4 (analyticsReady)
 *  2. Reject at L2 → verify status + Kafka event
 *  3. Return at L3 → drops to L2 → re-approve → L3 → L4
 *  4. RBAC: verify each level only accepts correct roles
 *  5. SLA escalation: overdue instance → cron escalates
 *  6. wahisReady set at L2, analyticsReady set at L4
 *
 * PostgreSQL: real Testcontainer with Prisma schema push
 * Kafka: spy mock captures published events
 */

// ── Container state ──

let pgContainer: StartedTestContainer;
let prisma: PrismaClient;
let databaseUrl: string;

// ── Kafka spy ──

interface CapturedEvent {
  topic: string;
  key: string;
  payload: unknown;
  headers?: unknown;
}

function createKafkaSpy() {
  const events: CapturedEvent[] = [];
  const producer = {
    send: async (topic: string, key: string, payload: unknown, headers?: unknown) => {
      events.push({ topic, key, payload, headers });
      return [];
    },
  };
  return { producer, events };
}

// ── Test users at each workflow level ──

const DATA_STEWARD = {
  userId: '00000000-0000-4000-a000-000000000001',
  email: 'steward@ke.aris.africa',
  role: 'DATA_STEWARD',
  tenantId: '00000000-0000-4000-b000-000000000001',
  tenantLevel: 'MEMBER_STATE',
};

const NATIONAL_ADMIN = {
  userId: '00000000-0000-4000-a000-000000000002',
  email: 'cvo@ke.aris.africa',
  role: 'NATIONAL_ADMIN',
  tenantId: '00000000-0000-4000-b000-000000000001',
  tenantLevel: 'MEMBER_STATE',
};

const WAHIS_FOCAL = {
  userId: '00000000-0000-4000-a000-000000000005',
  email: 'wahis@ke.aris.africa',
  role: 'WAHIS_FOCAL_POINT',
  tenantId: '00000000-0000-4000-b000-000000000001',
  tenantLevel: 'MEMBER_STATE',
};

const REC_ADMIN = {
  userId: '00000000-0000-4000-a000-000000000003',
  email: 'coord@igad.aris.africa',
  role: 'REC_ADMIN',
  tenantId: '00000000-0000-4000-b000-000000000002',
  tenantLevel: 'REC',
};

const CONTINENTAL_ADMIN = {
  userId: '00000000-0000-4000-a000-000000000004',
  email: 'admin@aris.africa',
  role: 'CONTINENTAL_ADMIN',
  tenantId: '00000000-0000-4000-b000-000000000003',
  tenantLevel: 'CONTINENTAL',
};

const FIELD_AGENT = {
  userId: '00000000-0000-4000-a000-000000000006',
  email: 'field@ke.aris.africa',
  role: 'FIELD_AGENT',
  tenantId: '00000000-0000-4000-b000-000000000001',
  tenantLevel: 'MEMBER_STATE',
};

const ANALYST = {
  userId: '00000000-0000-4000-a000-000000000007',
  email: 'analyst@ke.aris.africa',
  role: 'ANALYST',
  tenantId: '00000000-0000-4000-b000-000000000001',
  tenantLevel: 'MEMBER_STATE',
};

// ── Test suite ──

describe('Workflow Full Flow — E2E (Testcontainers)', () => {
  beforeAll(async () => {
    pgContainer = await new GenericContainer('postgres:16-alpine')
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_USER: 'aris',
        POSTGRES_PASSWORD: 'aris',
        POSTGRES_DB: 'aris_test',
      })
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
      .start();

    const pgHost = pgContainer.getHost();
    const pgPort = pgContainer.getMappedPort(5432);
    databaseUrl = `postgresql://aris:aris@${pgHost}:${pgPort}/aris_test`;

    process.env['DATABASE_URL'] = databaseUrl;

    const schemaPath = require
      .resolve('@aris/db-schemas/prisma/schema.prisma')
      .replace(/schema\.prisma$/, '');
    execSync(
      `npx prisma db push --schema=${schemaPath} --skip-generate --accept-data-loss`,
      { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' },
    );

    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await pgContainer?.stop();
  }, 30_000);

  // ── Helpers ──

  async function createWorkflowService(kafkaSpy?: ReturnType<typeof createKafkaSpy>) {
    const { WorkflowService } = await import('../src/instance/workflow.service');
    const spy = kafkaSpy ?? createKafkaSpy();
    const animalHealthClient = { patchEntity: async () => {} };
    return {
      service: new WorkflowService(
        prisma as never,
        spy.producer as never,
        animalHealthClient as never,
      ),
      events: spy.events,
    };
  }

  async function createEscalationService(
    workflowService: InstanceType<Awaited<ReturnType<typeof import('../src/instance/workflow.service')>>['WorkflowService']>,
  ) {
    const { EscalationService } = await import('../src/escalation/escalation.service');
    return new EscalationService(prisma as never, workflowService as never);
  }

  async function createInstanceAtLevel(
    service: Awaited<ReturnType<typeof createWorkflowService>>['service'],
    targetLevel: string,
    entityId?: string,
  ) {
    const id = entityId ?? `00000000-0000-4000-c000-${Date.now().toString(16).padStart(12, '0')}`;

    const created = await service.create(
      { entityType: 'submission', entityId: id, domain: 'health' },
      DATA_STEWARD as never,
    );
    const instanceId = created.data.id;

    // Approve through levels until we reach the target
    if (targetLevel === 'NATIONAL_TECHNICAL') return instanceId;

    await service.approve(instanceId, 'L1 pass', DATA_STEWARD as never);
    if (targetLevel === 'NATIONAL_OFFICIAL') return instanceId;

    await service.approve(instanceId, 'L2 pass', NATIONAL_ADMIN as never);
    if (targetLevel === 'REC_HARMONIZATION') return instanceId;

    await service.approve(instanceId, 'L3 pass', REC_ADMIN as never);
    if (targetLevel === 'CONTINENTAL_PUBLICATION') return instanceId;

    return instanceId;
  }

  // ── 1. Full 4-Level Approval Flow ──

  describe('Full 4-level approval', () => {
    it('create → L1 → L2 (wahisReady) → L3 → L4 (analyticsReady) → APPROVED', async () => {
      const kafkaSpy = createKafkaSpy();
      const { service, events } = await createWorkflowService(kafkaSpy);

      // Create instance
      const created = await service.create(
        { entityType: 'submission', entityId: '00000000-0000-4000-c000-000000000001', domain: 'health' },
        DATA_STEWARD as never,
      );
      expect(created.data.currentLevel).toBe('NATIONAL_TECHNICAL');
      expect(created.data.status).toBe('PENDING');
      expect(created.data.wahisReady).toBe(false);
      expect(created.data.analyticsReady).toBe(false);

      const instanceId = created.data.id;

      // Verify submission event published
      const submitEvents = events.filter((e) => e.topic === 'au.workflow.validation.submitted.v1');
      expect(submitEvents).toHaveLength(1);

      // L1: DATA_STEWARD approves
      const afterL1 = await service.approve(instanceId, 'Quality checks passed', DATA_STEWARD as never);
      expect(afterL1.data.currentLevel).toBe('NATIONAL_OFFICIAL');
      expect(afterL1.data.status).toBe('PENDING');
      expect(afterL1.data.wahisReady).toBe(false);
      expect(afterL1.data.transitions).toHaveLength(1);
      expect(afterL1.data.transitions![0].action).toBe('APPROVE');
      expect(afterL1.data.transitions![0].fromLevel).toBe('NATIONAL_TECHNICAL');
      expect(afterL1.data.transitions![0].toLevel).toBe('NATIONAL_OFFICIAL');

      // L2: NATIONAL_ADMIN approves → wahisReady = true
      const afterL2 = await service.approve(instanceId, 'WAHIS ready', NATIONAL_ADMIN as never);
      expect(afterL2.data.currentLevel).toBe('REC_HARMONIZATION');
      expect(afterL2.data.wahisReady).toBe(true);
      expect(afterL2.data.analyticsReady).toBe(false);

      // Verify WAHIS ready event published
      const wahisEvents = events.filter((e) => e.topic === 'au.workflow.wahis.ready.v1');
      expect(wahisEvents).toHaveLength(1);

      // L3: REC_ADMIN approves
      const afterL3 = await service.approve(instanceId, 'Harmonized', REC_ADMIN as never);
      expect(afterL3.data.currentLevel).toBe('CONTINENTAL_PUBLICATION');
      expect(afterL3.data.wahisReady).toBe(true);
      expect(afterL3.data.analyticsReady).toBe(false);

      // L4: CONTINENTAL_ADMIN approves → analyticsReady = true → APPROVED
      const afterL4 = await service.approve(instanceId, 'Published', CONTINENTAL_ADMIN as never);
      expect(afterL4.data.currentLevel).toBe('CONTINENTAL_PUBLICATION');
      expect(afterL4.data.status).toBe('APPROVED');
      expect(afterL4.data.wahisReady).toBe(true);
      expect(afterL4.data.analyticsReady).toBe(true);
      expect(afterL4.data.transitions).toHaveLength(4);

      // Verify analytics ready event published
      const analyticsEvents = events.filter((e) => e.topic === 'au.workflow.analytics.ready.v1');
      expect(analyticsEvents).toHaveLength(1);

      // Verify approval events (4 total)
      const approvalEvents = events.filter((e) => e.topic === 'au.workflow.validation.approved.v1');
      expect(approvalEvents).toHaveLength(4);

      // Verify final DB state
      const finalRow = await prisma.workflowInstance.findUnique({
        where: { id: instanceId },
        include: { transitions: { orderBy: { created_at: 'asc' } } },
      });
      expect(finalRow!.status).toBe('APPROVED');
      expect(finalRow!.wahis_ready).toBe(true);
      expect(finalRow!.analytics_ready).toBe(true);
      expect(finalRow!.transitions).toHaveLength(4);
    });
  });

  // ── 2. Reject at L2 ──

  describe('Rejection', () => {
    it('reject at L2 → status REJECTED, Kafka rejection event published', async () => {
      const kafkaSpy = createKafkaSpy();
      const { service, events } = await createWorkflowService(kafkaSpy);

      // Create and advance to L2
      const instanceId = await createInstanceAtLevel(service, 'NATIONAL_OFFICIAL');

      // Clear events from setup
      events.length = 0;

      // L2 reject
      const rejected = await service.reject(instanceId, 'Fraudulent data detected', NATIONAL_ADMIN as never);
      expect(rejected.data.status).toBe('REJECTED');
      expect(rejected.data.currentLevel).toBe('NATIONAL_OFFICIAL');

      // Kafka rejection event
      const rejectEvents = events.filter((e) => e.topic === 'au.workflow.validation.rejected.v1');
      expect(rejectEvents).toHaveLength(1);

      // Cannot approve after rejection
      await expect(
        service.approve(instanceId, 'Try again', NATIONAL_ADMIN as never),
      ).rejects.toThrow(/Cannot transition workflow in status REJECTED/);

      // Cannot return after rejection
      await expect(
        service.returnForCorrection(instanceId, 'Fix it', NATIONAL_ADMIN as never),
      ).rejects.toThrow(/Cannot transition workflow in status REJECTED/);

      // DB state
      const dbRow = await prisma.workflowInstance.findUnique({ where: { id: instanceId } });
      expect(dbRow!.status).toBe('REJECTED');
    });
  });

  // ── 3. Return at L3 ──

  describe('Return for correction', () => {
    it('return at L3 → drops to L2 → re-approve → L3 → L4 → APPROVED', async () => {
      const { service } = await createWorkflowService();

      // Create and advance to L3
      const instanceId = await createInstanceAtLevel(service, 'REC_HARMONIZATION');

      // L3: REC_ADMIN returns for correction → drops to L2
      const returned = await service.returnForCorrection(
        instanceId,
        'Cross-border discrepancy found',
        REC_ADMIN as never,
      );
      expect(returned.data.currentLevel).toBe('NATIONAL_OFFICIAL');
      expect(returned.data.status).toBe('RETURNED');
      expect(returned.data.wahisReady).toBe(true); // wahisReady stays true from L2 approval

      // L2: NATIONAL_ADMIN re-approves → back to L3
      const reApproved = await service.approve(instanceId, 'Discrepancy resolved', NATIONAL_ADMIN as never);
      expect(reApproved.data.currentLevel).toBe('REC_HARMONIZATION');
      expect(reApproved.data.status).toBe('PENDING');

      // L3: REC_ADMIN approves → L4
      const afterL3 = await service.approve(instanceId, 'Harmonized', REC_ADMIN as never);
      expect(afterL3.data.currentLevel).toBe('CONTINENTAL_PUBLICATION');

      // L4: CONTINENTAL_ADMIN approves → APPROVED
      const afterL4 = await service.approve(instanceId, 'Published', CONTINENTAL_ADMIN as never);
      expect(afterL4.data.status).toBe('APPROVED');
      expect(afterL4.data.analyticsReady).toBe(true);

      // Verify transitions include the RETURN
      const transitions = afterL4.data.transitions!;
      const returnTransition = transitions.find((t) => t.action === 'RETURN');
      expect(returnTransition).toBeDefined();
      expect(returnTransition!.fromLevel).toBe('REC_HARMONIZATION');
      expect(returnTransition!.toLevel).toBe('NATIONAL_OFFICIAL');
    });

    it('return at L2 → drops to L1 → re-approve through L2', async () => {
      const { service } = await createWorkflowService();

      // Create and advance to L2
      const instanceId = await createInstanceAtLevel(service, 'NATIONAL_OFFICIAL');

      // L2 returns → drops to L1
      const returned = await service.returnForCorrection(
        instanceId,
        'Missing GPS coordinates',
        NATIONAL_ADMIN as never,
      );
      expect(returned.data.currentLevel).toBe('NATIONAL_TECHNICAL');
      expect(returned.data.status).toBe('RETURNED');

      // L1 re-approves
      const reApproved = await service.approve(instanceId, 'GPS data added', DATA_STEWARD as never);
      expect(reApproved.data.currentLevel).toBe('NATIONAL_OFFICIAL');
      expect(reApproved.data.status).toBe('PENDING');

      // L2 approves → wahisReady
      const afterL2 = await service.approve(instanceId, 'Now complete', NATIONAL_ADMIN as never);
      expect(afterL2.data.currentLevel).toBe('REC_HARMONIZATION');
      expect(afterL2.data.wahisReady).toBe(true);
    });
  });

  // ── 4. RBAC per level ──

  describe('RBAC enforcement', () => {
    it('FIELD_AGENT cannot approve at L1 (NATIONAL_TECHNICAL)', async () => {
      const { service } = await createWorkflowService();
      const instanceId = await createInstanceAtLevel(service, 'NATIONAL_TECHNICAL');

      await expect(
        service.approve(instanceId, 'Attempt', FIELD_AGENT as never),
      ).rejects.toThrow(/Role FIELD_AGENT cannot act at workflow level NATIONAL_TECHNICAL/);
    });

    it('DATA_STEWARD cannot approve at L2 (NATIONAL_OFFICIAL)', async () => {
      const { service } = await createWorkflowService();
      const instanceId = await createInstanceAtLevel(service, 'NATIONAL_OFFICIAL');

      await expect(
        service.approve(instanceId, 'Attempt', DATA_STEWARD as never),
      ).rejects.toThrow(/Role DATA_STEWARD cannot act at workflow level NATIONAL_OFFICIAL/);
    });

    it('WAHIS_FOCAL_POINT can approve at L2 (NATIONAL_OFFICIAL)', async () => {
      const { service } = await createWorkflowService();
      const instanceId = await createInstanceAtLevel(service, 'NATIONAL_OFFICIAL');

      const result = await service.approve(instanceId, 'WAHIS approved', WAHIS_FOCAL as never);
      expect(result.data.currentLevel).toBe('REC_HARMONIZATION');
      expect(result.data.wahisReady).toBe(true);
    });

    it('NATIONAL_ADMIN cannot approve at L3 (REC_HARMONIZATION)', async () => {
      const { service } = await createWorkflowService();
      const instanceId = await createInstanceAtLevel(service, 'REC_HARMONIZATION');

      await expect(
        service.approve(instanceId, 'Attempt', NATIONAL_ADMIN as never),
      ).rejects.toThrow(/Role NATIONAL_ADMIN cannot act at workflow level REC_HARMONIZATION/);
    });

    it('REC_ADMIN cannot approve at L4 (CONTINENTAL_PUBLICATION)', async () => {
      const { service } = await createWorkflowService();
      const instanceId = await createInstanceAtLevel(service, 'CONTINENTAL_PUBLICATION');

      await expect(
        service.approve(instanceId, 'Attempt', REC_ADMIN as never),
      ).rejects.toThrow(/Role REC_ADMIN cannot act at workflow level CONTINENTAL_PUBLICATION/);
    });

    it('ANALYST cannot approve at any level', async () => {
      const { service } = await createWorkflowService();
      const instanceId = await createInstanceAtLevel(service, 'NATIONAL_TECHNICAL');

      await expect(
        service.approve(instanceId, 'Attempt', ANALYST as never),
      ).rejects.toThrow(/Role ANALYST cannot act at workflow level/);
    });
  });

  // ── 5. SLA Escalation ──

  describe('SLA escalation', () => {
    it('overdue instance is escalated by EscalationService', async () => {
      const kafkaSpy = createKafkaSpy();
      const { service, events } = await createWorkflowService(kafkaSpy);

      // Create instance at L1
      const created = await service.create(
        { entityType: 'submission', entityId: '00000000-0000-4000-c000-e5ca1a7e0001', domain: 'health' },
        DATA_STEWARD as never,
      );
      const instanceId = created.data.id;

      // Set SLA deadline to the past (manually via Prisma)
      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { sla_deadline: new Date(Date.now() - 86_400_000) }, // 1 day ago
      });

      // Clear events from creation
      events.length = 0;

      // Run escalation check
      const escalationService = await createEscalationService(service);
      const escalatedCount = await escalationService.checkOverdueInstances();

      expect(escalatedCount).toBeGreaterThanOrEqual(1);

      // Verify instance was escalated: L1 → L2, status ESCALATED
      const dbRow = await prisma.workflowInstance.findUnique({
        where: { id: instanceId },
        include: { transitions: { orderBy: { created_at: 'asc' } } },
      });
      expect(dbRow!.status).toBe('ESCALATED');
      expect(dbRow!.current_level).toBe('NATIONAL_OFFICIAL');

      // Verify escalation transition
      const escalateTransition = dbRow!.transitions.find((t) => t.action === 'ESCALATE');
      expect(escalateTransition).toBeDefined();
      expect(escalateTransition!.from_level).toBe('NATIONAL_TECHNICAL');
      expect(escalateTransition!.to_level).toBe('NATIONAL_OFFICIAL');
      expect(escalateTransition!.comment).toContain('SLA deadline breached');
      expect(escalateTransition!.actor_role).toBe('SYSTEM');

      // Verify escalation Kafka event published
      const escalationEvents = events.filter((e) => e.topic === 'au.workflow.validation.escalated.v1');
      expect(escalationEvents).toHaveLength(1);
    });

    it('escalation advances to next level from L2', async () => {
      const { service } = await createWorkflowService();

      // Create and advance to L2
      const instanceId = await createInstanceAtLevel(service, 'NATIONAL_OFFICIAL');

      // Set SLA deadline to past
      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { sla_deadline: new Date(Date.now() - 3_600_000) },
      });

      const escalationService = await createEscalationService(service);
      await escalationService.checkOverdueInstances();

      const dbRow = await prisma.workflowInstance.findUnique({ where: { id: instanceId } });
      expect(dbRow!.status).toBe('ESCALATED');
      expect(dbRow!.current_level).toBe('REC_HARMONIZATION');
    });

    it('does not escalate non-overdue instances', async () => {
      const { service } = await createWorkflowService();

      const created = await service.create(
        { entityType: 'submission', entityId: '00000000-0000-4000-c000-e5ca1a7e0003', domain: 'health' },
        DATA_STEWARD as never,
      );

      // Set SLA deadline to the future
      await prisma.workflowInstance.update({
        where: { id: created.data.id },
        data: { sla_deadline: new Date(Date.now() + 86_400_000 * 7) },
      });

      const escalationService = await createEscalationService(service);
      const before = await prisma.workflowInstance.findUnique({
        where: { id: created.data.id },
      });

      await escalationService.checkOverdueInstances();

      const after = await prisma.workflowInstance.findUnique({
        where: { id: created.data.id },
      });
      expect(after!.status).toBe(before!.status);
      expect(after!.current_level).toBe(before!.current_level);
    });
  });

  // ── 6. Dashboard ──

  describe('Dashboard metrics', () => {
    it('reflects aggregate counts across test instances', async () => {
      const { service } = await createWorkflowService();

      const dashboard = await service.getDashboard(CONTINENTAL_ADMIN as never);

      // We created multiple instances across tests — verify counts are positive
      expect(dashboard.data.totalApproved).toBeGreaterThanOrEqual(1);
      expect(dashboard.data.totalRejected).toBeGreaterThanOrEqual(1);
      expect(dashboard.data.totalEscalated).toBeGreaterThanOrEqual(1);
      expect(dashboard.data.wahisReadyCount).toBeGreaterThanOrEqual(1);
      expect(dashboard.data.analyticsReadyCount).toBeGreaterThanOrEqual(1);
      expect(dashboard.data.totalPending).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 7. Auto-advance Level 1 ──

  describe('Auto-advance Level 1', () => {
    it('autoAdvanceLevel1 moves instance from L1 to L2 with SYSTEM actor', async () => {
      const { service } = await createWorkflowService();

      const created = await service.create(
        { entityType: 'submission', entityId: '00000000-0000-4000-c000-aa7000000001', domain: 'health' },
        DATA_STEWARD as never,
      );
      expect(created.data.currentLevel).toBe('NATIONAL_TECHNICAL');

      // Simulate quality validation event → auto-advance
      const qualityReportId = '00000000-0000-4000-f000-000000000001';
      await service.autoAdvanceLevel1(created.data.entityId, qualityReportId);

      // Verify advanced to L2
      const dbRow = await prisma.workflowInstance.findUnique({
        where: { id: created.data.id },
        include: { transitions: { orderBy: { created_at: 'asc' } } },
      });
      expect(dbRow!.current_level).toBe('NATIONAL_OFFICIAL');
      expect(dbRow!.status).toBe('PENDING');
      expect(dbRow!.quality_report_id).toBe(qualityReportId);

      // Verify SYSTEM auto-approve transition
      expect(dbRow!.transitions).toHaveLength(1);
      expect(dbRow!.transitions[0].action).toBe('APPROVE');
      expect(dbRow!.transitions[0].actor_role).toBe('SYSTEM');
      expect(dbRow!.transitions[0].comment).toContain('Auto-approved');
    });
  });
});
