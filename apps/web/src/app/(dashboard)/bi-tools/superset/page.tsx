'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExternalLink, RefreshCw, Maximize2, Minimize2, Loader2, ChevronLeft, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import Link from 'next/link';
import { useBiDashboards, useRequestSupersetGuestToken, useBiAccessRulesForRole } from '@/lib/api/bi-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/lib/i18n/translations';

const SUPERSET_URL = process.env.NEXT_PUBLIC_SUPERSET_URL ?? '/bi-superset';

export default function SupersetEmbedPage() {
  const t = useTranslations('biTools');
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const embedRef = useRef<HTMLDivElement>(null);

  const { data: dashboardsData, isLoading: dashboardsLoading } = useBiDashboards('superset');
  const dashboards = dashboardsData?.data ?? [];
  const requestGuestToken = useRequestSupersetGuestToken();
  const user = useAuthStore((s) => s.user);

  // Access check
  const { data: rulesData, isLoading: rulesLoading } = useBiAccessRulesForRole(user?.role ?? '', 'superset');
  const accessRule = rulesData?.data?.[0];
  const hasAccess = rulesLoading || !rulesData ? true : (accessRule?.allowedSchemas?.length ?? 0) > 0;

  // Determine if we should use SDK embed (dashboards registered) or iframe fallback
  const useFallbackIframe = !dashboardsLoading && dashboards.length === 0;

  // Auto-select first dashboard
  useEffect(() => {
    if (dashboards.length > 0 && !selectedDashboardId) {
      setSelectedDashboardId(dashboards[0].externalId);
    }
  }, [dashboards, selectedDashboardId]);

  const fetchGuestToken = useCallback(async (): Promise<string> => {
    if (!selectedDashboardId) throw new Error('No dashboard selected');
    const result = await requestGuestToken.mutateAsync({ dashboardId: selectedDashboardId });
    return result.data.guestToken;
  }, [selectedDashboardId, requestGuestToken]);

  // Mount embedded dashboard when selected (SDK mode)
  useEffect(() => {
    if (!hasAccess) return;
    if (useFallbackIframe) return;
    if (!selectedDashboardId || !embedRef.current) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    if (embedRef.current) {
      embedRef.current.innerHTML = '';
    }

    (async () => {
      try {
        const { embedDashboard } = await import('@superset-ui/embedded-sdk');

        if (cancelled) return;

        await embedDashboard({
          id: selectedDashboardId,
          supersetDomain: SUPERSET_URL,
          mountPoint: embedRef.current!,
          fetchGuestToken,
          dashboardUiConfig: {
            hideTitle: true,
            hideChartControls: false,
            hideTab: false,
          },
        });

        if (!cancelled) {
          setLoading(false);
          const iframe = embedRef.current?.querySelector('iframe');
          if (iframe) {
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('embedFailed'));
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [selectedDashboardId, fetchGuestToken, useFallbackIframe, hasAccess, t]);

  const handleRefresh = () => {
    if (useFallbackIframe) {
      setLoading(true);
      setIframeKey((prev) => prev + 1);
    } else {
      setSelectedDashboardId((prev) => {
        setTimeout(() => setSelectedDashboardId(prev), 50);
        return null;
      });
    }
  };

  const handleIframeLoad = useCallback(() => {
    setLoading(false);
  }, []);

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
            style={{ backgroundColor: 'rgba(31, 194, 167, 0.1)' }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" style={{ color: '#1FC2A7' }}>
              <path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Apache Superset</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('supersetSubtitle')}</p>
          </div>

          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            {t('autoConnected')}
          </span>

          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {tenantLabel}
          </span>

          {loading && (
            <div className="ml-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('loading')}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {dashboards.length > 1 && (
            <select
              value={selectedDashboardId ?? ''}
              onChange={(e) => setSelectedDashboardId(e.target.value)}
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
            href={SUPERSET_URL}
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
                {t('dashboardUnavailable')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{error}</p>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: '#1FC2A7' }}
              >
                <RefreshCw className="h-4 w-4" />
                {t('retry')}
              </button>
            </div>
          </div>
        )}

        {useFallbackIframe && (
          <iframe
            key={iframeKey}
            src={`${SUPERSET_URL}/superset/welcome/?standalone=true`}
            className="h-full w-full border-0"
            title="Apache Superset"
            onLoad={handleIframeLoad}
            allow="fullscreen"
          />
        )}

        {!useFallbackIframe && <div ref={embedRef} className="h-full w-full" />}
      </div>
    </div>
  );
}
