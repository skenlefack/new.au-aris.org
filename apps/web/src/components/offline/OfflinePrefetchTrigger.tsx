'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { runOfflinePrefetch } from '@/lib/offline/offline-prefetcher';

/**
 * Triggers offline data prefetch when the dashboard mounts.
 * Runs once per session (uses a ref to avoid re-running on re-renders).
 * Only prefetches when online and authenticated.
 */
export function OfflinePrefetchTrigger() {
  const hasRun = useRef(false);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (hasRun.current) return;
    if (!user || !accessToken) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    hasRun.current = true;

    // Extract tenant info from user/JWT
    const tenantId = user.tenantId ?? '';
    const tenantLevel = user.tenantLevel ?? '';
    const countryCode = user.countryCode ?? '';

    if (!tenantId) return;

    // Determine API base URL
    const apiBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    // Run prefetch in background (fire and forget)
    runOfflinePrefetch({
      tenantId,
      tenantLevel,
      countryCode: countryCode || undefined,
      apiBaseUrl,
      accessToken,
    }).catch(() => {
      // Non-blocking — offline prefetch failure is not critical
    });
  }, [user, accessToken]);

  return null;
}
