'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ExternalLink, RefreshCw, Maximize2, Minimize2, Loader2, ChevronLeft, CheckCircle2, Lock } from 'lucide-react';
import Link from 'next/link';
import { useBiDashboards, useBiAccessRulesForRole, useGrafanaEmbedUrl } from '@/lib/api/bi-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/lib/i18n/translations';

// Provisioned ARIS dashboards — used as fallback when no dashboards are registered in the API
const PROVISIONED_DASHBOARDS = [
  { uid: 'aris-overview', label: 'ARIS Overview' },
  { uid: 'aris-continental', label: 'Continental' },
  { uid: 'aris-api', label: 'API Performance' },
  { uid: 'aris-kafka', label: 'Kafka' },
  { uid: 'aris-business', label: 'Business' },
  { uid: 'aris-animal-health', label: 'Animal Health' },
  { uid: 'aris-trade-production', label: 'Trade & Production' },
  { uid: 'aris-distributed-traces', label: 'Distributed Traces' },
];

export default function GrafanaEmbedPage() {
  const t = useTranslations('biTools');
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [selectedUid, setSelectedUid] = useState<string>('');
  const [authReady, setAuthReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data: dashboardsData } = useBiDashboards('grafana');
  const apiDashboards = dashboardsData?.data ?? [];

  // Operational dashboards — only visible to SUPER_ADMIN and CONTINENTAL_ADMIN
  const OPS_DASHBOARDS = new Set(['aris-overview', 'aris-api', 'aris-kafka', 'aris-distributed-traces']);
  const isAdmin = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN'].includes(user?.role ?? '');

  // Use API dashboards if available, otherwise fall back to provisioned list
  const allDashboards = apiDashboards.length > 0
    ? apiDashboards.map((d) => ({ uid: d.externalId, label: d.name.en ?? d.name.fr ?? d.externalId }))
    : PROVISIONED_DASHBOARDS;
  const dashboardList = isAdmin
    ? allDashboards
    : allDashboards.filter((d) => !OPS_DASHBOARDS.has(d.uid));

  // Auto-select first available dashboard
  useEffect(() => {
    if (dashboardList.length > 0 && (!selectedUid || !dashboardList.some((d) => d.uid === selectedUid))) {
      setSelectedUid(dashboardList[0].uid);
    }
  }, [dashboardList, selectedUid]);

  // Access check — allow by default when no rules are configured
  const { data: rulesData, isLoading: rulesLoading } = useBiAccessRulesForRole(user?.role ?? '', 'grafana');
  const accessRule = rulesData?.data?.[0];
  const hasAccess = rulesLoading ? true : accessRule ? accessRule.allowedSchemas.length > 0 : true;

  // Set auth cookie so the proxy can read the JWT from iframe requests
  // Cookie domain set to .au-aris.org so it reaches grafana.au-aris.org subdomain
  useEffect(() => {
    if (!hasAccess) return;
    if (accessToken) {
      const isProduction = typeof window !== 'undefined' && window.location.hostname.endsWith('au-aris.org');
      const domainSuffix = isProduction ? '; domain=.au-aris.org' : '';
      document.cookie = `aris-bi-token=${accessToken}; path=/; SameSite=Lax; Secure${domainSuffix}`;
      setAuthReady(true);
    }
  }, [accessToken, hasAccess]);

  const grafanaBaseUrl = process.env.NEXT_PUBLIC_GRAFANA_URL ?? '/api/bi-proxy/grafana';

  // Use backend hook to build embed URL with tenant_id variables (var-tenant_id=...)
  const { data: embedData } = useGrafanaEmbedUrl(authReady ? selectedUid : undefined);
  const embedUrl = authReady
    ? (embedData?.data?.url ?? `${grafanaBaseUrl}/d/${selectedUid}?kiosk`)
    : '';

  const handleLoad = useCallback(() => {
    setLoading(false);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setIframeKey((prev) => prev + 1);
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
            style={{ backgroundColor: 'rgba(255, 102, 0, 0.1)' }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" style={{ color: '#FF6600' }}>
              <path fill="currentColor" d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10zm-10-6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 9.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 8.5 12 8.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Grafana</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('grafanaSubtitle')}</p>
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
          <select
            value={selectedUid}
            onChange={(e) => {
              setSelectedUid(e.target.value);
              setLoading(true);
              setIframeKey((prev) => prev + 1);
            }}
            className="mr-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {dashboardList.map((d) => (
              <option key={d.uid} value={d.uid}>
                {d.label}
              </option>
            ))}
          </select>

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
            href={grafanaBaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={t('openNewTab')}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* iframe */}
      <div className="relative flex-1 min-h-0">
        {authReady && embedUrl && (
          <iframe
            ref={iframeRef}
            key={iframeKey}
            src={embedUrl}
            className="h-full w-full border-0"
            title="Grafana"
            onLoad={handleLoad}
            allow="fullscreen"
          />
        )}
      </div>
    </div>
  );
}
