'use client';

import React from 'react';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import type { DashboardWidget } from '@/lib/api/dashboard-hooks';
import { useViewerFilters } from './DashboardViewerContext';
import { KpiCardWidget } from './widgets/KpiCardWidget';
import { ChartWidget } from './widgets/ChartWidget';
import { MapWidget } from './widgets/MapWidget';
import { TableWidget } from './widgets/TableWidget';
import { GaugeWidget } from './widgets/GaugeWidget';
import { TextBlockWidget } from './widgets/TextBlockWidget';
import { AlertFeedWidget } from './widgets/AlertFeedWidget';
import { StatCardWidget } from './widgets/StatCardWidget';
import { ProgressBarWidget } from './widgets/ProgressBarWidget';
import { DividerWidget } from './widgets/DividerWidget';
import { ImageWidget } from './widgets/ImageWidget';
import { IframeWidget } from './widgets/IframeWidget';
import { ListWidget } from './widgets/ListWidget';
import { HeatmapWidget } from './widgets/HeatmapWidget';
import { RankedListWidget } from './widgets/RankedListWidget';
import { ActivityFeedWidget } from './widgets/ActivityFeedWidget';
import { EpiCurveWidget } from './widgets/EpiCurveWidget';
import { DualAxisWidget } from './widgets/DualAxisWidget';
import { CounterWidget } from './widgets/CounterWidget';
import { ChoroplethMapWidget } from './widgets/ChoroplethMapWidget';
import { KpiStripWidget } from './widgets/KpiStripWidget';
import { PersonStatWidget } from './widgets/PersonStatWidget';

function getDefaultWidgetConfigs(t: (key: string) => string): Record<string, Record<string, unknown>> {
  return {
    KPI_CARD: { value: null, label: t('dbConfigureThisKpi') },
    LINE: { data: [] },
    BAR: { data: [] },
    PIE: { data: [] },
    STACKED_BAR: { data: [] },
    AREA: { data: [] },
    MAP: {},
    TABLE: { columns: [], rows: [] },
    GAUGE: { value: 0, target: 100, unit: '%' },
    TEXT_BLOCK: { content: t('dbClickSettingsToEdit'), format: 'plain' },
    ALERT_FEED: { alerts: [] },
    STAT_CARD: { value: 0, label: t('dbStatistic') },
    PROGRESS_BAR: { value: 0, target: 100, label: t('dbProgress') },
    DIVIDER: { style: 'line' },
    IMAGE: { src: '', alt: '' },
    IFRAME: { url: '' },
    LIST: { items: [] },
    HEATMAP: { rows: [], columns: [] },
    RANKED_LIST: { items: [] },
    ACTIVITY_FEED: { activities: [] },
    EPI_CURVE: { data: [] },
    DUAL_AXIS: { data: [], leftAxis: { key: 'left', label: 'Left', color: '#1F4E79' }, rightAxis: { key: 'right', label: 'Right', color: '#C9A227' } },
    COUNTER: { value: 0, label: 'Counter' },
    CHOROPLETH_MAP: {},
    KPI_STRIP: { items: [] },
    PERSON_STAT: { data: {} },
  };
}

interface WidgetRendererProps {
  widget: DashboardWidget;
  data?: Record<string, unknown>;
  loading?: boolean;
  error?: string;
}

function WidgetSkeleton() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="space-y-3 w-full">
        <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-8 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

function WidgetError({ message }: { message: string }) {
  const t = useTranslations('dashboard');
  const friendlyMessage = message.includes('Unknown queryType') ? t('dbErrorUnknownQuery')
    : message.includes('query is required') ? t('dbErrorQueryRequired')
    : message.includes('not found') ? t('dbErrorNotFound')
    : t('dbErrorDataUnavailable');
  return (
    <div className="flex h-full items-center justify-center p-4">
      <p className="text-sm text-red-500">{friendlyMessage}</p>
    </div>
  );
}

function WidgetEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

/**
 * Normalize resolved data for chart/table/KPI widgets.
 * ANALYTICS_QUERY and grouped FORM_AGGREGATION return { data: [{name, key, value}], ... }
 * Charts expect { data: [...], xKey, yKeys, ... }
 * KPI_CARD expects { value, label }
 * TABLE expects { columns, rows }
 */
function normalizeResolvedData(
  widgetType: string,
  widgetConfig: Record<string, any>,
  resolved: Record<string, any>,
): Record<string, any> {
  // Handle SQL_QUERY results ({ rows }) — promote to { data } for uniform handling
  if (Array.isArray(resolved?.rows) && !resolved?.data) {
    resolved = { ...resolved, data: resolved.rows };
  }
  // If the resolved data has a `data` array (from ANALYTICS_QUERY or grouped aggregation)
  const dataArray = resolved?.data;
  if (!Array.isArray(dataArray)) return resolved;

  const xKey = resolved.xKey || widgetConfig.xKey || 'name';
  const yKey = resolved.yKey || widgetConfig.yKey || 'value';

  // Charts: map data array + set axis keys
  const CHART_TYPES = ['LINE', 'LINE_CHART', 'BAR', 'BAR_CHART', 'PIE', 'PIE_CHART', 'STACKED_BAR', 'AREA', 'AREA_CHART', 'EPI_CURVE', 'DUAL_AXIS'];
  if (CHART_TYPES.includes(widgetType)) {
    const chartData = dataArray.map((row: any) => ({
      ...row,
      // Ensure standard keys exist
      name: row[xKey] ?? row.name ?? row.key ?? '',
      value: typeof row[yKey] === 'number' ? row[yKey] : (parseFloat(row[yKey]) || 0),
    }));
    return {
      ...resolved,
      data: chartData,
      chartConfig: {
        ...widgetConfig,
        xKey: 'name',
        yKeys: [yKey],
        nameKey: 'name',
        valueKey: yKey,
        colors: widgetConfig.colors || ['#1F4E79', '#C9A227', '#2E7D32', '#D84315', '#6A1B9A', '#0277BD', '#F57F17', '#455A64'],
        showGrid: widgetConfig.showGrid ?? true,
        showLegend: widgetConfig.showLegend ?? true,
      },
    };
  }

  // KPI_CARD / STAT_CARD / COUNTER / GAUGE: use first value or total
  if (['KPI_CARD', 'STAT_CARD', 'COUNTER', 'GAUGE'].includes(widgetType)) {
    // For continental_summary, map specific fields
    if (resolved.total_submissions !== undefined) {
      return { value: resolved.total_submissions, label: widgetConfig.label };
    }
    if (resolved.active_countries !== undefined) {
      return { value: resolved.active_countries, label: widgetConfig.label };
    }
    // Single-value aggregation
    if (resolved.value !== undefined) {
      return resolved;
    }
    // Array → take first value or sum
    if (dataArray.length === 1) {
      return { value: dataArray[0].value, label: dataArray[0].name };
    }
    const total = dataArray.reduce((sum: number, r: any) => sum + (r.value || 0), 0);
    return { value: total, label: widgetConfig.label || 'Total' };
  }

  // TABLE: auto-generate columns from data keys
  if (widgetType === 'TABLE') {
    if (dataArray.length > 0) {
      const sampleKeys = Object.keys(dataArray[0]).filter((k) => k !== 'key');
      const columns = widgetConfig.columns?.length > 0
        ? widgetConfig.columns
        : sampleKeys.map((k: string) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) }));
      return { columns, rows: dataArray, maxRows: widgetConfig.maxRows };
    }
  }

  // RANKED_LIST: map to items
  if (widgetType === 'RANKED_LIST') {
    return {
      items: dataArray.map((r: any) => ({ label: r.name || r.key, value: r.value })),
      maxItems: widgetConfig.maxItems,
      unit: widgetConfig.unit,
    };
  }

  // PROGRESS_BAR: value / target from data
  if (widgetType === 'PROGRESS_BAR' && dataArray.length >= 1) {
    return { value: dataArray[0].value, target: widgetConfig.target || 100, label: widgetConfig.label };
  }

  // MAP: convert to map format
  if (widgetType === 'MAP') {
    return { data: dataArray };
  }

  // CHOROPLETH_MAP: pass through as-is (backend returns { byCountry, indicator, mode })
  if (widgetType === 'CHOROPLETH_MAP') {
    return resolved;
  }

  // PERSON_STAT: pass data as-is
  if (widgetType === 'PERSON_STAT') {
    return resolved;
  }

  // KPI_STRIP: use items array if present, otherwise try to build from data
  if (widgetType === 'KPI_STRIP') {
    if (resolved.items && Array.isArray(resolved.items)) {
      return resolved;
    }
    // Build items from data array
    return {
      items: dataArray.map((r: any) => ({
        label: r.name || r.key || '',
        value: typeof r.value === 'number' ? r.value : (parseFloat(r.value) || 0),
        icon: r.icon,
        color: r.color,
      })),
    };
  }

  return resolved;
}

/** Pick the best widget title for the current locale (reactive). */
function pickWidgetTitle(w: any, locale: string): string {
  switch (locale) {
    case 'en': return w.titleEn || w.title_en || w.titleFr || w.title_fr || w.title || '';
    case 'pt': return w.titlePt || w.title_pt || w.titleFr || w.title_fr || w.title || '';
    case 'ar': return w.titleAr || w.title_ar || w.titleFr || w.title_fr || w.title || '';
    case 'es': return w.titleEs || w.title_es || w.titleFr || w.title_fr || w.title || '';
    case 'sw': return w.titleSw || w.title_sw || w.titleEn || w.title_en || w.title || '';
    default:   return w.titleFr || w.title_fr || w.title || w.titleEn || w.title_en || '';
  }
}

export function WidgetRenderer({ widget, data, loading, error }: WidgetRendererProps) {
  const t = useTranslations('dashboard');
  const locale = useLocaleStore((s) => s.locale);
  const { filters } = useViewerFilters();
  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;

  // Resolve title reactively based on current locale
  const resolvedTitle = pickWidgetTitle(widget, locale);
  const localizedWidget = { ...widget, title: resolvedTitle };

  const DEFAULT_WIDGET_CONFIGS = getDefaultWidgetConfigs(t);
  // Normalize analytics query / grouped data into widget-expected format
  const normalizedData = data ? normalizeResolvedData(localizedWidget.type, localizedWidget.config, data) : {};
  const cfg = { ...DEFAULT_WIDGET_CONFIGS[localizedWidget.type], ...localizedWidget.config, ...normalizedData } as Record<string, any>;

  const w = localizedWidget;
  switch (w.type) {
    case 'KPI_CARD':
      if (cfg.value == null) return <WidgetEmpty label={t('dbNoData')} />;
      return (
        <KpiCardWidget
          value={cfg.value}
          label={cfg.label ?? w.title}
          labels={cfg.labels}
          trend={cfg.trend}
          thresholds={cfg.thresholds}
          prefix={cfg.prefix}
          suffix={cfg.suffix}
          icon={cfg.icon}
          color={cfg.color}
        />
      );

    case 'LINE':
    case 'LINE_CHART':
    case 'BAR':
    case 'BAR_CHART':
    case 'PIE':
    case 'PIE_CHART':
    case 'STACKED_BAR':
    case 'AREA':
    case 'AREA_CHART':
      if (!Array.isArray(cfg.data) || cfg.data.length === 0) return <WidgetEmpty label={t('dbNoData')} />;
      {
        const chartConfig = { ...cfg.chartConfig };
        if (Array.isArray(cfg.colors) && !chartConfig.colors) {
          chartConfig.colors = cfg.colors;
        }
        const chartType = w.type.replace('_CHART', '') as any;
        return (
          <ChartWidget
            type={chartType}
            data={cfg.data}
            config={chartConfig}
          />
        );
      }

    case 'MAP':
    case 'MAP_AFRICA':
      return <MapWidget title={w.title} config={cfg} data={cfg.data} />;

    case 'TABLE':
      return (
        <TableWidget
          columns={cfg.columns ?? []}
          rows={cfg.rows ?? []}
          maxRows={cfg.maxRows}
          config={cfg}
        />
      );

    case 'GAUGE':
      if (cfg.value == null || cfg.target == null) return <WidgetEmpty label={t('dbNoData')} />;
      return (
        <GaugeWidget
          value={cfg.value}
          target={cfg.target}
          label={cfg.label ?? w.title}
          unit={cfg.unit}
          variant={cfg.variant}
        />
      );

    case 'TEXT_BLOCK':
      return <TextBlockWidget content={cfg.content ?? ''} format={cfg.format} />;

    case 'ALERT_FEED':
      return <AlertFeedWidget alerts={cfg.alerts ?? []} maxItems={cfg.maxItems} />;

    case 'STAT_CARD':
      return (
        <StatCardWidget
          value={cfg.value ?? 0}
          previousValue={cfg.previousValue}
          label={cfg.label ?? w.title}
          icon={cfg.icon}
          color={cfg.color}
        />
      );

    case 'PROGRESS_BAR':
      return (
        <ProgressBarWidget
          value={cfg.value ?? 0}
          target={cfg.target ?? 100}
          label={cfg.label ?? w.title}
          color={cfg.color}
          showPercentage={cfg.showPercentage}
        />
      );

    case 'DIVIDER':
      return <DividerWidget style={cfg.style} label={cfg.label} />;

    case 'IMAGE':
      return <ImageWidget src={cfg.src ?? ''} alt={cfg.alt ?? ''} caption={cfg.caption} fit={cfg.fit} />;

    case 'IFRAME':
      return <IframeWidget url={cfg.url ?? ''} title={cfg.title ?? w.title} />;

    case 'LIST':
      return <ListWidget items={cfg.items ?? []} ordered={cfg.ordered} />;

    case 'HEATMAP':
      return <HeatmapWidget rows={cfg.rows ?? []} columns={cfg.columns ?? []} colorScale={cfg.colorScale} />;

    case 'RANKED_LIST':
      return <RankedListWidget items={cfg.items ?? []} maxItems={cfg.maxItems} unit={cfg.unit} />;

    case 'ACTIVITY_FEED':
      return <ActivityFeedWidget activities={cfg.activities ?? []} maxItems={cfg.maxItems} />;

    case 'EPI_CURVE':
      return <EpiCurveWidget data={cfg.data ?? []} title={cfg.title ?? w.title} />;

    case 'DUAL_AXIS':
      return (
        <DualAxisWidget
          data={cfg.data ?? []}
          leftAxis={cfg.leftAxis ?? { key: 'left', label: 'Left', color: '#1F4E79' }}
          rightAxis={cfg.rightAxis ?? { key: 'right', label: 'Right', color: '#C9A227' }}
          xKey={cfg.xKey}
        />
      );

    case 'COUNTER':
      return (
        <CounterWidget
          value={cfg.value ?? 0}
          label={cfg.label ?? w.title}
          icon={cfg.icon}
          color={cfg.color}
          format={cfg.format}
        />
      );

    case 'CHOROPLETH_MAP':
      return <ChoroplethMapWidget data={cfg} config={cfg} />;

    case 'KPI_STRIP':
      return <KpiStripWidget items={cfg.items ?? []} config={cfg} />;

    case 'PERSON_STAT':
      return <PersonStatWidget data={cfg.data ?? cfg} config={cfg} />;

    default:
      return (
        <div className="flex h-full items-center justify-center p-4 text-sm text-gray-400">
          {t('dbUnknownWidgetType', { type: w.type })}
        </div>
      );
  }
}
