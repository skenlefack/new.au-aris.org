/**
 * React Query offline integration helpers.
 *
 * Provides wrappers that intercept React Query fetch calls
 * to write results to IndexedDB (when online) and read from
 * IndexedDB (when offline or on fetch failure).
 *
 * Usage in hooks:
 *   queryFn: withOfflineCache('ref-data:species', tenantId, () => apiFetch(...))
 */

import {
  cacheRefData, getCachedRefData,
  cacheGeoEntities, getCachedGeoEntities,
  cacheFormTemplates, getCachedFormTemplates,
  cacheCampaigns, getCachedCampaigns,
} from './ref-data-cache';
import {
  cacheDashboardData, getCachedDashboardData, dashboardCacheKey,
} from './dashboard-cache';

type CacheCategory = 'ref-data' | 'geo' | 'templates' | 'campaigns' | 'dashboard';

/**
 * Wraps a queryFn to:
 * 1. Try the network fetch
 * 2. On success: cache in IndexedDB, return data
 * 3. On failure (offline): return cached data from IndexedDB
 *
 * @param cacheKey - unique key for this data in the cache
 * @param fetchFn - the original queryFn
 * @param cacheFn - function to write data to IndexedDB
 * @param readFn  - function to read data from IndexedDB
 */
export function withOfflineCache<T>(
  fetchFn: () => Promise<T>,
  cacheFn: (data: T) => Promise<void>,
  readFn: () => Promise<T | null>,
): () => Promise<T> {
  return async () => {
    // If online, try network first
    if (typeof navigator === 'undefined' || navigator.onLine) {
      try {
        const result = await fetchFn();
        // Cache in background (fire and forget)
        cacheFn(result).catch(() => {});
        return result;
      } catch (err) {
        // Network failed even though navigator.onLine was true
        // (flaky connection). Try IndexedDB fallback.
        const cached = await readFn();
        if (cached) return cached;
        throw err; // No cached data, re-throw original error
      }
    }

    // Offline: read from IndexedDB
    const cached = await readFn();
    if (cached) return cached;

    throw new Error('No cached data available offline');
  };
}

/**
 * Helper for ref-data for-select endpoints.
 * Caches the full response and returns it from IndexedDB when offline.
 */
export function withRefDataCache<T>(
  type: string,
  tenantId: string,
  fetchFn: () => Promise<T>,
): () => Promise<T> {
  return withOfflineCache(
    fetchFn,
    async (data: T) => {
      // Extract items from the API response shape: { data: SelectOption[] }
      const items = (data as any)?.data;
      if (!Array.isArray(items)) return;
      await cacheRefData(type, tenantId, items.map((item: any, i: number) => ({
        type,
        itemId: item.id ?? item.value ?? String(i),
        code: item.code ?? item.value ?? '',
        name: typeof item.name === 'object' ? item.name : { en: item.label ?? item.name ?? '' },
        metadata: item,
        tenantId,
        sortOrder: item.sortOrder ?? i,
      })));
    },
    async () => {
      const cached = await getCachedRefData(type, tenantId);
      if (cached.length === 0) return null;
      // Reconstruct the API response shape
      return {
        data: cached.map((c) => ({
          ...(c.metadata as Record<string, unknown> ?? {}),
          id: c.itemId,
          value: c.code || c.itemId,
          label: c.name?.en ?? c.name?.fr ?? c.code ?? '',
          name: c.name,
          code: c.code,
        })),
      } as T;
    },
  );
}

/**
 * Helper for dashboard/KPI endpoints.
 */
export function withDashboardCache<T>(
  endpoint: string,
  tenantId: string,
  fetchFn: () => Promise<T>,
  params?: Record<string, string>,
): () => Promise<T> {
  const key = dashboardCacheKey(endpoint, tenantId, params);
  return withOfflineCache(
    fetchFn,
    async (data: T) => {
      await cacheDashboardData(key, tenantId, data);
    },
    async () => getCachedDashboardData<T>(key),
  );
}
