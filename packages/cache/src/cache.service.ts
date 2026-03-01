import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import {
  CacheConfig,
  CACHE_CONFIG_TOKEN,
  DEFAULT_CACHE_CONFIG,
  buildCacheKey,
  buildListCacheKey,
  buildInvalidationPattern,
} from './cache.config';
import type { CacheStats } from './cache.types';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;
  private readonly keyPrefix: string;
  private readonly defaultTtl: number;

  // In-memory stats
  private hits = 0;
  private misses = 0;
  private errors = 0;

  constructor(
    @Inject(CACHE_CONFIG_TOKEN) private readonly config: CacheConfig,
  ) {
    const mergedConfig = { ...DEFAULT_CACHE_CONFIG, ...config };

    this.keyPrefix = mergedConfig.keyPrefix;
    this.defaultTtl = mergedConfig.defaultTtlSeconds;

    this.client = new Redis(mergedConfig.url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > mergedConfig.maxReconnectAttempts) {
          this.logger.error(`Redis: max reconnect attempts (${mergedConfig.maxReconnectAttempts}) exceeded`);
          return null;
        }
        const delay = Math.min(times * 200, 5000);
        this.logger.warn(`Redis: reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
    });

    this.client.on('error', (err) => {
      this.errors++;
      this.logger.error(`Redis error: ${err.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.lazyConnect) {
      await this.client.connect();
      this.logger.log(`Redis connected (prefix: ${this.keyPrefix})`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  // ─── Core operations ────────────────────────────────────────

  /**
   * Store a value in cache with optional TTL.
   * Values are JSON-serialized automatically.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtl;
    const serialized = JSON.stringify(value);
    if (ttl > 0) {
      await this.client.set(key, serialized, 'EX', ttl);
    } else {
      await this.client.set(key, serialized);
    }
  }

  /**
   * Retrieve a value from cache. Returns null on miss.
   * Values are JSON-deserialized automatically.
   */
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
      this.logger.warn(`Failed to parse cached value for key: ${key}`);
      await this.client.del(key);
      this.misses++;
      return null;
    }
  }

  /**
   * Get or set: returns cached value if exists, otherwise calls factory and caches result.
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /** Delete a single key. Returns true if the key existed. */
  async del(key: string): Promise<boolean> {
    const count = await this.client.del(key);
    return count > 0;
  }

  /** Check if a key exists. */
  async exists(key: string): Promise<boolean> {
    const count = await this.client.exists(key);
    return count > 0;
  }

  /** Get remaining TTL for a key in seconds. Returns -1 if no TTL, -2 if key doesn't exist. */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  // ─── Domain-aware helpers ───────────────────────────────────

  /**
   * Cache a single entity using the standardized key pattern.
   * Key: `{prefix}{domain}:{entity}:{id}`
   */
  async setEntity<T>(domain: string, entity: string, id: string, value: T, ttlSeconds?: number): Promise<void> {
    const key = buildCacheKey(this.keyPrefix, domain, entity, id);
    await this.set(key, value, ttlSeconds);
  }

  /**
   * Retrieve a cached entity.
   */
  async getEntity<T>(domain: string, entity: string, id: string): Promise<T | null> {
    const key = buildCacheKey(this.keyPrefix, domain, entity, id);
    return this.get<T>(key);
  }

  /**
   * Cache a list/query result using the standardized key pattern.
   * Key: `{prefix}{domain}:{entity}:list:{queryHash}`
   */
  async setList<T>(domain: string, entity: string, queryHash: string, value: T, ttlSeconds?: number): Promise<void> {
    const key = buildListCacheKey(this.keyPrefix, domain, entity, queryHash);
    await this.set(key, value, ttlSeconds);
  }

  /**
   * Retrieve a cached list/query result.
   */
  async getList<T>(domain: string, entity: string, queryHash: string): Promise<T | null> {
    const key = buildListCacheKey(this.keyPrefix, domain, entity, queryHash);
    return this.get<T>(key);
  }

  // ─── Invalidation ──────────────────────────────────────────

  /**
   * Invalidate a single entity from cache.
   */
  async invalidateEntity(domain: string, entity: string, id: string): Promise<boolean> {
    const key = buildCacheKey(this.keyPrefix, domain, entity, id);
    return this.del(key);
  }

  /**
   * Invalidate ALL cached data for a domain+entity (entity cache + list cache).
   * Uses SCAN to avoid blocking Redis.
   */
  async invalidateByPattern(domain: string, entity: string): Promise<number> {
    const pattern = buildInvalidationPattern(this.keyPrefix, domain, entity);
    return this.delByPattern(pattern);
  }

  /**
   * Invalidate keys matching a raw glob pattern using SCAN (non-blocking).
   */
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

    if (deleted > 0) {
      this.logger.debug(`Invalidated ${deleted} keys matching: ${pattern}`);
    }
    return deleted;
  }

  // ─── Counters ──────────────────────────────────────────────

  /** Increment a counter and return the new value. */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /** Increment and set expiry atomically if counter is new. */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const value = await this.client.incr(key);
    if (value === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return value;
  }

  /** Set expiry on an existing key. */
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  // ─── Hash operations (for structured cache entries) ────────

  /** Set a hash field. */
  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  /** Get a hash field. */
  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  /** Get all hash fields. */
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  /** Delete a hash field. */
  async hdel(key: string, field: string): Promise<boolean> {
    const count = await this.client.hdel(key, field);
    return count > 0;
  }

  // ─── Distributed lock ─────────────────────────────────────

  /**
   * Acquire a simple distributed lock using SET NX EX.
   * Returns true if lock was acquired.
   */
  async acquireLock(lockKey: string, ttlSeconds: number, ownerId: string): Promise<boolean> {
    const result = await this.client.set(lockKey, ownerId, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Release a distributed lock (only if we own it).
   * Uses Lua script for atomicity.
   */
  async releaseLock(lockKey: string, ownerId: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.client.eval(script, 1, lockKey, ownerId) as number;
    return result === 1;
  }

  // ─── Monitoring ────────────────────────────────────────────

  /** Get cache hit/miss statistics. */
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

  /** Reset statistics counters. */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.errors = 0;
  }

  /** Ping Redis to check connectivity. Returns latency in ms. */
  async ping(): Promise<number> {
    const start = Date.now();
    await this.client.ping();
    return Date.now() - start;
  }

  /** Get underlying ioredis client for advanced operations. */
  getClient(): Redis {
    return this.client;
  }
}
