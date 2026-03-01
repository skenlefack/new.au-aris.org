import type { CacheStats } from '../cache.types';

/**
 * In-memory mock of CacheService for unit testing.
 *
 * @example
 * ```typescript
 * const cacheService = new MockCacheService();
 * const module = await Test.createTestingModule({
 *   providers: [
 *     MyService,
 *     { provide: CacheService, useValue: cacheService },
 *   ],
 * }).compile();
 * ```
 */
export class MockCacheService {
  private store = new Map<string, { value: string; expiresAt?: number }>();
  private hits = 0;
  private misses = 0;

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value: JSON.stringify(value), expiresAt });
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return JSON.parse(entry.value) as T;
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async del(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async ttl(_key: string): Promise<number> {
    const entry = this.store.get(_key);
    if (!entry) return -2;
    if (!entry.expiresAt) return -1;
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async setEntity<T>(domain: string, entity: string, id: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(`${domain}:${entity}:${id}`, value, ttlSeconds);
  }

  async getEntity<T>(domain: string, entity: string, id: string): Promise<T | null> {
    return this.get<T>(`${domain}:${entity}:${id}`);
  }

  async setList<T>(domain: string, entity: string, queryHash: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(`${domain}:${entity}:list:${queryHash}`, value, ttlSeconds);
  }

  async getList<T>(domain: string, entity: string, queryHash: string): Promise<T | null> {
    return this.get<T>(`${domain}:${entity}:list:${queryHash}`);
  }

  async invalidateEntity(domain: string, entity: string, id: string): Promise<boolean> {
    return this.del(`${domain}:${entity}:${id}`);
  }

  async invalidateByPattern(domain: string, entity: string): Promise<number> {
    const prefix = `${domain}:${entity}:`;
    let deleted = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  async delByPattern(pattern: string): Promise<number> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    let deleted = 0;
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get<number>(key);
    const next = (current ?? 0) + 1;
    await this.set(key, next);
    return next;
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const current = await this.get<number>(key);
    const next = (current ?? 0) + 1;
    await this.set(key, next, current === null ? ttlSeconds : undefined);
    return next;
  }

  async expire(_key: string, _seconds: number): Promise<boolean> {
    const entry = this.store.get(_key);
    if (!entry) return false;
    entry.expiresAt = Date.now() + _seconds * 1000;
    return true;
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    const hash = await this.get<Record<string, string>>(key) ?? {};
    hash[field] = value;
    await this.set(key, hash);
  }

  async hget(key: string, field: string): Promise<string | null> {
    const hash = await this.get<Record<string, string>>(key);
    return hash?.[field] ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return (await this.get<Record<string, string>>(key)) ?? {};
  }

  async hdel(key: string, field: string): Promise<boolean> {
    const hash = await this.get<Record<string, string>>(key);
    if (!hash || !(field in hash)) return false;
    delete hash[field];
    await this.set(key, hash);
    return true;
  }

  async acquireLock(_lockKey: string, _ttlSeconds: number, ownerId: string): Promise<boolean> {
    const existing = this.store.get(_lockKey);
    if (existing && (!existing.expiresAt || Date.now() < existing.expiresAt)) {
      return false;
    }
    await this.set(_lockKey, ownerId, _ttlSeconds);
    return true;
  }

  async releaseLock(lockKey: string, ownerId: string): Promise<boolean> {
    const entry = this.store.get(lockKey);
    if (!entry) return false;
    const stored = JSON.parse(entry.value);
    if (stored !== ownerId) return false;
    this.store.delete(lockKey);
    return true;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      errors: 0,
      hitRate: total > 0 ? this.hits / total : 0,
      totalRequests: total,
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  async ping(): Promise<number> {
    return 0;
  }

  getClient(): unknown {
    return null;
  }

  /** Test helper: clear all stored data */
  clear(): void {
    this.store.clear();
    this.resetStats();
  }

  /** Test helper: get the number of stored keys */
  size(): number {
    return this.store.size;
  }
}
