'use client';

import React, { useState } from 'react';
import { KeyRound, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { emitReauthCompleted } from '@/lib/offline/token-manager';
import { useSyncStatus } from '@/hooks/use-sync-status';

/**
 * Re-authentication prompt — shown when the refresh token has expired
 * after a long offline session. The user re-enters their password to
 * get fresh tokens, and sync resumes automatically.
 *
 * Data is NEVER lost — submissions stay in IndexedDB until synced.
 */
export function ReauthPrompt() {
  const { needsReauth, pending, reauthDaysExpired } = useSyncStatus();
  const user = useAuthStore((s) => s.user);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  if (!needsReauth || dismissed || !user) return null;

  const handleReauth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/credential/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'Invalid password');
        setLoading(false);
        return;
      }

      const data = await res.json();
      const accessToken = data.accessToken ?? data.data?.accessToken;
      const refreshToken = data.refreshToken ?? data.data?.refreshToken;

      if (accessToken && refreshToken) {
        // Update tokens in auth store (which mirrors to IDB)
        useAuthStore.getState().updateTokens(accessToken, refreshToken);

        // Init encryption with the password
        try {
          const { initEncryption } = await import('@/lib/offline/crypto');
          await initEncryption(password);
        } catch { /* non-blocking */ }

        // Notify all tabs that re-auth is complete
        emitReauthCompleted();

        setPassword('');
        setDismissed(true);
      }
    } catch {
      setError('Connection error — please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9998] p-4 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm">
      <div className={cn(
        'overflow-hidden rounded-xl border shadow-2xl backdrop-blur-sm',
        'border-amber-200 bg-amber-50/95 dark:border-amber-800 dark:bg-amber-950/95',
      )}>
        {/* Header */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
            <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Session expired
            </h3>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
              {pending > 0 && (
                <>
                  <span className="font-medium">{pending} item{pending !== 1 ? 's' : ''}</span>
                  {' '}waiting to sync.{' '}
                </>
              )}
              Re-enter your password to resume.
            </p>
            {reauthDaysExpired > 0 && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-500">
                <AlertTriangle className="h-3 w-3" />
                Offline for {reauthDaysExpired} day{reauthDaysExpired !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleReauth} className="px-4 pb-4">
          {error && (
            <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex items-center gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={!password || loading}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              Sync
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="mt-2 w-full text-center text-[10px] text-amber-600 hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-300"
          >
            Dismiss (data is safe — sync later)
          </button>
        </form>
      </div>
    </div>
  );
}
