import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheService } from '../cache.service';
import { CACHE_CONFIG_TOKEN } from '../cache.config';
import type { CacheConfig } from '../cache.config';

// Mock ioredis
const mockRedis = {
  connect: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(300),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  hset: vi.fn().mockResolvedValue(1),
  hget: vi.fn().mockResolvedValue(null),
  hgetall: vi.fn().mockResolvedValue({}),
  hdel: vi.fn().mockResolvedValue(1),
  scan: vi.fn().mockResolvedValue(['0', []]),
  eval: vi.fn().mockResolvedValue(1),
  ping: vi.fn().mockResolvedValue('PONG'),
  on: vi.fn(),
};

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis),
}));

describe('CacheService', () => {
  let service: CacheService;
  const config: CacheConfig = {
    url: 'redis://localhost:6379',
    keyPrefix: 'test:',
    defaultTtlSeconds: 60,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CacheService(config);
  });

  describe('set/get', () => {
    it('should serialize and store values with default TTL', async () => {
      await service.set('key1', { name: 'test' });

      expect(mockRedis.set).toHaveBeenCalledWith(
        'key1',
        JSON.stringify({ name: 'test' }),
        'EX',
        60,
      );
    });

    it('should use custom TTL when provided', async () => {
      await service.set('key1', 'value', 120);

      expect(mockRedis.set).toHaveBeenCalledWith('key1', '"value"', 'EX', 120);
    });

    it('should deserialize values on get', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ name: 'test' }));

      const result = await service.get<{ name: string }>('key1');

      expect(result).toEqual({ name: 'test' });
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await service.get('missing');

      expect(result).toBeNull();
    });

    it('should handle invalid JSON gracefully', async () => {
      mockRedis.get.mockResolvedValueOnce('not-valid-json{');

      const result = await service.get('corrupt');

      expect(result).toBeNull();
      expect(mockRedis.del).toHaveBeenCalledWith('corrupt');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value without calling factory', async () => {
      mockRedis.get.mockResolvedValueOnce('"cached"');
      const factory = vi.fn().mockResolvedValue('fresh');

      const result = await service.getOrSet('key', factory);

      expect(result).toBe('cached');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result on miss', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      const factory = vi.fn().mockResolvedValue('fresh');

      const result = await service.getOrSet('key', factory, 120);

      expect(result).toBe('fresh');
      expect(factory).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith('key', '"fresh"', 'EX', 120);
    });
  });

  describe('domain-aware helpers', () => {
    it('should build correct entity key', async () => {
      await service.setEntity('health', 'outbreak', 'abc-123', { status: 'confirmed' });

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test:health:outbreak:abc-123',
        JSON.stringify({ status: 'confirmed' }),
        'EX',
        60,
      );
    });

    it('should build correct list key', async () => {
      await service.setList('health', 'outbreak', 'page=1&limit=20', []);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test:health:outbreak:list:page=1&limit=20',
        '[]',
        'EX',
        60,
      );
    });

    it('should get entity with correct key', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ id: 'abc' }));

      const result = await service.getEntity('health', 'outbreak', 'abc');

      expect(mockRedis.get).toHaveBeenCalledWith('test:health:outbreak:abc');
      expect(result).toEqual({ id: 'abc' });
    });
  });

  describe('invalidation', () => {
    it('should delete entity key', async () => {
      mockRedis.del.mockResolvedValueOnce(1);

      const result = await service.invalidateEntity('health', 'outbreak', 'abc');

      expect(mockRedis.del).toHaveBeenCalledWith('test:health:outbreak:abc');
      expect(result).toBe(true);
    });

    it('should scan and delete keys matching pattern', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['1', ['test:health:outbreak:a', 'test:health:outbreak:b']])
        .mockResolvedValueOnce(['0', ['test:health:outbreak:c']]);
      mockRedis.del.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

      const count = await service.invalidateByPattern('health', 'outbreak');

      expect(count).toBe(3);
    });
  });

  describe('counters', () => {
    it('should increment a counter', async () => {
      mockRedis.incr.mockResolvedValueOnce(5);

      const result = await service.incr('counter:key');

      expect(result).toBe(5);
    });

    it('should set TTL on first increment', async () => {
      mockRedis.incr.mockResolvedValueOnce(1);

      await service.incrWithTtl('rate:limit', 60);

      expect(mockRedis.expire).toHaveBeenCalledWith('rate:limit', 60);
    });

    it('should not set TTL on subsequent increments', async () => {
      mockRedis.incr.mockResolvedValueOnce(2);

      await service.incrWithTtl('rate:limit', 60);

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  describe('distributed lock', () => {
    it('should acquire lock using SET NX EX', async () => {
      mockRedis.set.mockResolvedValueOnce('OK');

      const acquired = await service.acquireLock('lock:resource', 30, 'owner-1');

      expect(acquired).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith('lock:resource', 'owner-1', 'EX', 30, 'NX');
    });

    it('should fail to acquire if lock exists', async () => {
      mockRedis.set.mockResolvedValueOnce(null);

      const acquired = await service.acquireLock('lock:resource', 30, 'owner-2');

      expect(acquired).toBe(false);
    });

    it('should release lock only if owner matches', async () => {
      mockRedis.eval.mockResolvedValueOnce(1);

      const released = await service.releaseLock('lock:resource', 'owner-1');

      expect(released).toBe(true);
    });
  });

  describe('stats', () => {
    it('should track hits and misses', async () => {
      mockRedis.get
        .mockResolvedValueOnce('"hit1"')
        .mockResolvedValueOnce('"hit2"')
        .mockResolvedValueOnce(null);

      await service.get('a');
      await service.get('b');
      await service.get('c');

      const stats = service.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
      expect(stats.totalRequests).toBe(3);
    });

    it('should reset stats', async () => {
      mockRedis.get.mockResolvedValueOnce('"hit"');
      await service.get('a');

      service.resetStats();
      const stats = service.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('lifecycle', () => {
    it('should connect on module init when not lazy', async () => {
      await service.onModuleInit();
      expect(mockRedis.connect).toHaveBeenCalled();
    });

    it('should not connect on module init when lazy', async () => {
      const lazyService = new CacheService({ ...config, lazyConnect: true });
      vi.clearAllMocks();

      await lazyService.onModuleInit();
      expect(mockRedis.connect).not.toHaveBeenCalled();
    });

    it('should disconnect on module destroy', async () => {
      await service.onModuleDestroy();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('ping', () => {
    it('should return latency in ms', async () => {
      const latency = await service.ping();
      expect(typeof latency).toBe('number');
      expect(latency).toBeGreaterThanOrEqual(0);
      expect(mockRedis.ping).toHaveBeenCalled();
    });
  });
});
