'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ExternalLink, RefreshCw, Maximize2, Minimize2, Loader2, ChevronLeft, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import Link from 'next/link';
import { useBiDashboards, useBiAccessRulesForRole, useRequestMetabaseSession, useRequestMetabaseEmbedUrl } from '@/lib/api/bi-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/lib/i18n/translations';

export default function MetabaseEmbedPage() {
  const t = useTranslations('biTools');
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [embedUrl, setEmbedUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedDashboardId, setSelectedDashboardId] = useState<number | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const user = useAuthStore((s) => s.user);
  const requestEmbedUrl = useRequestMetabaseEmbedUrl();
  const requestSession = useRequestMetabaseSession();

  // Fetch registered Metabase dashboards
  const { data: dashboardsData, isLoading: dashboardsLoading } = useBiDashboards('metabase');
  const dashboards = dashboardsData?.data ?? [];

  // Determine mode: signed embed (dashboards registered) or session fallback
  const useSignedEmbed = !dashboardsLoading && dashboards.length > 0;
  const useFallbackSession = !dashboardsLoading && dashboards.length === 0;

  // Access check — allow by default when no rules are configured
  const { data: rulesData, isLoading: rulesLoading } = useBiAccessRulesForRole(user?.role ?? '', 'metabase');
  const accessRule = rulesData?.data?.[0];
  const hasAccess = rulesLoading ? true : accessRule ? accessRule.allowedSchemas.length > 0 : true;

  const metabaseUrl = process.env.NEXT_PUBLIC_METABASE_URL ?? 'https://metabase.au-aris.org';

  // === MODE 1: Signed Embed (when dashboards are registered) ===

  // Auto-select first dashboard
  useEffect(() => {
    if (useSignedEmbed && dashboards.length > 0 && selectedDashboardId === null) {
      const id = parseInt(dashboards[0].externalId, 10);
      if (!isNaN(id)) setSelectedDashboardId(id);
    }
  }, [dashboards, selectedDashboardId, useSignedEmbed]);

  // Request signed embed URL when dashboard changes
  useEffect(() => {
    if (!useSignedEmbed || !hasAccess || selectedDashboardId === null) return;
    let cancelled = false;

    async function fetchEmbedUrl() {
      try {
        setError(null);
        setLoading(true);
        const result = await requestEmbedUrl.mutateAsync({ dashboardId: selectedDashboardId! });
        if (!cancelled) {
          setEmbedUrl(result.data.embedUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('connectionFailed'));
          setLoading(false);
        }
      }
    }

    fetchEmbedUrl();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDashboardId, hasAccess, useSignedEmbed]);

  // === MODE 2: Session fallback (when no dashboards registered) ===

  useEffect(() => {
    if (!useFallbackSession || !hasAccess) return;
    let cancelled = false;

    async function autoLogin() {
      try {
        setError(null);
        const result = await requestSession.mutateAsync();
        if (cancelled) return;
        const token = result.data.sessionToken;
        const isProduction = typeof window !== 'undefined' && window.location.hostname.endsWith('au-aris.org');
        const domainSuffix = isProduction ? '; domain=.au-aris.org' : '';
        document.cookie = `metabase.SESSION=${token}; path=/; SameSite=Lax; Secure${domainSuffix}`;
        setSessionReady(true);
        setEmbedUrl(`${metabaseUrl}/`);
      } catch {
        if (!cancelled) {
          // Even if session fails, try loading the iframe
          setSessionReady(true);
          setEmbedUrl(`${metabaseUrl}/`);
        }
      }
    }

    autoLogin();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useFallbackSession, hasAccess]);

  const handleLoad = useCallback(() => {
    setLoading(false);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setIframeKey((prev) => prev + 1);
    if (useSignedEmbed) {
      setEmbedUrl('');
      const id = selectedDashboardId;
      setSelectedDashboardId(null);
      setTimeout(() => setSelectedDashboardId(id), 50);
    }
  };

  const handleDashboardChange = (externalId: string) => {
    const id = parseInt(externalId, 10);
    if (!isNaN(id)) {
      setSelectedDashboardId(id);
      setLoading(true);
      setIframeKey((prev) => prev + 1);
    }
  };

  const tenantLabel = user?.tenantLevel === 'CONTINENTAL'
    ? t('allData')
    : user?.tenantLevel === 'REC'
      ? t('regionalData')
      : t('countryData');

  // Access denied screen
  if (!rulesLoading && !hasAccess) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md px-6">
          <Lock className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t('accessDenied')}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('accessDeniedDesc')}</p>
          <Link
            href="/bi-tools"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('backToTools')}
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
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('metabaseSubtitle')}</p>
          </div>

          {(embedUrl || sessionReady) && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              {t('autoConnected')}
            </span>
          )}

          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {tenantLabel}
          </span>

          {loading && !error && (
            <div className="ml-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              {sessionReady ? t('loading') : t('connecting')}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {useSignedEmbed && dashboards.length > 1 && (
            <select
              value={selectedDashboardId?.toString() ?? ''}
              onChange={(e) => handleDashboardChange(e.target.value)}
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
            title={t('refresh')}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <a
            href={metabaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={t('openNewTab')}
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
                {t('connectionFailed')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{error}</p>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: '#509EE3' }}
              >
                <RefreshCw className="h-4 w-4" />
                {t('retry')}
              </button>
            </div>
          </div>
        )}

        {embedUrl && (
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
