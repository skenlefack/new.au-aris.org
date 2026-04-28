'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import {
  type DashboardWidget,
  type WidgetType,
  useUpdateWidget,
} from '@/lib/api/dashboard-hooks';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';
import { KpiCardConfig } from './config/KpiCardConfig';
import { ChartConfig } from './config/ChartConfig';
import { TableConfig } from './config/TableConfig';
import { GaugeConfig } from './config/GaugeConfig';
import { TextBlockConfig } from './config/TextBlockConfig';
import { AlertFeedConfig } from './config/AlertFeedConfig';

interface WidgetConfigPanelProps {
  widget: DashboardWidget | null;
  dashboardId: string;
  onClose: () => void;
  onSaved: () => void;
}

const DATA_SOURCE_OPTIONS = [
  { value: 'INDICATOR', label: 'Indicator' },
  { value: 'FORM_AGGREGATION', label: 'Form Aggregation' },
  { value: 'KPI_CONTINENTAL', label: 'KPI Continental' },
  { value: 'MANUAL_VALUE', label: 'Manual Value' },
  { value: 'COMPOSITE', label: 'Composite Formula' },
  { value: 'SQL_QUERY', label: 'SQL Query' },
] as const;

const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
  KPI_CARD: 'KPI Card',
  LINE: 'Line Chart',
  BAR: 'Bar Chart',
  PIE: 'Pie Chart',
  STACKED_BAR: 'Stacked Bar',
  AREA: 'Area Chart',
  MAP: 'Map',
  TABLE: 'Table',
  GAUGE: 'Gauge',
  TEXT_BLOCK: 'Text Block',
  ALERT_FEED: 'Alert Feed',
  STAT_CARD: 'Statistics',
  PROGRESS_BAR: 'Progress Bar',
  DIVIDER: 'Divider',
  IMAGE: 'Image',
  IFRAME: 'Embed',
  LIST: 'List',
};

const CHART_TYPES: WidgetType[] = ['LINE', 'BAR', 'PIE', 'STACKED_BAR', 'AREA'];

export function WidgetConfigPanel({ widget, dashboardId, onClose, onSaved }: WidgetConfigPanelProps) {
  const updateWidget = useUpdateWidget();
  const addToast = useRealtimeStore((s) => s.addToast);

  const [localTitle, setLocalTitle] = useState('');
  const [dataSourceType, setDataSourceType] = useState('INDICATOR');
  const [dataSourceConfig, setDataSourceConfig] = useState<Record<string, unknown>>({});
  const [displayConfig, setDisplayConfig] = useState<Record<string, unknown>>({});

  // Sync local state when widget changes
  useEffect(() => {
    if (widget) {
      setLocalTitle(widget.title || '');
      const ds = widget.dataSource ?? {};
      setDataSourceType((ds.type as string) || 'INDICATOR');
      setDataSourceConfig({ ...ds });
      setDisplayConfig({ ...widget.config });
    }
  }, [widget]);

  const handleDataSourceConfigChange = useCallback((updates: Record<string, unknown>) => {
    setDataSourceConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleDisplayConfigChange = useCallback((updates: Record<string, unknown>) => {
    setDisplayConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSave = async () => {
    if (!widget) return;
    try {
      await updateWidget.mutateAsync({
        dashboardId,
        widgetId: widget.id,
        title: localTitle,
        config: displayConfig,
        dataSource: { ...dataSourceConfig, type: dataSourceType },
      });
      addToast({ type: 'success', title: 'Widget updated', message: 'Configuration saved' });
      onSaved();
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to save widget configuration' });
    }
  };

  if (!widget) return null;

  const isOpen = !!widget;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-[480px] z-50 bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-[#1F4E79]/10 dark:bg-[#1F4E79]/30 px-2 py-0.5 text-xs font-medium text-[#1F4E79] dark:text-[#C9A227]">
              {WIDGET_TYPE_LABELS[widget.type] ?? widget.type}
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Configure</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Section 1: Widget Title */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Widget Title</h3>
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              placeholder="Enter widget title"
            />
          </section>

          {/* Section 2: Data Source */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Data Source</h3>
            <select
              value={dataSourceType}
              onChange={(e) => {
                setDataSourceType(e.target.value);
                setDataSourceConfig({});
              }}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            >
              {DATA_SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </section>

          {/* Section 3: Data Source Configuration */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Data Source Configuration</h3>
            <DataSourceFields
              type={dataSourceType}
              config={dataSourceConfig}
              onChange={handleDataSourceConfigChange}
            />
          </section>

          {/* Section 4: Display Configuration */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Display Configuration</h3>
            <DisplayConfigSection
              widgetType={widget.type}
              config={displayConfig}
              onChange={handleDisplayConfigChange}
            />
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-5 py-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateWidget.isPending}
            className="rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white hover:bg-[#163a5c] disabled:opacity-50 transition-colors"
          >
            {updateWidget.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Data Source Fields ─────────────────────────────────────────────────── */

function DataSourceFields({
  type,
  config,
  onChange,
}: {
  type: string;
  config: Record<string, unknown>;
  onChange: (u: Record<string, unknown>) => void;
}) {
  switch (type) {
    case 'INDICATOR':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Indicator code</label>
          <input
            type="text"
            value={(config.indicatorCode as string) ?? ''}
            onChange={(e) => onChange({ indicatorCode: e.target.value })}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            placeholder="e.g. AH_OUTBREAK_COUNT"
          />
        </div>
      );

    case 'FORM_AGGREGATION':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Form ID</label>
            <input
              type="text"
              value={(config.formId as string) ?? ''}
              onChange={(e) => onChange({ formId: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Aggregation</label>
            <select
              value={(config.aggregation as string) ?? 'count'}
              onChange={(e) => onChange({ aggregation: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            >
              <option value="count">Count</option>
              <option value="sum">Sum</option>
              <option value="avg">Average</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field</label>
            <input
              type="text"
              value={(config.field as string) ?? ''}
              onChange={(e) => onChange({ field: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>
        </div>
      );

    case 'KPI_CONTINENTAL':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">KPI code</label>
          <input
            type="text"
            value={(config.kpiCode as string) ?? ''}
            onChange={(e) => onChange({ kpiCode: e.target.value })}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            placeholder="e.g. CONTINENTAL_LIVESTOCK_TOTAL"
          />
        </div>
      );

    case 'MANUAL_VALUE':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
            <input
              type="text"
              value={(config.value as string) ?? ''}
              onChange={(e) => onChange({ value: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label</label>
            <input
              type="text"
              value={(config.label as string) ?? ''}
              onChange={(e) => onChange({ label: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>
        </div>
      );

    case 'COMPOSITE':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Formula</label>
          <textarea
            value={(config.formula as string) ?? ''}
            onChange={(e) => onChange({ formula: e.target.value })}
            rows={4}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono"
            placeholder="e.g. indicator_a / indicator_b * 100"
          />
        </div>
      );

    case 'SQL_QUERY':
      return (
        <div>
          <div className="mb-2 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 px-3 py-2">
            <p className="text-xs text-yellow-800 dark:text-yellow-300">Admin only. Direct SQL queries are executed against the analytics database.</p>
          </div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SQL Query</label>
          <textarea
            value={(config.query as string) ?? ''}
            onChange={(e) => onChange({ query: e.target.value })}
            rows={6}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono"
            placeholder="SELECT ..."
          />
        </div>
      );

    default:
      return <p className="text-sm text-gray-500">Select a data source type above.</p>;
  }
}

/* ─── Display Config Section ─────────────────────────────────────────────── */

function DisplayConfigSection({
  widgetType,
  config,
  onChange,
}: {
  widgetType: WidgetType;
  config: Record<string, unknown>;
  onChange: (u: Record<string, unknown>) => void;
}) {
  if (widgetType === 'KPI_CARD') {
    return <KpiCardConfig config={config} onChange={onChange} />;
  }
  if (CHART_TYPES.includes(widgetType)) {
    return <ChartConfig config={{ ...config, _widgetType: widgetType }} onChange={onChange} />;
  }
  if (widgetType === 'TABLE') {
    return <TableConfig config={config} onChange={onChange} />;
  }
  if (widgetType === 'GAUGE') {
    return <GaugeConfig config={config} onChange={onChange} />;
  }
  if (widgetType === 'TEXT_BLOCK') {
    return <TextBlockConfig config={config} onChange={onChange} />;
  }
  if (widgetType === 'ALERT_FEED') {
    return <AlertFeedConfig config={config} onChange={onChange} />;
  }
  return <p className="text-sm text-gray-500 italic">No additional display configuration for this widget type.</p>;
}
