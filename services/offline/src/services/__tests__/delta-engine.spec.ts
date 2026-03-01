import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeltaEngine } from '../delta-engine';

// ── Mock factories ──

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    syncDelta: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      ...overrides.syncDelta,
    },
    syncSession: {
      update: vi.fn().mockResolvedValue({}),
      ...overrides.syncSession,
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

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SESSION_ID = '00000000-0000-0000-0000-000000000099';

// ── Tests ──

describe('DeltaEngine', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;
  let engine: DeltaEngine;

  beforeEach(() => {
    prisma = makePrisma();
    redis = makeRedis();
    engine = new DeltaEngine(prisma, redis);
  });

  describe('processBatch', () => {
    it('should apply a CREATE delta when no server version exists', async () => {
      const result = await engine.processBatch(SESSION_ID, [
        {
          id: 'delta-1',
          entityType: 'animal',
          entityId: 'a-1',
          operation: 'CREATE',
          payload: { name: 'Cow' },
          version: 0,
          clientTimestamp: new Date().toISOString(),
        },
      ], TENANT_ID);

      expect(result.applied).toContain('delta-1');
      expect(result.conflicts).toHaveLength(0);
      expect(result.duplicates).toHaveLength(0);
      expect(prisma.syncDelta.create).toHaveBeenCalledOnce();
    });

    it('should apply an UPDATE delta when version matches', async () => {
      // Server version = 1
      redis._store.set(`aris:offline:version:${TENANT_ID}:animal:a-1`, '1');

      const result = await engine.processBatch(SESSION_ID, [
        {
          id: 'delta-2',
          entityType: 'animal',
          entityId: 'a-1',
          operation: 'UPDATE',
          payload: { name: 'Updated Cow' },
          version: 1,
          clientTimestamp: new Date().toISOString(),
        },
      ], TENANT_ID);

      expect(result.applied).toContain('delta-2');
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect a conflict when client version < server version', async () => {
      // Server version = 3, client sends version = 1
      redis._store.set(`aris:offline:version:${TENANT_ID}:animal:a-1`, '3');

      const result = await engine.processBatch(SESSION_ID, [
        {
          id: 'delta-3',
          entityType: 'animal',
          entityId: 'a-1',
          operation: 'UPDATE',
          payload: { name: 'Outdated Cow' },
          version: 1,
          clientTimestamp: new Date().toISOString(),
        },
      ], TENANT_ID);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].clientVersion).toBe(1);
      expect(result.conflicts[0].serverVersion).toBe(3);
    });

    it('should auto-resolve conflict with LWW for non-critical entities', async () => {
      redis._store.set(`aris:offline:version:${TENANT_ID}:animal:a-1`, '2');

      const result = await engine.processBatch(SESSION_ID, [
        {
          id: 'delta-4',
          entityType: 'animal',
          entityId: 'a-1',
          operation: 'UPDATE',
          payload: { name: 'LWW Cow' },
          version: 1,
          clientTimestamp: new Date().toISOString(),
        },
      ], TENANT_ID);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].autoResolved).toBe(true);
      expect(result.applied).toContain('delta-4');
    });

    it('should flag MANUAL_REQUIRED for critical entity types', async () => {
      redis._store.set(`aris:offline:version:${TENANT_ID}:health_event:he-1`, '2');

      const result = await engine.processBatch(SESSION_ID, [
        {
          id: 'delta-5',
          entityType: 'health_event',
          entityId: 'he-1',
          operation: 'UPDATE',
          payload: { status: 'CONFIRMED' },
          version: 1,
          clientTimestamp: new Date().toISOString(),
        },
      ], TENANT_ID);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].autoResolved).toBe(false);
      expect(result.applied).not.toContain('delta-5');
    });

    it('should skip already-processed deltas (idempotence)', async () => {
      redis._store.set('aris:offline:processed:delta-dup', '1');

      const result = await engine.processBatch(SESSION_ID, [
        {
          id: 'delta-dup',
          entityType: 'animal',
          entityId: 'a-1',
          operation: 'CREATE',
          payload: { name: 'Duplicate' },
          version: 0,
          clientTimestamp: new Date().toISOString(),
        },
      ], TENANT_ID);

      expect(result.duplicates).toContain('delta-dup');
      expect(result.applied).toHaveLength(0);
      expect(prisma.syncDelta.create).not.toHaveBeenCalled();
    });

    it('should process a batch of mixed operations', async () => {
      redis._store.set(`aris:offline:version:${TENANT_ID}:animal:a-2`, '1');

      const result = await engine.processBatch(SESSION_ID, [
        {
          id: 'delta-a',
          entityType: 'animal',
          entityId: 'a-new',
          operation: 'CREATE',
          payload: { name: 'New Animal' },
          version: 0,
          clientTimestamp: new Date().toISOString(),
        },
        {
          id: 'delta-b',
          entityType: 'animal',
          entityId: 'a-2',
          operation: 'UPDATE',
          payload: { name: 'Updated' },
          version: 1,
          clientTimestamp: new Date().toISOString(),
        },
      ], TENANT_ID);

      expect(result.applied).toHaveLength(2);
      expect(prisma.syncDelta.create).toHaveBeenCalledTimes(2);
    });

    it('should flag DELETE conflict on critical entity as MANUAL_REQUIRED', async () => {
      redis._store.set(`aris:offline:version:${TENANT_ID}:outbreak:ob-1`, '3');

      const result = await engine.processBatch(SESSION_ID, [
        {
          id: 'delta-del',
          entityType: 'outbreak',
          entityId: 'ob-1',
          operation: 'DELETE',
          payload: {},
          version: 1,
          clientTimestamp: new Date().toISOString(),
        },
      ], TENANT_ID);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].autoResolved).toBe(false);
    });
  });

  describe('detectConflictingFields', () => {
    it('should return differing fields', () => {
      const fields = engine.detectConflictingFields(
        { name: 'Old', age: 5, color: 'brown' },
        { name: 'New', age: 5, weight: 100 },
      );

      expect(fields).toContain('name');
      expect(fields).toContain('color');
      expect(fields).toContain('weight');
      expect(fields).not.toContain('age');
    });

    it('should return empty array when payloads are identical', () => {
      const fields = engine.detectConflictingFields(
        { name: 'Same', age: 5 },
        { name: 'Same', age: 5 },
      );

      expect(fields).toHaveLength(0);
    });
  });

  describe('resolveConflict', () => {
    it('should resolve with CLIENT_WINS', async () => {
      prisma.syncDelta.findUnique.mockResolvedValue({
        id: 'delta-c1',
        session_id: SESSION_ID,
        entity_type: 'health_event',
        entity_id: 'he-1',
        operation: 'UPDATE',
        payload: { status: 'CONFIRMED' },
        version: 1,
        tenant_id: TENANT_ID,
        conflict_status: 'MANUAL_REQUIRED',
      });

      const result = await engine.resolveConflict(
        'delta-c1',
        'CLIENT_WINS',
        TENANT_ID,
      );

      expect(result.entityType).toBe('health_event');
      expect(prisma.syncDelta.update).toHaveBeenCalledWith({
        where: { id: 'delta-c1' },
        data: expect.objectContaining({ conflict_status: 'AUTO_RESOLVED' }),
      });
    });

    it('should resolve with MERGE requiring mergedPayload', async () => {
      prisma.syncDelta.findUnique.mockResolvedValue({
        id: 'delta-c2',
        session_id: SESSION_ID,
        entity_type: 'health_event',
        entity_id: 'he-2',
        operation: 'UPDATE',
        payload: { status: 'SUSPECTED' },
        version: 1,
        tenant_id: TENANT_ID,
        conflict_status: 'MANUAL_REQUIRED',
      });

      const result = await engine.resolveConflict(
        'delta-c2',
        'MERGE',
        TENANT_ID,
        { status: 'CONFIRMED', notes: 'Merged by admin' },
      );

      expect(result.entityType).toBe('health_event');
      expect(prisma.syncDelta.update).toHaveBeenCalledWith({
        where: { id: 'delta-c2' },
        data: expect.objectContaining({
          resolved_payload: { status: 'CONFIRMED', notes: 'Merged by admin' },
        }),
      });
    });

    it('should throw 400 for MERGE without mergedPayload', async () => {
      prisma.syncDelta.findUnique.mockResolvedValue({
        id: 'delta-c3',
        session_id: SESSION_ID,
        entity_type: 'health_event',
        entity_id: 'he-3',
        operation: 'UPDATE',
        payload: {},
        version: 1,
        tenant_id: TENANT_ID,
        conflict_status: 'MANUAL_REQUIRED',
      });

      await expect(
        engine.resolveConflict('delta-c3', 'MERGE', TENANT_ID),
      ).rejects.toThrow(/mergedPayload is required/);
    });

    it('should throw 404 for unknown delta', async () => {
      prisma.syncDelta.findUnique.mockResolvedValue(null);

      await expect(
        engine.resolveConflict('missing', 'CLIENT_WINS', TENANT_ID),
      ).rejects.toThrow(/not found/);
    });

    it('should throw 403 for different tenant', async () => {
      prisma.syncDelta.findUnique.mockResolvedValue({
        id: 'delta-x',
        tenant_id: 'other-tenant',
        conflict_status: 'MANUAL_REQUIRED',
      });

      await expect(
        engine.resolveConflict('delta-x', 'CLIENT_WINS', TENANT_ID),
      ).rejects.toThrow(/different tenant/);
    });
  });
});
