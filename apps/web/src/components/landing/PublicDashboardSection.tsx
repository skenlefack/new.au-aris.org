'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { usePublicDashboard, type DashboardScope } from '@/lib/api/dashboard-hooks';

interface PublicDashboardSectionProps {
  scope: DashboardScope;
  code: string;
}

export function PublicDashboardSection({ scope, code }: PublicDashboardSectionProps) {
  const { data, isLoading } = usePublicDashboard(scope, code?.toLowerCase());

  const dashboard = data?.data;

  // Don't render anything if no dashboard is configured for this page
  if (!dashboard || isLoading) return null;

  const title = (dashboard as any).title || (dashboard as any).title_fr || (dashboard as any).titleFr || '';
  const sections = (dashboard as any).sections ?? [];
  const widgetData = (dashboard as any).widgetData ?? {};

  if (sections.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Section header */}
      {title && (
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F4E79]/10">
            <BarChart3 className="h-5 w-5 text-[#1F4E79]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
        </div>
      )}

      {/* Dashboard sections with widgets */}
      <div className="space-y-6">
        {sections.map((section: any) => (
          <div key={section.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            {section.title_fr && (
              <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {section.title_fr || section.titleFr || section.title_en || section.titleEn}
              </h3>
            )}
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${section.columns ?? 2}, minmax(0, 1fr))` }}
            >
              {(section.widgets ?? []).map((widget: any) => (
                <div
                  key={widget.id}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50"
                >
                  {widget.title_fr && (
                    <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {widget.title_fr || widget.titleFr || widget.title_en || widget.titleEn}
                    </p>
                  )}
                  <WidgetValueDisplay
                    widget={widget}
                    data={widgetData[widget.id]}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Simple widget value renderer for public pages (read-only, no interactive features) */
function WidgetValueDisplay({ widget, data }: { widget: any; data: any }) {
  const type = widget.type;
  const value = data?.value ?? data?.currentValue;
  const label = data?.label ?? widget.title_fr ?? widget.titleFr ?? '';

  if (type === 'KPI_CARD' || type === 'STAT_CARD' || type === 'COUNTER') {
    return (
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {value != null ? Number(value).toLocaleString() : '—'}
        </p>
        {label && <p className="mt-1 text-xs text-gray-400">{label}</p>}
      </div>
    );
  }

  if (type === 'TEXT_BLOCK') {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {(widget.config as any)?.content || value || '—'}
      </div>
    );
  }

  // For charts and complex widgets, show a placeholder with the value
  return (
    <div className="flex items-center justify-center py-4 text-sm text-gray-400">
      {value != null ? (
        <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">{Number(value).toLocaleString()}</span>
      ) : (
        <span>Widget: {type}</span>
      )}
    </div>
  );
}
