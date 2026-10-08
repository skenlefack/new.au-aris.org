'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi, CloudOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOffline } from '@/hooks/use-offline';
import { useTranslations } from '@/lib/i18n/translations';

type BannerState = 'hidden' | 'offline' | 'back-online';

/**
 * Enhanced offline indicator — replaces the basic NetworkBanner.
 *
 * Shows:
 *  - "You are offline — data is available in read-only mode" when offline
 *  - "Back online" flash when connectivity returns
 *  - Persistent dot indicator in the header area
 */
export function OfflineIndicator() {
  const t = useTranslations('shared');
  const { isOnline } = useOffline();
  const [banner, setBanner] = useState<BannerState>('hidden');
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setBanner('offline');
      setWasOffline(true);
    } else if (wasOffline) {
      setBanner('back-online');
      const timer = setTimeout(() => setBanner('hidden'), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (banner === 'hidden') return null;

  const isOffline = banner === 'offline';

  return (
    <div
      role="status"
      aria-live="assertive"
      className={cn(
        'fixed left-0 right-0 top-0 z-[60] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-300',
        isOffline
          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
          : 'bg-emerald-500 text-white',
      )}
    >
      {isOffline ? (
        <>
          <CloudOff className="h-4 w-4 flex-shrink-0" />
          <span>{t('youAreOffline') || 'You are offline'}</span>
          <span className="hidden text-xs opacity-75 sm:inline">
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
 * Small dot indicator for sidebar/header — shows offline status at a glance.
 */
export function OfflineDot() {
  const { isOnline } = useOffline();

  return (
    <span
      title={isOnline ? 'Online' : 'Offline'}
      className={cn(
        'inline-block h-2 w-2 rounded-full transition-colors',
        isOnline
          ? 'bg-emerald-500'
          : 'bg-amber-500 animate-pulse',
      )}
    />
  );
}
