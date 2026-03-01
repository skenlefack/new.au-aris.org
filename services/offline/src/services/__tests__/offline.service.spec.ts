import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineService } from '../offline.service';

// ── Mock factories ──

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const DEVICE_ID = 'device-android-001';

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    syncSession: {
      create: vi.fn().mockImplementation(async ({ data }: any) => ({
        id: '00000000-0000-0000-0000-000000000099',
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
        deltas_sent: data.deltas_sent?.increment ?? 0,
        deltas_received: data.deltas_received?.increment ?? 0,
        conflicts_resolved: data.conflicts_resolved?.increment ?? 0,
        error_message: data.error_message ?? null,
      })),
      ...overrides.syncSession,
    },
    syncDelta: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      ...overrides.syncDelta,
    },
    deviceRegistry: {
      upsert: vi.fn().mockImplementation(async ({ create }: any) => ({
        id: '00000000-0000-0000-0000-000000000050',
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
      ...overrides.deviceRegistry,
    },
  } as any;
}

function makeRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    _store: store,
  } as any;
}

function makeKafka() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
  } as any;
}

const SESSION_ID = '00000000-0000-0000-0000-000000000099';

describe('OfflineService', () => {
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

  // ── initSession ──

  describe('initSession', () => {
    it('should create a new sync session', async () => {
      const result = await service.initSession(
        { deviceId: DEVICE_ID },
        USER_ID,
        TENANT_ID,
      );

      expect(result.deviceId).toBe(DEVICE_ID);
      expect(result.status).toBe('IN_PROGRESS');
      expect(prisma.syncSession.create).toHaveBeenCalledOnce();
    });

    it('should publish SYNC_INITIATED Kafka event', async () => {
      await service.initSession({ deviceId: DEVICE_ID }, USER_ID, TENANT_ID);

      expect(kafka.send).toHaveBeenCalledTimes(1);
      const call = kafka.send.mock.calls[0];
      // call[1] = entityId (session id), call[2] = payload, call[3] = headers
      expect(call[2]).toMatchObject({ deviceId: DEVICE_ID, tenantId: TENANT_ID });
      expect(call[3]).toMatchObject({ sourceService: 'offline-service', tenantId: TENANT_ID });
    });

    it('should reject if device already has an active session', async () => {
      prisma.syncSession.findFirst.mockResolvedValue({
        id: 'existing-session',
        status: 'IN_PROGRESS',
      });

      await expect(
        service.initSession({ deviceId: DEVICE_ID }, USER_ID, TENANT_ID),
      ).rejects.toThrow(/already has an active sync session/);
    });
  });

  // ── pushDeltas ──

  describe('pushDeltas', () => {
    it('should push deltas to an active session', async () => {
      prisma.syncSession.findUnique.mockResolvedValue({
        id: SESSION_ID,
        device_id: DEVICE_ID,
        tenant_id: TENANT_ID,
        status: 'IN_PROGRESS',
      });

      const result = await service.pushDeltas(
        SESSION_ID,
        [
          {
            id: 'delta-1',
            entityType: 'animal',
            entityId: 'a-1',
            operation: 'CREATE' as const,
            payload: { name: 'Test' },
            version: 0,
            clientTimestamp: new Date().toISOString(),
          },
        ],
        USER_ID,
        TENANT_ID,
      );

      expect(result.applied).toContain('delta-1');
      expect(kafka.send).toHaveBeenCalled();
    });

    it('should reject pushDeltas for non-IN_PROGRESS session', async () => {
      prisma.syncSession.findUnique.mockResolvedValue({
        id: SESSION_ID,
        tenant_id: TENANT_ID,
        status: 'COMPLETED',
      });

      await expect(
        service.pushDeltas(SESSION_ID, [], USER_ID, TENANT_ID),
      ).rejects.toThrow(/not in progress/);
    });

    it('should reject pushDeltas for wrong tenant', async () => {
      prisma.syncSession.findUnique.mockResolvedValue({
        id: SESSION_ID,
        tenant_id: 'other-tenant',
        status: 'IN_PROGRESS',
      });

      await expect(
        service.pushDeltas(SESSION_ID, [], USER_ID, TENANT_ID),
      ).rejects.toThrow(/different tenant/);
    });
  });

  // ── pullDeltas ──

  describe('pullDeltas', () => {
    it('should pull deltas excluding current session', async () => {
      prisma.syncSession.findUnique.mockResolvedValue({
        id: SESSION_ID,
        tenant_id: TENANT_ID,
        status: 'IN_PROGRESS',
      });

      prisma.syncDelta.findMany.mockResolvedValue([
        {
          id: 'server-delta-1',
          entity_type: 'animal',
          entity_id: 'a-100',
          operation: 'CREATE',
          payload: { name: 'Server Animal' },
          version: 1,
          server_timestamp: new Date(),
          resolved_payload: null,
        },
      ]);

      const result = await service.pullDeltas(
        SESSION_ID,
        { limit: 100 },
        USER_ID,
        TENANT_ID,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].entityType).toBe('animal');
      expect(result.hasMore).toBe(false);
    });

    it('should indicate hasMore when results exceed limit', async () => {
      prisma.syncSession.findUnique.mockResolvedValue({
        id: SESSION_ID,
        tenant_id: TENANT_ID,
        status: 'IN_PROGRESS',
      });

      // Return 3 items when limit is 2 (take: limit + 1 = 3)
      prisma.syncDelta.findMany.mockResolvedValue([
        { id: 'd1', entity_type: 'a', entity_id: '1', operation: 'CREATE', payload: {}, version: 1, server_timestamp: new Date(), resolved_payload: null },
        { id: 'd2', entity_type: 'a', entity_id: '2', operation: 'CREATE', payload: {}, version: 1, server_timestamp: new Date(), resolved_payload: null },
        { id: 'd3', entity_type: 'a', entity_id: '3', operation: 'CREATE', payload: {}, version: 1, server_timestamp: new Date(), resolved_payload: null },
      ]);

      const result = await service.pullDeltas(
        SESSION_ID,
        { limit: 2 },
        USER_ID,
        TENANT_ID,
      );

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });
  });

  // ── completeSession ──

  describe('completeSession', () => {
    it('should complete an active session', async () => {
      prisma.syncSession.findUnique.mockResolvedValue({
        id: SESSION_ID,
        device_id: DEVICE_ID,
        tenant_id: TENANT_ID,
        status: 'IN_PROGRESS',
      });

      const result = await service.completeSession(
        SESSION_ID,
        {},
        USER_ID,
        TENANT_ID,
      );

      expect(result.status).toBe('COMPLETED');
      expect(prisma.syncSession.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      });
    });

    it('should publish SYNC_COMPLETED Kafka event', async () => {
      prisma.syncSession.findUnique.mockResolvedValue({
        id: SESSION_ID,
        device_id: DEVICE_ID,
        tenant_id: TENANT_ID,
        status: 'IN_PROGRESS',
      });

      await service.completeSession(SESSION_ID, {}, USER_ID, TENANT_ID);

      expect(kafka.send).toHaveBeenCalled();
      const call = kafka.send.mock.calls[0];
      expect(call[1]).toBe(SESSION_ID);
      expect(call[2]).toMatchObject({ sessionId: SESSION_ID, status: 'COMPLETED' });
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
        { status: 'FAILED', errorMessage: 'Network timeout' },
        USER_ID,
        TENANT_ID,
      );

      expect(result.status).toBe('FAILED');
      expect(prisma.syncSession.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: expect.objectContaining({
          status: 'FAILED',
          error_message: 'Network timeout',
        }),
      });
    });
  });

  // ── getSession ──

  describe('getSession', () => {
    it('should return session info', async () => {
      prisma.syncSession.findUnique.mockResolvedValue({
        id: SESSION_ID,
        device_id: DEVICE_ID,
        user_id: USER_ID,
        tenant_id: TENANT_ID,
        status: 'IN_PROGRESS',
        started_at: new Date(),
        completed_at: null,
        deltas_sent: 10,
        deltas_received: 5,
        conflicts_resolved: 1,
        error_message: null,
      });

      const result = await service.getSession(SESSION_ID, TENANT_ID);

      expect(result.id).toBe(SESSION_ID);
      expect(result.deltasSent).toBe(10);
      expect(result.deltasReceived).toBe(5);
    });

    it('should throw 404 for unknown session', async () => {
      await expect(
        service.getSession('missing', TENANT_ID),
      ).rejects.toThrow(/not found/);
    });
  });

  // ── listConflicts ──

  describe('listConflicts', () => {
    it('should return paginated conflicts', async () => {
      prisma.syncDelta.findMany.mockResolvedValue([
        {
          id: 'c-1',
          session_id: SESSION_ID,
          entity_type: 'health_event',
          entity_id: 'he-1',
          operation: 'UPDATE',
          payload: {},
          version: 1,
          client_timestamp: new Date(),
          server_timestamp: new Date(),
          conflict_status: 'MANUAL_REQUIRED',
        },
      ]);
      prisma.syncDelta.count.mockResolvedValue(1);

      const result = await service.listConflicts(TENANT_ID, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.data[0].conflictStatus).toBe('MANUAL_REQUIRED');
    });
  });

  // ── resolveConflict ──

  describe('resolveConflict', () => {
    it('should delegate to delta engine and publish event', async () => {
      prisma.syncDelta.findUnique.mockResolvedValue({
        id: 'delta-conflict',
        session_id: SESSION_ID,
        entity_type: 'health_event',
        entity_id: 'he-1',
        operation: 'UPDATE',
        payload: { status: 'SUSPECTED' },
        version: 1,
        tenant_id: TENANT_ID,
        conflict_status: 'MANUAL_REQUIRED',
      });

      const result = await service.resolveConflict(
        'delta-conflict',
        'CLIENT_WINS',
        TENANT_ID,
        USER_ID,
      );

      expect(result.entityType).toBe('health_event');
      expect(kafka.send).toHaveBeenCalled();
      const call = kafka.send.mock.calls[0];
      expect(call[1]).toBe('delta-conflict');
      expect(call[2]).toMatchObject({ resolution: 'CLIENT_WINS' });
    });
  });
});
