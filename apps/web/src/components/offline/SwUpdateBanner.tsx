'use client';

import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shows a non-intrusive banner when a new service worker is available.
 * The user can click "Update" to activate it (triggers page reload).
 */
export function SwUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const checkForUpdate = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });

        // Also check if there's already a waiting worker
        if (reg.waiting && navigator.serviceWorker.controller) {
          setUpdateAvailable(true);
        }
      } catch { /* ignore */ }
    };

    checkForUpdate();
  }, []);

  const handleUpdate = () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
    // The controllerchange handler in layout.tsx will reload the page
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <div
      className={cn(
        'fixed bottom-20 left-4 z-50 flex items-center gap-3',
        'rounded-lg border border-blue-200 bg-white px-4 py-3 shadow-lg',
        'dark:border-blue-700 dark:bg-gray-900',
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
        <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          New version available
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Update to get the latest improvements
        </p>
      </div>
      <button
        onClick={handleUpdate}
        className="ml-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        Update
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
