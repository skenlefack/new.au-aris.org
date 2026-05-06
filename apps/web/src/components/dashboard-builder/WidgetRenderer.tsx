'use client';

import React from 'react';
import type { DashboardWidget } from '@/lib/api/dashboard-hooks';
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

const DEFAULT_WIDGET_CONFIGS: Record<string, Record<string, unknown>> = {
  KPI_CARD: { value: null, label: 'Configure this KPI' },
  LINE: { data: [] },
  BAR: { data: [] },
  PIE: { data: [] },
  STACKED_BAR: { data: [] },
  AREA: { data: [] },
  MAP: {},
  TABLE: { columns: [], rows: [] },
  GAUGE: { value: 0, target: 100, unit: '%' },
  TEXT_BLOCK: { content: 'Click settings to edit', format: 'plain' },
  ALERT_FEED: { alerts: [] },
  STAT_CARD: { value: 0, label: 'Statistic' },
  PROGRESS_BAR: { value: 0, target: 100, label: 'Progress' },
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
};

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
  return (
    <div className="flex h-full items-center justify-center p-4">
      <p className="text-sm text-red-500">{message}</p>
    </div>
  );
}

function WidgetEmpty() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <p className="text-sm text-gray-400">No data available</p>
    </div>
  );
}

export function WidgetRenderer({ widget, data, loading, error }: WidgetRendererProps) {
  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;

  const cfg = { ...DEFAULT_WIDGET_CONFIGS[widget.type], ...widget.config, ...data } as Record<string, any>;

  switch (widget.type) {
    case 'KPI_CARD':
      if (cfg.value == null) return <WidgetEmpty />;
      return (
        <KpiCardWidget
          value={cfg.value}
          label={cfg.label ?? widget.title}
          trend={cfg.trend}
          thresholds={cfg.thresholds}
          prefix={cfg.prefix}
          suffix={cfg.suffix}
        />
      );

    case 'LINE':
    case 'BAR':
    case 'PIE':
    case 'STACKED_BAR':
    case 'AREA':
      if (!Array.isArray(cfg.data) || cfg.data.length === 0) return <WidgetEmpty />;
      return (
        <ChartWidget
          type={widget.type}
          data={cfg.data}
          config={cfg.chartConfig}
        />
      );

    case 'MAP':
      return <MapWidget title={widget.title} config={cfg} data={cfg.data} />;

    case 'TABLE':
      return (
        <TableWidget
          columns={cfg.columns ?? []}
          rows={cfg.rows ?? []}
          maxRows={cfg.maxRows}
        />
      );

    case 'GAUGE':
      if (cfg.value == null || cfg.target == null) return <WidgetEmpty />;
      return (
        <GaugeWidget
          value={cfg.value}
          target={cfg.target}
          label={cfg.label ?? widget.title}
          unit={cfg.unit}
          variant={cfg.variant}
        />
      );

    case 'TEXT_BLOCK':
      return (
        <TextBlockWidget
          content={cfg.content ?? ''}
          format={cfg.format}
        />
      );

    case 'ALERT_FEED':
      return (
        <AlertFeedWidget
          alerts={cfg.alerts ?? []}
          maxItems={cfg.maxItems}
        />
      );

    case 'STAT_CARD':
      return (
        <StatCardWidget
          value={cfg.value ?? 0}
          previousValue={cfg.previousValue}
          label={cfg.label ?? widget.title}
          icon={cfg.icon}
          color={cfg.color}
        />
      );

    case 'PROGRESS_BAR':
      return (
        <ProgressBarWidget
          value={cfg.value ?? 0}
          target={cfg.target ?? 100}
          label={cfg.label ?? widget.title}
          color={cfg.color}
          showPercentage={cfg.showPercentage}
        />
      );

    case 'DIVIDER':
      return (
        <DividerWidget
          style={cfg.style}
          label={cfg.label}
        />
      );

    case 'IMAGE':
      return (
        <ImageWidget
          src={cfg.src ?? ''}
          alt={cfg.alt ?? ''}
          caption={cfg.caption}
          fit={cfg.fit}
        />
      );

    case 'IFRAME':
      return (
        <IframeWidget
          url={cfg.url ?? ''}
          title={cfg.title ?? widget.title}
        />
      );

    case 'LIST':
      return (
        <ListWidget
          items={cfg.items ?? []}
          ordered={cfg.ordered}
        />
      );

    case 'HEATMAP':
      return (
        <HeatmapWidget
          rows={cfg.rows ?? []}
          columns={cfg.columns ?? []}
          colorScale={cfg.colorScale}
        />
      );

    case 'RANKED_LIST':
      return (
        <RankedListWidget
          items={cfg.items ?? []}
          maxItems={cfg.maxItems}
          unit={cfg.unit}
        />
      );

    case 'ACTIVITY_FEED':
      return (
        <ActivityFeedWidget
          activities={cfg.activities ?? []}
          maxItems={cfg.maxItems}
        />
      );

    case 'EPI_CURVE':
      return (
        <EpiCurveWidget
          data={cfg.data ?? []}
          title={cfg.title ?? widget.title}
        />
      );

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
          label={cfg.label ?? widget.title}
          icon={cfg.icon}
          color={cfg.color}
          format={cfg.format}
        />
      );

    default:
      return (
        <div className="flex h-full items-center justify-center p-4 text-sm text-gray-400">
          Unknown widget type: {widget.type}
        </div>
      );
  }
}
