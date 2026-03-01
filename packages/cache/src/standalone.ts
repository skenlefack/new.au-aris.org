import Redis from 'ioredis';
import type { CacheConfig } from './cache.config';
import {
  DEFAULT_CACHE_CONFIG,
  buildCacheKey,
  buildListCacheKey,
  buildInvalidationPattern,
} from './cache.config';
import type { CacheStats } from './cache.types';

/**
 * Create a raw ioredis client from cache config.
 * Use this for services that need direct Redis access without NestJS DI.
 */
export function getRedisClient(config: CacheConfig): Redis {
  const merged = { ...DEFAULT_CACHE_CONFIG, ...config };
  return new Redis(merged.url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > merged.maxReconnectAttempts) {
        return null;
      }
      return Math.min(times * 200, 5000);
    },
  });
}

/**
 * Standalone CacheService — no NestJS decorators.
 * API-compatible with the injectable CacheService.
 */
export class StandaloneCacheService {
  private readonly client: Redis;
  private readonly keyPrefix: string;
  private readonly defaultTtl: number;

  private hits = 0;
  private misses = 0;
  private errors = 0;

  constructor(config: CacheConfig) {
    const merged = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.keyPrefix = merged.keyPrefix;
    this.defaultTtl = merged.defaultTtlSeconds;
    this.client = getRedisClient(config);

    this.client.on('error', () => {
      this.errors++;
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  // ---- Core operations ----

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtl;
    const serialized = JSON.stringify(value);
    if (ttl > 0) {
      await this.client.set(key, serialized, 'EX', ttl);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null) {
      this.misses++;
      return null;
    }
    this.hits++;
    try {
      return JSON.parse(raw) as T;
    } catch {
      await this.client.del(key);
      this.misses++;
      return null;
    }
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async del(key: string): Promise<boolean> {
    const count = await this.client.del(key);
    return count > 0;
  }

  async exists(key: string): Promise<boolean> {
    const count = await this.client.exists(key);
    return count > 0;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  // ---- Domain-aware helpers ----

  async setEntity<T>(domain: string, entity: string, id: string, value: T, ttlSeconds?: number): Promise<void> {
    const key = buildCacheKey(this.keyPrefix, domain, entity, id);
    await this.set(key, value, ttlSeconds);
  }

  async getEntity<T>(domain: string, entity: string, id: string): Promise<T | null> {
    const key = buildCacheKey(this.keyPrefix, domain, entity, id);
    return this.get<T>(key);
  }

  async setList<T>(domain: string, entity: string, queryHash: string, value: T, ttlSeconds?: number): Promise<void> {
    const key = buildListCacheKey(this.keyPrefix, domain, entity, queryHash);
    await this.set(key, value, ttlSeconds);
  }

  async getList<T>(domain: string, entity: string, queryHash: string): Promise<T | null> {
    const key = buildListCacheKey(this.keyPrefix, domain, entity, queryHash);
    return this.get<T>(key);
  }

  // ---- Invalidation ----

  async invalidateEntity(domain: string, entity: string, id: string): Promise<boolean> {
    const key = buildCacheKey(this.keyPrefix, domain, entity, id);
    return this.del(key);
  }

  async invalidateByPattern(domain: string, entity: string): Promise<number> {
    const pattern = buildInvalidationPattern(this.keyPrefix, domain, entity);
    return this.delByPattern(pattern);
  }

  async delByPattern(pattern: string): Promise<number> {
    let deleted = 0;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        deleted += await this.client.del(...keys);
      }
    } while (cursor !== '0');
    return deleted;
  }

  // ---- Counters ----

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const value = await this.client.incr(key);
    if (value === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return value;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  // ---- Distributed lock ----

  async acquireLock(lockKey: string, ttlSeconds: number, ownerId: string): Promise<boolean> {
    const result = await this.client.set(lockKey, ownerId, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseLock(lockKey: string, ownerId: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = (await this.client.eval(script, 1, lockKey, ownerId)) as number;
    return result === 1;
  }

  // ---- Monitoring ----

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      hitRate: total > 0 ? this.hits / total : 0,
      totalRequests: total,
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.errors = 0;
  }

  async ping(): Promise<number> {
    const start = Date.now();
    await this.client.ping();
    return Date.now() - start;
  }

  getClient(): Redis {
    return this.client;
  }
}
