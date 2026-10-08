'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { getStorageQuota, type StorageQuota } from '@/lib/offline/quota-manager';

/* ------------------------------------------------------------------ */
/*  Online/offline state (reactive, SSR-safe)                          */
/* ------------------------------------------------------------------ */

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true; // assume online during SSR
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export interface OfflineState {
  /** Whether the browser reports connectivity */
  isOnline: boolean;
  /** Timestamp of last detected online→offline or offline→online transition */
  lastTransition: number | null;
  /** Storage quota info (updated on mount and on transitions) */
  quota: StorageQuota | null;
  /** Whether IndexedDB is available */
  hasIndexedDB: boolean;
  /** Whether service workers are supported */
  hasServiceWorker: boolean;
  /** Force a quota refresh */
  refreshQuota: () => Promise<void>;
}

export function useOffline(): OfflineState {
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerSnapshot);
  const [lastTransition, setLastTransition] = useState<number | null>(null);
  const [quota, setQuota] = useState<StorageQuota | null>(null);

  const hasIndexedDB = typeof indexedDB !== 'undefined';
  const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

  const refreshQuota = useCallback(async () => {
    const q = await getStorageQuota();
    setQuota(q);
  }, []);

  // Track transitions
  useEffect(() => {
    const handler = () => {
      setLastTransition(Date.now());
      refreshQuota();
    };
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  }, [refreshQuota]);

  // Initial quota check
  useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  return { isOnline, lastTransition, quota, hasIndexedDB, hasServiceWorker, refreshQuota };
}
