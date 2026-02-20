'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

type NetworkState = 'online' | 'offline' | 'back-online';

export function NetworkBanner() {
  const [state, setState] = useState<NetworkState>('online');
  const [visible, setVisible] = useState(false);

  const handleOffline = useCallback(() => {
    setState('offline');
    setVisible(true);
  }, []);

  const handleOnline = useCallback(() => {
    setState((prev) => {
      if (prev === 'offline') {
        return 'back-online';
      }
      return prev;
    });
  }, []);

  // Attach browser online/offline listeners
  useEffect(() => {
    // Check initial status (only matters if already offline on mount)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      handleOffline();
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [handleOffline, handleOnline]);

  // Auto-hide the "back online" banner after 3 seconds
  useEffect(() => {
    if (state !== 'back-online') return;

    const timer = setTimeout(() => {
      setVisible(false);
      // After fade-out transition completes, reset state
      const resetTimer = setTimeout(() => setState('online'), 300);
      return () => clearTimeout(resetTimer);
    }, 3000);

    return () => clearTimeout(timer);
  }, [state]);

  // Don't render anything when fully online and not transitioning
  if (state === 'online' && !visible) {
    return null;
  }

  const isOffline = state === 'offline';
  const isBackOnline = state === 'back-online';

  return (
    <div
      role="status"
      aria-live="assertive"
      className={cn(
        'fixed left-0 right-0 top-0 z-40 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300',
        isOffline && 'network-banner-in bg-amber-500 text-amber-950',
        isBackOnline && 'network-banner-in bg-emerald-500 text-white',
        !visible && state !== 'offline' && 'network-banner-out',
      )}
    >
      {isOffline && (
        <>
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <span>You are offline. Some features may be unavailable.</span>
        </>
      )}
      {isBackOnline && (
        <>
          <Wifi className="h-4 w-4 flex-shrink-0" />
          <span>Back online</span>
        </>
      )}
    </div>
  );
}
