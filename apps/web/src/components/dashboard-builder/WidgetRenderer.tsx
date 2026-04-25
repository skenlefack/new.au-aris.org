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

  const cfg = { ...widget.config, ...data } as Record<string, any>;

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
      return <MapWidget title={widget.title} config={cfg} />;

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

    default:
      return (
        <div className="flex h-full items-center justify-center p-4 text-sm text-gray-400">
          Unknown widget type: {widget.type}
        </div>
      );
  }
}
