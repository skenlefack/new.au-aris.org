'use client';

import React, { useEffect, useState, useRef } from 'react';
import { CloudDownload, Check, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { onPrefetchProgress, type PrefetchProgress } from '@/lib/offline/offline-prefetcher';

type WidgetState = 'hidden' | 'syncing' | 'done';

/**
 * Discrete sync progress widget — appears bottom-right during offline data sync.
 *
 * Shows:
 *  - A small pill with progress bar while syncing
 *  - A green "Sync complete" flash when done
 *  - Auto-hides after completion
 */
export function SyncProgressWidget() {
  const [state, setState] = useState<WidgetState>('hidden');
  const [progress, setProgress] = useState<PrefetchProgress>({
    total: 0, completed: 0, currentTask: '', done: false,
  });
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = onPrefetchProgress((p) => {
      setProgress(p);

      if (p.done) {
        setState('done');
        // Auto-hide after 4 seconds
        hideTimerRef.current = setTimeout(() => setState('hidden'), 4000);
      } else if (p.completed < p.total) {
        setState('syncing');
      }
    });

    return () => {
      unsubscribe();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (state === 'hidden') return null;

  const percent = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  const isDone = state === 'done';

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 overflow-hidden rounded-xl shadow-lg transition-all duration-500',
        'border backdrop-blur-sm',
        isDone
          ? 'border-emerald-200 bg-emerald-50/95 dark:border-emerald-800 dark:bg-emerald-950/95'
          : 'border-gray-200 bg-white/95 dark:border-gray-700 dark:bg-gray-900/95',
        state === 'hidden' ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100',
      )}
      style={{ minWidth: '220px' }}
    >
      {/* Content */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {isDone ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
              <CloudDownload className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-xs font-semibold',
              isDone ? 'text-emerald-800 dark:text-emerald-300' : 'text-gray-800 dark:text-gray-200',
            )}>
              {isDone ? 'Offline data ready' : 'Syncing offline data...'}
            </p>

            {!isDone && (
              <p className="mt-0.5 truncate text-[10px] text-gray-500 dark:text-gray-400">
                {progress.currentTask}
              </p>
            )}
          </div>

          <div className={cn(
            'flex items-center gap-1 text-[10px] font-bold',
            isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400',
          )}>
            <Database className="h-3 w-3" />
            {isDone ? (
              <span>{progress.total}/{progress.total}</span>
            ) : (
              <span>{progress.completed}/{progress.total}</span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {!isDone && (
        <div className="h-1 bg-gray-100 dark:bg-gray-800">
          <div
            className="h-1 bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {isDone && (
        <div className="h-1 bg-emerald-500" />
      )}
    </div>
  );
}
