'use client';

import React, { useEffect, useState } from 'react';
import { HardDrive, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStorageQuota, formatBytes, type StorageQuota } from '@/lib/offline/quota-manager';

const THRESHOLD = 0.8; // 80%

export function StorageQuotaWarning() {
  const [quota, setQuota] = useState<StorageQuota | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('aris-quota-dismissed')) {
      setDismissed(true);
      return;
    }
    getStorageQuota().then(setQuota);
  }, []);

  if (dismissed || !quota || !quota.available || quota.percentUsed < THRESHOLD) return null;

  return (
    <div
      role="alert"
      className={cn(
        'fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border p-3 shadow-lg',
        'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950',
      )}
    >
      <div className="flex items-start gap-2">
        <HardDrive className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600 dark:text-orange-400" />
        <div className="flex-1">
          <p className="text-xs font-medium text-orange-900 dark:text-orange-200">
            Storage {Math.round(quota.percentUsed * 100)}% used
          </p>
          <p className="mt-0.5 text-xs text-orange-700 dark:text-orange-400">
            {formatBytes(quota.usageBytes)} / {formatBytes(quota.quotaBytes)}
          </p>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
            sessionStorage.setItem('aris-quota-dismissed', 'true');
          }}
          className="rounded p-0.5 text-orange-400 hover:text-orange-600"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
