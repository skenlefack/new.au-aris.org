import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * E2E test — Collecte Full Pipeline with Testcontainers (PostgreSQL + Kafka + Redis).
 *
 * Tests:
 *  1. Campaign creation -> form submission -> Kafka event published
 *  2. Offline sync: batch of 5 records -> 3 accepted, 1 conflict, 1 rejected
 *  3. Campaign progress updates correctly after submissions
 *  4. Concurrent submissions from multiple agents
 *
 * PostgreSQL: real Testcontainer with Prisma schema push
 * Kafka: spy mock captures published events (production-like verification)
 * Redis: Testcontainer started (available for cache/session extensions)
 */

// ── Container state ──

let pgContainer: StartedTestContainer;
let redisContainer: StartedTestContainer;
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

// ── Fixture IDs ──

const TENANT_ID = '00000000-0000-4000-b000-000000000001';
const TEMPLATE_ID = '00000000-0000-4000-d000-000000000001';

const FIELD_AGENT_1 = {
  userId: '00000000-0000-4000-a000-000000000010',
  email: 'agent1@ke.au-aris.org',
  role: 'FIELD_AGENT',
  tenantId: TENANT_ID,
  tenantLevel: 'MEMBER_STATE',
};

const FIELD_AGENT_2 = {
  userId: '00000000-0000-4000-a000-000000000011',
  email: 'agent2@ke.au-aris.org',
  role: 'FIELD_AGENT',
  tenantId: TENANT_ID,
  tenantLevel: 'MEMBER_STATE',
};

const DATA_STEWARD = {
  userId: '00000000-0000-4000-a000-000000000012',
  email: 'steward@ke.au-aris.org',
  role: 'DATA_STEWARD',
  tenantId: TENANT_ID,
  tenantLevel: 'MEMBER_STATE',
};

// ── Test suite ──

describe('Collecte Full Pipeline — E2E (Testcontainers)', () => {
  beforeAll(async () => {
    // Start PostgreSQL
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

    // Start Redis
    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start();

    // Push Prisma schema
    process.env['DATABASE_URL'] = databaseUrl;
    const schemaPath = require
      .resolve('@aris/db-schemas/prisma/schema.prisma')
      .replace(/schema\.prisma$/, '');
    execSync(
      `npx prisma db push --schema=${schemaPath} --skip-generate --accept-data-loss`,
      { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' },
    );

    // Initialize Prisma client
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    // Seed a form template for schema validation
    try {
      await prisma.formTemplate.create({
        data: {
          id: TEMPLATE_ID,
          tenantId: TENANT_ID,
          name: 'Disease Notification Form',
          domain: 'health',
          version: 1,
          status: 'PUBLISHED',
          schema: {
            type: 'object',
            properties: {
              diseaseName: { type: 'string' },
              cases: { type: 'integer', minimum: 0 },
              deaths: { type: 'integer', minimum: 0 },
              location: { type: 'string' },
            },
            required: ['diseaseName', 'cases'],
          },
          createdBy: DATA_STEWARD.userId,
        },
      });
    } catch {
      // Template may already exist from previous test run within same container
    }
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await pgContainer?.stop();
    await redisContainer?.stop();
  }, 30_000);

  // ── Helpers ──

  async function createCampaignService() {
    const { CampaignService } = await import('../src/campaign/campaign.service');
    const { producer } = createKafkaSpy();
    return new CampaignService(prisma as never, producer as never);
  }

  async function createSubmissionService(kafkaSpy?: ReturnType<typeof createKafkaSpy>) {
    const { SubmissionService } = await import('../src/submission/submission.service');
    const spy = kafkaSpy ?? createKafkaSpy();

    const dataQualityClient = {
      validate: async () => ({
        data: {
          data: { id: uuidv4(), overallStatus: 'PASSED' },
        },
      }),
    };

    const workflowClient = {
      createInstance: async () => ({
        data: {
          data: { id: uuidv4() },
        },
      }),
    };

    return {
      service: new SubmissionService(
        prisma as never,
        spy.producer as never,
        dataQualityClient as never,
        workflowClient as never,
      ),
      events: spy.events,
    };
  }

  async function createSyncService(kafkaSpy?: ReturnType<typeof createKafkaSpy>) {
    const { SyncService } = await import('../src/sync/sync.service');
    const spy = kafkaSpy ?? createKafkaSpy();
    return {
      service: new SyncService(prisma as never, spy.producer as never),
      events: spy.events,
    };
  }

  async function createActiveCampaign(overrides?: Record<string, unknown>) {
    const campaignService = await createCampaignService();

    const created = await campaignService.create(
      {
        name: `Test Campaign ${Date.now()}`,
        domain: 'health',
        templateId: TEMPLATE_ID,
        startDate: new Date(Date.now() - 86_400_000).toISOString(),
        endDate: new Date(Date.now() + 86_400_000 * 30).toISOString(),
        targetZones: ['KE-01', 'KE-02'],
        assignedAgents: [FIELD_AGENT_1.userId, FIELD_AGENT_2.userId],
        targetSubmissions: 10,
        conflictStrategy: 'LAST_WRITE_WINS',
        ...overrides,
      } as never,
      DATA_STEWARD as never,
    );

    // Transition PLANNED → ACTIVE
    const activated = await campaignService.update(
      created.data.id,
      { status: 'ACTIVE' } as never,
      DATA_STEWARD as never,
    );

    return activated.data;
  }

  // ── 1. Campaign → Submission → Kafka ──

  describe('Campaign → Submission → Kafka Event', () => {
    it('creates campaign, submits form, and publishes Kafka event', async () => {
      const campaign = await createActiveCampaign();
      expect(campaign.status).toBe('ACTIVE');

      const kafkaSpy = createKafkaSpy();
      const { service, events } = await createSubmissionService(kafkaSpy);

      const result = await service.submit(
        {
          campaignId: campaign.id,
          data: { diseaseName: 'Foot-and-Mouth Disease', cases: 12, deaths: 2 },
          deviceId: 'device-001',
          gpsLat: -1.2921,
          gpsLng: 36.8219,
          gpsAccuracy: 5.0,
        } as never,
        FIELD_AGENT_1 as never,
      );

      // Submission persisted
      expect(result.data.id).toBeDefined();
      expect(result.data.status).toBe('VALIDATED');
      expect(result.data.campaignId).toBe(campaign.id);
      expect(result.data.templateId).toBe(TEMPLATE_ID);

      // Kafka event published
      const submitted = events.filter((e) => e.topic === 'ms.collecte.form.submitted.v1');
      expect(submitted.length).toBeGreaterThanOrEqual(1);
      expect(submitted[0].key).toBe(result.data.id);

      // Verify in database
      const dbRow = await prisma.submission.findUnique({
        where: { id: result.data.id },
      });
      expect(dbRow).not.toBeNull();
      expect(dbRow!.campaignId).toBe(campaign.id);
      expect(dbRow!.submittedBy).toBe(FIELD_AGENT_1.userId);
      expect(dbRow!.tenantId).toBe(TENANT_ID);
    });

    it('rejects submission to inactive campaign', async () => {
      const campaignService = await createCampaignService();
      const campaign = await createActiveCampaign();

      // Transition ACTIVE → COMPLETED
      await campaignService.update(
        campaign.id,
        { status: 'COMPLETED' } as never,
        DATA_STEWARD as never,
      );

      const { service } = await createSubmissionService();

      await expect(
        service.submit(
          {
            campaignId: campaign.id,
            data: { diseaseName: 'Test', cases: 1 },
          } as never,
          FIELD_AGENT_1 as never,
        ),
      ).rejects.toThrow(/not active/);
    });
  });

  // ── 2. Offline Sync ──

  describe('Offline Sync', () => {
    it('batch of 5 records: 3 new accepted, 1 conflict (client wins), 1 rejected (bad campaign)', async () => {
      const campaign = await createActiveCampaign();
      const kafkaSpy = createKafkaSpy();
      const { service, events } = await createSyncService(kafkaSpy);

      // Pre-create an existing submission for conflict scenario
      const existingId = uuidv4();
      await prisma.submission.create({
        data: {
          id: existingId,
          tenantId: TENANT_ID,
          campaignId: campaign.id,
          templateId: TEMPLATE_ID,
          data: { diseaseName: 'Old Data', cases: 1 },
          submittedBy: FIELD_AGENT_1.userId,
          submittedAt: new Date(),
          status: 'SUBMITTED',
          dataClassification: 'RESTRICTED',
          version: 1,
        },
      });

      const result = await service.deltaSync(
        {
          submissions: [
            // Record 1-3: new submissions → accepted
            {
              campaignId: campaign.id,
              data: { diseaseName: 'Avian Influenza', cases: 5 },
              deviceId: 'device-001',
            },
            {
              campaignId: campaign.id,
              data: { diseaseName: 'Rift Valley Fever', cases: 3 },
              deviceId: 'device-001',
            },
            {
              campaignId: campaign.id,
              data: { diseaseName: 'Peste des Petits Ruminants', cases: 8 },
              deviceId: 'device-001',
            },
            // Record 4: update existing → conflict, client version >= server → client wins
            {
              id: existingId,
              campaignId: campaign.id,
              data: { diseaseName: 'Updated Disease Data', cases: 10 },
              deviceId: 'device-001',
              version: 2,
            },
            // Record 5: invalid campaign → rejected
            {
              campaignId: '00000000-0000-4000-c000-999999999999',
              data: { diseaseName: 'Invalid', cases: 0 },
              deviceId: 'device-001',
            },
          ],
          lastSyncAt: new Date(Date.now() - 3_600_000).toISOString(),
        } as never,
        FIELD_AGENT_1 as never,
      );

      // 3 new accepted + 1 conflict resolved by client (also counted in accepted)
      expect(result.accepted).toHaveLength(4);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].errors[0].field).toBe('campaignId');
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].submissionId).toBe(existingId);
      expect(result.conflicts[0].resolvedBy).toBe('client');
      expect(result.conflicts[0].strategy).toBe('LAST_WRITE_WINS');

      // Kafka sync event published
      const syncEvents = events.filter((e) => e.topic === 'ms.collecte.form.synced.v1');
      expect(syncEvents).toHaveLength(1);

      // Submitted events published for each new record
      const submittedEvents = events.filter((e) => e.topic === 'ms.collecte.form.submitted.v1');
      expect(submittedEvents).toHaveLength(3);

      // Sync log persisted
      const syncLogs = await prisma.syncLog.findMany({
        where: { userId: FIELD_AGENT_1.userId },
        orderBy: { syncedAt: 'desc' },
        take: 1,
      });
      expect(syncLogs).toHaveLength(1);
      expect(syncLogs[0].acceptedCount).toBe(4);
      expect(syncLogs[0].rejectedCount).toBe(1);
      expect(syncLogs[0].conflictCount).toBe(1);
    });

    it('MANUAL_MERGE strategy flags conflict as pending (not accepted)', async () => {
      const campaign = await createActiveCampaign({ conflictStrategy: 'MANUAL_MERGE' });
      const { service } = await createSyncService();

      // Pre-create existing submission
      const existingId = uuidv4();
      await prisma.submission.create({
        data: {
          id: existingId,
          tenantId: TENANT_ID,
          campaignId: campaign.id,
          templateId: TEMPLATE_ID,
          data: { diseaseName: 'Original', cases: 5 },
          submittedBy: FIELD_AGENT_1.userId,
          submittedAt: new Date(),
          status: 'SUBMITTED',
          dataClassification: 'RESTRICTED',
          version: 1,
        },
      });

      const result = await service.deltaSync(
        {
          submissions: [
            {
              id: existingId,
              campaignId: campaign.id,
              data: { diseaseName: 'Updated', cases: 10 },
              version: 2,
            },
          ],
          lastSyncAt: new Date(Date.now() - 3_600_000).toISOString(),
        } as never,
        FIELD_AGENT_1 as never,
      );

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolvedBy).toBe('pending');
      expect(result.conflicts[0].strategy).toBe('MANUAL_MERGE');
      // MANUAL_MERGE conflicts are NOT in accepted
      expect(result.accepted).toHaveLength(0);
    });

    it('LAST_WRITE_WINS: server wins when client version < server version', async () => {
      const campaign = await createActiveCampaign();
      const { service } = await createSyncService();

      // Pre-create existing submission at version 5
      const existingId = uuidv4();
      await prisma.submission.create({
        data: {
          id: existingId,
          tenantId: TENANT_ID,
          campaignId: campaign.id,
          templateId: TEMPLATE_ID,
          data: { diseaseName: 'Server Version', cases: 99 },
          submittedBy: FIELD_AGENT_1.userId,
          submittedAt: new Date(),
          status: 'SUBMITTED',
          dataClassification: 'RESTRICTED',
          version: 5,
        },
      });

      const result = await service.deltaSync(
        {
          submissions: [
            {
              id: existingId,
              campaignId: campaign.id,
              data: { diseaseName: 'Stale Client', cases: 1 },
              version: 3, // client version < server version (5)
            },
          ],
          lastSyncAt: new Date(Date.now() - 3_600_000).toISOString(),
        } as never,
        FIELD_AGENT_1 as never,
      );

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolvedBy).toBe('server');
      // Server wins → NOT in accepted
      expect(result.accepted).toHaveLength(0);

      // Verify server data was NOT overwritten
      const dbRow = await prisma.submission.findUnique({ where: { id: existingId } });
      expect((dbRow!.data as Record<string, unknown>).diseaseName).toBe('Server Version');
      expect(dbRow!.version).toBe(5);
    });
  });

  // ── 3. Campaign Progress ──

  describe('Campaign Progress', () => {
    it('progress updates correctly after submissions', async () => {
      const campaign = await createActiveCampaign({ targetSubmissions: 5 });
      const campaignService = await createCampaignService();

      // Submit 3 forms (all pass quality → VALIDATED)
      const { service } = await createSubmissionService();
      for (let i = 0; i < 3; i++) {
        await service.submit(
          {
            campaignId: campaign.id,
            data: { diseaseName: `Disease ${i}`, cases: i + 1 },
          } as never,
          FIELD_AGENT_1 as never,
        );
      }

      // Check progress
      const result = await campaignService.findOne(campaign.id, DATA_STEWARD as never);
      const progress = result.data.progress;

      expect(progress.totalSubmissions).toBe(3);
      expect(progress.validated).toBe(3);
      expect(progress.rejected).toBe(0);
      expect(progress.pending).toBe(0);
      // completionRate = Math.round((3 / 5) * 10000) / 100 = 60
      expect(progress.completionRate).toBe(60);
    });

    it('progress reflects mixed validated/rejected submissions', async () => {
      const campaign = await createActiveCampaign({ targetSubmissions: 4 });
      const campaignService = await createCampaignService();

      // Submit 2 validated
      const { service: validService } = await createSubmissionService();
      for (let i = 0; i < 2; i++) {
        await validService.submit(
          {
            campaignId: campaign.id,
            data: { diseaseName: `Valid ${i}`, cases: i + 1 },
          } as never,
          FIELD_AGENT_1 as never,
        );
      }

      // Submit 1 that will be rejected by quality gates
      const kafkaSpy = createKafkaSpy();
      const { SubmissionService } = await import('../src/submission/submission.service');
      const failingQualityClient = {
        validate: async () => ({
          data: {
            data: { id: uuidv4(), overallStatus: 'FAILED' },
          },
        }),
      };
      const workflowClient = {
        createInstance: async () => ({ data: { data: { id: uuidv4() } } }),
      };
      const rejectService = new SubmissionService(
        prisma as never,
        kafkaSpy.producer as never,
        failingQualityClient as never,
        workflowClient as never,
      );

      await rejectService.submit(
        {
          campaignId: campaign.id,
          data: { diseaseName: 'Bad Data', cases: 0 },
        } as never,
        FIELD_AGENT_1 as never,
      );

      // Check progress
      const result = await campaignService.findOne(campaign.id, DATA_STEWARD as never);
      const progress = result.data.progress;

      expect(progress.totalSubmissions).toBe(3);
      expect(progress.validated).toBe(2);
      expect(progress.rejected).toBe(1);
      expect(progress.pending).toBe(0);
      // completionRate = Math.round((2 / 4) * 10000) / 100 = 50
      expect(progress.completionRate).toBe(50);
    });
  });

  // ── 4. Concurrent Submissions ──

  describe('Concurrent Submissions', () => {
    it('handles concurrent submissions from multiple agents', async () => {
      const campaign = await createActiveCampaign();

      const { service: svc1 } = await createSubmissionService();
      const { service: svc2 } = await createSubmissionService();

      // Fire 4 concurrent submissions from 2 agents
      const submissions = await Promise.all([
        svc1.submit(
          {
            campaignId: campaign.id,
            data: { diseaseName: 'Agent1 Report A', cases: 5 },
            deviceId: 'device-a1',
          } as never,
          FIELD_AGENT_1 as never,
        ),
        svc2.submit(
          {
            campaignId: campaign.id,
            data: { diseaseName: 'Agent2 Report A', cases: 3 },
            deviceId: 'device-a2',
          } as never,
          FIELD_AGENT_2 as never,
        ),
        svc1.submit(
          {
            campaignId: campaign.id,
            data: { diseaseName: 'Agent1 Report B', cases: 7 },
            deviceId: 'device-a1',
          } as never,
          FIELD_AGENT_1 as never,
        ),
        svc2.submit(
          {
            campaignId: campaign.id,
            data: { diseaseName: 'Agent2 Report B', cases: 2 },
            deviceId: 'device-a2',
          } as never,
          FIELD_AGENT_2 as never,
        ),
      ]);

      // All 4 should succeed
      expect(submissions).toHaveLength(4);
      submissions.forEach((s) => {
        expect(s.data.id).toBeDefined();
        expect(s.data.status).toBe('VALIDATED');
      });

      // All unique IDs
      const ids = submissions.map((s) => s.data.id);
      expect(new Set(ids).size).toBe(4);

      // All persisted in DB
      const dbCount = await prisma.submission.count({
        where: { campaignId: campaign.id, id: { in: ids } },
      });
      expect(dbCount).toBe(4);

      // Verify agent attribution
      const agent1Subs = await prisma.submission.count({
        where: { campaignId: campaign.id, submittedBy: FIELD_AGENT_1.userId, id: { in: ids } },
      });
      const agent2Subs = await prisma.submission.count({
        where: { campaignId: campaign.id, submittedBy: FIELD_AGENT_2.userId, id: { in: ids } },
      });
      expect(agent1Subs).toBe(2);
      expect(agent2Subs).toBe(2);
    });
  });
});
