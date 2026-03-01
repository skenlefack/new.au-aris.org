import { describe, it, expect, beforeEach } from 'vitest';
import { MockCacheService } from '../testing/mock-cache.service';

describe('MockCacheService', () => {
  let cache: MockCacheService;

  beforeEach(() => {
    cache = new MockCacheService();
  });

  it('should store and retrieve values', async () => {
    await cache.set('key', { name: 'test' });
    const result = await cache.get<{ name: string }>('key');
    expect(result).toEqual({ name: 'test' });
  });

  it('should return null for missing keys', async () => {
    const result = await cache.get('missing');
    expect(result).toBeNull();
  });

  it('should delete keys', async () => {
    await cache.set('key', 'value');
    const deleted = await cache.del('key');
    expect(deleted).toBe(true);
    expect(await cache.get('key')).toBeNull();
  });

  it('should check existence', async () => {
    await cache.set('key', 'value');
    expect(await cache.exists('key')).toBe(true);
    expect(await cache.exists('missing')).toBe(false);
  });

  it('should handle entity operations', async () => {
    await cache.setEntity('health', 'outbreak', '123', { status: 'confirmed' });
    const result = await cache.getEntity<{ status: string }>('health', 'outbreak', '123');
    expect(result).toEqual({ status: 'confirmed' });
  });

  it('should handle list operations', async () => {
    await cache.setList('health', 'outbreak', 'page=1', [{ id: '1' }]);
    const result = await cache.getList('health', 'outbreak', 'page=1');
    expect(result).toEqual([{ id: '1' }]);
  });

  it('should invalidate entity', async () => {
    await cache.setEntity('health', 'outbreak', '123', { data: true });
    const deleted = await cache.invalidateEntity('health', 'outbreak', '123');
    expect(deleted).toBe(true);
    expect(await cache.getEntity('health', 'outbreak', '123')).toBeNull();
  });

  it('should invalidate by pattern', async () => {
    await cache.setEntity('health', 'outbreak', '1', {});
    await cache.setEntity('health', 'outbreak', '2', {});
    await cache.setEntity('health', 'vaccination', '1', {});

    const count = await cache.invalidateByPattern('health', 'outbreak');

    expect(count).toBe(2);
    expect(await cache.getEntity('health', 'vaccination', '1')).not.toBeNull();
  });

  it('should handle getOrSet', async () => {
    const factory = async () => 'computed';

    const result1 = await cache.getOrSet('key', factory);
    expect(result1).toBe('computed');

    const result2 = await cache.getOrSet('key', async () => 'new');
    expect(result2).toBe('computed'); // Still cached
  });

  it('should handle distributed lock', async () => {
    const acquired1 = await cache.acquireLock('lock:res', 30, 'owner-1');
    expect(acquired1).toBe(true);

    const acquired2 = await cache.acquireLock('lock:res', 30, 'owner-2');
    expect(acquired2).toBe(false);

    const released = await cache.releaseLock('lock:res', 'owner-1');
    expect(released).toBe(true);

    const acquired3 = await cache.acquireLock('lock:res', 30, 'owner-2');
    expect(acquired3).toBe(true);
  });

  it('should track stats', async () => {
    await cache.set('a', 1);
    await cache.get('a');  // hit
    await cache.get('b');  // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(0.5);
  });

  it('should clear all data', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
