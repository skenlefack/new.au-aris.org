'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, X, CloudOff, Cloud, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSyncQueue, removeSyncItem, retrySyncItem } from '@/lib/offline/sync-queue';
import { deleteOfflineSubmission } from '@/lib/offline/submission-store';
import type { SyncQueueItem } from '@/lib/offline/db';
import { useTranslations } from '@/lib/i18n/translations';

interface ConflictItem extends SyncQueueItem {
  id: number;
}

/**
 * Dialog that appears when there are sync conflicts.
 * Shows local vs server version side by side.
 * User can choose "Keep local" (retry push) or "Accept server" (discard local).
 */
export function SyncConflictDialog() {
  const t = useTranslations('shared');
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState<number | null>(null);

  // Poll for conflicts every 30 seconds
  useEffect(() => {
    const check = async () => {
      try {
        const queue = await getSyncQueue();
        const conflicted = queue.filter((i) => i.status === 'CONFLICT' && i.id != null) as ConflictItem[];
        setConflicts(conflicted);
        if (conflicted.length > 0 && !open) setOpen(true);
      } catch { /* ignore */ }
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [open]);

  const handleKeepLocal = async (item: ConflictItem) => {
    setProcessing(item.id);
    try {
      await retrySyncItem(item.id);
      setConflicts((prev) => prev.filter((c) => c.id !== item.id));
    } finally {
      setProcessing(null);
    }
  };

  const handleAcceptServer = async (item: ConflictItem) => {
    setProcessing(item.id);
    try {
      // Remove from sync queue
      await removeSyncItem(item.id);
      // Remove the local submission if it exists
      const payload = item.payload as Record<string, unknown>;
      if (payload?.submissionId) {
        await deleteOfflineSubmission(payload.submissionId as string);
      }
      setConflicts((prev) => prev.filter((c) => c.id !== item.id));
    } finally {
      setProcessing(null);
    }
  };

  if (!open || conflicts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {t('syncConflicts') || 'Sync Conflicts'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {conflicts.length} {conflicts.length === 1 ? 'conflict' : 'conflicts'} — {t('syncConflictDesc') || 'Choose which version to keep'}
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conflict list */}
        <div className="max-h-80 overflow-y-auto p-4">
          <div className="space-y-3">
            {conflicts.map((item) => {
              const payload = item.payload as Record<string, unknown>;
              const serverData = item.serverResponse as Record<string, unknown> | undefined;
              const isActive = processing === item.id;

              return (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-lg border p-3 transition-opacity',
                    isActive ? 'opacity-50' : 'opacity-100',
                    'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
                  )}
                >
                  <div className="mb-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono dark:bg-gray-800">
                      {item.type.replace(/_/g, ' ')}
                    </span>
                    <ArrowRight className="h-3 w-3" />
                    <span className="truncate">{item.endpoint}</span>
                  </div>

                  {/* Side by side comparison */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded border border-blue-200 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-950/30">
                      <div className="mb-1 flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400">
                        <CloudOff className="h-3 w-3" />
                        Local
                      </div>
                      <pre className="max-h-20 overflow-auto whitespace-pre-wrap text-[10px] text-blue-800 dark:text-blue-300">
                        {JSON.stringify(payload?.data || payload, null, 1)?.slice(0, 200)}
                      </pre>
                    </div>
                    <div className="rounded border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-800 dark:bg-emerald-950/30">
                      <div className="mb-1 flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                        <Cloud className="h-3 w-3" />
                        Server
                      </div>
                      <pre className="max-h-20 overflow-auto whitespace-pre-wrap text-[10px] text-emerald-800 dark:text-emerald-300">
                        {serverData
                          ? JSON.stringify(serverData, null, 1)?.slice(0, 200)
                          : '(no server data)'}
                      </pre>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleKeepLocal(item)}
                      disabled={isActive}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <CloudOff className="h-3 w-3" />
                      {t('keepLocal') || 'Keep local'}
                    </button>
                    <button
                      onClick={() => handleAcceptServer(item)}
                      disabled={isActive}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <Cloud className="h-3 w-3" />
                      {t('acceptServer') || 'Accept server'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 dark:border-gray-700">
          <button
            onClick={() => setOpen(false)}
            className="w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {t('close') || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
