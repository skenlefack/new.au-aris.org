'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

interface AuthGuardProps {
  children: React.ReactNode;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3002/api/v1';

/** Seconds before expiry at which we proactively refresh */
const REFRESH_THRESHOLD_SEC = 5 * 60; // 5 minutes
/** How often the background check runs (ms) */
const CHECK_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Parse the `exp` claim from a JWT without verifying signature.
 * Returns the expiry as a Unix timestamp (seconds), or null on failure.
 */
function getTokenExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the token is expired (exp <= now).
 */
function isTokenExpired(token: string): boolean {
  const exp = getTokenExp(token);
  if (exp === null) return false; // If we cannot parse, assume still valid
  return exp <= Math.floor(Date.now() / 1000);
}

/**
 * Returns true if the token will expire within `thresholdSec` seconds.
 */
function isTokenExpiringSoon(token: string, thresholdSec: number): boolean {
  const exp = getTokenExp(token);
  if (exp === null) return false;
  return exp <= Math.floor(Date.now() / 1000) + thresholdSec;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const updateTokens = useAuthStore((s) => s.updateTokens);
  const logout = useAuthStore((s) => s.logout);
  const [hydrated, setHydrated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshInProgressRef = useRef(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  /**
   * Attempt to refresh the access token using raw fetch (NOT apiClient)
   * to avoid recursive refresh loops through fetchWithRefresh.
   * Returns true on success, false on failure.
   */
  const attemptRefresh = useCallback(async (): Promise<boolean> => {
    if (refreshInProgressRef.current) return false;

    // Read the latest refresh token from the store (not from the closure)
    const currentRefreshToken = useAuthStore.getState().refreshToken;
    if (!currentRefreshToken) return false;

    refreshInProgressRef.current = true;
    setIsRefreshing(true);

    try {
      const res = await fetch(`${API_BASE_URL}/credential/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });

      if (!res.ok) return false;

      const body = await res.json();
      const newAccessToken = body?.data?.accessToken;
      const newRefreshToken = body?.data?.refreshToken;
      if (newAccessToken && newRefreshToken) {
        updateTokens(newAccessToken, newRefreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshInProgressRef.current = false;
      setIsRefreshing(false);
    }
  }, [updateTokens]);

  /**
   * Handle auth failure: clear state and redirect to login.
   */
  const handleAuthFailure = useCallback(() => {
    logout();
    router.replace('/');
  }, [logout, router]);

  // On hydration, check if the existing token is expired and attempt refresh
  useEffect(() => {
    if (!hydrated) return;

    if (!isAuthenticated || !accessToken) {
      router.replace('/');
      return;
    }

    if (isTokenExpired(accessToken)) {
      attemptRefresh().then((success) => {
        if (!success) {
          handleAuthFailure();
        }
      });
    }
  }, [hydrated, isAuthenticated, accessToken, attemptRefresh, handleAuthFailure, router]);

  // Background interval: every 30s, check if token is expiring soon and proactively refresh
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;

    const intervalId = setInterval(() => {
      const currentToken = useAuthStore.getState().accessToken;
      if (!currentToken) return;

      if (isTokenExpiringSoon(currentToken, REFRESH_THRESHOLD_SEC)) {
        attemptRefresh().then((success) => {
          if (!success) {
            handleAuthFailure();
          }
        });
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [hydrated, isAuthenticated, attemptRefresh, handleAuthFailure]);

  // Loading state while Zustand hydrates from localStorage
  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-aris-primary-200 border-t-aris-primary-600" />
      </div>
    );
  }

  // Not authenticated: render nothing while redirect runs
  if (!isAuthenticated && !accessToken) {
    return null;
  }

  // Session refreshing indicator: shown as a subtle top banner, does not block children
  return (
    <>
      {isRefreshing && (
        <div className="fixed left-0 right-0 top-0 z-[9999] flex items-center justify-center bg-aris-primary-50 py-1.5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-aris-primary-300 border-t-aris-primary-600" />
            <span className="text-xs font-medium text-aris-primary-700">
              Session refreshing...
            </span>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
