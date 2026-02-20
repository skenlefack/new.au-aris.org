/**
 * E2E Pipeline Test: Submission → Quality → Workflow → Domain Callback
 *
 * Tests the full cross-service pipeline:
 *   1. Create campaign + submit form data
 *   2. Data quality validation (mocked) → PASSED / FAILED
 *   3. Workflow instance creation → 4-level approval
 *   4. Level 2 approval → wahisReady flag set on source entity
 *   5. Level 4 approval → analyticsReady flag set on source entity
 *   6. Graceful degradation when downstream services are unavailable
 *
 * Both SubmissionService (collecte) and WorkflowService (workflow) are
 * instantiated with in-memory Prisma mocks. The HTTP inter-service calls
 * (DataQualityClient → data-quality, WorkflowClient → workflow, AnimalHealthClient → animal-health)
 * are wired to either mock responses or route through the real WorkflowService.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TenantLevel,
  UserRole,
  DataClassification,
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
  TOPIC_AU_QUALITY_RECORD_REJECTED,
  TOPIC_AU_WORKFLOW_VALIDATION_SUBMITTED,
  TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
  TOPIC_AU_WORKFLOW_WAHIS_READY,
  TOPIC_AU_WORKFLOW_ANALYTICS_READY,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { DataQualityClient, WorkflowClient, AnimalHealthClient } from '@aris/service-clients';
import { SubmissionService } from '../src/submission/submission.service';
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
  email: 'officer@au-ibar.org',
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

// ── Patched entity tracker ──

let patchedEntities: Array<{ entityType: string; entityId: string; body: Record<string, unknown> }> = [];

// ── Quality report mock ──

const QUALITY_REPORT_ID = '00000000-0000-0000-0000-0000000000aa';

function createMockDataQualityClient(overallStatus: string = 'PASSED') {
  return {
    validate: vi.fn().mockResolvedValue({
      status: 200,
      data: {
        data: {
          id: QUALITY_REPORT_ID,
          overallStatus,
          gateResults: [],
        },
      },
    }),
  } as unknown as DataQualityClient;
}

// ── Workflow client wired to real WorkflowService ──

function createWiredWorkflowClient(workflowService: WorkflowService) {
  return {
    createInstance: vi.fn().mockImplementation(async (request: any, tenantId: string) => {
      // Build a user for workflow service (the calling service acts as itself)
      const callingUser: AuthenticatedUser = {
        userId: 'system-collecte',
        email: 'system@collecte.internal',
        role: UserRole.DATA_STEWARD,
        tenantId,
        tenantLevel: TenantLevel.MEMBER_STATE,
      };

      const result = await workflowService.create(
        {
          entityType: request.entityType,
          entityId: request.entityId,
          domain: request.domain,
          qualityReportId: request.qualityReportId,
        } as any,
        callingUser,
      );

      return { status: 201, data: { data: result.data } };
    }),
    getInstance: vi.fn(),
  } as unknown as WorkflowClient;
}

function createMockAnimalHealthClient() {
  return {
    patchEntity: vi.fn().mockImplementation(async (entityType: string, entityId: string, body: Record<string, unknown>) => {
      patchedEntities.push({ entityType, entityId, body });
      return { status: 200, data: { data: { id: entityId, ...body } } };
    }),
    patchHealthEvent: vi.fn().mockResolvedValue({ status: 200, data: {} }),
  } as unknown as AnimalHealthClient;
}

// ── Test Suite ──

describe('E2E Pipeline: Submission → Quality → Workflow → Domain Callback', () => {
  let collectePrisma: ReturnType<typeof createCollectePrisma>;
  let workflowPrisma: ReturnType<typeof createWorkflowPrisma>;
  let collecteKafka: { send: ReturnType<typeof vi.fn> };
  let workflowKafka: { send: ReturnType<typeof vi.fn> };

  let submissionService: SubmissionService;
  let workflowService: WorkflowService;
  let dataQualityClient: DataQualityClient;
  let workflowClient: WorkflowClient;
  let animalHealthClient: AnimalHealthClient;

  let campaignId: string;

  beforeEach(() => {
    // Reset stores
    submissions = [];
    campaigns = [];
    workflowInstances = [];
    workflowTransitions = [];
    patchedEntities = [];
    idCounter = 0;

    // Create mock infrastructure
    collectePrisma = createCollectePrisma();
    workflowPrisma = createWorkflowPrisma();
    collecteKafka = { send: vi.fn().mockResolvedValue(undefined) };
    workflowKafka = { send: vi.fn().mockResolvedValue(undefined) };
    animalHealthClient = createMockAnimalHealthClient();

    // Workflow service (real logic, mock Prisma + Kafka + AH client)
    workflowService = new WorkflowService(
      workflowPrisma as never,
      workflowKafka as never,
      animalHealthClient,
    );

    // Data quality client (mock)
    dataQualityClient = createMockDataQualityClient('PASSED');

    // Workflow client wired to real WorkflowService
    workflowClient = createWiredWorkflowClient(workflowService);

    // Submission service (real logic, mock Prisma + Kafka + service clients)
    submissionService = new SubmissionService(
      collectePrisma as never,
      collecteKafka as never,
      dataQualityClient,
      workflowClient,
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

      // Verify quality validation was called
      expect(dataQualityClient.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: submissionId,
          entityType: 'Submission',
          domain: 'health',
        }),
        TENANT_ID,
      );

      // Verify submission updated with quality report
      const submissionRecord = submissions.find((s) => s.id === submissionId);
      expect(submissionRecord.qualityReportId).toBe(QUALITY_REPORT_ID);
      expect(submissionRecord.status).toBe('VALIDATED');

      // Verify workflow client was called
      expect((workflowClient as any).createInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Submission',
          entityId: submissionId,
          domain: 'health',
          qualityReportId: QUALITY_REPORT_ID,
        }),
        TENANT_ID,
      );

      // Verify workflow instance was created (via wired WorkflowService)
      expect(workflowInstances).toHaveLength(1);
      const wfInstance = workflowInstances[0];
      expect(wfInstance.entity_id).toBe(submissionId);
      expect(wfInstance.current_level).toBe('NATIONAL_TECHNICAL');
      expect(wfInstance.status).toBe('PENDING');

      // Verify workflowInstanceId stored on submission
      expect(submissionRecord.workflowInstanceId).toBe(wfInstance.id);

      // Verify Kafka events published
      expect(collecteKafka.send).toHaveBeenCalledWith(
        TOPIC_MS_COLLECTE_FORM_SUBMITTED,
        expect.any(String),
        expect.objectContaining({ submissionId }),
        expect.any(Object),
      );
      expect(workflowKafka.send).toHaveBeenCalledWith(
        TOPIC_AU_WORKFLOW_VALIDATION_SUBMITTED,
        expect.any(String),
        expect.any(Object),
        expect.any(Object),
      );

      // ── Step 2: Approve Level 1 (NATIONAL_TECHNICAL → NATIONAL_OFFICIAL) ──
      const l1Result = await workflowService.approve(
        wfInstance.id,
        'Technical validation passed',
        dataSteward,
      );

      expect(l1Result.data.currentLevel).toBe('NATIONAL_OFFICIAL');
      expect(l1Result.data.status).toBe('PENDING');
      expect(l1Result.data.wahisReady).toBe(false);
      expect(l1Result.data.analyticsReady).toBe(false);

      // ── Step 3: Approve Level 2 (NATIONAL_OFFICIAL → REC_HARMONIZATION) ──
      const l2Result = await workflowService.approve(
        wfInstance.id,
        'Official approval — WAHIS ready',
        nationalAdmin,
      );

      expect(l2Result.data.currentLevel).toBe('REC_HARMONIZATION');
      expect(l2Result.data.status).toBe('PENDING');
      expect(l2Result.data.wahisReady).toBe(true);

      // Verify wahisReady callback to animal-health service
      expect(workflowKafka.send).toHaveBeenCalledWith(
        TOPIC_AU_WORKFLOW_WAHIS_READY,
        expect.any(String),
        expect.any(Object),
        expect.any(Object),
      );
      expect(patchedEntities).toContainEqual(
        expect.objectContaining({
          entityType: 'Submission',
          entityId: submissionId,
          body: { wahisReady: true },
        }),
      );

      // ── Step 4: Approve Level 3 (REC_HARMONIZATION → CONTINENTAL_PUBLICATION) ──
      const l3Result = await workflowService.approve(
        wfInstance.id,
        'REC harmonized',
        recAdmin,
      );

      expect(l3Result.data.currentLevel).toBe('CONTINENTAL_PUBLICATION');
      expect(l3Result.data.status).toBe('PENDING');

      // ── Step 5: Approve Level 4 (CONTINENTAL_PUBLICATION → final APPROVED) ──
      const l4Result = await workflowService.approve(
        wfInstance.id,
        'Published to continental analytics',
        continentalAdmin,
      );

      expect(l4Result.data.currentLevel).toBe('CONTINENTAL_PUBLICATION');
      expect(l4Result.data.status).toBe('APPROVED');
      expect(l4Result.data.wahisReady).toBe(true);
      expect(l4Result.data.analyticsReady).toBe(true);

      // Verify analyticsReady callback to animal-health service
      expect(workflowKafka.send).toHaveBeenCalledWith(
        TOPIC_AU_WORKFLOW_ANALYTICS_READY,
        expect.any(String),
        expect.any(Object),
        expect.any(Object),
      );
      expect(patchedEntities).toContainEqual(
        expect.objectContaining({
          entityType: 'Submission',
          entityId: submissionId,
          body: { analyticsReady: true },
        }),
      );

      // Verify full transition history (4 approvals stored in global array)
      // Note: the $transaction mock evaluates update before create, so the
      // last transition may not appear in l4Result.data.transitions. We verify
      // from the authoritative workflowTransitions store instead.
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
    it('submit → quality FAILED → submission REJECTED → no workflow → rejection event', async () => {
      // Override quality client to return FAILED
      dataQualityClient = createMockDataQualityClient('FAILED');
      submissionService = new SubmissionService(
        collectePrisma as never,
        collecteKafka as never,
        dataQualityClient,
        workflowClient,
      );

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
      const submissionRecord = submissions.find((s) => s.id === submissionId);

      // Submission should be rejected
      expect(submissionRecord.status).toBe('REJECTED');
      expect(submissionRecord.qualityReportId).toBe(QUALITY_REPORT_ID);

      // No workflow should be created
      expect((workflowClient as any).createInstance).not.toHaveBeenCalled();
      expect(workflowInstances).toHaveLength(0);
      expect(submissionRecord.workflowInstanceId).toBeNull();

      // Rejection event published
      expect(collecteKafka.send).toHaveBeenCalledWith(
        TOPIC_AU_QUALITY_RECORD_REJECTED,
        submissionId,
        expect.objectContaining({
          submissionId,
          reportId: QUALITY_REPORT_ID,
          overallStatus: 'FAILED',
        }),
        expect.any(Object),
      );
    });

    it('quality WARNING is treated as passed — workflow created', async () => {
      dataQualityClient = createMockDataQualityClient('WARNING');
      submissionService = new SubmissionService(
        collectePrisma as never,
        collecteKafka as never,
        dataQualityClient,
        workflowClient,
      );

      await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

      const submissionRecord = submissions[0];
      expect(submissionRecord.status).toBe('VALIDATED');
      expect((workflowClient as any).createInstance).toHaveBeenCalledOnce();
      expect(workflowInstances).toHaveLength(1);
    });
  });

  // ── Graceful Degradation ──

  describe('Graceful degradation', () => {
    it('quality service unavailable → submission proceeds → workflow still created', async () => {
      const failingQualityClient = {
        validate: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      } as unknown as DataQualityClient;

      submissionService = new SubmissionService(
        collectePrisma as never,
        collecteKafka as never,
        failingQualityClient,
        workflowClient,
      );

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
      // Quality report is null (service unavailable)
      expect(sub.qualityReportId).toBeNull();
      // Workflow should still be created (passed: true by default on error)
      expect((workflowClient as any).createInstance).toHaveBeenCalledOnce();
      expect(workflowInstances).toHaveLength(1);
    });

    it('workflow service unavailable → submission still saved', async () => {
      const failingWorkflowClient = {
        createInstance: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        getInstance: vi.fn(),
      } as unknown as WorkflowClient;

      submissionService = new SubmissionService(
        collectePrisma as never,
        collecteKafka as never,
        dataQualityClient,
        failingWorkflowClient,
      );

      const result = await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

      // Submission should still succeed
      expect(result.data).toBeDefined();
      const sub = submissions[0];
      expect(sub.status).toBe('VALIDATED');
      expect(sub.qualityReportId).toBe(QUALITY_REPORT_ID);
      // No workflow instance ID (service was down)
      expect(sub.workflowInstanceId).toBeNull();
    });

    it('domain service callback failure → workflow approval still succeeds', async () => {
      const failingAhClient = {
        patchEntity: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        patchHealthEvent: vi.fn(),
      } as unknown as AnimalHealthClient;

      workflowService = new WorkflowService(
        workflowPrisma as never,
        workflowKafka as never,
        failingAhClient,
      );
      workflowClient = createWiredWorkflowClient(workflowService);
      submissionService = new SubmissionService(
        collectePrisma as never,
        collecteKafka as never,
        dataQualityClient,
        workflowClient,
      );

      // Submit → creates workflow
      const result = await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

      const wfId = workflowInstances[0].id;

      // Approve L1
      await workflowService.approve(wfId, 'L1 ok', dataSteward);
      // Approve L2 — this triggers wahisReady callback which will fail
      const l2 = await workflowService.approve(wfId, 'L2 ok', nationalAdmin);

      // Workflow approval should succeed despite callback failure
      expect(l2.data.currentLevel).toBe('REC_HARMONIZATION');
      expect(l2.data.wahisReady).toBe(true);
      // patchEntity was called but failed — no crash
      expect(failingAhClient.patchEntity).toHaveBeenCalled();
    });
  });

  // ── Auto-advance Level 1 via Quality Event ──

  describe('Auto-advance Level 1 via quality event', () => {
    it('quality PASSED event auto-advances workflow from L1 to L2', async () => {
      // Submit and create workflow
      await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

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
      await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

      const wfId = workflowInstances[0].id;

      // Approve L1
      await workflowService.approve(wfId, 'L1 ok', dataSteward);
      expect(workflowInstances[0].current_level).toBe('NATIONAL_OFFICIAL');

      // Reject at L2
      const rejected = await workflowService.reject(wfId, 'Data inconsistency found', nationalAdmin);

      expect(rejected.data.status).toBe('REJECTED');
      expect(rejected.data.currentLevel).toBe('NATIONAL_OFFICIAL');
      expect(patchedEntities).toHaveLength(0); // No domain callback on rejection
    });

    it('return at Level 3 → drops back to Level 2', async () => {
      await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE' },
        } as any,
        fieldAgent,
      );

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
      await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'BOV', countryCode: 'KE', cases: 5 },
        } as any,
        fieldAgent,
      );

      await submissionService.submit(
        {
          campaignId,
          data: { speciesCode: 'OVI', countryCode: 'KE', cases: 3 },
        } as any,
        fieldAgent,
      );

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
});
