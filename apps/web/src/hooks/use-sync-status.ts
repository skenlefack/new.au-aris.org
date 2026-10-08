'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSyncQueueStatus, processQueue, isSyncing, type SyncResult } from '@/lib/offline/sync-queue';
import { useOffline } from './use-offline';

export interface SyncStatusState {
  pending: number;
  failed: number;
  conflict: number;
  total: number;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  triggerSync: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook that tracks sync queue status and provides sync triggers.
 *
 * Auto-syncs when:
 * - Connection comes back online
 * - App gains focus (visibilitychange)
 * - Every 5 minutes while online
 */
export function useSyncStatus(): SyncStatusState {
  const { isOnline } = useOffline();
  const [status, setStatus] = useState({ pending: 0, failed: 0, conflict: 0, total: 0 });
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getSyncQueueStatus();
      setStatus({ pending: s.pending, failed: s.failed, conflict: s.conflict, total: s.total });
      setSyncing(isSyncing());
    } catch { /* ignore */ }
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncing || !isOnline) return;
    setSyncing(true);
    try {
      const result = await processQueue();
      setLastResult(result);
      await refresh();
    } finally {
      setSyncing(false);
    }
  }, [syncing, isOnline, refresh]);

  // Initial load
  useEffect(() => { refresh(); }, [refresh]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && status.pending > 0) {
      triggerSync();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sync on visibility change (tab focus)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isOnline) {
        refresh().then(() => {
          if (status.pending > 0) triggerSync();
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isOnline, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic sync every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline) {
        refresh().then(() => {
          if (status.pending > 0) triggerSync();
        });
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isOnline, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    pending: status.pending,
    failed: status.failed,
    conflict: status.conflict,
    total: status.total,
    isSyncing: syncing,
    lastSyncResult: lastResult,
    triggerSync,
    refresh,
  };
}
