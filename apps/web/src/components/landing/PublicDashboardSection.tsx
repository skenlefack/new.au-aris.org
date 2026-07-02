'use client';

import React from 'react';
import { BarChart3, Info } from 'lucide-react';
import { usePublicDashboard, type DashboardScope } from '@/lib/api/dashboard-hooks';
import { useLocaleStore } from '@/lib/stores/locale-store';

interface PublicDashboardSectionProps {
  scope: DashboardScope;
  code: string;
  /** If true, show a "no statistics" message when no dashboard exists */
  showEmptyState?: boolean;
}

const NO_STATS_MSG: Record<string, string> = {
  en: 'No country statistics available yet. Data will appear here once collection campaigns are completed.',
  fr: 'Aucune statistique pays disponible pour le moment. Les données apparaîtront ici une fois les campagnes de collecte terminées.',
  pt: 'Nenhuma estatística do país disponível de momento. Os dados aparecerão aqui após a conclusão das campanhas de recolha.',
  ar: 'لا تتوفر إحصائيات للبلد حالياً. ستظهر البيانات هنا بمجرد اكتمال حملات جمع البيانات.',
};

export function PublicDashboardSection({ scope, code, showEmptyState }: PublicDashboardSectionProps) {
  const { data, isLoading } = usePublicDashboard(scope, code?.toLowerCase());
  const locale = useLocaleStore((s) => s.locale);

  const dashboard = data?.data;

  if (isLoading) return null;

  // No dashboard configured — show empty state if requested
  if (!dashboard) {
    if (!showEmptyState) return null;
    return (
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-900/50">
          <Info className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
            {NO_STATS_MSG[locale] ?? NO_STATS_MSG.en}
          </p>
        </div>
      </section>
    );
  }

  const db = dashboard as any;
  const title = db[`title_${locale}`] ?? db.title_en ?? db.title ?? db.title_fr ?? db.titleFr ?? '';
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
            {(section[`title_${locale}`] ?? section.title_en) && (
              <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {section[`title_${locale}`] ?? section.title_en ?? section.title_fr ?? ''}
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
                  {(widget[`title_${locale}`] ?? widget.title_en) && (
                    <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {widget[`title_${locale}`] ?? widget.title_en ?? widget.title_fr ?? ''}
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
