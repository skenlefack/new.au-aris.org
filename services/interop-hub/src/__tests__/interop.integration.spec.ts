import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Integration test — starts a real PostgreSQL container,
 * pushes the full Prisma schema (all schemas), seeds workflow
 * instances, and exercises the WAHIS export generation flow
 * including the cross-schema query to workflow.workflow_instances.
 */

let pgContainer: StartedTestContainer;
let prisma: PrismaClient;
let databaseUrl: string;

const TENANT_ID = '00000000-0000-4000-a000-000000000001';
const USER_ID = '00000000-0000-4000-a000-000000000010';

describe('Interop Hub — WAHIS Export Integration', () => {
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

    process.env['DATABASE_URL'] = databaseUrl;

    // Push Prisma schema (creates ALL schemas: interop_hub, workflow, etc.)
    const schemaPath = require.resolve('@aris/db-schemas/prisma/schema.prisma').replace(/schema\.prisma$/, '');
    execSync(`npx prisma db push --schema=${schemaPath} --skip-generate --accept-data-loss`, {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    // Initialize Prisma client
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    // Seed workflow instances that are WAHIS-ready (health domain)
    await prisma.workflowInstance.createMany({
      data: [
        {
          id: '10000000-0000-4000-a000-000000000001',
          tenant_id: TENANT_ID,
          entity_type: 'submission',
          entity_id: '20000000-0000-4000-a000-000000000001',
          domain: 'health',
          current_level: 'NATIONAL_OFFICIAL',
          status: 'APPROVED',
          wahis_ready: true,
          analytics_ready: false,
          created_by: USER_ID,
          created_at: new Date('2024-03-15'),
        },
        {
          id: '10000000-0000-4000-a000-000000000002',
          tenant_id: TENANT_ID,
          entity_type: 'submission',
          entity_id: '20000000-0000-4000-a000-000000000002',
          domain: 'health',
          current_level: 'CONTINENTAL_PUBLICATION',
          status: 'APPROVED',
          wahis_ready: true,
          analytics_ready: true,
          created_by: USER_ID,
          created_at: new Date('2024-04-20'),
        },
        {
          // Not WAHIS-ready — should be excluded
          id: '10000000-0000-4000-a000-000000000003',
          tenant_id: TENANT_ID,
          entity_type: 'submission',
          entity_id: '20000000-0000-4000-a000-000000000003',
          domain: 'health',
          current_level: 'NATIONAL_TECHNICAL',
          status: 'PENDING',
          wahis_ready: false,
          analytics_ready: false,
          created_by: USER_ID,
          created_at: new Date('2024-05-01'),
        },
        {
          // WAHIS-ready but wrong domain — should be excluded
          id: '10000000-0000-4000-a000-000000000004',
          tenant_id: TENANT_ID,
          entity_type: 'submission',
          entity_id: '20000000-0000-4000-a000-000000000004',
          domain: 'livestock',
          current_level: 'NATIONAL_OFFICIAL',
          status: 'APPROVED',
          wahis_ready: true,
          analytics_ready: false,
          created_by: USER_ID,
          created_at: new Date('2024-04-01'),
        },
        {
          // WAHIS-ready, health, but outside date range — should be excluded
          id: '10000000-0000-4000-a000-000000000005',
          tenant_id: TENANT_ID,
          entity_type: 'submission',
          entity_id: '20000000-0000-4000-a000-000000000005',
          domain: 'health',
          current_level: 'NATIONAL_OFFICIAL',
          status: 'APPROVED',
          wahis_ready: true,
          analytics_ready: false,
          created_by: USER_ID,
          created_at: new Date('2024-08-15'),
        },
      ],
    });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await pgContainer?.stop();
  });

  it('should create export record and generate WAHIS package from real DB', async () => {
    // Import WahisService dynamically to avoid module resolution issues before container starts
    const { WahisService } = await import('../connectors/wahis.service');

    // Mock Kafka producer (Kafka is not under test)
    const mockKafka = { send: async () => [] };

    const service = new WahisService(prisma as never, mockKafka as never);

    const user = {
      userId: USER_ID,
      email: 'cvo@ke.au-aris.org',
      role: 'NATIONAL_ADMIN' as const,
      tenantId: TENANT_ID,
      tenantLevel: 'MEMBER_STATE' as const,
    };

    const result = await service.createExport(
      { countryCode: 'KE', periodStart: '2024-01-01', periodEnd: '2024-06-30' },
      user,
    );

    // Should be COMPLETED with exactly 2 WAHIS-ready health events in range
    expect(result.data.status).toBe('COMPLETED');
    expect(result.data.recordCount).toBe(2);
    expect(result.data.connectorType).toBe('WAHIS');
    expect(result.data.countryCode).toBe('KE');
    expect(result.data.packageUrl).toContain('/download');
    expect(result.data.exportedAt).toBeTruthy();
  });

  it('should persist export record in database', async () => {
    const records = await prisma.exportRecord.findMany({
      where: { connector_type: 'WAHIS' },
      orderBy: { created_at: 'desc' },
    });

    expect(records.length).toBeGreaterThanOrEqual(1);

    const latest = records[0];
    expect(latest.status).toBe('COMPLETED');
    expect(latest.record_count).toBe(2);
    expect(latest.country_code).toBe('KE');
    expect(latest.package_url).toContain('/download');
  });

  it('should generate package with correct event structure', async () => {
    const { WahisService } = await import('../connectors/wahis.service');
    const service = new WahisService(prisma as never, { send: async () => [] } as never);

    const pkg = await service.generateWahisPackage(
      'test-export-id',
      'KE',
      new Date('2024-01-01'),
      new Date('2024-06-30'),
    );

    expect(pkg.exportId).toBe('test-export-id');
    expect(pkg.countryCode).toBe('KE');
    expect(pkg.totalEvents).toBe(2);
    expect(pkg.events).toHaveLength(2);
    expect(pkg.format).toBe('WOAH_JSON');

    // Events should come from the 2 WAHIS-ready health instances in date range
    const eventIds = pkg.events.map((e) => e.eventId).sort();
    expect(eventIds).toEqual([
      '20000000-0000-4000-a000-000000000001',
      '20000000-0000-4000-a000-000000000002',
    ]);

    // Each event should have standard WAHIS fields
    for (const event of pkg.events) {
      expect(event.confidenceLevel).toBe('CONFIRMED');
      expect(event.countryCode).toBe('KE');
      expect(event.reportDate).toBeTruthy();
    }
  });

  it('should return empty package for country/period with no WAHIS-ready events', async () => {
    const { WahisService } = await import('../connectors/wahis.service');
    const service = new WahisService(prisma as never, { send: async () => [] } as never);

    const pkg = await service.generateWahisPackage(
      'empty-export',
      'NG', // Nigeria — no seeded events
      new Date('2024-01-01'),
      new Date('2024-06-30'),
    );

    expect(pkg.totalEvents).toBe(0);
    expect(pkg.events).toHaveLength(0);
    expect(pkg.countryCode).toBe('NG');
  });

  it('should list exports with pagination', async () => {
    const { WahisService } = await import('../connectors/wahis.service');
    const service = new WahisService(prisma as never, { send: async () => [] } as never);

    const user = {
      userId: USER_ID,
      email: 'admin@au-aris.org',
      role: 'CONTINENTAL_ADMIN' as const,
      tenantId: TENANT_ID,
      tenantLevel: 'CONTINENTAL' as const,
    };

    const result = await service.findAll(user, { page: 1, limit: 10 });

    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(10);
    expect(result.meta.total).toBeGreaterThanOrEqual(1);
  });
});
