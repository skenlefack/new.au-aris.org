/**
 * Cache policy / TTL management for offline data.
 * Mirrors the mobile app's CachePolicy.kt pattern.
 */

import { getDB, type CacheMeta } from './db';

/* ── Default TTLs ── */
export const TTL = {
  /** Master/reference data: species, diseases, breeds — 24 hours */
  REF_DATA: 24 * 60 * 60 * 1000,
  /** Geo entities: admin divisions — 24 hours */
  GEO: 24 * 60 * 60 * 1000,
  /** Form templates — 6 hours */
  TEMPLATES: 6 * 60 * 60 * 1000,
  /** Campaigns — 1 hour */
  CAMPAIGNS: 60 * 60 * 1000,
  /** Dashboard/KPI data — 5 minutes */
  DASHBOARD: 5 * 60 * 1000,
} as const;

/**
 * Check whether a cache entry is still fresh.
 */
export async function isCacheFresh(key: string): Promise<boolean> {
  try {
    const db = await getDB();
    const meta = await db.get('meta', key);
    if (!meta) return false;
    return Date.now() - meta.lastRefreshed < meta.ttlMs;
  } catch {
    return false;
  }
}

/**
 * Mark a cache entry as refreshed now.
 */
export async function markCacheRefreshed(key: string, ttlMs: number): Promise<void> {
  try {
    const db = await getDB();
    const entry: CacheMeta = { key, lastRefreshed: Date.now(), ttlMs };
    await db.put('meta', entry);
  } catch {
    // Silently fail — offline cache is best-effort
  }
}

/**
 * Get the timestamp of the last refresh for a cache key.
 */
export async function getLastRefresh(key: string): Promise<number | null> {
  try {
    const db = await getDB();
    const meta = await db.get('meta', key);
    return meta?.lastRefreshed ?? null;
  } catch {
    return null;
  }
}

/**
 * Remove a cache entry's metadata (forces re-fetch on next access).
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('meta', key);
  } catch {
    // Silently fail
  }
}
