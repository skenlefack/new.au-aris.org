/**
 * Integration test: Full Collecte Flow
 *
 * Tests the complete pipeline:
 *   1. Create campaign
 *   2. Submit form data → validates against template → publishes Kafka event
 *   3. Offline sync → conflict resolution
 *   4. Campaign progress tracking
 *
 * Uses in-memory mock Prisma (same approach as data-quality integration test).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { KafkaProducerService } from '@aris/kafka-client';
import { TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { PrismaService } from '../src/prisma.service';
import { CampaignService } from '../src/campaign/campaign.service';
import { SubmissionService } from '../src/submission/submission.service';
import { SyncService } from '../src/sync/sync.service';

const adminUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'admin@ke.gov',
  role: UserRole.NATIONAL_ADMIN,
  tenantId: '00000000-0000-0000-0000-000000000010',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

const fieldAgent: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000002',
  email: 'agent@ke.gov',
  role: UserRole.FIELD_AGENT,
  tenantId: '00000000-0000-0000-0000-000000000010',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

// In-memory stores
let campaigns: any[] = [];
let submissions: any[] = [];
let syncLogs: any[] = [];
let idCounter = 0;

function uuid(): string {
  idCounter++;
  return `00000000-0000-0000-0000-${String(idCounter).padStart(12, '0')}`;
}

function createMockPrisma() {
  return {
    campaign: {
      create: vi.fn().mockImplementation(({ data }) => {
        const campaign = { id: uuid(), ...data, createdAt: new Date(), updatedAt: new Date() };
        campaigns.push(campaign);
        return Promise.resolve(campaign);
      }),
      findMany: vi.fn().mockImplementation(({ where } = {}) => {
        let result = [...campaigns];
        if (where?.tenantId) result = result.filter((c) => c.tenantId === where.tenantId);
        if (where?.domain) result = result.filter((c) => c.domain === where.domain);
        if (where?.status) result = result.filter((c) => c.status === where.status);
        if (where?.updatedAt?.gt) {
          const since = where.updatedAt.gt;
          result = result.filter((c) => c.updatedAt > since);
        }
        return Promise.resolve(result);
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(campaigns.find((c) => c.id === where.id) ?? null);
      }),
      count: vi.fn().mockImplementation(({ where } = {}) => {
        let result = [...campaigns];
        if (where?.tenantId) result = result.filter((c) => c.tenantId === where.tenantId);
        return Promise.resolve(result.length);
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const campaign = campaigns.find((c) => c.id === where.id);
        if (campaign) Object.assign(campaign, data, { updatedAt: new Date() });
        return Promise.resolve(campaign);
      }),
    },
    submission: {
      create: vi.fn().mockImplementation(({ data }) => {
        const sub = {
          id: data.id ?? uuid(),
          ...data,
          version: data.version ?? 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        submissions.push(sub);
        return Promise.resolve(sub);
      }),
      findMany: vi.fn().mockImplementation(({ where } = {}) => {
        let result = [...submissions];
        if (where?.tenantId) result = result.filter((s) => s.tenantId === where.tenantId);
        if (where?.campaignId) result = result.filter((s) => s.campaignId === where.campaignId);
        if (where?.status) result = result.filter((s) => s.status === where.status);
        return Promise.resolve(result);
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(submissions.find((s) => s.id === where.id) ?? null);
      }),
      count: vi.fn().mockImplementation(({ where } = {}) => {
        let result = [...submissions];
        if (where?.campaignId) result = result.filter((s) => s.campaignId === where.campaignId);
        if (where?.status) result = result.filter((s) => s.status === where.status);
        return Promise.resolve(result.length);
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const sub = submissions.find((s) => s.id === where.id);
        if (sub) Object.assign(sub, data, { updatedAt: new Date() });
        return Promise.resolve(sub);
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
    syncLog: {
      create: vi.fn().mockImplementation(({ data }) => {
        const log = { id: uuid(), ...data, createdAt: new Date() };
        syncLogs.push(log);
        return Promise.resolve(log);
      }),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
}

describe('Collecte — Full Flow (Integration)', () => {
  let campaignService: CampaignService;
  let submissionService: SubmissionService;
  let syncService: SyncService;
  let kafkaProducer: { send: ReturnType<typeof vi.fn> };
  let prisma: ReturnType<typeof createMockPrisma>;
  let campaignId: string;

  beforeAll(async () => {
    campaigns = [];
    submissions = [];
    syncLogs = [];
    idCounter = 0;

    prisma = createMockPrisma();
    kafkaProducer = { send: vi.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: KafkaProducerService, useValue: kafkaProducer },
        CampaignService,
        SubmissionService,
        SyncService,
      ],
    }).compile();

    campaignService = module.get(CampaignService);
    submissionService = module.get(SubmissionService);
    syncService = module.get(SyncService);
  });

  it('Step 1: Create a campaign', async () => {
    const result = await campaignService.create(
      {
        name: 'Kenya FMD Surveillance Q1 2025',
        domain: 'health',
        templateId: '00000000-0000-0000-0000-000000000200',
        startDate: '2025-01-01',
        endDate: '2025-03-31',
        targetZones: ['zone-1', 'zone-2'],
        assignedAgents: [fieldAgent.userId],
        targetSubmissions: 100,
      } as any,
      adminUser,
    );

    expect(result.data).toBeDefined();
    expect(result.data.name).toBe('Kenya FMD Surveillance Q1 2025');
    expect(result.data.status).toBe('PLANNED');
    campaignId = result.data.id;

    // Kafka campaign created event
    expect(kafkaProducer.send).toHaveBeenCalledWith(
      'ms.collecte.campaign.created.v1',
      expect.any(String),
      expect.objectContaining({ name: 'Kenya FMD Surveillance Q1 2025' }),
      expect.any(Object),
    );
  });

  it('Step 2: Activate the campaign', async () => {
    const result = await campaignService.update(
      campaignId,
      { status: 'ACTIVE' },
      adminUser,
    );

    expect(result.data.status).toBe('ACTIVE');
  });

  it('Step 3: Submit form data (valid)', async () => {
    kafkaProducer.send.mockClear();

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
        deviceId: 'device-001',
        gpsLat: -1.28,
        gpsLng: 36.82,
        gpsAccuracy: 5.0,
      } as any,
      fieldAgent,
    );

    expect(result.data).toBeDefined();
    expect(result.data.status).toBe('SUBMITTED');
    expect(result.data.campaignId).toBe(campaignId);

    // Kafka submitted event
    expect(kafkaProducer.send).toHaveBeenCalledWith(
      'ms.collecte.form.submitted.v1',
      expect.any(String),
      expect.objectContaining({ campaignId }),
      expect.any(Object),
    );
  });

  it('Step 4: Submit form data (invalid schema) — should be rejected', async () => {
    await expect(
      submissionService.submit(
        {
          campaignId,
          data: {
            // Missing required speciesCode and countryCode
            cases: 'not-a-number', // Also wrong type
          },
        } as any,
        fieldAgent,
      ),
    ).rejects.toThrow();
  });

  it('Step 5: Offline sync — new submissions from field', async () => {
    kafkaProducer.send.mockClear();

    const result = await syncService.deltaSync(
      {
        submissions: [
          {
            campaignId,
            data: {
              speciesCode: 'OVI',
              countryCode: 'KE',
              reportDate: '2025-01-20',
              cases: 3,
              deaths: 0,
            },
            deviceId: 'device-002',
            offlineCreatedAt: new Date(Date.now() - 7200000).toISOString(),
          },
          {
            campaignId,
            data: {
              speciesCode: 'CAP',
              countryCode: 'KE',
              reportDate: '2025-01-22',
              cases: 10,
              deaths: 2,
            },
            deviceId: 'device-002',
            offlineCreatedAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
        lastSyncAt: new Date(Date.now() - 86400000).toISOString(),
      } as any,
      fieldAgent,
    );

    expect(result.accepted).toHaveLength(2);
    expect(result.rejected).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    expect(result.syncedAt).toBeDefined();

    // Sync event published
    expect(kafkaProducer.send).toHaveBeenCalledWith(
      'ms.collecte.form.synced.v1',
      expect.any(String),
      expect.objectContaining({ acceptedCount: 2 }),
      expect.any(Object),
    );

    // Sync log created
    expect(prisma.syncLog.create).toHaveBeenCalledOnce();
  });

  it('Step 6: Offline sync — conflict resolution (last-write-wins)', async () => {
    // Get an existing submission to create a conflict with
    const existingSub = submissions[0];
    const existingId = existingSub.id;

    const result = await syncService.deltaSync(
      {
        submissions: [
          {
            id: existingId,
            campaignId,
            data: {
              speciesCode: 'BOV',
              countryCode: 'KE',
              reportDate: '2025-01-15',
              cases: 8, // Updated from 5 to 8
              deaths: 2, // Updated from 1 to 2
            },
            version: 1, // Same or higher than server → client wins
          },
        ],
        lastSyncAt: new Date(Date.now() - 86400000).toISOString(),
      } as any,
      fieldAgent,
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].submissionId).toBe(existingId);
    expect(result.conflicts[0].resolvedBy).toBe('client');
    expect(result.accepted).toContain(existingId);
  });

  it('Step 7: Campaign progress stats', async () => {
    const result = await campaignService.findOne(campaignId, adminUser);

    expect(result.data.progress).toBeDefined();
    expect(result.data.progress.totalSubmissions).toBeGreaterThanOrEqual(3);
  });

  it('Step 8: List submissions with filters', async () => {
    const allSubs = await submissionService.findAll(fieldAgent, {});
    expect(allSubs.data.length).toBeGreaterThanOrEqual(3);

    const campaignSubs = await submissionService.findAll(fieldAgent, {
      campaignId,
    });
    expect(campaignSubs.data.length).toBeGreaterThanOrEqual(3);
  });

  it('Step 9: Sync with server updates returns updated campaigns', async () => {
    // Update a campaign to generate a server update
    await campaignService.update(
      campaignId,
      { description: 'Updated description' },
      adminUser,
    );

    const result = await syncService.deltaSync(
      {
        submissions: [],
        lastSyncAt: new Date(Date.now() - 86400000).toISOString(),
      } as any,
      fieldAgent,
    );

    expect(result.serverUpdates).toHaveLength(1);
    expect(result.serverUpdates[0].id).toBe(campaignId);
  });
});
