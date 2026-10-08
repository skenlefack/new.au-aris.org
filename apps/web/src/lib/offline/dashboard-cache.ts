/**
 * Dashboard / KPI data cache — IndexedDB read/write.
 *
 * Caches API responses for dashboards and KPIs so they're
 * viewable offline. Short TTL (5 min) since dashboard data
 * is more volatile than reference data.
 */

import { getDB, type DashboardCacheItem } from './db';
import { isCacheFresh, markCacheRefreshed, TTL } from './cache-policy';

/**
 * Build a cache key for dashboard data.
 */
export function dashboardCacheKey(
  endpoint: string,
  tenantId: string,
  params?: Record<string, string>,
): string {
  const base = `dashboard:${tenantId}:${endpoint}`;
  if (!params || Object.keys(params).length === 0) return base;
  const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  return `${base}:${sorted.map(([k, v]) => `${k}=${v}`).join('&')}`;
}

/**
 * Store dashboard/KPI data in cache.
 */
export async function cacheDashboardData(
  cacheKey: string,
  tenantId: string,
  data: unknown,
  ttlMs: number = TTL.DASHBOARD,
): Promise<void> {
  try {
    const db = await getDB();
    const item: DashboardCacheItem = {
      cacheKey,
      tenantId,
      data,
      cachedAt: Date.now(),
      ttlMs,
    };
    await db.put('dashboard-cache', item);
    await markCacheRefreshed(cacheKey, ttlMs);
  } catch {
    // Silently fail — offline cache is best-effort
  }
}

/**
 * Get cached dashboard/KPI data. Returns null if not cached or expired.
 */
export async function getCachedDashboardData<T = unknown>(
  cacheKey: string,
): Promise<T | null> {
  try {
    const db = await getDB();
    const item = await db.get('dashboard-cache', cacheKey);
    if (!item) return null;

    // Check TTL
    if (Date.now() - item.cachedAt > item.ttlMs) {
      // Expired — but still return it if we're offline (stale data is better than nothing)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return item.data as T;
      }
      return null;
    }

    return item.data as T;
  } catch {
    return null;
  }
}

/**
 * Check if dashboard cache for a key is fresh.
 */
export async function isDashboardCacheFresh(cacheKey: string): Promise<boolean> {
  return isCacheFresh(cacheKey);
}

/**
 * Clear all dashboard cache for a tenant.
 */
export async function clearDashboardCache(tenantId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('dashboard-cache', 'readwrite');
    const store = tx.objectStore('dashboard-cache');
    const idx = store.index('by-tenant');
    let cursor = await idx.openCursor(tenantId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch {
    // Silently fail
  }
}
