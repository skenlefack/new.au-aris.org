'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ExternalLink, RefreshCw, Maximize2, Minimize2, Loader2, ChevronLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useBiDashboards, useGrafanaEmbedUrl } from '@/lib/api/bi-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function GrafanaEmbedPage() {
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [selectedUid, setSelectedUid] = useState<string | undefined>(undefined);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const user = useAuthStore((s) => s.user);
  const { data: dashboardsData } = useBiDashboards('grafana');
  const dashboards = dashboardsData?.data ?? [];

  // Auto-select first dashboard
  useEffect(() => {
    if (dashboards.length > 0 && !selectedUid) {
      setSelectedUid(dashboards[0].externalId);
    }
  }, [dashboards, selectedUid]);

  const { data: embedData } = useGrafanaEmbedUrl(selectedUid);
  const embedUrl = embedData?.data?.url ?? '/api/bi-proxy/grafana/?kiosk';

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
            style={{ backgroundColor: 'rgba(255, 102, 0, 0.1)' }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" style={{ color: '#FF6600' }}>
              <path fill="currentColor" d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10zm-10-6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 9.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 8.5 12 8.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Grafana</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Dashboard Builder &amp; BI Analytics</p>
          </div>

          {/* Auto-connected badge */}
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Auto-connected
          </span>

          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {tenantLabel}
          </span>

          {loading && (
            <div className="ml-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Dashboard selector */}
          {dashboards.length > 1 && (
            <select
              value={selectedUid ?? ''}
              onChange={(e) => {
                setSelectedUid(e.target.value);
                setLoading(true);
                setIframeKey((prev) => prev + 1);
              }}
              className="mr-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {dashboards.map((d) => (
                <option key={d.externalId} value={d.externalId}>
                  {d.name.en ?? d.name.fr ?? d.externalId}
                </option>
              ))}
            </select>
          )}

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
            href={process.env.NEXT_PUBLIC_GRAFANA_URL ?? '/api/bi-proxy/grafana'}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* iframe — via Next.js proxy with auth headers */}
      <div className="relative flex-1 min-h-0">
        <iframe
          ref={iframeRef}
          key={iframeKey}
          src={embedUrl}
          className="h-full w-full border-0"
          title="Grafana"
          onLoad={handleLoad}
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
