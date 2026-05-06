'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Edit3, Maximize2, Star, ArrowLeft, Download } from 'lucide-react';
import {
  useDashboard,
  useDashboardRender,
  useSetDashboardPreference,
} from '@/lib/api/dashboard-hooks';
import { SectionList } from '@/components/dashboard-builder/SectionList';
import { ExportDashboardDialog } from '@/components/dashboard-builder/ExportDashboardDialog';

export default function DashboardViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: dashboardData, isLoading } = useDashboard(id);
  const { data: renderData } = useDashboardRender(id);
  const setPreference = useSetDashboardPreference();

  const [exportOpen, setExportOpen] = useState(false);

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
    document.documentElement.requestFullscreen?.();
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
    <div className="mx-auto max-w-7xl">
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
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {title}
            </h1>
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
            <Maximize2 className="h-4 w-4" />
            Full screen
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
