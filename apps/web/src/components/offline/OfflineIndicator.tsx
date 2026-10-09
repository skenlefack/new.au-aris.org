'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { WifiOff, Wifi, CloudOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';

type BannerState = 'hidden' | 'offline' | 'back-online';

/**
 * Enhanced offline indicator — uses direct browser events for maximum reliability.
 * Does NOT depend on useOffline() hook to avoid SSR hydration issues.
 */
export function OfflineIndicator() {
  const t = useTranslations('shared');
  const [banner, setBanner] = useState<BannerState>('hidden');
  const [wasOffline, setWasOffline] = useState(false);

  const goOffline = useCallback(() => {
    setBanner('offline');
    setWasOffline(true);
  }, []);

  const goOnline = useCallback(() => {
    if (wasOffline) {
      setBanner('back-online');
      // When coming back online, refetch the current page to clear any
      // stale/error states. Small delay to let the network stabilize.
      setTimeout(() => {
        // Only reload if the page looks broken (no main content rendered)
        const main = document.getElementById('main-content');
        if (!main || main.children.length === 0) {
          window.location.reload();
        }
      }, 2000);
    }
  }, [wasOffline]);

  useEffect(() => {
    // Check initial state
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      goOffline();
    }

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [goOffline, goOnline]);

  // Auto-hide "back online" after 4 seconds
  useEffect(() => {
    if (banner !== 'back-online') return;
    const timer = setTimeout(() => {
      setBanner('hidden');
      setWasOffline(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [banner]);

  if (banner === 'hidden') return null;

  const isOffline = banner === 'offline';

  return (
    <div
      role="status"
      aria-live="assertive"
      className={cn(
        'fixed left-0 right-0 top-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium shadow-lg',
        'transition-transform duration-300',
        isOffline
          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
          : 'bg-emerald-500 text-white',
      )}
    >
      {isOffline ? (
        <>
          <CloudOff className="h-4 w-4 flex-shrink-0 animate-pulse" />
          <span>{t('youAreOffline') || 'You are offline'}</span>
          <span className="hidden text-xs opacity-80 sm:inline">
            — {t('offlineReadOnly') || 'Cached data available in read-only mode'}
          </span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4 flex-shrink-0" />
          <span>{t('backOnline') || 'Back online'}</span>
          <RefreshCw className="h-3.5 w-3.5 animate-spin opacity-75" />
        </>
      )}
    </div>
  );
}

/**
 * Small dot indicator for sidebar/header.
 */
export function OfflineDot() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator !== 'undefined') setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <span
      title={online ? 'Online' : 'Offline'}
      className={cn(
        'inline-block h-2 w-2 rounded-full transition-colors',
        online ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse',
      )}
    />
  );
}
