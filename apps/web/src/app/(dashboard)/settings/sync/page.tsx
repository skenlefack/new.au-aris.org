'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw, Trash2, RotateCcw, Cloud, CloudOff, CheckCircle2,
  AlertTriangle, Clock, HardDrive, Wifi, WifiOff, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useOffline } from '@/hooks/use-offline';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { getSyncQueue, removeSyncItem, retrySyncItem, discardSyncItem } from '@/lib/offline/sync-queue';
import { getOfflineSubmissions, countSubmissionsByStatus } from '@/lib/offline/submission-store';
import { getStorageQuota, formatBytes } from '@/lib/offline/quota-manager';
import { getLastRefresh } from '@/lib/offline/cache-policy';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { SyncQueueItem, SubmissionSyncStatus } from '@/lib/offline/db';
import type { StorageQuota } from '@/lib/offline/quota-manager';

function timeAgo(ts: number | null): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  IN_FLIGHT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CONFLICT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  SYNCED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export default function SyncPage() {
  const t = useTranslations('shared');
  const { isOnline, quota } = useOffline();
  const { pending, failed, conflict, isSyncing, triggerSync, refresh } = useSyncStatus();
  const tenantId = useAuthStore((s) => s.user?.tenantId ?? '');

  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [subCounts, setSubCounts] = useState<Record<SubmissionSyncStatus, number>>({
    DRAFT: 0, PENDING: 0, SYNCED: 0, FAILED: 0, CONFLICT: 0,
  });
  const [cacheInfo, setCacheInfo] = useState<{ key: string; age: string }[]>([]);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [q, counts] = await Promise.all([
        getSyncQueue(),
        tenantId ? countSubmissionsByStatus(tenantId) : null,
      ]);
      setQueue(q);
      if (counts) setSubCounts(counts);

      // Load cache ages
      const cacheKeys = [
        { key: 'ref-data:species', label: 'Species' },
        { key: 'ref-data:diseases', label: 'Diseases' },
        { key: `templates:${tenantId}`, label: 'Form Templates' },
        { key: `campaigns:${tenantId}`, label: 'Campaigns' },
      ];
      const ages = await Promise.all(
        cacheKeys.map(async ({ key, label }) => {
          const ts = await getLastRefresh(`${key}:${tenantId}`).catch(() => null);
          return { key: label, age: timeAgo(ts) };
        }),
      );
      setCacheInfo(ages);
    } catch { /* ignore */ }
  }, [tenantId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRetry = async (id: number) => {
    await retrySyncItem(id);
    await loadData();
    refresh();
  };

  const handleDiscard = async (id: number) => {
    await discardSyncItem(id);
    await loadData();
    refresh();
  };

  const handleSyncNow = async () => {
    await triggerSync();
    await loadData();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Synchronization
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Offline data sync status and management
          </p>
        </div>
        <button
          onClick={handleSyncNow}
          disabled={isSyncing || !isOnline || pending === 0}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all',
            isSyncing ? 'bg-blue-400' : 'bg-[var(--color-accent)] hover:opacity-90',
            (!isOnline || pending === 0) && 'opacity-50 cursor-not-allowed',
          )}
        >
          <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusCard icon={isOnline ? Wifi : WifiOff} label="Connection" value={isOnline ? 'Online' : 'Offline'} color={isOnline ? 'emerald' : 'amber'} />
        <StatusCard icon={Clock} label="Pending" value={String(pending)} color={pending > 0 ? 'orange' : 'gray'} />
        <StatusCard icon={AlertTriangle} label="Failed" value={String(failed + conflict)} color={failed + conflict > 0 ? 'red' : 'gray'} />
        <StatusCard icon={HardDrive} label="Storage" value={quota ? `${Math.round(quota.percentUsed * 100)}%` : '—'} color={quota && quota.percentUsed > 0.8 ? 'red' : 'gray'} />
      </div>

      {/* Offline submissions summary */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Offline Submissions</h3>
        <div className="grid grid-cols-5 gap-2 text-center">
          {(['DRAFT', 'PENDING', 'SYNCED', 'FAILED', 'CONFLICT'] as SubmissionSyncStatus[]).map((s) => (
            <div key={s} className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{subCounts[s]}</div>
              <div className={cn('mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium', STATUS_STYLE[s])}>
                {s}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cache freshness */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Cached Data</h3>
        <div className="space-y-1">
          {cacheInfo.map(({ key, age }) => (
            <div key={key} className="flex items-center justify-between rounded py-1 px-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
              <span className="text-gray-700 dark:text-gray-300">{key}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{age}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sync queue */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Sync Queue ({queue.length})
          </h3>
        </div>
        {queue.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            All synced — no pending operations
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {queue.map((item) => (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('inline-block rounded px-1.5 py-0.5 text-[10px] font-medium', STATUS_STYLE[item.status])}>
                      {item.status}
                    </span>
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                      {item.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {timeAgo(item.createdAt)}
                    </span>
                    {item.retryCount > 0 && (
                      <span className="text-[10px] text-gray-400">
                        ({item.retryCount} retries)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setExpandedItem(expandedItem === item.id ? null : (item.id ?? null))}
                      className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {expandedItem === item.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {(item.status === 'FAILED' || item.status === 'CONFLICT') && (
                      <>
                        <button onClick={() => handleRetry(item.id!)} title="Retry" className="rounded p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDiscard(item.id!)} title="Discard" className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {item.lastError && (
                  <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{item.lastError}</p>
                )}
                {expandedItem === item.id && (
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-gray-50 p-2 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {JSON.stringify(item.payload, null, 2)?.slice(0, 1000)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Storage details */}
      {quota?.available && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Storage</h3>
          <div className="mb-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={cn(
                'h-2 rounded-full transition-all',
                quota.percentUsed > 0.8 ? 'bg-red-500' : quota.percentUsed > 0.5 ? 'bg-amber-500' : 'bg-emerald-500',
              )}
              style={{ width: `${Math.min(quota.percentUsed * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatBytes(quota.usageBytes)} used of {formatBytes(quota.quotaBytes)}
          </p>
        </div>
      )}
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    orange: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <div className={cn('rounded-lg p-3', colors[color] || colors.gray)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
