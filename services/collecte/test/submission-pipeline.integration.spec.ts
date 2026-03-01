/**
 * E2E Pipeline Test: Submission → Quality → Workflow → Domain Callback
 *
 * Tests the full cross-service pipeline using event-driven architecture:
 *   1. Create campaign + submit form data
 *   2. Quality validation request published to Kafka
 *   3. Simulate quality PASSED/FAILED callback → triggers workflow creation event
 *   4. Simulate workflow created callback → links workflow to submission
 *   5. Workflow 4-level approval → publishes flag-ready events (wahisReady, analyticsReady)
 *   6. Graceful degradation when Kafka publishing fails
 *
 * SubmissionService (collecte/Fastify) publishes events via Kafka.
 * WorkflowService (workflow/NestJS) publishes flag-ready events via EventPublisher.
 * No synchronous inter-service REST calls — all communication is async via Kafka.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TenantLevel,
  UserRole,
  DataClassification,
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
  TOPIC_AU_WORKFLOW_VALIDATION_SUBMITTED,
  TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
  TOPIC_AU_WORKFLOW_WAHIS_READY,
  TOPIC_AU_WORKFLOW_ANALYTICS_READY,
} from '@aris/shared-types';
import { EVENTS } from '@aris/kafka-client';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { SubmissionService } from '../src/services/submission.service';
import { WorkflowService } from '../../workflow/src/instance/workflow.service';

// ── Test users (one per workflow level RBAC requirement) ──

const TENANT_ID = '00000000-0000-0000-0000-000000000010';
const REC_TENANT_ID = '00000000-0000-0000-0000-000000000020';
const AU_TENANT_ID = '00000000-0000-0000-0000-000000000030';

const fieldAgent: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'agent@ke.gov',
  role: UserRole.FIELD_AGENT,
  tenantId: TENANT_ID,
  tenantLevel: TenantLevel.MEMBER_STATE,
};

const dataSteward: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000002',
  email: 'steward@ke.gov',
  role: UserRole.DATA_STEWARD,
  tenantId: TENANT_ID,
  tenantLevel: TenantLevel.MEMBER_STATE,
};

const nationalAdmin: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000003',
  email: 'cvo@ke.gov',
  role: UserRole.NATIONAL_ADMIN,
  tenantId: TENANT_ID,
  tenantLevel: TenantLevel.MEMBER_STATE,
};

// Note: REC and AU users use CONTINENTAL tenantLevel to bypass the simplified
// tenant access check (no parent-child resolution in mocks). RBAC still validates roles.
const recAdmin: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000004',
  email: 'coord@igad.int',
  role: UserRole.REC_ADMIN,
  tenantId: REC_TENANT_ID,
  tenantLevel: TenantLevel.CONTINENTAL,
};

const continentalAdmin: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000005',
  email: 'officer@au-aris.org',
  role: UserRole.CONTINENTAL_ADMIN,
  tenantId: AU_TENANT_ID,
  tenantLevel: TenantLevel.CONTINENTAL,
};

// ── In-memory stores ──

let submissions: any[] = [];
let campaigns: any[] = [];
let workflowInstances: any[] = [];
let workflowTransitions: any[] = [];
let idCounter = 0;

function uuid(): string {
  idCounter++;
  return `e2e-${String(idCounter).padStart(8, '0')}`;
}

// ── Mock Prisma for collecte ──

function createCollectePrisma() {
  return {
    campaign: {
      create: vi.fn().mockImplementation(({ data }) => {
        const c = { id: uuid(), ...data, createdAt: new Date(), updatedAt: new Date() };
        campaigns.push(c);
        return Promise.resolve(c);
      }),
      findUnique: vi.fn().mockImplementation(({ where, select }) => {
        const c = campaigns.find((x) => x.id === where.id);
        if (!c) return Promise.resolve(null);
        if (select) {
          const filtered: any = {};
          for (const key of Object.keys(select)) filtered[key] = c[key];
          return Promise.resolve(filtered);
        }
        return Promise.resolve(c);
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const c = campaigns.find((x) => x.id === where.id);
        if (c) Object.assign(c, data, { updatedAt: new Date() });
        return Promise.resolve(c);
      }),
    },
    submission: {
      create: vi.fn().mockImplementation(({ data }) => {
        const s = {
          id: data.id ?? uuid(),
          ...data,
          qualityReportId: data.qualityReportId ?? null,
          workflowInstanceId: data.workflowInstanceId ?? null,
          version: data.version ?? 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        submissions.push(s);
        return Promise.resolve(s);
      }),
      findUnique: vi.fn().mockImplementation(({ where }) =>
        Promise.resolve(submissions.find((s) => s.id === where.id) ?? null),
      ),
      findMany: vi.fn().mockImplementation(({ where, skip, take, orderBy }) => {
        let filtered = [...submissions];
        if (where?.tenantId) filtered = filtered.filter((s) => s.tenantId === where.tenantId);
        if (where?.campaignId) filtered = filtered.filter((s) => s.campaignId === where.campaignId);
        return Promise.resolve(filtered.slice(skip ?? 0, (skip ?? 0) + (take ?? 100)));
      }),
      count: vi.fn().mockImplementation(({ where }) => {
        let filtered = [...submissions];
        if (where?.tenantId) filtered = filtered.filter((s) => s.tenantId === where.tenantId);
        return Promise.resolve(filtered.length);
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const s = submissions.find((x) => x.id === where.id);
        if (s) Object.assign(s, data, { updatedAt: new Date() });
        return Promise.resolve(s);
      }),
    },
    formTemplate: {
      findUnique: vi.fn().mockResolvedValue({
        schema: {
          type: 'object',
          required: ['speciesCode', 'countryCode'],
          properties: {
            speciesCode: { type: 'string' },
            countryCode: { type: 'string' },
            reportDate: { type: 'string', format: 'date' },
            cases: { type: 'integer', minimum: 0 },
            deaths: { type: 'integer', minimum: 0 },
          },
        },
      }),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
}

// ── Mock Prisma for workflow ──

function createWorkflowPrisma() {
  return {
    workflowInstance: {
      create: vi.fn().mockImplementation(({ data }) => {
        const inst = {
          id: uuid(),
          ...data,
          wahis_ready: false,
          analytics_ready: false,
          sla_deadline: null,
          created_at: new Date(),
          updated_at: new Date(),
        };
        workflowInstances.push(inst);
        return Promise.resolve({ ...inst });
      }),
      findUnique: vi.fn().mockImplementation(({ where, include }) => {
        const inst = workflowInstances.find((x) => x.id === where.id);
        if (!inst) return Promise.resolve(null);
        if (include?.transitions) {
          return Promise.resolve({
            ...inst,
            transitions: workflowTransitions
              .filter((t) => t.instance_id === inst.id)
              .sort((a, b) => a.created_at.getTime() - b.created_at.getTime()),
          });
        }
        // Return a shallow copy so mutations in service code don't leak back
        return Promise.resolve({ ...inst });
      }),
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const inst = workflowInstances.find((x) => {
          if (where?.entity_id && x.entity_id !== where.entity_id) return false;
          if (where?.current_level && x.current_level !== where.current_level) return false;
          if (where?.status?.in && !where.status.in.includes(x.status)) return false;
          return true;
        });
        return Promise.resolve(inst ? { ...inst } : null);
      }),
      update: vi.fn().mockImplementation(({ where, data, include }) => {
        const inst = workflowInstances.find((x) => x.id === where.id);
        if (inst) Object.assign(inst, data, { updated_at: new Date() });
        if (include?.transitions) {
          return Promise.resolve({
            ...inst,
            transitions: workflowTransitions
              .filter((t) => t.instance_id === inst!.id)
              .sort((a, b) => a.created_at.getTime() - b.created_at.getTime()),
          });
        }
        return Promise.resolve(inst ? { ...inst } : null);
      }),
      count: vi.fn().mockResolvedValue(0),
    },
    workflowTransition: {
      create: vi.fn().mockImplementation(({ data }) => {
        const t = { id: uuid(), ...data, created_at: new Date() };
        workflowTransitions.push(t);
        return Promise.resolve(t);
      }),
    },
    $transaction: vi.fn().mockImplementation(async (ops: Promise<any>[]) => {
      const results = await Promise.all(ops);
      return results;
    }),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
}

// ── Mock Kafka interfaces ──

function createMockKafkaProducer() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

/** Mock FastifyKafka instance for SubmissionService (publish = event-driven, send = legacy) */
function createMockFastifyKafka() {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    producer: null,
    consumer: null,
  };
}

/** Mock EventPublisher for WorkflowService (replaces AnimalHealthClient) */
function createMockEventPublisher() {
  return { publish: vi.fn().mockResolvedValue(undefined) };
}

// ── Quality report mock ──

const QUALITY_REPORT_ID = '00000000-0000-0000-0000-0000000000aa';

// ── Test Suite ──

describe('E2E Pipeline: Submission → Quality → Workflow (Event-Driven)', () => {
  let collectePrisma: ReturnType<typeof createCollectePrisma>;
  let workflowPrisma: ReturnType<typeof createWorkflowPrisma>;
  let collecteKafkaProducer: ReturnType<typeof createMockKafkaProducer>;
  let collecteKafka: ReturnType<typeof createMockFastifyKafka>;
  let workflowKafkaProducer: ReturnType<typeof createMockKafkaProducer>;
  let eventPublisher: ReturnType<typeof createMockEventPublisher>;

  let submissionService: SubmissionService;
  let workflowService: WorkflowService;

  let campaignId: string;

  beforeEach(() => {
    // Reset stores
    submissions = [];
    campaigns = [];
    workflowInstances = [];
    workflowTransitions = [];
    idCounter = 0;

    // Create mock infrastructure
    collectePrisma = createCollectePrisma();
    workflowPrisma = createWorkflowPrisma();
    collecteKafkaProducer = createMockKafkaProducer();
    collecteKafka = createMockFastifyKafka();
    workflowKafkaProducer = createMockKafkaProducer();
    eventPublisher = createMockEventPublisher();

    // Workflow service (real logic, mock Prisma + Kafka + EventPublisher)
    workflowService = new WorkflowService(
      workflowPrisma as never,
      workflowKafkaProducer as never,
      eventPublisher as never,
    );

    // Submission service (real logic, mock Prisma + Kafka — no service clients)
    submissionService = new SubmissionService(
      collectePrisma as never,
      collecteKafkaProducer as never,
      collecteKafka as never,
    );

    // Seed a campaign
    const campaign = {
      id: uuid(),
      tenantId: TENANT_ID,
      name: 'Kenya FMD Surveillance Q1 2025',
      domain: 'health',
      templateId: '00000000-0000-0000-0000-000000000200',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    campaigns.push(campaign);
    campaignId = campaign.id;
  });

  // ── Helper: simulate full async pipeline ──

  /**
   * Simulates the async event-driven pipeline that happens after submit():
   * 1. Quality validation result arrives via Kafka → handleQualityResult()
   * 2. If quality passed → workflow creation event published → WorkflowService.create()
   * 3. Workflow created event arrives → handleWorkflowCreated()
   */
  async function simulateQualityAndWorkflow(
    submissionId: string,
    overallStatus: string = 'PASSED',
    domain: string = 'health',
  ) {
    // Simulate quality result callback
    await submissionService.handleQualityResult(
      submissionId,
      QUALITY_REPORT_ID,
      overallStatus,
      domain,
      TENANT_ID,
      fieldAgent.userId,
    );

    // If quality passed, simulate workflow service consuming the event
    if (overallStatus === 'PASSED' || overallStatus === 'WARNING') {
      const callingUser: AuthenticatedUser = {
        userId: 'system-collecte',
        email: 'system@collecte.internal',
        role: UserRole.DATA_STEWARD,
        tenantId: TENANT_ID,
        tenantLevel: TenantLevel.MEMBER_STATE,
      };

      const wfResult = await workflowService.create(
        {
          entityType: 'Submission',
          entityId: submissionId,
          domain,
          qualityReportId: QUALITY_REPORT_ID,
        } as any,
        callingUser,
      );

      // Simulate workflow-created event arriving back at collecte
      await submissionService.handleWorkflowCreated(
        submissionId,
        wfResult.data.id,
      );
    }
  }

  // ── Happy Path: Full Pipeline ──

  describe('Happy path — full pipeline', () => {
    it('submit → quality PASSED → workflow created → approve L1–L4 → wahisReady + analyticsReady', async () => {
      // ── Step 1: Submit form ──
      const result = await submissionService.submit(
        {
          campaignId,
          data: {
            speciesCode: 'BOV',
            countryCode: 'KE',
            reportDate: '2025-01-15',
            cases: 5,
            deaths: 1,
          },
          deviceId: 'device-e2e',
          gpsLat: -1.28,
          gpsLng: 36.82,
          gpsAccuracy: 5.0,
        } as any,
        fieldAgent,
      );

      const submissionId = result.data.id;

      // Verify quality validation request was published via Kafka
      expect(collecteKafka.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EVENTS.QUALITY.VALIDATION_REQUESTED,
          source: 'collecte-service',
          payload: expect.objectContaining({
            recordId: submissionId,
            entityType: 'Submission',
            domain: 'health',
          }),
        }),
      );

      // Submission is in SUBMITTED status (quality hasn't responded yet)
      const submissionRecord = submissions.find((s) => s.id === submissionId);
      expect(submissionRecord.status).toBe('SUBMITTED');

      // Verify submitted event published to Kafka
      expect(collecteKafkaProducer.send).toHaveBeenCalledWith(
        TOPIC_MS_COLLECTE_FORM_SUBMITTED,
        expect.any(String),
        expect.objectContaining({ submissionId }),
        expect.any(Object),
      );

      // ── Step 2: Simulate async quality result + workflow creation ──
      await simulateQualityAndWorkflow(submissionId, 'PASSED');

      // Verify submission updated with quality report
      expect(submissionRecord.qualityReportId).toBe(QUALITY_REPORT_ID);
      expect(submissionRecord.status).toBe('VALIDATED');

      // Verify workflow instance was created
      expect(workflowInstances).toHaveLength(1);
      const wfInstance = workflowInstances[0];
      expect(wfInstance.entity_id).toBe(submissionId);
      expect(wfInstance.current_level).toBe('NATIONAL_TECHNICAL');
      expect(wfInstance.status).toBe('PENDING');

      // Verify workflowInstanceId stored on submission
      expect(submissionRecord.workflowInstanceId).toBe(wfInstance.id);

      // Verify workflow creation event published
      expect(workflowKafkaProducer.send).toHaveBeenCalledWith(
        TOPIC_AU_WORKFLOW_VALIDATION_SUBMITTED,
        expect.any(String),
        expect.any(Object),
        expect.any(Object),
      );

      // Verify workflow creation request was published by collecte
      expect(collecteKafka.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EVENTS.WORKFLOW.INSTANCE_REQUESTED,
        }),
      );

      // ── Step 3: Approve Level 1 (NATIONAL_TECHNICAL → NATIONAL_OFFICIAL) ──
      const l1Result = await workflowService.approve(
        wfInstance.id,
        'Technical validation passed',
        dataSteward,
      );

      expect(l1Result.data.currentLevel).toBe('NATIONAL_OFFICIAL');
      expect(l1Result.data.status).toBe('PENDING');
      expect(l1Result.data.wahisReady).toBe(false);
      expect(l1Result.data.analyticsReady).toBe(false);

      // ── Step 4: Approve Level 2 (NATIONAL_OFFICIAL → REC_HARMONIZATION) ──
      const l2Result = await workflowService.approve(
        wfInstance.id,
        'Official approval — WAHIS ready',
        nationalAdmin,
      );

      expect(l2Result.data.currentLevel).toBe('REC_HARMONIZATION');
      expect(l2Result.data.status).toBe('PENDING');
      expect(l2Result.data.wahisReady).toBe(true);

      // Verify wahisReady event published via EventPublisher (replaces REST PATCH)
      expect(workflowKafkaProducer.send).toHaveBeenCalledWith(
        TOPIC_AU_WORKFLOW_WAHIS_READY,
        expect.any(String),
        expect.any(Object),
        expect.any(Object),
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        EVENTS.WORKFLOW.WAHIS_READY,
        expect.objectContaining({
          payload: expect.objectContaining({
            entityId: submissionId,
            flag: 'wahisReady',
          }),
        }),
        expect.objectContaining({ key: submissionId }),
      );

      // ── Step 5: Approve Level 3 (REC_HARMONIZATION → CONTINENTAL_PUBLICATION) ──
      const l3Result = await workflowService.approve(
        wfInstance.id,
        'REC harmonized',
        recAdmin,
      );

      expect(l3Result.data.currentLevel).toBe('CONTINENTAL_PUBLICATION');
      expect(l3Result.data.status).toBe('PENDING');

      // ── Step 6: Approve Level 4 (CONTINENTAL_PUBLICATION → final APPROVED) ──
      const l4Result = await workflowService.approve(
        wfInstance.id,
        'Published to continental analytics',
        continentalAdmin,
      );

      expect(l4Result.data.currentLevel).toBe('CONTINENTAL_PUBLICATION');
      expect(l4Result.data.status).toBe('APPROVED');
      expect(l4Result.data.wahisReady).toBe(true);
      expect(l4Result.data.analyticsReady).toBe(true);

      // Verify analyticsReady event published via EventPublisher
      expect(workflowKafkaProducer.send).toHaveBeenCalledWith(
        TOPIC_AU_WORKFLOW_ANALYTICS_READY,
        expect.any(String),
        expect.any(Object),
        expect.any(Object),
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        EVENTS.WORKFLOW.ANALYTICS_READY,
        expect.objectContaining({
          payload: expect.objectContaining({
            entityId: submissionId,
            flag: 'analyticsReady',
          }),
        }),
        expect.objectContaining({ key: submissionId }),
      );

      // Verify full transition history (4 approvals stored in global array)
      const instanceTransitions = workflowTransitions.filter(
        (t) => t.instance_id === wfInstance.id,
      );
      expect(instanceTransitions).toHaveLength(4);
      expect(instanceTransitions[0].action).toBe('APPROVE');
      expect(instanceTransitions[0].from_level).toBe('NATIONAL_TECHNICAL');
      expect(instanceTransitions[3].action).toBe('APPROVE');
      expect(instanceTransitions[3].to_status).toBe('APPROVED');
    });
  });

  // ── Quality Failure Path ──

  describe('Quality failure path', () => {
    it('submit → quality FAILED → submission REJECTED → no workflow', async () => {
      const result = await submissionService.submit(
        {
          campaignId,
          data: {
            speciesCode: 'BOV',
            countryCode: 'KE',
            reportDate: '2025-01-15',
            cases: 5,
            deaths: 1,
          },
        } as any,
        fieldAgent,
      );

      const submissionId = result.data.id;

      // Simulate quality FAILED callback
      await simulateQualityAndWorkflow(submissionId, 'FAILED');

      const submissionRecord = submissions.find((s) => s.id === submissionId);

      // Submission should be rejected
      expect(submissionRecord.status).toBe('REJECTED');
      expect(submissionRecord.qualityReportId).toBe(QUALITY_REPORT_ID);

      // No workflow should be created
      expect(workflowInstances).toHaveLength(0);
      expect(submissionRecord.workflowInstanceId).toBeNull();
    });

    it('quality WARNING is treated as passed — workflow created', async () => {
      const result = await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

      await simulateQualityAndWorkflow(result.data.id, 'WARNING');

      const submissionRecord = submissions[0];
      expect(submissionRecord.status).toBe('VALIDATED');
      expect(workflowInstances).toHaveLength(1);
    });
  });

  // ── Graceful Degradation ──

  describe('Graceful degradation', () => {
    it('kafka publish failure during quality request → submission still saved', async () => {
      // Make Kafka publish fail (simulates broker unavailable)
      collecteKafka.publish.mockRejectedValue(new Error('Kafka broker unavailable'));

      const result = await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

      // Submission should still succeed (graceful degradation)
      expect(result.data).toBeDefined();
      const sub = submissions[0];
      expect(sub.status).toBe('SUBMITTED');
      // Quality report is null (async request failed, will be retried)
      expect(sub.qualityReportId).toBeNull();
    });

    it('null kafka → submission still saved without quality request', async () => {
      // Create submission service with null kafka (no Kafka available)
      const noKafkaService = new SubmissionService(
        collectePrisma as never,
        collecteKafkaProducer as never,
        null,
      );

      const result = await noKafkaService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

      // Submission should succeed
      expect(result.data).toBeDefined();
      expect(submissions).toHaveLength(1);
      expect(submissions[0].status).toBe('SUBMITTED');
    });

    it('event publisher failure → workflow approval still succeeds', async () => {
      // EventPublisher.publish fails (Kafka broker down for flag-ready events)
      const failingEventPublisher = {
        publish: vi.fn().mockRejectedValue(new Error('Kafka broker unavailable')),
      };

      workflowService = new WorkflowService(
        workflowPrisma as never,
        workflowKafkaProducer as never,
        failingEventPublisher as never,
      );

      const result = await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

      // Run async pipeline
      await simulateQualityAndWorkflow(result.data.id, 'PASSED');

      const wfId = workflowInstances[0].id;

      // Approve L1
      await workflowService.approve(wfId, 'L1 ok', dataSteward);
      // Approve L2 — triggers wahisReady flag-ready event which will fail
      const l2 = await workflowService.approve(wfId, 'L2 ok', nationalAdmin);

      // Workflow approval should succeed despite event publish failure
      expect(l2.data.currentLevel).toBe('REC_HARMONIZATION');
      expect(l2.data.wahisReady).toBe(true);
      // eventPublisher.publish was called but failed — no crash
      expect(failingEventPublisher.publish).toHaveBeenCalled();
    });
  });

  // ── Auto-advance Level 1 via Quality Event ──

  describe('Auto-advance Level 1 via quality event', () => {
    it('quality PASSED event auto-advances workflow from L1 to L2', async () => {
      // Submit and create workflow
      const result = await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

      await simulateQualityAndWorkflow(result.data.id, 'PASSED');

      const wfInstance = workflowInstances[0];
      const submissionId = submissions[0].id;
      expect(wfInstance.current_level).toBe('NATIONAL_TECHNICAL');

      // Simulate quality event → auto-advance
      await workflowService.autoAdvanceLevel1(submissionId, 'quality-report-xyz');

      // Workflow should now be at Level 2
      expect(wfInstance.current_level).toBe('NATIONAL_OFFICIAL');
      expect(wfInstance.status).toBe('PENDING');
      expect(wfInstance.quality_report_id).toBe('quality-report-xyz');

      // Transition recorded
      const autoTransition = workflowTransitions.find(
        (t) => t.instance_id === wfInstance.id && t.comment?.includes('Auto-approved'),
      );
      expect(autoTransition).toBeDefined();
      expect(autoTransition.from_level).toBe('NATIONAL_TECHNICAL');
      expect(autoTransition.to_level).toBe('NATIONAL_OFFICIAL');
      expect(autoTransition.actor_role).toBe('SYSTEM');
    });

    it('auto-advance skipped if no pending L1 workflow exists', async () => {
      // No workflow created — call auto-advance with random entity
      await workflowService.autoAdvanceLevel1('non-existent-entity', 'report-123');

      // No transitions created, no errors thrown
      expect(workflowTransitions).toHaveLength(0);
    });
  });

  // ── Workflow Rejection and Return ──

  describe('Workflow rejection and return', () => {
    it('reject at Level 2 → workflow REJECTED', async () => {
      const result = await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

      await simulateQualityAndWorkflow(result.data.id, 'PASSED');

      const wfId = workflowInstances[0].id;

      // Approve L1
      await workflowService.approve(wfId, 'L1 ok', dataSteward);
      expect(workflowInstances[0].current_level).toBe('NATIONAL_OFFICIAL');

      // Reject at L2
      const rejected = await workflowService.reject(wfId, 'Data inconsistency found', nationalAdmin);

      expect(rejected.data.status).toBe('REJECTED');
      expect(rejected.data.currentLevel).toBe('NATIONAL_OFFICIAL');
      // No flag-ready events published on rejection
      expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it('return at Level 3 → drops back to Level 2', async () => {
      const result = await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

      await simulateQualityAndWorkflow(result.data.id, 'PASSED');

      const wfId = workflowInstances[0].id;

      // Approve L1, L2, then return at L3
      await workflowService.approve(wfId, 'L1 ok', dataSteward);
      await workflowService.approve(wfId, 'L2 ok', nationalAdmin);
      expect(workflowInstances[0].current_level).toBe('REC_HARMONIZATION');

      const returned = await workflowService.returnForCorrection(
        wfId,
        'Cross-border data needs correction',
        recAdmin,
      );

      expect(returned.data.status).toBe('RETURNED');
      expect(returned.data.currentLevel).toBe('NATIONAL_OFFICIAL');

      // Re-approve at L2 after correction
      const reapproved = await workflowService.approve(wfId, 'Corrected', nationalAdmin);
      expect(reapproved.data.currentLevel).toBe('REC_HARMONIZATION');
    });
  });

  // ── Multiple Submissions ──

  describe('Multiple submissions in pipeline', () => {
    it('two submissions create independent workflow instances', async () => {
      const r1 = await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE', cases: 5 },
        } as any,
        fieldAgent,
      );

      const r2 = await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'OVI', countryCode: 'KE', cases: 3 },
        } as any,
        fieldAgent,
      );

      // Simulate async pipeline for both
      await simulateQualityAndWorkflow(r1.data.id, 'PASSED');
      await simulateQualityAndWorkflow(r2.data.id, 'PASSED');

      expect(submissions).toHaveLength(2);
      expect(workflowInstances).toHaveLength(2);

      // Each submission has its own workflow
      expect(submissions[0].workflowInstanceId).toBe(workflowInstances[0].id);
      expect(submissions[1].workflowInstanceId).toBe(workflowInstances[1].id);

      // Approve first one through all levels
      const wfId1 = workflowInstances[0].id;
      await workflowService.approve(wfId1, 'L1', dataSteward);
      await workflowService.approve(wfId1, 'L2', nationalAdmin);
      await workflowService.approve(wfId1, 'L3', recAdmin);
      await workflowService.approve(wfId1, 'L4', continentalAdmin);

      // First workflow fully approved
      expect(workflowInstances[0].status).toBe('APPROVED');
      expect(workflowInstances[0].wahis_ready).toBe(true);
      expect(workflowInstances[0].analytics_ready).toBe(true);

      // Second workflow untouched
      expect(workflowInstances[1].status).toBe('PENDING');
      expect(workflowInstances[1].current_level).toBe('NATIONAL_TECHNICAL');
    });
  });

  // ── Event-Driven Specific Tests ──

  describe('Event-driven pipeline verification', () => {
    it('submit only publishes quality request — no synchronous inter-service calls', async () => {
      const result = await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

      // After submit, submission is SUBMITTED (not VALIDATED)
      expect(submissions[0].status).toBe('SUBMITTED');
      expect(submissions[0].qualityReportId).toBeNull();
      expect(submissions[0].workflowInstanceId).toBeNull();

      // No workflow instances created yet
      expect(workflowInstances).toHaveLength(0);

      // Quality validation was requested via Kafka event
      expect(collecteKafka.publish).toHaveBeenCalledTimes(1);
      expect(collecteKafka.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EVENTS.QUALITY.VALIDATION_REQUESTED,
        }),
      );
    });

    it('workflow flag-ready events contain correct payload', async () => {
      const result = await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

      await simulateQualityAndWorkflow(result.data.id, 'PASSED');

      const wfId = workflowInstances[0].id;
      await workflowService.approve(wfId, 'L1', dataSteward);
      await workflowService.approve(wfId, 'L2', nationalAdmin);

      // Verify wahisReady event payload structure
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        EVENTS.WORKFLOW.WAHIS_READY,
        expect.objectContaining({
          eventType: EVENTS.WORKFLOW.WAHIS_READY,
          source: 'workflow-service',
          version: 1,
          payload: expect.objectContaining({
            instanceId: wfId,
            entityType: 'Submission',
            entityId: result.data.id,
            domain: 'health',
            flag: 'wahisReady',
          }),
        }),
        expect.any(Object),
      );
    });
  });
});
