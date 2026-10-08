'use client';

import React from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { useOffline } from '@/hooks/use-offline';

/**
 * Compact sync status indicator for the header/sidebar.
 *
 * Shows:
 * - Green cloud check: all synced
 * - Blue spinning: syncing in progress
 * - Orange badge: N items pending
 * - Red badge: N items failed
 * - Gray cloud-off: offline
 */
export function SyncStatusIndicator() {
  const { isOnline } = useOffline();
  const { pending, failed, conflict, isSyncing, triggerSync } = useSyncStatus();

  const totalPending = pending + failed + conflict;

  if (!isOnline) {
    return (
      <div
        title="Offline — changes will sync when connected"
        className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      >
        <CloudOff className="h-3.5 w-3.5" />
        <span>Offline</span>
        {totalPending > 0 && (
          <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
            {totalPending}
          </span>
        )}
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div
        title="Syncing..."
        className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      >
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span>Sync</span>
      </div>
    );
  }

  if (failed > 0 || conflict > 0) {
    return (
      <button
        onClick={triggerSync}
        title={`${failed} failed, ${conflict} conflicts — click to retry`}
        className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>{failed + conflict}</span>
      </button>
    );
  }

  if (pending > 0) {
    return (
      <button
        onClick={triggerSync}
        title={`${pending} pending — click to sync now`}
        className="flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400"
      >
        <Cloud className="h-3.5 w-3.5" />
        <span>{pending}</span>
      </button>
    );
  }

  // All synced
  return (
    <div
      title="All changes synced"
      className={cn(
        'flex items-center gap-1 rounded-full px-2 py-1 text-xs text-emerald-600',
        'dark:text-emerald-400',
      )}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
    </div>
  );
}
