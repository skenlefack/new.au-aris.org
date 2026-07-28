'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Edit3, Maximize2, Minimize2, Star, ArrowLeft, Download, X, RefreshCw } from 'lucide-react';
import {
  useDashboard,
  useDashboardRender,
  useSetDashboardPreference,
} from '@/lib/api/dashboard-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import { SectionList } from '@/components/dashboard-builder/SectionList';
import { ExportDashboardDialog } from '@/components/dashboard-builder/ExportDashboardDialog';
import {
  DashboardViewerProvider,
  useViewerFilters,
} from '@/components/dashboard-builder/DashboardViewerContext';

export default function DashboardViewPage() {
  return (
    <DashboardViewerProvider>
      <DashboardViewContent />
    </DashboardViewerProvider>
  );
}

function DashboardViewContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const t = useTranslations('dashboard');
  const { filters, activeFilterCount, resetFilters } = useViewerFilters();

  const { data: dashboardData, isLoading } = useDashboard(id);
  const refreshInterval = (dashboardData?.data as any)?.refreshInterval ?? null;
  const { data: renderData } = useDashboardRender(id, filters, {
    refetchInterval: refreshInterval ?? undefined,
  });
  const setPreference = useSetDashboardPreference();

  const [exportOpen, setExportOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Listen for fullscreen changes (e.g. user presses Escape)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const dashboard = dashboardData?.data;
  const widgetData = (renderData?.data?.widgetData ?? {}) as Record<
    string,
    Record<string, unknown>
  >;

  const handleSetDefault = () => {
    if (!dashboard) return;
    setPreference.mutate({
      dashboardId: dashboard.id,
      scope: dashboard.scope,
      target: dashboard.tenantId,
    });
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="h-10 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="mt-6 grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800/50"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-gray-500">Dashboard not found</p>
      </div>
    );
  }

  const title = dashboard.title || (dashboard as any).title_fr || (dashboard as any).titleFr || '';

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 overflow-auto bg-white dark:bg-gray-950 p-6' : 'mx-auto max-w-7xl'}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/my-dashboards')}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {title}
              </h1>
              {refreshInterval && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: '3s' }} />
                  {t('dbAutoRefreshEvery', { seconds: String(refreshInterval) })}
                </span>
              )}
            </div>
            {dashboard.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {dashboard.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSetDefault}
            disabled={dashboard.isDefault || setPreference.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            <Star className={`h-4 w-4 ${dashboard.isDefault ? 'fill-[#C9A227] text-[#C9A227]' : ''}`} />
            {dashboard.isDefault ? 'Default' : 'Set as default'}
          </button>
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={handleFullscreen}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isFullscreen ? 'Exit' : 'Full screen'}
          </button>
          <button
            onClick={() => router.push(`/dashboards/${id}/edit`)}
            className="flex items-center gap-1.5 rounded-lg bg-[#1F4E79] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#163a5c] transition-colors"
          >
            <Edit3 className="h-4 w-4" />
            Edit
          </button>
        </div>
      </div>

      {/* Cross-filter indicator */}
      {activeFilterCount > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
          </span>
          {filters.countryCode && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1F4E79]/10 px-2.5 py-0.5 text-xs font-medium text-[#1F4E79] dark:bg-[#1F4E79]/20 dark:text-blue-300">
              Country: {filters.countryCode}
            </span>
          )}
          {filters.recCode && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A227]/10 px-2.5 py-0.5 text-xs font-medium text-[#C9A227] dark:bg-[#C9A227]/20 dark:text-yellow-300">
              REC: {filters.recCode}
            </span>
          )}
          {filters.year && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-300">
              Year: {filters.year}
            </span>
          )}
          {filters.domain && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
              Domain: {filters.domain}
            </span>
          )}
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-3 w-3" />
            Reset filters
          </button>
        </div>
      )}

      {/* Sections view */}
      <div id="dashboard-content" className="mt-6">
        <SectionList
          sections={dashboard.sections ?? []}
          widgetData={widgetData}
          editable={false}
        />
      </div>

      <ExportDashboardDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        dashboardId={id}
        dashboardTitle={title}
        sections={dashboard.sections ?? []}
      />
    </div>
  );
}
