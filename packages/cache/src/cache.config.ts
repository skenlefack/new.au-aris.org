export interface CacheConfig {
  /** Redis connection URL (e.g. redis://localhost:6379) */
  url: string;
  /** Key prefix for all keys managed by this service (e.g. 'aris:credential:') */
  keyPrefix: string;
  /** Default TTL in seconds (default: 300 = 5 minutes) */
  defaultTtlSeconds?: number;
  /** Maximum number of reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Enable lazy connect — connect on first command instead of module init (default: false) */
  lazyConnect?: boolean;
}

export const DEFAULT_CACHE_CONFIG: Required<Pick<CacheConfig, 'defaultTtlSeconds' | 'maxReconnectAttempts' | 'lazyConnect'>> = {
  defaultTtlSeconds: 300,
  maxReconnectAttempts: 10,
  lazyConnect: false,
};

export const CACHE_CONFIG_TOKEN = 'ARIS_CACHE_CONFIG';
export const CACHE_REDIS_TOKEN = 'ARIS_CACHE_REDIS';

/** Default TTLs by data type (in seconds) */
export const DEFAULT_TTLS = {
  /** Master data (species, diseases, geo) — rarely changes */
  MASTER_DATA: 3600,        // 1 hour
  /** User sessions / auth tokens */
  SESSION: 1800,            // 30 minutes
  /** List/query results */
  QUERY_RESULT: 300,        // 5 minutes
  /** Single entity lookup */
  ENTITY: 600,              // 10 minutes
  /** Dashboard / aggregate stats */
  DASHBOARD: 120,           // 2 minutes
  /** Rate limiting counters */
  RATE_LIMIT: 60,           // 1 minute
  /** Distributed locks */
  LOCK: 30,                 // 30 seconds
} as const;

/**
 * Build a standardized cache key.
 *
 * Pattern: `{prefix}{domain}:{entity}:{id}`
 *
 * Examples:
 * - `aris:credential:user:uuid-123`
 * - `aris:health:outbreak:uuid-456`
 * - `aris:master:species:list:page=1&limit=20`
 */
export function buildCacheKey(prefix: string, domain: string, entity: string, id: string): string {
  return `${prefix}${domain}:${entity}:${id}`;
}

/**
 * Build a standardized cache key for query/list results.
 *
 * Pattern: `{prefix}{domain}:{entity}:list:{queryHash}`
 */
export function buildListCacheKey(prefix: string, domain: string, entity: string, queryHash: string): string {
  return `${prefix}${domain}:${entity}:list:${queryHash}`;
}

/**
 * Build an invalidation pattern for all keys of a domain+entity.
 *
 * Pattern: `{prefix}{domain}:{entity}:*`
 */
export function buildInvalidationPattern(prefix: string, domain: string, entity: string): string {
  return `${prefix}${domain}:${entity}:*`;
}
