'use client';

import { useEffect, useState } from 'react';
import { useOffline } from './use-offline';
import { getCachedRefData } from '@/lib/offline/ref-data-cache';
import { getCachedDashboardData, dashboardCacheKey } from '@/lib/offline/dashboard-cache';
import type { RefDataItem } from '@/lib/offline/db';

/**
 * Hook that returns cached reference data from IndexedDB when offline.
 * When online, returns null (caller should use the normal React Query hook).
 *
 * Usage:
 *   const onlineData = useSpeciesForSelect();  // React Query
 *   const offlineData = useOfflineRefData('species', tenantId);
 *   const data = onlineData.data ?? offlineData;
 */
export function useOfflineRefData(
  type: string,
  tenantId: string | undefined,
): RefDataItem[] | null {
  const { isOnline } = useOffline();
  const [data, setData] = useState<RefDataItem[] | null>(null);

  useEffect(() => {
    if (isOnline || !tenantId) {
      setData(null);
      return;
    }

    getCachedRefData(type, tenantId).then((items) => {
      setData(items.length > 0 ? items : null);
    }).catch(() => setData(null));
  }, [isOnline, type, tenantId]);

  return data;
}

/**
 * Hook that returns cached dashboard/KPI data from IndexedDB when offline.
 * When online, returns null (caller should use the normal React Query hook).
 */
export function useOfflineDashboardData<T = unknown>(
  endpoint: string,
  tenantId: string | undefined,
  params?: Record<string, string>,
): T | null {
  const { isOnline } = useOffline();
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    if (isOnline || !tenantId) {
      setData(null);
      return;
    }

    const key = dashboardCacheKey(endpoint, tenantId, params);
    getCachedDashboardData<T>(key).then(setData).catch(() => setData(null));
  }, [isOnline, endpoint, tenantId, params]);

  return data;
}
