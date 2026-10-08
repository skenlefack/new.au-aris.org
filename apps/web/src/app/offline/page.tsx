'use client';

import React from 'react';
import { CloudOff, RefreshCw, Home, WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 dark:from-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md text-center">
        {/* Logo / Icon */}
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <CloudOff className="h-12 w-12 text-amber-600 dark:text-amber-400" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          ARIS — Mode hors ligne
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Offline Mode
        </p>

        {/* Message */}
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/50">
          <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400">
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">Pas de connexion internet</span>
          </div>
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
            Cette page n&apos;est pas disponible hors ligne. Les pages que vous avez
            consultées précédemment sont peut-être encore accessibles.
          </p>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
            This page is not available offline. Previously visited pages may still be accessible.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1B5E20] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#2E7D32] transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer / Retry
          </button>
          <button
            onClick={() => { window.location.href = '/home'; }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <Home className="h-4 w-4" />
            Accueil / Home
          </button>
        </div>

        {/* Status info */}
        <div className="mt-8 text-xs text-slate-400 dark:text-slate-600">
          <p>ARIS 4.0 — Animal Resources Information System</p>
          <p className="mt-1">AU-IBAR | Union Africaine</p>
        </div>
      </div>
    </div>
  );
}
