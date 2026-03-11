import { describe, it, expect } from 'vitest';
import {
  buildCacheKey,
  buildListCacheKey,
  buildInvalidationPattern,
  DEFAULT_TTLS,
  DEFAULT_CACHE_CONFIG,
} from '../cache.config';

describe('cache.config', () => {
  it('should build correct cache key pattern', () => {
    const key = buildCacheKey('aris:', 'health', 'outbreak', 'uuid-123');
    expect(key).toBe('aris:health:outbreak:uuid-123');
  });

  it('should build correct list cache key pattern', () => {
    const key = buildListCacheKey('aris:', 'master', 'species', 'page=1&limit=20');
    expect(key).toBe('aris:master:species:list:page=1&limit=20');
  });

  it('should build correct invalidation pattern', () => {
    const pattern = buildInvalidationPattern('aris:', 'health', 'outbreak');
    expect(pattern).toBe('aris:health:outbreak:*');
  });

  it('should have correct DEFAULT_TTLS constants', () => {
    expect(DEFAULT_TTLS.MASTER_DATA).toBe(3600);
    expect(DEFAULT_TTLS.SESSION).toBe(1800);
    expect(DEFAULT_TTLS.QUERY_RESULT).toBe(300);
    expect(DEFAULT_TTLS.ENTITY).toBe(600);
    expect(DEFAULT_TTLS.DASHBOARD).toBe(120);
    expect(DEFAULT_TTLS.RATE_LIMIT).toBe(60);
    expect(DEFAULT_TTLS.LOCK).toBe(30);
  });

  it('should have correct DEFAULT_CACHE_CONFIG defaults', () => {
    expect(DEFAULT_CACHE_CONFIG.defaultTtlSeconds).toBe(300);
    expect(DEFAULT_CACHE_CONFIG.maxReconnectAttempts).toBe(10);
    expect(DEFAULT_CACHE_CONFIG.lazyConnect).toBe(false);
  });
});
