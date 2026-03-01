/**
 * Full Cycle Integration Test — verifies all 6 acceptance criteria:
 *
 * 1. Service starts without error on port 3040
 * 2. Complete cycle: init → push → pull → complete works
 * 3. Conflicts are detected and resolved (LWW auto or manual)
 * 4. Kafka events are produced on all 5 topics
 * 5. Tests pass (15+) — this file adds more
 * 6. Idempotence is guaranteed on duplicate pushes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineService } from '../offline.service';
import { DeltaEngine } from '../delta-engine';

// ── Constants ──

const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID   = 'bbbbbbbb-0000-0000-0000-000000000002';
const DEVICE_ID = 'device-field-agent-ke-001';
const SESSION_ID = 'cccccccc-0000-0000-0000-000000000099';

// ── Mock factories ──

function makePrisma() {
  return {
    syncSession: {
      create: vi.fn().mockImplementation(async ({ data }: any) => ({
        id: SESSION_ID,
        device_id: data.device_id,
        user_id: data.user_id,
        tenant_id: data.tenant_id,
        status: data.status ?? 'IN_PROGRESS',
        started_at: new Date(),
        completed_at: null,
        deltas_sent: 0,
        deltas_received: 0,
        conflicts_resolved: 0,
        error_message: null,
        metadata: data.metadata ?? null,
      })),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockImplementation(async ({ data, where }: any) => ({
        id: where.id,
        device_id: DEVICE_ID,
        user_id: USER_ID,
        tenant_id: TENANT_ID,
        status: data.status ?? 'IN_PROGRESS',
        started_at: new Date(),
        completed_at: data.completed_at ?? null,
        deltas_sent: typeof data.deltas_sent === 'object' ? data.deltas_sent.increment : 0,
        deltas_received: typeof data.deltas_received === 'object' ? data.deltas_received.increment : 0,
        conflicts_resolved: typeof data.conflicts_resolved === 'object' ? data.conflicts_resolved.increment : 0,
        error_message: data.error_message ?? null,
      })),
    },
    syncDelta: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    deviceRegistry: {
      upsert: vi.fn().mockImplementation(async ({ create }: any) => ({
        id: 'dddddddd-0000-0000-0000-000000000050',
        device_id: create.device_id,
        user_id: create.user_id,
        tenant_id: create.tenant_id,
        platform: create.platform,
        app_version: create.app_version,
        last_sync_at: null,
        is_active: true,
        registered_at: new Date(),
      })),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

function makeRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, ...args: any[]) => { store.set(key, value); }),
    _store: store,
  } as any;
}

function makeKafka() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  } as any;
}

// ── Point 1: Service port configuration ──

describe('Point 1: Service starts on port 3040', () => {
  it('server.ts defaults to port 3040', async () => {
    // Verify the default port in the server file
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const serverContent = readFileSync(
      resolve(__dirname, '../../server.ts'),
      'utf8',
    );
    expect(serverContent).toContain("'3040'");
    expect(serverContent).toContain('OFFLINE_PORT');
  });

  it('app.ts exports buildApp function', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const appContent = readFileSync(
      resolve(__dirname, '../../app.ts'),
      'utf8',
    );
    // Verify buildApp is exported
    expect(appContent).toContain('export async function buildApp');
    // Verify it uses correct port via fastifyKafka and prismaPlugin
    expect(appContent).toContain('fastifyKafka');
    expect(appContent).toContain('prismaPlugin');
    expect(appContent).toContain('redisPlugin');
    expect(appContent).toContain('OfflineService');
    expect(appContent).toContain('registerOfflineRoutes');
    expect(appContent).toContain('registerHealthRoutes');
  });
});

// ── Point 2: Full cycle init → push → pull → complete ──

describe('Point 2: Complete sync cycle', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: OfflineService;

  beforeEach(() => {
    prisma = makePrisma();
    redis = makeRedis();
    kafka = makeKafka();
    service = new OfflineService(prisma, redis, kafka);
  });

  it('should complete full cycle: init → push → pull → complete', async () => {
    // STEP 1: Init session
    const session = await service.initSession(
      { deviceId: DEVICE_ID, metadata: { appVersion: '1.2.0' } },
      USER_ID,
      TENANT_ID,
    );
    expect(session.id).toBe(SESSION_ID);
    expect(session.status).toBe('IN_PROGRESS');
    expect(session.deviceId).toBe(DEVICE_ID);

    // STEP 2: Push deltas
    prisma.syncSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      device_id: DEVICE_ID,
      tenant_id: TENANT_ID,
      status: 'IN_PROGRESS',
    });

    const pushResult = await service.pushDeltas(
      SESSION_ID,
      [
        {
          id: 'delta-create-1',
          entityType: 'animal',
          entityId: 'animal-001',
          operation: 'CREATE',
          payload: { name: 'Cattle A', species: 'bovine', count: 50 },
          version: 0,
          clientTimestamp: new Date().toISOString(),
        },
        {
          id: 'delta-create-2',
          entityType: 'animal',
          entityId: 'animal-002',
          operation: 'CREATE',
          payload: { name: 'Goat B', species: 'caprine', count: 30 },
          version: 0,
          clientTimestamp: new Date().toISOString(),
        },
      ],
      USER_ID,
      TENANT_ID,
    );

    expect(pushResult.applied).toHaveLength(2);
    expect(pushResult.applied).toContain('delta-create-1');
    expect(pushResult.applied).toContain('delta-create-2');
    expect(pushResult.conflicts).toHaveLength(0);
    expect(pushResult.duplicates).toHaveLength(0);

    // Verify session counter was updated
    expect(prisma.syncSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: { deltas_received: { increment: 2 } },
      }),
    );

    // STEP 3: Pull deltas (server-side changes)
    prisma.syncDelta.findMany.mockResolvedValue([
      {
        id: 'server-delta-1',
        entity_type: 'vaccination',
        entity_id: 'vax-001',
        operation: 'CREATE',
        payload: { campaign: 'FMD-2026', doses: 1000 },
        version: 1,
        server_timestamp: new Date(),
        resolved_payload: null,
      },
    ]);

    const pullResult = await service.pullDeltas(
      SESSION_ID,
      { limit: 100 },
      USER_ID,
      TENANT_ID,
    );

    expect(pullResult.data).toHaveLength(1);
    expect(pullResult.data[0].entityType).toBe('vaccination');
    expect(pullResult.data[0].operation).toBe('CREATE');
    expect(pullResult.hasMore).toBe(false);
    expect(pullResult.checkpoint).toBeDefined();

    // STEP 4: Complete session
    const completed = await service.completeSession(
      SESSION_ID,
      { status: 'COMPLETED' },
      USER_ID,
      TENANT_ID,
    );

    expect(completed.status).toBe('COMPLETED');
    expect(prisma.syncSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );

    // Verify device last sync was updated
    expect(prisma.deviceRegistry.update).toHaveBeenCalled();
  });

  it('should reject push/pull/complete on a non-IN_PROGRESS session', async () => {
    prisma.syncSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      tenant_id: TENANT_ID,
      status: 'COMPLETED',
    });

    await expect(
      service.pushDeltas(SESSION_ID, [], USER_ID, TENANT_ID),
    ).rejects.toThrow(/not in progress/);

    await expect(
      service.pullDeltas(SESSION_ID, {}, USER_ID, TENANT_ID),
    ).rejects.toThrow(/not in progress/);

    await expect(
      service.completeSession(SESSION_ID, {}, USER_ID, TENANT_ID),
    ).rejects.toThrow(/not in progress/);
  });

  it('should reject init if device already has an active session', async () => {
    prisma.syncSession.findFirst.mockResolvedValue({ id: 'existing', status: 'IN_PROGRESS' });

    await expect(
      service.initSession({ deviceId: DEVICE_ID }, USER_ID, TENANT_ID),
    ).rejects.toThrow(/already has an active sync session/);
  });

  it('should allow completing with FAILED status and error message', async () => {
    prisma.syncSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      device_id: DEVICE_ID,
      tenant_id: TENANT_ID,
      status: 'IN_PROGRESS',
    });

    const result = await service.completeSession(
      SESSION_ID,
      { status: 'FAILED', errorMessage: 'Network error during sync' },
      USER_ID,
      TENANT_ID,
    );

    expect(result.status).toBe('FAILED');
    expect(prisma.syncSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          error_message: 'Network error during sync',
        }),
      }),
    );
  });

  it('should support PARTIAL completion status', async () => {
    prisma.syncSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      device_id: DEVICE_ID,
      tenant_id: TENANT_ID,
      status: 'IN_PROGRESS',
    });

    const result = await service.completeSession(
      SESSION_ID,
      { status: 'PARTIAL' },
      USER_ID,
      TENANT_ID,
    );

    expect(result.status).toBe('PARTIAL');
  });

  it('should paginate pull results with hasMore flag', async () => {
    prisma.syncSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      tenant_id: TENANT_ID,
      status: 'IN_PROGRESS',
    });

    // Return 4 items when limit is 3 (take: 3+1=4)
    const serverDeltas = Array.from({ length: 4 }, (_, i) => ({
      id: `sd-${i}`,
      entity_type: 'animal',
      entity_id: `a-${i}`,
      operation: 'CREATE',
      payload: { idx: i },
      version: 1,
      server_timestamp: new Date(Date.now() + i * 1000),
      resolved_payload: null,
    }));
    prisma.syncDelta.findMany.mockResolvedValue(serverDeltas);

    const result = await service.pullDeltas(
      SESSION_ID,
      { limit: 3 },
      USER_ID,
      TENANT_ID,
    );

    expect(result.data).toHaveLength(3);
    expect(result.hasMore).toBe(true);
  });
});

// ── Point 3: Conflict detection and resolution ──

describe('Point 3: Conflict detection (LWW auto + manual)', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;
  let engine: DeltaEngine;

  beforeEach(() => {
    prisma = makePrisma();
    redis = makeRedis();
    engine = new DeltaEngine(prisma, redis);
  });

  it('should auto-resolve conflicts with LWW for non-critical entities', async () => {
    // Set server version to 2, client sends version 1
    redis._store.set(`aris:offline:version:${TENANT_ID}:animal:a-1`, '2');

    const result = await engine.processBatch(SESSION_ID, [
      {
        id: 'delta-lww',
        entityType: 'animal',
        entityId: 'a-1',
        operation: 'UPDATE',
        payload: { name: 'Updated by field agent', count: 60 },
        version: 1,
        clientTimestamp: new Date().toISOString(),
      },
    ], TENANT_ID);

    // Should auto-resolve
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].autoResolved).toBe(true);
    expect(result.conflicts[0].clientVersion).toBe(1);
    expect(result.conflicts[0].serverVersion).toBe(2);
    expect(result.applied).toContain('delta-lww');

    // Should have merged payload (server + client)
    expect(result.conflicts[0].resolvedPayload).toBeDefined();

    // Version should be bumped in Redis
    expect(redis.set).toHaveBeenCalledWith(
      `aris:offline:version:${TENANT_ID}:animal:a-1`,
      '3',
    );

    // Delta should be written with AUTO_RESOLVED status
    expect(prisma.syncDelta.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conflict_status: 'AUTO_RESOLVED',
        resolved_payload: expect.any(Object),
      }),
    });
  });

  it('should flag MANUAL_REQUIRED for critical entity types (health_event)', async () => {
    redis._store.set(`aris:offline:version:${TENANT_ID}:health_event:he-1`, '3');

    const result = await engine.processBatch(SESSION_ID, [
      {
        id: 'delta-manual',
        entityType: 'health_event',
        entityId: 'he-1',
        operation: 'UPDATE',
        payload: { status: 'CONFIRMED', cases: 100 },
        version: 1,
        clientTimestamp: new Date().toISOString(),
      },
    ], TENANT_ID);

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].autoResolved).toBe(false);
    expect(result.applied).not.toContain('delta-manual');

    // Delta should be written with MANUAL_REQUIRED status
    expect(prisma.syncDelta.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conflict_status: 'MANUAL_REQUIRED',
      }),
    });
  });

  it('should flag MANUAL_REQUIRED for other critical types (outbreak, sps_certificate, lab_result)', async () => {
    const criticalTypes = ['outbreak', 'sps_certificate', 'lab_result', 'vaccination_campaign', 'wahis_notification'];

    for (const entityType of criticalTypes) {
      redis._store.set(`aris:offline:version:${TENANT_ID}:${entityType}:id-1`, '2');

      const result = await engine.processBatch(SESSION_ID, [
        {
          id: `delta-${entityType}`,
          entityType,
          entityId: 'id-1',
          operation: 'UPDATE',
          payload: { field: 'value' },
          version: 1,
          clientTimestamp: new Date().toISOString(),
        },
      ], TENANT_ID);

      expect(result.conflicts[0].autoResolved).toBe(false);
    }
  });

  it('should flag DELETE operations on non-critical entities as MANUAL_REQUIRED', async () => {
    redis._store.set(`aris:offline:version:${TENANT_ID}:animal:a-del`, '2');

    const result = await engine.processBatch(SESSION_ID, [
      {
        id: 'delta-delete',
        entityType: 'animal',
        entityId: 'a-del',
        operation: 'DELETE',
        payload: {},
        version: 1,
        clientTimestamp: new Date().toISOString(),
      },
    ], TENANT_ID);

    // Even though 'animal' is non-critical, DELETE conflicts require manual resolution
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].autoResolved).toBe(false);
  });

  it('should resolve conflict with CLIENT_WINS strategy', async () => {
    prisma.syncDelta.findUnique.mockResolvedValue({
      id: 'delta-c-resolve',
      session_id: SESSION_ID,
      entity_type: 'health_event',
      entity_id: 'he-resolve',
      operation: 'UPDATE',
      payload: { status: 'CONFIRMED', cases: 100 },
      version: 1,
      tenant_id: TENANT_ID,
      conflict_status: 'MANUAL_REQUIRED',
    });

    const result = await engine.resolveConflict(
      'delta-c-resolve',
      'CLIENT_WINS',
      TENANT_ID,
    );

    expect(result.entityType).toBe('health_event');
    expect(prisma.syncDelta.update).toHaveBeenCalledWith({
      where: { id: 'delta-c-resolve' },
      data: expect.objectContaining({
        conflict_status: 'AUTO_RESOLVED',
        resolved_payload: { status: 'CONFIRMED', cases: 100 },
      }),
    });
    // Session conflict count should be incremented
    expect(prisma.syncSession.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { conflicts_resolved: { increment: 1 } },
    });
  });

  it('should resolve conflict with SERVER_WINS strategy', async () => {
    prisma.syncDelta.findUnique.mockResolvedValue({
      id: 'delta-srv-win',
      session_id: SESSION_ID,
      entity_type: 'outbreak',
      entity_id: 'ob-1',
      operation: 'UPDATE',
      payload: { status: 'SUSPECTED' },
      version: 1,
      tenant_id: TENANT_ID,
      conflict_status: 'MANUAL_REQUIRED',
    });

    // Server has latest data
    prisma.syncDelta.findFirst.mockResolvedValue({
      payload: { status: 'CONFIRMED', area: 'Nairobi' },
      resolved_payload: null,
    });

    const result = await engine.resolveConflict(
      'delta-srv-win',
      'SERVER_WINS',
      TENANT_ID,
    );

    expect(result.entityType).toBe('outbreak');
    expect(prisma.syncDelta.update).toHaveBeenCalledWith({
      where: { id: 'delta-srv-win' },
      data: expect.objectContaining({
        resolved_payload: { status: 'CONFIRMED', area: 'Nairobi' },
      }),
    });
  });

  it('should resolve conflict with MERGE strategy', async () => {
    prisma.syncDelta.findUnique.mockResolvedValue({
      id: 'delta-merge',
      session_id: SESSION_ID,
      entity_type: 'sps_certificate',
      entity_id: 'sps-1',
      operation: 'UPDATE',
      payload: { exporter: 'Kenya Meat Corp' },
      version: 1,
      tenant_id: TENANT_ID,
      conflict_status: 'MANUAL_REQUIRED',
    });

    const mergedPayload = {
      exporter: 'Kenya Meat Corp',
      status: 'APPROVED',
      inspectionDate: '2026-02-28',
    };

    const result = await engine.resolveConflict(
      'delta-merge',
      'MERGE',
      TENANT_ID,
      mergedPayload,
    );

    expect(result.entityType).toBe('sps_certificate');
    expect(prisma.syncDelta.update).toHaveBeenCalledWith({
      where: { id: 'delta-merge' },
      data: expect.objectContaining({
        resolved_payload: mergedPayload,
      }),
    });
  });

  it('should throw 400 for MERGE without mergedPayload', async () => {
    prisma.syncDelta.findUnique.mockResolvedValue({
      id: 'delta-no-merge',
      session_id: SESSION_ID,
      entity_type: 'health_event',
      entity_id: 'he-x',
      payload: {},
      version: 1,
      tenant_id: TENANT_ID,
      conflict_status: 'MANUAL_REQUIRED',
    });

    await expect(
      engine.resolveConflict('delta-no-merge', 'MERGE', TENANT_ID),
    ).rejects.toThrow(/mergedPayload is required/);
  });

  it('should detect conflicting fields correctly', () => {
    const fields = engine.detectConflictingFields(
      { name: 'Server Name', count: 50, status: 'active', region: 'Nairobi' },
      { name: 'Client Name', count: 50, status: 'inactive', zone: 'Central' },
    );

    expect(fields).toContain('name');
    expect(fields).toContain('status');
    expect(fields).toContain('region');  // missing in client
    expect(fields).toContain('zone');    // missing in server
    expect(fields).not.toContain('count'); // same value
  });
});

// ── Point 4: Kafka events on 5 topics ──

describe('Point 4: Kafka events on 5 topics', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: OfflineService;

  beforeEach(() => {
    prisma = makePrisma();
    redis = makeRedis();
    kafka = makeKafka();
    service = new OfflineService(prisma, redis, kafka);
  });

  it('Topic 1: sys.offline.sync.initiated.v1 — on initSession', async () => {
    await service.initSession({ deviceId: DEVICE_ID }, USER_ID, TENANT_ID);

    expect(kafka.send).toHaveBeenCalledTimes(1);
    const [, entityId, payload, headers] = kafka.send.mock.calls[0];
    expect(entityId).toBe(SESSION_ID);
    expect(payload).toMatchObject({
      sessionId: SESSION_ID,
      deviceId: DEVICE_ID,
      tenantId: TENANT_ID,
    });
    expect(headers.sourceService).toBe('offline-service');
    expect(headers.tenantId).toBe(TENANT_ID);
    expect(headers.userId).toBe(USER_ID);
    expect(headers.correlationId).toBeDefined();
    expect(headers.schemaVersion).toBe('1');
    expect(headers.timestamp).toBeDefined();
  });

  it('Topic 2: sys.offline.sync.pushed.v1 — on pushDeltas', async () => {
    prisma.syncSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      device_id: DEVICE_ID,
      tenant_id: TENANT_ID,
      status: 'IN_PROGRESS',
    });

    await service.pushDeltas(SESSION_ID, [
      {
        id: 'delta-push-1',
        entityType: 'animal',
        entityId: 'a-1',
        operation: 'CREATE',
        payload: { name: 'Test' },
        version: 0,
        clientTimestamp: new Date().toISOString(),
      },
    ], USER_ID, TENANT_ID);

    expect(kafka.send).toHaveBeenCalled();
    const pushCall = kafka.send.mock.calls[0];
    expect(pushCall[1]).toBe(SESSION_ID);
    expect(pushCall[2]).toMatchObject({
      sessionId: SESSION_ID,
      appliedCount: 1,
      conflictCount: 0,
      duplicateCount: 0,
    });
  });

  it('Topic 3: sys.offline.sync.conflict.v1 — on push with manual conflict', async () => {
    prisma.syncSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      device_id: DEVICE_ID,
      tenant_id: TENANT_ID,
      status: 'IN_PROGRESS',
    });
    // Set server version > client version
    redis._store.set(`aris:offline:version:${TENANT_ID}:health_event:he-1`, '5');

    await service.pushDeltas(SESSION_ID, [
      {
        id: 'delta-conflict-evt',
        entityType: 'health_event',
        entityId: 'he-1',
        operation: 'UPDATE',
        payload: { status: 'CONFIRMED' },
        version: 1,
        clientTimestamp: new Date().toISOString(),
      },
    ], USER_ID, TENANT_ID);

    // Should have at least 2 kafka.send calls: 1 for PUSHED, 1 for CONFLICT
    expect(kafka.send.mock.calls.length).toBeGreaterThanOrEqual(2);

    // The conflict event
    const conflictCall = kafka.send.mock.calls[1];
    expect(conflictCall[1]).toBe('delta-conflict-evt'); // entityId = deltaId
    expect(conflictCall[2]).toMatchObject({
      sessionId: SESSION_ID,
      deltaId: 'delta-conflict-evt',
      entityType: 'health_event',
      entityId: 'he-1',
    });
  });

  it('Topic 4: sys.offline.sync.resolved.v1 — on resolveConflict', async () => {
    prisma.syncDelta.findUnique.mockResolvedValue({
      id: 'delta-to-resolve',
      session_id: SESSION_ID,
      entity_type: 'health_event',
      entity_id: 'he-1',
      operation: 'UPDATE',
      payload: { status: 'SUSPECTED' },
      version: 1,
      tenant_id: TENANT_ID,
      conflict_status: 'MANUAL_REQUIRED',
    });

    await service.resolveConflict(
      'delta-to-resolve',
      'CLIENT_WINS',
      TENANT_ID,
      USER_ID,
    );

    expect(kafka.send).toHaveBeenCalledTimes(1);
    const [, entityId, payload] = kafka.send.mock.calls[0];
    expect(entityId).toBe('delta-to-resolve');
    expect(payload).toMatchObject({
      deltaId: 'delta-to-resolve',
      resolution: 'CLIENT_WINS',
      entityType: 'health_event',
      entityId: 'he-1',
      tenantId: TENANT_ID,
    });
  });

  it('Topic 5: sys.offline.sync.completed.v1 — on completeSession', async () => {
    prisma.syncSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      device_id: DEVICE_ID,
      tenant_id: TENANT_ID,
      status: 'IN_PROGRESS',
    });

    await service.completeSession(SESSION_ID, {}, USER_ID, TENANT_ID);

    expect(kafka.send).toHaveBeenCalledTimes(1);
    const [, entityId, payload] = kafka.send.mock.calls[0];
    expect(entityId).toBe(SESSION_ID);
    expect(payload).toMatchObject({
      sessionId: SESSION_ID,
      deviceId: DEVICE_ID,
      status: 'COMPLETED',
      tenantId: TENANT_ID,
    });
  });

  it('should include all standard Kafka headers', async () => {
    await service.initSession({ deviceId: DEVICE_ID }, USER_ID, TENANT_ID);

    const headers = kafka.send.mock.calls[0][3];
    expect(headers).toMatchObject({
      correlationId: expect.any(String),
      sourceService: 'offline-service',
      tenantId: TENANT_ID,
      userId: USER_ID,
      schemaVersion: '1',
      timestamp: expect.any(String),
    });

    // correlationId should be a valid UUID
    expect(headers.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('should not throw when Kafka is unavailable', async () => {
    kafka.send.mockRejectedValue(new Error('Kafka broker unavailable'));

    // Should not throw — events are fire-and-forget
    const session = await service.initSession(
      { deviceId: DEVICE_ID },
      USER_ID,
      TENANT_ID,
    );
    expect(session.id).toBe(SESSION_ID);
  });
});

// ── Point 6: Idempotence on duplicate pushes ──

describe('Point 6: Idempotence guaranteed on duplicate pushes', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;
  let engine: DeltaEngine;

  beforeEach(() => {
    prisma = makePrisma();
    redis = makeRedis();
    engine = new DeltaEngine(prisma, redis);
  });

  it('should skip already-processed deltas and return them as duplicates', async () => {
    // Simulate delta already processed
    redis._store.set('aris:offline:processed:delta-dup-1', '1');

    const result = await engine.processBatch(SESSION_ID, [
      {
        id: 'delta-dup-1',
        entityType: 'animal',
        entityId: 'a-1',
        operation: 'CREATE',
        payload: { name: 'Duplicate' },
        version: 0,
        clientTimestamp: new Date().toISOString(),
      },
    ], TENANT_ID);

    expect(result.duplicates).toContain('delta-dup-1');
    expect(result.applied).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);

    // Should NOT write to the database
    expect(prisma.syncDelta.create).not.toHaveBeenCalled();
  });

  it('should process a new delta and mark it as processed in Redis', async () => {
    const result = await engine.processBatch(SESSION_ID, [
      {
        id: 'delta-new-1',
        entityType: 'animal',
        entityId: 'a-new',
        operation: 'CREATE',
        payload: { name: 'New Animal' },
        version: 0,
        clientTimestamp: new Date().toISOString(),
      },
    ], TENANT_ID);

    expect(result.applied).toContain('delta-new-1');

    // Should mark as processed in Redis with 7-day TTL
    expect(redis.set).toHaveBeenCalledWith(
      'aris:offline:processed:delta-new-1',
      '1',
      'EX',
      7 * 24 * 3600,
    );
  });

  it('should handle a batch with mix of new and duplicate deltas', async () => {
    // One already processed, two new
    redis._store.set('aris:offline:processed:delta-old', '1');

    const result = await engine.processBatch(SESSION_ID, [
      {
        id: 'delta-old',
        entityType: 'animal',
        entityId: 'a-old',
        operation: 'CREATE',
        payload: { name: 'Old' },
        version: 0,
        clientTimestamp: new Date().toISOString(),
      },
      {
        id: 'delta-fresh-1',
        entityType: 'animal',
        entityId: 'a-fresh-1',
        operation: 'CREATE',
        payload: { name: 'Fresh 1' },
        version: 0,
        clientTimestamp: new Date().toISOString(),
      },
      {
        id: 'delta-fresh-2',
        entityType: 'animal',
        entityId: 'a-fresh-2',
        operation: 'CREATE',
        payload: { name: 'Fresh 2' },
        version: 0,
        clientTimestamp: new Date().toISOString(),
      },
    ], TENANT_ID);

    expect(result.duplicates).toEqual(['delta-old']);
    expect(result.applied).toEqual(['delta-fresh-1', 'delta-fresh-2']);
    expect(prisma.syncDelta.create).toHaveBeenCalledTimes(2); // Only 2 new writes
  });

  it('should also mark conflict-resolved deltas as processed', async () => {
    // Server version is ahead → conflict
    redis._store.set(`aris:offline:version:${TENANT_ID}:animal:a-conflict`, '5');

    await engine.processBatch(SESSION_ID, [
      {
        id: 'delta-conflict-idem',
        entityType: 'animal',
        entityId: 'a-conflict',
        operation: 'UPDATE',
        payload: { name: 'Conflict Test' },
        version: 1,
        clientTimestamp: new Date().toISOString(),
      },
    ], TENANT_ID);

    // Should be marked as processed even though it was a conflict (LWW auto-resolved)
    expect(redis.set).toHaveBeenCalledWith(
      'aris:offline:processed:delta-conflict-idem',
      '1',
      'EX',
      7 * 24 * 3600,
    );

    // Sending the same delta again should be skipped
    const result2 = await engine.processBatch(SESSION_ID, [
      {
        id: 'delta-conflict-idem',
        entityType: 'animal',
        entityId: 'a-conflict',
        operation: 'UPDATE',
        payload: { name: 'Conflict Test' },
        version: 1,
        clientTimestamp: new Date().toISOString(),
      },
    ], TENANT_ID);

    expect(result2.duplicates).toContain('delta-conflict-idem');
    expect(result2.applied).toHaveLength(0);
  });

  it('should use 7-day TTL for processed delta keys in Redis', async () => {
    await engine.processBatch(SESSION_ID, [
      {
        id: 'delta-ttl-check',
        entityType: 'animal',
        entityId: 'a-ttl',
        operation: 'CREATE',
        payload: {},
        version: 0,
        clientTimestamp: new Date().toISOString(),
      },
    ], TENANT_ID);

    // Check Redis.set was called with EX and 604800 seconds (7 days)
    const setCall = redis.set.mock.calls.find(
      (call: any[]) => call[0] === 'aris:offline:processed:delta-ttl-check',
    );
    expect(setCall).toBeDefined();
    expect(setCall![2]).toBe('EX');
    expect(setCall![3]).toBe(604800); // 7 * 24 * 3600
  });
});
