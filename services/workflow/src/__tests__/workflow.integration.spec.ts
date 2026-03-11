import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Integration test — starts a real PG container, pushes the Prisma schema,
 * then exercises the full 4-level approval flow:
 *   Level 1 (NATIONAL_TECHNICAL) → Level 2 (NATIONAL_OFFICIAL) →
 *   Level 3 (REC_HARMONIZATION)  → Level 4 (CONTINENTAL_PUBLICATION) → APPROVED
 */

let pgContainer: StartedTestContainer;
let prisma: PrismaClient;
let databaseUrl: string;

describe('Workflow Service — Integration (4-level approval flow)', () => {
  beforeAll(async () => {
    // Start PostgreSQL container
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

    // Set env for Prisma
    process.env['DATABASE_URL'] = databaseUrl;

    // Push Prisma schema (creates tables)
    const schemaPath = require.resolve('@aris/db-schemas/prisma/schema.prisma').replace(/schema\.prisma$/, '');
    execSync(`npx prisma db push --schema=${schemaPath} --skip-generate --accept-data-loss`, {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    // Initialize Prisma client
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await pgContainer?.stop();
  }, 30_000);

  async function createWorkflowService() {
    const { WorkflowService } = await import('../services/workflow.service');

    // Mock Kafka producer (no-op for integration tests)
    const kafkaProducer = {
      send: async () => [],
    };

    return new WorkflowService(prisma as never, kafkaProducer as never);
  }

  it('full 4-level approval flow: create → L1 approve → L2 approve (wahisReady) → L3 approve → L4 approve (analyticsReady)', async () => {
    const service = await createWorkflowService();

    // ── Users at each level ──
    const dataSteward = {
      userId: '00000000-0000-4000-a000-000000000001',
      email: 'steward@ke.au-aris.org',
      role: 'DATA_STEWARD',
      tenantId: '00000000-0000-4000-b000-000000000001',
      tenantLevel: 'MEMBER_STATE',
    };

    const nationalAdmin = {
      userId: '00000000-0000-4000-a000-000000000002',
      email: 'cvo@ke.au-aris.org',
      role: 'NATIONAL_ADMIN',
      tenantId: '00000000-0000-4000-b000-000000000001',
      tenantLevel: 'MEMBER_STATE',
    };

    const recAdmin = {
      userId: '00000000-0000-4000-a000-000000000003',
      email: 'coord@igad.au-aris.org',
      role: 'REC_ADMIN',
      tenantId: '00000000-0000-4000-b000-000000000002',
      tenantLevel: 'REC',
    };

    const continentalAdmin = {
      userId: '00000000-0000-4000-a000-000000000004',
      email: 'admin@au-aris.org',
      role: 'CONTINENTAL_ADMIN',
      tenantId: '00000000-0000-4000-b000-000000000003',
      tenantLevel: 'CONTINENTAL',
    };

    // ── 1. Create workflow instance ──
    const created = await service.create(
      { entityType: 'submission', entityId: '00000000-0000-4000-c000-000000000001', domain: 'health' },
      dataSteward as never,
    );

    expect(created.data.currentLevel).toBe('NATIONAL_TECHNICAL');
    expect(created.data.status).toBe('PENDING');
    expect(created.data.wahisReady).toBe(false);
    expect(created.data.analyticsReady).toBe(false);

    const instanceId = created.data.id;

    // Verify persisted in DB
    const dbRow = await (prisma as any).workflowInstance.findUnique({ where: { id: instanceId } });
    expect(dbRow).not.toBeNull();
    expect(dbRow!.current_level).toBe('NATIONAL_TECHNICAL');

    // ── 2. Level 1: DATA_STEWARD approves (NATIONAL_TECHNICAL → NATIONAL_OFFICIAL) ──
    const afterL1 = await service.approve(instanceId, 'Quality checks passed', dataSteward as never);

    expect(afterL1.data.currentLevel).toBe('NATIONAL_OFFICIAL');
    expect(afterL1.data.status).toBe('PENDING');
    expect(afterL1.data.wahisReady).toBe(false);
    expect(afterL1.data.analyticsReady).toBe(false);
    expect(afterL1.data.transitions).toHaveLength(1);
    expect(afterL1.data.transitions![0].action).toBe('APPROVE');
    expect(afterL1.data.transitions![0].fromLevel).toBe('NATIONAL_TECHNICAL');
    expect(afterL1.data.transitions![0].toLevel).toBe('NATIONAL_OFFICIAL');

    // ── 3. Level 2: NATIONAL_ADMIN approves (NATIONAL_OFFICIAL → REC_HARMONIZATION) ──
    //    This should set wahisReady = true
    const afterL2 = await service.approve(instanceId, 'Officially approved for WAHIS', nationalAdmin as never);

    expect(afterL2.data.currentLevel).toBe('REC_HARMONIZATION');
    expect(afterL2.data.status).toBe('PENDING');
    expect(afterL2.data.wahisReady).toBe(true);
    expect(afterL2.data.analyticsReady).toBe(false);
    expect(afterL2.data.transitions).toHaveLength(2);

    // ── 4. Level 3: REC_ADMIN approves (REC_HARMONIZATION → CONTINENTAL_PUBLICATION) ──
    const afterL3 = await service.approve(instanceId, 'Regional harmonization complete', recAdmin as never);

    expect(afterL3.data.currentLevel).toBe('CONTINENTAL_PUBLICATION');
    expect(afterL3.data.status).toBe('PENDING');
    expect(afterL3.data.wahisReady).toBe(true);
    expect(afterL3.data.analyticsReady).toBe(false);
    expect(afterL3.data.transitions).toHaveLength(3);

    // ── 5. Level 4: CONTINENTAL_ADMIN approves (final → APPROVED) ──
    //    This should set analyticsReady = true
    const afterL4 = await service.approve(instanceId, 'Published to continental analytics', continentalAdmin as never);

    expect(afterL4.data.currentLevel).toBe('CONTINENTAL_PUBLICATION');
    expect(afterL4.data.status).toBe('APPROVED');
    expect(afterL4.data.wahisReady).toBe(true);
    expect(afterL4.data.analyticsReady).toBe(true);
    expect(afterL4.data.transitions).toHaveLength(4);

    // ── 6. Verify final state in DB ──
    const finalRow = await (prisma as any).workflowInstance.findUnique({
      where: { id: instanceId },
      include: { transitions: { orderBy: { created_at: 'asc' } } },
    });

    expect(finalRow!.status).toBe('APPROVED');
    expect(finalRow!.wahis_ready).toBe(true);
    expect(finalRow!.analytics_ready).toBe(true);
    expect(finalRow!.transitions).toHaveLength(4);

    // Verify each transition in order
    const transitions = finalRow!.transitions;
    expect(transitions[0].action).toBe('APPROVE');
    expect(transitions[0].from_level).toBe('NATIONAL_TECHNICAL');
    expect(transitions[0].to_level).toBe('NATIONAL_OFFICIAL');

    expect(transitions[1].action).toBe('APPROVE');
    expect(transitions[1].from_level).toBe('NATIONAL_OFFICIAL');
    expect(transitions[1].to_level).toBe('REC_HARMONIZATION');

    expect(transitions[2].action).toBe('APPROVE');
    expect(transitions[2].from_level).toBe('REC_HARMONIZATION');
    expect(transitions[2].to_level).toBe('CONTINENTAL_PUBLICATION');

    expect(transitions[3].action).toBe('APPROVE');
    expect(transitions[3].from_level).toBe('CONTINENTAL_PUBLICATION');
    expect(transitions[3].to_level).toBe('CONTINENTAL_PUBLICATION');
  });

  it('return for correction flow: create → L1 approve → L2 return → L1 re-approve → L2 approve', async () => {
    const service = await createWorkflowService();

    const dataSteward = {
      userId: '00000000-0000-4000-a000-000000000001',
      email: 'steward@ke.au-aris.org',
      role: 'DATA_STEWARD',
      tenantId: '00000000-0000-4000-b000-000000000001',
      tenantLevel: 'MEMBER_STATE',
    };

    const nationalAdmin = {
      userId: '00000000-0000-4000-a000-000000000002',
      email: 'cvo@ke.au-aris.org',
      role: 'NATIONAL_ADMIN',
      tenantId: '00000000-0000-4000-b000-000000000001',
      tenantLevel: 'MEMBER_STATE',
    };

    // Create
    const created = await service.create(
      { entityType: 'submission', entityId: '00000000-0000-4000-c000-000000000002', domain: 'health' },
      dataSteward as never,
    );
    const instanceId = created.data.id;

    // L1 approve
    await service.approve(instanceId, 'Passed', dataSteward as never);

    // L2 returns for correction
    const returned = await service.returnForCorrection(instanceId, 'Missing GPS coordinates', nationalAdmin as never);
    expect(returned.data.currentLevel).toBe('NATIONAL_TECHNICAL');
    expect(returned.data.status).toBe('RETURNED');

    // L1 re-approves after correction
    const reApproved = await service.approve(instanceId, 'GPS data added', dataSteward as never);
    expect(reApproved.data.currentLevel).toBe('NATIONAL_OFFICIAL');
    expect(reApproved.data.status).toBe('PENDING');

    // L2 approves this time
    const approved = await service.approve(instanceId, 'Now complete', nationalAdmin as never);
    expect(approved.data.currentLevel).toBe('REC_HARMONIZATION');
    expect(approved.data.wahisReady).toBe(true);

    // Verify transitions include RETURN
    expect(approved.data.transitions).toHaveLength(4);
    expect(approved.data.transitions![1].action).toBe('RETURN');
  });

  it('reject flow: create → L1 approve → L2 reject → cannot approve', async () => {
    const service = await createWorkflowService();

    const dataSteward = {
      userId: '00000000-0000-4000-a000-000000000001',
      email: 'steward@ke.au-aris.org',
      role: 'DATA_STEWARD',
      tenantId: '00000000-0000-4000-b000-000000000001',
      tenantLevel: 'MEMBER_STATE',
    };

    const nationalAdmin = {
      userId: '00000000-0000-4000-a000-000000000002',
      email: 'cvo@ke.au-aris.org',
      role: 'NATIONAL_ADMIN',
      tenantId: '00000000-0000-4000-b000-000000000001',
      tenantLevel: 'MEMBER_STATE',
    };

    // Create and approve L1
    const created = await service.create(
      { entityType: 'submission', entityId: '00000000-0000-4000-c000-000000000003', domain: 'livestock' },
      dataSteward as never,
    );
    const instanceId = created.data.id;
    await service.approve(instanceId, 'OK', dataSteward as never);

    // L2 rejects
    const rejected = await service.reject(instanceId, 'Fraudulent data detected', nationalAdmin as never);
    expect(rejected.data.status).toBe('REJECTED');

    // Cannot approve after rejection
    await expect(
      service.approve(instanceId, 'Try again', nationalAdmin as never),
    ).rejects.toThrow('Cannot transition workflow in status REJECTED');
  });

  it('dashboard returns correct metrics', async () => {
    const service = await createWorkflowService();

    const continentalAdmin = {
      userId: '00000000-0000-4000-a000-000000000004',
      email: 'admin@au-aris.org',
      role: 'CONTINENTAL_ADMIN',
      tenantId: '00000000-0000-4000-b000-000000000003',
      tenantLevel: 'CONTINENTAL',
    };

    const dashboard = await service.getDashboard(continentalAdmin as never);

    // We created 3 instances in previous tests:
    // 1. Fully approved (APPROVED)
    // 2. At REC_HARMONIZATION level (PENDING, wahisReady=true)
    // 3. Rejected (REJECTED)
    expect(dashboard.data.totalApproved).toBeGreaterThanOrEqual(1);
    expect(dashboard.data.totalRejected).toBeGreaterThanOrEqual(1);
    expect(dashboard.data.wahisReadyCount).toBeGreaterThanOrEqual(1);
    expect(dashboard.data.analyticsReadyCount).toBeGreaterThanOrEqual(1);
  });
});
