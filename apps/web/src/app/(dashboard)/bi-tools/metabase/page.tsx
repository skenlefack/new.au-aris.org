'use client';

import React, { useState, useCallback, useRef } from 'react';
import { ExternalLink, RefreshCw, Maximize2, Minimize2, Loader2, ChevronLeft, LogIn, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

const METABASE_URL = 'http://localhost:3035';

export default function MetabaseEmbedPage() {
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [showSetup, setShowSetup] = useState(true);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const embedUrl = `${METABASE_URL}/`;

  const handleLoad = useCallback(() => {
    setLoading(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setIframeBlocked(false);
    setIframeKey((prev) => prev + 1);
  };

  const handleStartSession = () => {
    setShowSetup(false);
    // Detect if iframe is blocked by CSP after a timeout
    timeoutRef.current = setTimeout(() => {
      // If still loading after 8s, likely blocked by CSP
      setIframeBlocked(true);
      setLoading(false);
    }, 8000);
  };

  // Show setup prompt first
  if (showSetup) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-gray-950">
        <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'rgba(80, 158, 227, 0.1)' }}
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8" style={{ color: '#509EE3' }}>
              <circle cx="12" cy="12" r="3" fill="currentColor" />
              <circle cx="12" cy="4" r="2" fill="currentColor" />
              <circle cx="20" cy="12" r="2" fill="currentColor" />
              <circle cx="12" cy="20" r="2" fill="currentColor" />
              <circle cx="4" cy="12" r="2" fill="currentColor" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Metabase</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Simple & intuitive business intelligence platform
          </p>

          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-left dark:border-blue-900/30 dark:bg-blue-900/10">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Getting started</p>
            <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
              Metabase opens in a separate tab for the best experience. Complete the initial setup wizard on first launch.
            </p>
            <div className="mt-3 rounded-lg bg-white p-3 text-xs dark:bg-slate-800">
              <div className="flex justify-between"><span className="text-slate-500">URL:</span><span className="font-mono text-slate-700 dark:text-slate-300">{METABASE_URL}</span></div>
              <div className="flex justify-between mt-1"><span className="text-slate-500">Database:</span><span className="font-mono text-slate-700 dark:text-slate-300">PostgreSQL (aris)</span></div>
              <div className="flex justify-between mt-1"><span className="text-slate-500">DB Host:</span><span className="font-mono text-slate-700 dark:text-slate-300">localhost:5432</span></div>
              <div className="flex justify-between mt-1"><span className="text-slate-500">DB User:</span><span className="font-mono text-slate-700 dark:text-slate-300">aris_bi_reader</span></div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-left dark:border-amber-900/30 dark:bg-amber-900/10">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Metabase uses Content Security Policy headers that prevent iframe embedding.
                Use the &quot;Open in new tab&quot; button for the full experience.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <a
              href={METABASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              style={{ backgroundColor: '#509EE3' }}
            >
              <ExternalLink className="h-4 w-4" />
              Open Metabase (new tab)
            </a>
            <button
              onClick={handleStartSession}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Try embedded view anyway
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
            <p className="text-xs text-slate-500 dark:text-slate-400">Simple & Intuitive Business Intelligence</p>
          </div>
          {loading && !iframeBlocked && (
            <div className="ml-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSetup(true)}
            className="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Show setup info"
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
            href={METABASE_URL}
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
        {iframeBlocked ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white dark:bg-gray-950">
            <div className="text-center max-w-md px-6">
              <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-amber-500" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Iframe embedding blocked
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Metabase&apos;s Content Security Policy prevents loading inside an iframe.
                Please use Metabase directly in a new browser tab.
              </p>
              <div className="flex flex-col gap-3 items-center">
                <a
                  href={METABASE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
                  style={{ backgroundColor: '#509EE3' }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Metabase (new tab)
                </a>
                <button
                  onClick={handleRefresh}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  Retry embedded view
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <iframe
          ref={iframeRef}
          key={iframeKey}
          src={embedUrl}
          className="h-full w-full border-0"
          title="Metabase"
          onLoad={handleLoad}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
