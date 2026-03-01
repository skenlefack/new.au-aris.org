'use client';

import React, { useState, useCallback, useRef } from 'react';
import { ExternalLink, RefreshCw, Maximize2, Minimize2, Loader2, ChevronLeft, LogIn } from 'lucide-react';
import Link from 'next/link';

const SUPERSET_URL = 'http://localhost:8088';

export default function SupersetEmbedPage() {
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [showLogin, setShowLogin] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const embedUrl = `${SUPERSET_URL}/superset/welcome/?standalone=true`;

  const handleLoad = useCallback(() => {
    setLoading(false);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  const handleStartSession = () => {
    setShowLogin(false);
  };

  // Show login prompt first
  if (showLogin) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-gray-950">
        <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'rgba(31, 194, 167, 0.1)' }}
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8" style={{ color: '#1FC2A7' }}>
              <path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Apache Superset</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Advanced analytics and data exploration platform
          </p>

          <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50 p-4 text-left dark:border-amber-900/30 dark:bg-amber-900/10">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">First time?</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Log into Superset first in a new tab, then come back here to use the embedded view.
            </p>
            <div className="mt-3 rounded-lg bg-white p-3 text-xs dark:bg-slate-800">
              <div className="flex justify-between"><span className="text-slate-500">URL:</span><span className="font-mono text-slate-700 dark:text-slate-300">{SUPERSET_URL}</span></div>
              <div className="flex justify-between mt-1"><span className="text-slate-500">Username:</span><span className="font-mono text-slate-700 dark:text-slate-300">admin</span></div>
              <div className="flex justify-between mt-1"><span className="text-slate-500">Password:</span><span className="font-mono text-slate-700 dark:text-slate-300">ArisSuperset2024!</span></div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <a
              href={SUPERSET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <LogIn className="h-4 w-4" />
              Open Superset login (new tab)
            </a>
            <button
              onClick={handleStartSession}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              style={{ backgroundColor: '#1FC2A7' }}
            >
              I&apos;m already logged in — Show Superset
            </button>
          </div>

          <Link href="/bi-tools" className="mt-4 inline-block text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            &larr; Back to BI Tools
          </Link>
        </div>
      </div>
    );
  }

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
            style={{ backgroundColor: 'rgba(31, 194, 167, 0.1)' }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" style={{ color: '#1FC2A7' }}>
              <path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Apache Superset</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Advanced Analytics & Data Exploration</p>
          </div>
          {loading && (
            <div className="ml-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowLogin(true)}
            className="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Show login info"
          >
            <LogIn className="h-4 w-4" />
          </button>
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
            href={SUPERSET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* iframe */}
      <div className="relative flex-1 min-h-0">
        <iframe
          ref={iframeRef}
          key={iframeKey}
          src={embedUrl}
          className="h-full w-full border-0"
          title="Apache Superset"
          onLoad={handleLoad}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
