'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { GripVertical, Settings, Trash2, Copy, Download, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import type { DashboardWidget } from '@/lib/api/dashboard-hooks';
import { WidgetRenderer } from './WidgetRenderer';

const MIN_HEIGHTS: Record<string, string> = {
  KPI_CARD: '90px',
  LINE: '420px',
  LINE_CHART: '420px',
  BAR: '420px',
  BAR_CHART: '420px',
  PIE: '320px',
  PIE_CHART: '320px',
  STACKED_BAR: '420px',
  AREA: '380px',
  AREA_CHART: '380px',
  MAP: '550px',
  MAP_AFRICA: '550px',
  TABLE: '350px',
  GAUGE: '220px',
  TEXT_BLOCK: '100px',
  ALERT_FEED: '250px',
  STAT_CARD: '120px',
  PROGRESS_BAR: '80px',
  DIVIDER: '40px',
  IMAGE: '200px',
  IFRAME: '400px',
  LIST: '200px',
  HEATMAP: '350px',
  RANKED_LIST: '300px',
  ACTIVITY_FEED: '300px',
  EPI_CURVE: '380px',
  DUAL_AXIS: '380px',
  COUNTER: '120px',
  CHOROPLETH_MAP: '550px',
};

interface DraggableWidgetProps {
  widget: DashboardWidget;
  sectionId: string;
  columnIndex: number;
  data?: Record<string, unknown>;
  editable?: boolean;
  onConfigure?: () => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
}

export function DraggableWidget({
  widget,
  sectionId,
  columnIndex,
  data,
  editable = false,
  onConfigure,
  onRemove,
  onDuplicate,
}: DraggableWidgetProps) {
  const t = useTranslations('dashboard');
  const widgetRef = React.useRef<HTMLDivElement>(null);

  const handleExportCsv = React.useCallback(() => {
    if (!data) return;
    const dataArray = (data as any)?.data ?? (data as any)?.rows;
    if (!Array.isArray(dataArray) || dataArray.length === 0) return;
    const keys = Object.keys(dataArray[0]);
    const csvRows = [keys.join(',')];
    for (const row of dataArray) {
      csvRows.push(keys.map((k) => {
        const val = (row as any)[k];
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : String(val ?? '');
      }).join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${widget.title || 'widget'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, widget.title]);

  const handleExportPng = React.useCallback(async () => {
    const el = widgetRef.current;
    if (!el) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2 });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${widget.title || 'widget'}.png`;
      a.click();
    } catch {
      // html2canvas not available — fallback: copy SVG if present
      const svg = el.querySelector('svg');
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${widget.title || 'widget'}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  }, [widget.title]);

  const hasExportableData = data && (Array.isArray((data as any)?.data) || Array.isArray((data as any)?.rows));
  const CHART_WIDGET_TYPES = ['LINE', 'BAR', 'PIE', 'STACKED_BAR', 'AREA', 'EPI_CURVE', 'DUAL_AXIS', 'HEATMAP', 'GAUGE'];
  const isChartWidget = CHART_WIDGET_TYPES.includes(widget.type);

  const {
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: widget.id,
    data: {
      type: 'widget',
      widgetId: widget.id,
      sectionId,
      columnIndex,
      widget,
    },
    disabled: !editable,
  });

  // Only translate, never scale
  const tx = transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined;

  return (
    <div
      ref={setNodeRef}
      data-widget-id={widget.id}
      style={{
        transform: tx,
        transition: transition ?? undefined,
        minHeight: MIN_HEIGHTS[widget.type] || '120px',
      }}
      className={cn(
        'group relative flex flex-1 flex-col overflow-hidden rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 transition-shadow',
        editable ? 'shadow-sm' : 'shadow-sm hover:shadow-md',
        isDragging && 'opacity-40 shadow-lg ring-2 ring-[#1F4E79]/30 z-50',
        editable && !isDragging && 'hover:ring-1 hover:ring-[#1F4E79]/20',
      )}
    >
      {/* Header — hidden for KPI_CARD in view mode (KPI renders its own label) */}
      {(editable || widget.type !== 'KPI_CARD') && (
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-3 py-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {editable && (
              <button
                type="button"
                className="cursor-grab text-gray-300 dark:text-gray-600 hover:text-gray-500 active:cursor-grabbing touch-none"
                {...listeners}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            )}
            <h3 className="truncate text-[12px] font-semibold text-gray-600 dark:text-gray-300 tracking-tight">
              {widget.title}
            </h3>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Export buttons (available in both edit and view mode) */}
            {hasExportableData && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleExportCsv(); }}
                className="rounded p-1 text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950/30 dark:hover:text-green-400"
                title="Export CSV"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            )}
            {isChartWidget && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleExportPng(); }}
                className="rounded p-1 text-gray-400 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-950/30 dark:hover:text-purple-400"
                title="Export PNG"
              >
                <Image className="h-3.5 w-3.5" />
              </button>
            )}
            {editable && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onConfigure?.(); }}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  title={t('dbConfigure')}
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
                  className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
                  title={t('dbDuplicate')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                  title={t('dbDelete')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Body — flex-1 fills remaining height so charts match sibling widgets */}
      <div ref={widgetRef} className="flex-1" style={{ minHeight: 0 }}>
        <WidgetRenderer widget={widget} data={data} />
      </div>
    </div>
  );
}
