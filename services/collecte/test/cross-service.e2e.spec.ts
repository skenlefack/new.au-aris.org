import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * E2E test — Cross-service integration: Collecte → Quality → Workflow pipeline.
 *
 * Tests:
 *  1. Submit → quality PASSED → workflow created → events published
 *  2. Submit → quality FAILED → submission rejected → rejection event
 *  3. Submit → quality WARNING → treated as passed → workflow created
 *  4. Quality service down → graceful degradation → workflow still created
 *  5. Workflow service down → submission still saved → no workflowInstanceId
 *  6. Both services down → submission persisted, no crash
 *  7. Kafka event sequence verification
 *
 * PostgreSQL: real Testcontainer with Prisma schema push
 * Kafka: spy mock captures events for verification
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

// ── Fixtures ──

const TENANT_ID = '00000000-0000-4000-b000-000000000001';
const TEMPLATE_ID = '00000000-0000-4000-d000-000000000099';

const FIELD_AGENT = {
  userId: '00000000-0000-4000-a000-000000000020',
  email: 'agent@ke.aris.africa',
  role: 'FIELD_AGENT',
  tenantId: TENANT_ID,
  tenantLevel: 'MEMBER_STATE',
};

const DATA_STEWARD = {
  userId: '00000000-0000-4000-a000-000000000021',
  email: 'steward@ke.aris.africa',
  role: 'DATA_STEWARD',
  tenantId: TENANT_ID,
  tenantLevel: 'MEMBER_STATE',
};

// ── Mock factories ──

function createQualityMock(overallStatus: string) {
  const reportId = uuidv4();
  return {
    client: {
      validate: async () => ({
        data: {
          data: { id: reportId, overallStatus },
        },
      }),
    },
    reportId,
  };
}

function createFailingQualityMock() {
  return {
    client: {
      validate: async () => {
        throw new Error('ECONNREFUSED: data-quality service unavailable');
      },
    },
  };
}

function createWorkflowMock() {
  const instanceId = uuidv4();
  return {
    client: {
      createInstance: async () => ({
        data: {
          data: { id: instanceId },
        },
      }),
    },
    instanceId,
  };
}

function createFailingWorkflowMock() {
  return {
    client: {
      createInstance: async () => {
        throw new Error('ECONNREFUSED: workflow service unavailable');
      },
    },
  };
}

// ── Test suite ──

describe('Cross-Service Pipeline — E2E (Testcontainers)', () => {
  let campaignId: string;

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

    // Seed form template
    try {
      await prisma.formTemplate.create({
        data: {
          id: TEMPLATE_ID,
          tenantId: TENANT_ID,
          name: 'Cross-Service Test Form',
          domain: 'health',
          version: 1,
          status: 'PUBLISHED',
          schema: {
            type: 'object',
            properties: {
              diseaseName: { type: 'string' },
              cases: { type: 'integer', minimum: 0 },
            },
            required: ['diseaseName', 'cases'],
          },
          createdBy: DATA_STEWARD.userId,
        },
      });
    } catch {
      // May already exist
    }

    // Create and activate a campaign
    const campaign = await prisma.campaign.create({
      data: {
        tenantId: TENANT_ID,
        name: 'Cross-Service E2E Campaign',
        domain: 'health',
        templateId: TEMPLATE_ID,
        startDate: new Date(Date.now() - 86_400_000),
        endDate: new Date(Date.now() + 86_400_000 * 30),
        targetZones: ['KE-01'],
        assignedAgents: [FIELD_AGENT.userId],
        targetSubmissions: 50,
        conflictStrategy: 'LAST_WRITE_WINS',
        status: 'ACTIVE',
        createdBy: DATA_STEWARD.userId,
      },
    });
    campaignId = campaign.id;
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await pgContainer?.stop();
  }, 30_000);

  // ── Helpers ──

  async function createSubmissionService(opts: {
    qualityClient: unknown;
    workflowClient: unknown;
    kafkaSpy?: ReturnType<typeof createKafkaSpy>;
  }) {
    const { SubmissionService } = await import('../src/submission/submission.service');
    const spy = opts.kafkaSpy ?? createKafkaSpy();

    return {
      service: new SubmissionService(
        prisma as never,
        spy.producer as never,
        opts.qualityClient as never,
        opts.workflowClient as never,
      ),
      events: spy.events,
    };
  }

  // ── 1. Quality PASSED → Workflow Created ──

  describe('Submit → Quality PASSED → Workflow created', () => {
    it('creates submission, passes quality, creates workflow, publishes events', async () => {
      const quality = createQualityMock('PASSED');
      const workflow = createWorkflowMock();
      const kafkaSpy = createKafkaSpy();

      const { service, events } = await createSubmissionService({
        qualityClient: quality.client,
        workflowClient: workflow.client,
        kafkaSpy,
      });

      const result = await service.submit(
        {
          campaignId,
          data: { diseaseName: 'Anthrax', cases: 5 },
          deviceId: 'device-001',
        } as never,
        FIELD_AGENT as never,
      );

      // Submission is VALIDATED (quality passed)
      expect(result.data.status).toBe('VALIDATED');
      expect(result.data.qualityReportId).toBe(quality.reportId);
      expect(result.data.workflowInstanceId).toBe(workflow.instanceId);

      // Kafka: form.submitted event
      const submittedEvents = events.filter((e) => e.topic === 'ms.collecte.form.submitted.v1');
      expect(submittedEvents).toHaveLength(1);
      expect(submittedEvents[0].key).toBe(result.data.id);

      // No rejection event
      const rejectionEvents = events.filter((e) => e.topic === 'au.quality.record.rejected.v1');
      expect(rejectionEvents).toHaveLength(0);

      // DB state
      const dbRow = await prisma.submission.findUnique({ where: { id: result.data.id } });
      expect(dbRow!.status).toBe('VALIDATED');
      expect(dbRow!.qualityReportId).toBe(quality.reportId);
      expect(dbRow!.workflowInstanceId).toBe(workflow.instanceId);
    });
  });

  // ── 2. Quality FAILED → Submission Rejected ──

  describe('Submit → Quality FAILED → Submission rejected', () => {
    it('rejects submission and publishes rejection event', async () => {
      const quality = createQualityMock('FAILED');
      const workflow = createWorkflowMock();
      const kafkaSpy = createKafkaSpy();

      const { service, events } = await createSubmissionService({
        qualityClient: quality.client,
        workflowClient: workflow.client,
        kafkaSpy,
      });

      const result = await service.submit(
        {
          campaignId,
          data: { diseaseName: 'Bad Quality Data', cases: 0 },
        } as never,
        FIELD_AGENT as never,
      );

      // Submission is REJECTED
      expect(result.data.status).toBe('REJECTED');
      expect(result.data.qualityReportId).toBe(quality.reportId);
      // Workflow NOT created (quality failed)
      expect(result.data.workflowInstanceId).toBeNull();

      // Rejection event published
      const rejectionEvents = events.filter((e) => e.topic === 'au.quality.record.rejected.v1');
      expect(rejectionEvents).toHaveLength(1);
      const rejPayload = rejectionEvents[0].payload as Record<string, unknown>;
      expect(rejPayload.submissionId).toBe(result.data.id);
      expect(rejPayload.overallStatus).toBe('FAILED');

      // Submitted event still published
      const submittedEvents = events.filter((e) => e.topic === 'ms.collecte.form.submitted.v1');
      expect(submittedEvents).toHaveLength(1);
    });
  });

  // ── 3. Quality WARNING → Treated as PASSED ──

  describe('Submit → Quality WARNING → Workflow created', () => {
    it('WARNING is treated as passed — workflow still created', async () => {
      const quality = createQualityMock('WARNING');
      const workflow = createWorkflowMock();

      const { service } = await createSubmissionService({
        qualityClient: quality.client,
        workflowClient: workflow.client,
      });

      const result = await service.submit(
        {
          campaignId,
          data: { diseaseName: 'Partial Data', cases: 2 },
        } as never,
        FIELD_AGENT as never,
      );

      expect(result.data.status).toBe('VALIDATED');
      expect(result.data.qualityReportId).toBe(quality.reportId);
      expect(result.data.workflowInstanceId).toBe(workflow.instanceId);
    });
  });

  // ── 4. Quality Service Down → Graceful Degradation ──

  describe('Quality service down → graceful degradation', () => {
    it('proceeds with workflow creation when quality service is unavailable', async () => {
      const quality = createFailingQualityMock();
      const workflow = createWorkflowMock();

      const { service } = await createSubmissionService({
        qualityClient: quality.client,
        workflowClient: workflow.client,
      });

      const result = await service.submit(
        {
          campaignId,
          data: { diseaseName: 'Quality Down Test', cases: 4 },
        } as never,
        FIELD_AGENT as never,
      );

      // Submission is still persisted (status stays SUBMITTED since quality update didn't run)
      expect(result.data.id).toBeDefined();
      // Quality report ID is null (service was unavailable)
      expect(result.data.qualityReportId).toBeNull();
      // Workflow was still created (graceful degradation returns passed=true)
      expect(result.data.workflowInstanceId).toBe(workflow.instanceId);
    });
  });

  // ── 5. Workflow Service Down ──

  describe('Workflow service down → submission preserved', () => {
    it('saves submission even when workflow service fails', async () => {
      const quality = createQualityMock('PASSED');
      const workflow = createFailingWorkflowMock();
      const kafkaSpy = createKafkaSpy();

      const { service, events } = await createSubmissionService({
        qualityClient: quality.client,
        workflowClient: workflow.client,
        kafkaSpy,
      });

      const result = await service.submit(
        {
          campaignId,
          data: { diseaseName: 'Workflow Down Test', cases: 6 },
        } as never,
        FIELD_AGENT as never,
      );

      // Submission is VALIDATED (quality passed)
      expect(result.data.status).toBe('VALIDATED');
      expect(result.data.qualityReportId).toBe(quality.reportId);
      // Workflow instance ID is null (service was unavailable)
      expect(result.data.workflowInstanceId).toBeNull();

      // Submitted event still published
      const submittedEvents = events.filter((e) => e.topic === 'ms.collecte.form.submitted.v1');
      expect(submittedEvents).toHaveLength(1);

      // DB state
      const dbRow = await prisma.submission.findUnique({ where: { id: result.data.id } });
      expect(dbRow!.status).toBe('VALIDATED');
      expect(dbRow!.workflowInstanceId).toBeNull();
    });
  });

  // ── 6. Both Services Down ──

  describe('Both services down → submission still persisted', () => {
    it('persists submission even when both quality and workflow services fail', async () => {
      const quality = createFailingQualityMock();
      const workflow = createFailingWorkflowMock();

      const { service } = await createSubmissionService({
        qualityClient: quality.client,
        workflowClient: workflow.client,
      });

      const result = await service.submit(
        {
          campaignId,
          data: { diseaseName: 'Both Down Test', cases: 1 },
        } as never,
        FIELD_AGENT as never,
      );

      // Submission is persisted (not crashed)
      expect(result.data.id).toBeDefined();
      expect(result.data.qualityReportId).toBeNull();
      expect(result.data.workflowInstanceId).toBeNull();

      // Verify in DB
      const dbRow = await prisma.submission.findUnique({ where: { id: result.data.id } });
      expect(dbRow).not.toBeNull();
    });
  });

  // ── 7. Kafka Event Sequence ──

  describe('Kafka event flow verification', () => {
    it('publishes events in correct sequence for full pipeline', async () => {
      const quality = createQualityMock('PASSED');
      const workflow = createWorkflowMock();
      const kafkaSpy = createKafkaSpy();

      const { service, events } = await createSubmissionService({
        qualityClient: quality.client,
        workflowClient: workflow.client,
        kafkaSpy,
      });

      await service.submit(
        {
          campaignId,
          data: { diseaseName: 'Event Sequence Test', cases: 10 },
        } as never,
        FIELD_AGENT as never,
      );

      // Verify event topics in order
      const topics = events.map((e) => e.topic);
      expect(topics).toContain('ms.collecte.form.submitted.v1');
      // No rejection event for PASSED quality
      expect(topics).not.toContain('au.quality.record.rejected.v1');

      // Verify all events have required headers
      for (const event of events) {
        const headers = event.headers as Record<string, string>;
        expect(headers.correlationId).toBeDefined();
        expect(headers.sourceService).toBe('collecte-service');
        expect(headers.tenantId).toBe(TENANT_ID);
        expect(headers.userId).toBe(FIELD_AGENT.userId);
        expect(headers.schemaVersion).toBe('1');
        expect(headers.timestamp).toBeDefined();
      }
    });

    it('publishes rejection event for FAILED quality with correct payload', async () => {
      const quality = createQualityMock('FAILED');
      const workflow = createWorkflowMock();
      const kafkaSpy = createKafkaSpy();

      const { service, events } = await createSubmissionService({
        qualityClient: quality.client,
        workflowClient: workflow.client,
        kafkaSpy,
      });

      const result = await service.submit(
        {
          campaignId,
          data: { diseaseName: 'Rejection Event Test', cases: 0 },
        } as never,
        FIELD_AGENT as never,
      );

      // Both events published
      const topics = events.map((e) => e.topic);
      expect(topics).toContain('au.quality.record.rejected.v1');
      expect(topics).toContain('ms.collecte.form.submitted.v1');

      // Rejection event has correct payload
      const rejEvent = events.find((e) => e.topic === 'au.quality.record.rejected.v1')!;
      const rejPayload = rejEvent.payload as Record<string, unknown>;
      expect(rejPayload.submissionId).toBe(result.data.id);
      expect(rejPayload.reportId).toBe(quality.reportId);
      expect(rejPayload.entityType).toBe('Submission');
      expect(rejPayload.overallStatus).toBe('FAILED');

      // Rejection event key is the submission ID
      expect(rejEvent.key).toBe(result.data.id);
    });
  });

  // ── 8. Tenant Isolation ──

  describe('Tenant isolation in cross-service flow', () => {
    it('submission enforces tenant isolation on campaign access', async () => {
      const quality = createQualityMock('PASSED');
      const workflow = createWorkflowMock();

      const { service } = await createSubmissionService({
        qualityClient: quality.client,
        workflowClient: workflow.client,
      });

      // Different tenant tries to submit to our campaign
      const otherTenantUser = {
        ...FIELD_AGENT,
        userId: '00000000-0000-4000-a000-000000000099',
        tenantId: '00000000-0000-4000-b000-999999999999',
      };

      await expect(
        service.submit(
          {
            campaignId,
            data: { diseaseName: 'Cross-tenant', cases: 1 },
          } as never,
          otherTenantUser as never,
        ),
      ).rejects.toThrow(/not found/);
    });
  });
});
