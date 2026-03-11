import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PresenceService } from '../services/presence.service';

/** Minimal Redis mock for unit tests (no real Redis needed) */
function createRedisMock() {
  const store = new Map<string, string>();
  return {
    set: vi.fn(async (key: string, value: string, _ex?: string, _ttl?: number) => {
      store.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    incr: vi.fn(async (key: string) => {
      const val = parseInt(store.get(key) ?? '0', 10) + 1;
      store.set(key, String(val));
      return val;
    }),
    decr: vi.fn(async (key: string) => {
      const val = parseInt(store.get(key) ?? '0', 10) - 1;
      store.set(key, String(val));
      return val;
    }),
    keys: vi.fn(async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
    }),
    mget: vi.fn(async (...keys: string[]) =>
      keys.map((k) => store.get(k) ?? null),
    ),
    _store: store,
  } as any;
}

describe('PresenceService', () => {
  let service: PresenceService;
  let redis: ReturnType<typeof createRedisMock>;

  beforeEach(() => {
    service = new PresenceService();
    redis = createRedisMock();
    service.setRedis(redis);
  });

  describe('online / offline', () => {
    it('sets user online (in-memory + Redis)', async () => {
      await service.setOnline('tenant-ke', 'user-1', 'user@test.com');
      expect(service.isUserOnline('tenant-ke', 'user-1')).toBe(true);
      expect(redis.set).toHaveBeenCalled();
    });

    it('sets user offline', async () => {
      await service.setOnline('tenant-ke', 'user-1', 'user@test.com');
      await service.setOffline('tenant-ke', 'user-1');
      expect(service.isUserOnline('tenant-ke', 'user-1')).toBe(false);
      expect(redis.del).toHaveBeenCalled();
    });

    it('counts online users per tenant', async () => {
      await service.setOnline('tenant-ke', 'u1', 'u1@test.com');
      await service.setOnline('tenant-ke', 'u2', 'u2@test.com');
      await service.setOnline('tenant-ng', 'u3', 'u3@test.com');
      expect(service.getOnlineCount('tenant-ke')).toBe(2);
      expect(service.getOnlineCount('tenant-ng')).toBe(1);
      expect(service.getAllOnlineCount()).toBe(3);
    });
  });

  describe('tenant presence', () => {
    it('returns presence snapshot for a tenant', async () => {
      await service.setOnline('tenant-ke', 'u1', 'u1@test.com');
      await service.setOnline('tenant-ke', 'u2', 'u2@test.com');
      await service.setOffline('tenant-ke', 'u2');

      const presence = service.getTenantPresence('tenant-ke');
      expect(presence.tenantId).toBe('tenant-ke');
      expect(presence.totalOnline).toBe(1);
      expect(presence.onlineUsers).toHaveLength(1);
      expect(presence.onlineUsers[0].userId).toBe('u1');
    });

    it('returns empty for unknown tenant', () => {
      const presence = service.getTenantPresence('unknown');
      expect(presence.totalOnline).toBe(0);
      expect(presence.onlineUsers).toHaveLength(0);
    });
  });

  describe('room counts (Redis-backed)', () => {
    it('increments room count', async () => {
      const count = await service.incrementRoomCount('room:campaign:c1');
      expect(count).toBe(1);
      expect(redis.incr).toHaveBeenCalledWith('aris:realtime:room:room:campaign:c1');
    });

    it('decrements room count', async () => {
      await service.incrementRoomCount('room:campaign:c1');
      await service.incrementRoomCount('room:campaign:c1');
      const count = await service.decrementRoomCount('room:campaign:c1');
      expect(count).toBe(1);
    });

    it('prevents negative room count', async () => {
      const count = await service.decrementRoomCount('room:campaign:c1');
      expect(count).toBe(0);
      expect(redis.set).toHaveBeenCalledWith('aris:realtime:room:room:campaign:c1', '0');
    });

    it('gets room count', async () => {
      await service.incrementRoomCount('room:country:KE');
      await service.incrementRoomCount('room:country:KE');
      const count = await service.getRoomCount('room:country:KE');
      expect(count).toBe(2);
    });

    it('gets all room counts', async () => {
      await service.incrementRoomCount('room:campaign:c1');
      await service.incrementRoomCount('room:country:KE');
      const counts = await service.getAllRoomCounts();
      expect(counts.size).toBe(2);
    });

    it('returns 0 when Redis is not configured', async () => {
      const noRedisService = new PresenceService();
      const count = await noRedisService.incrementRoomCount('room:test');
      expect(count).toBe(0);
    });
  });

  describe('heartbeat', () => {
    it('records heartbeat in Redis', async () => {
      await service.recordHeartbeat('socket-1');
      expect(redis.set).toHaveBeenCalledWith(
        'aris:realtime:heartbeat:socket-1',
        expect.any(String),
        'EX',
        120,
      );
    });

    it('removes heartbeat from Redis', async () => {
      await service.removeHeartbeat('socket-1');
      expect(redis.del).toHaveBeenCalledWith('aris:realtime:heartbeat:socket-1');
    });
  });

  describe('metrics', () => {
    it('returns aggregated metrics', async () => {
      await service.setOnline('tenant-ke', 'u1', 'u1@test.com');
      await service.setOnline('tenant-ng', 'u2', 'u2@test.com');
      await service.incrementRoomCount('room:campaign:c1');

      const metrics = await service.getMetrics();
      expect(metrics.totalOnline).toBe(2);
      expect(metrics.roomsWithPresence).toBe(1);
      expect(metrics.tenantBreakdown).toHaveLength(2);
    });
  });

  describe('cleanup', () => {
    it('removes stale offline entries', async () => {
      await service.setOnline('tenant-ke', 'u1', 'u1@test.com');
      await service.setOffline('tenant-ke', 'u1');

      // Wait a tiny amount so the lastSeen is older than maxAgeMs
      await new Promise((r) => setTimeout(r, 10));

      // cleanup(5) → remove offline entries older than 5ms
      const removed = service.cleanup(5);
      expect(removed).toBe(1);
    });

    it('keeps active online users', async () => {
      await service.setOnline('tenant-ke', 'u1', 'u1@test.com');
      const removed = service.cleanup(0);
      expect(removed).toBe(0);
    });
  });
});
