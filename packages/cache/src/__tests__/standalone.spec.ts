import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn().mockResolvedValue('OK');
const mockRedisDel = vi.fn().mockResolvedValue(1);
const mockRedisExists = vi.fn().mockResolvedValue(1);
const mockRedisConnect = vi.fn().mockResolvedValue(undefined);
const mockRedisQuit = vi.fn().mockResolvedValue(undefined);
const mockRedisPing = vi.fn().mockResolvedValue('PONG');
const mockRedisIncr = vi.fn().mockResolvedValue(1);
const mockRedisExpire = vi.fn().mockResolvedValue(1);
const mockRedisTtl = vi.fn().mockResolvedValue(300);
const mockRedisScan = vi.fn().mockResolvedValue(['0', []]);
const mockRedisEval = vi.fn().mockResolvedValue(1);
const mockRedisOn = vi.fn();

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    exists: mockRedisExists,
    connect: mockRedisConnect,
    quit: mockRedisQuit,
    ping: mockRedisPing,
    incr: mockRedisIncr,
    expire: mockRedisExpire,
    ttl: mockRedisTtl,
    scan: mockRedisScan,
    eval: mockRedisEval,
    on: mockRedisOn,
  })),
}));

import { StandaloneCacheService } from '../standalone';

describe('StandaloneCacheService', () => {
  let cache: StandaloneCacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new StandaloneCacheService({
      url: 'redis://localhost:6379',
      keyPrefix: 'aris:test:',
    });
  });

  it('should set and get with JSON serialization', async () => {
    const value = { name: 'test', count: 42 };
    await cache.set('my-key', value, 60);

    expect(mockRedisSet).toHaveBeenCalledWith('my-key', JSON.stringify(value), 'EX', 60);

    mockRedisGet.mockResolvedValueOnce(JSON.stringify(value));
    const result = await cache.get('my-key');
    expect(result).toEqual(value);
  });

  it('should return cached value from getOrSet without calling factory', async () => {
    const existingValue = { id: '1', name: 'cached' };
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(existingValue));

    const factory = vi.fn().mockResolvedValue({ id: '1', name: 'fresh' });
    const result = await cache.getOrSet('cache-key', factory);

    expect(result).toEqual(existingValue);
    expect(factory).not.toHaveBeenCalled();
  });

  it('should use domain-aware keys for setEntity/getEntity', async () => {
    const entity = { id: 'uuid-1', name: 'Test Species' };
    await cache.setEntity('master', 'species', 'uuid-1', entity, 600);

    expect(mockRedisSet).toHaveBeenCalledWith(
      'aris:test:master:species:uuid-1',
      JSON.stringify(entity),
      'EX',
      600,
    );

    mockRedisGet.mockResolvedValueOnce(JSON.stringify(entity));
    const result = await cache.getEntity('master', 'species', 'uuid-1');
    expect(result).toEqual(entity);
  });

  it('should use SET NX EX for acquireLock and Lua script for releaseLock', async () => {
    mockRedisSet.mockResolvedValueOnce('OK');
    const acquired = await cache.acquireLock('lock:resource', 30, 'owner-1');
    expect(acquired).toBe(true);
    expect(mockRedisSet).toHaveBeenCalledWith('lock:resource', 'owner-1', 'EX', 30, 'NX');

    mockRedisEval.mockResolvedValueOnce(1);
    const released = await cache.releaseLock('lock:resource', 'owner-1');
    expect(released).toBe(true);
    expect(mockRedisEval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("get"'),
      1,
      'lock:resource',
      'owner-1',
    );
  });

  it('should track hits and misses in getStats', async () => {
    // Miss
    mockRedisGet.mockResolvedValueOnce(null);
    await cache.get('missing-key');

    // Hit
    mockRedisGet.mockResolvedValueOnce(JSON.stringify({ data: 'value' }));
    await cache.get('existing-key');

    // Another hit
    mockRedisGet.mockResolvedValueOnce(JSON.stringify({ data: 'value2' }));
    await cache.get('another-key');

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.totalRequests).toBe(3);
    expect(stats.hitRate).toBeCloseTo(2 / 3);
  });
});
