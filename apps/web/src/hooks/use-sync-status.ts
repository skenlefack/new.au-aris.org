'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSyncQueueStatus, processQueue, isSyncing, type SyncResult } from '@/lib/offline/sync-queue';
import { onReauthEvent, type ReauthEvent } from '@/lib/offline/token-manager';
import { useOffline } from './use-offline';

export interface SyncStatusState {
  pending: number;
  failed: number;
  conflict: number;
  total: number;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  /** Whether the last sync was performed by the Service Worker in the background */
  lastSyncWasBackground: boolean;
  /** True when refresh token is expired and user needs to re-login to sync */
  needsReauth: boolean;
  /** Number of days the refresh token has been expired */
  reauthDaysExpired: number;
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
 * - Service Worker completes a Background Sync (listens for SW messages)
 */
export function useSyncStatus(): SyncStatusState {
  const { isOnline } = useOffline();
  const [status, setStatus] = useState({ pending: 0, failed: 0, conflict: 0, total: 0 });
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [lastSyncWasBackground, setLastSyncWasBackground] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [reauthDaysExpired, setReauthDaysExpired] = useState(0);

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
    setLastSyncWasBackground(false);
    try {
      const result = await processQueue();
      setLastResult(result);
      if (result.needsReauth) {
        setNeedsReauth(true);
      } else {
        setNeedsReauth(false);
      }
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

  // Listen for re-auth events (expired refresh token after long offline)
  useEffect(() => {
    return onReauthEvent((event: ReauthEvent) => {
      if (event.type === 'REAUTH_REQUIRED') {
        setNeedsReauth(true);
        setReauthDaysExpired(event.daysExpired ?? 0);
        refresh();
      } else if (event.type === 'REAUTH_COMPLETED') {
        setNeedsReauth(false);
        setReauthDaysExpired(0);
        // Re-trigger sync after successful re-auth
        triggerSync();
      }
    });
  }, [refresh, triggerSync]);

  // Listen for Background Sync results from Service Worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BACKGROUND_SYNC_RESULT') {
        const result = event.data.payload as SyncResult;
        setLastResult(result);
        setLastSyncWasBackground(true);
        // Refresh the queue status since the SW just processed items
        refresh();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage);
  }, [refresh]);

  return {
    pending: status.pending,
    failed: status.failed,
    conflict: status.conflict,
    total: status.total,
    isSyncing: syncing,
    lastSyncResult: lastResult,
    lastSyncWasBackground,
    needsReauth,
    reauthDaysExpired,
    triggerSync,
    refresh,
  };
}
