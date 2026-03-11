'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ExternalLink, RefreshCw, Maximize2, Minimize2, Loader2, ChevronLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRequestMetabaseSession } from '@/lib/api/bi-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function MetabaseEmbedPage() {
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const user = useAuthStore((s) => s.user);
  const requestSession = useRequestMetabaseSession();

  // Auto-login: get Metabase session token and set cookie
  useEffect(() => {
    let cancelled = false;

    async function autoLogin() {
      try {
        setError(null);
        const result = await requestSession.mutateAsync();
        if (cancelled) return;

        const token = result.data.sessionToken;

        // Set the metabase.SESSION cookie for same-origin proxy
        document.cookie = `metabase.SESSION=${token}; path=/api/bi-proxy/metabase; SameSite=Lax`;

        setSessionReady(true);
      } catch {
        // Auto-login failed — fall back to loading Metabase directly via proxy
        // The user will see Metabase's own login page (or be already logged in)
        if (!cancelled) {
          setSessionReady(true);
        }
      }
    }

    autoLogin();
    return () => { cancelled = true; };
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Proxy URL — API route strips CSP/X-Frame-Options headers
  const embedUrl = sessionReady ? '/api/bi-proxy/metabase/' : '';

  const handleLoad = useCallback(() => {
    setLoading(false);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  const tenantLabel = user?.tenantLevel === 'CONTINENTAL'
    ? 'All data'
    : user?.tenantLevel === 'REC'
      ? 'Regional data'
      : 'Country data';

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-950' : 'h-full'}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          {!isFullscreen && (
            <Link
              href="/bi-tools"
              className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          )}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'rgba(80, 158, 227, 0.1)' }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" style={{ color: '#509EE3' }}>
              <circle cx="12" cy="12" r="3" fill="currentColor" />
              <circle cx="12" cy="4" r="2" fill="currentColor" />
              <circle cx="20" cy="12" r="2" fill="currentColor" />
              <circle cx="12" cy="20" r="2" fill="currentColor" />
              <circle cx="4" cy="12" r="2" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Metabase</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Simple &amp; Intuitive Business Intelligence</p>
          </div>

          {/* Auto-connected badge */}
          {sessionReady && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Auto-connected
            </span>
          )}

          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {tenantLabel}
          </span>

          {loading && !error && (
            <div className="ml-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              {sessionReady ? 'Loading...' : 'Connecting...'}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <a
            href={process.env.NEXT_PUBLIC_METABASE_URL ?? '/api/bi-proxy/metabase'}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-h-0">
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white dark:bg-gray-950">
            <div className="text-center max-w-md px-6">
              <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-amber-500" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Connection failed
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{error}</p>
              <div className="flex flex-col gap-3 items-center">
                <a
                  href={process.env.NEXT_PUBLIC_METABASE_URL ?? '/api/bi-proxy/metabase'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
                  style={{ backgroundColor: '#509EE3' }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Metabase (new tab)
                </a>
                <button
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    setSessionReady(false);
                    setIframeKey((prev) => prev + 1);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  Retry connection
                </button>
              </div>
            </div>
          </div>
        )}

        {sessionReady && (
          <iframe
            ref={iframeRef}
            key={iframeKey}
            src={embedUrl}
            className="h-full w-full border-0"
            title="Metabase"
            onLoad={handleLoad}
            allow="fullscreen"
          />
        )}
      </div>
    </div>
  );
}
