'use client';

import React, { useCallback, useMemo } from 'react';
import { Responsive, type Layout } from 'react-grid-layout';
import { Settings, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardWidget } from '@/lib/api/dashboard-hooks';
import { WidgetRenderer } from './WidgetRenderer';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// react-grid-layout v2.x removed WidthProvider; use Responsive directly with a measured width
const ResponsiveGridLayout = Responsive;

interface DashboardGridProps {
  widgets: DashboardWidget[];
  widgetData?: Record<string, Record<string, unknown>>;
  editable?: boolean;
  onLayoutChange?: (layouts: Array<{ id: string; layout: { x: number; y: number; w: number; h: number } }>) => void;
  onWidgetConfigure?: (widget: DashboardWidget) => void;
  onWidgetRemove?: (widgetId: string) => void;
}

// Default min sizes per widget type
const MIN_SIZES: Record<string, { minW: number; minH: number }> = {
  KPI_CARD:    { minW: 2, minH: 2 },
  LINE:        { minW: 4, minH: 3 },
  BAR:         { minW: 4, minH: 3 },
  PIE:         { minW: 3, minH: 3 },
  STACKED_BAR: { minW: 4, minH: 3 },
  AREA:        { minW: 4, minH: 3 },
  MAP:         { minW: 4, minH: 4 },
  TABLE:       { minW: 4, minH: 3 },
  GAUGE:       { minW: 2, minH: 3 },
  TEXT_BLOCK:  { minW: 2, minH: 2 },
  ALERT_FEED:  { minW: 3, minH: 3 },
};

export function DashboardGrid({
  widgets,
  widgetData,
  editable = false,
  onLayoutChange,
  onWidgetConfigure,
  onWidgetRemove,
}: DashboardGridProps) {
  // Build layout from widgets
  const layout = useMemo<any[]>(
    () =>
      widgets.map((w) => {
        const mins = MIN_SIZES[w.type] ?? { minW: 2, minH: 2 };
        return {
          i: w.id,
          x: w.layout.x,
          y: w.layout.y,
          w: w.layout.w,
          h: w.layout.h,
          minW: w.layout.minW ?? mins.minW,
          minH: w.layout.minH ?? mins.minH,
          static: !editable,
        };
      }),
    [widgets, editable],
  );

  const handleLayoutChange = useCallback(
    (currentLayout: any, allLayouts: any) => {
      if (!onLayoutChange) return;
      const items = Array.isArray(currentLayout) ? currentLayout : Object.values(allLayouts || {}).flat();
      const updates = (items as any[]).map((l: any) => ({
        id: l.i,
        layout: { x: l.x, y: l.y, w: l.w, h: l.h },
      }));
      onLayoutChange(updates);
    },
    [onLayoutChange],
  );

  if (widgets.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
            No widgets yet
          </p>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            {editable
              ? 'Use the palette on the left to add widgets'
              : 'This dashboard has no widgets configured'}
          </p>
        </div>
      </div>
    );
  }

  const gridProps: any = {
    className: 'dashboard-grid-layout',
    layouts: { lg: layout },
    breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
    cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
    rowHeight: 60,
    isDraggable: editable,
    isResizable: editable,
    onLayoutChange: handleLayoutChange,
    draggableHandle: '.widget-drag-handle',
    containerPadding: [0, 0],
    margin: [16, 16],
  };

  return (
    <ResponsiveGridLayout {...gridProps}>
      {widgets.map((widget) => (
        <div
          key={widget.id}
          className={cn(
            'group relative overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800',
            editable && 'ring-1 ring-transparent hover:ring-[#1F4E79]/30 transition-shadow',
          )}
        >
          {/* Widget header */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-3 py-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {editable && (
                <GripVertical className="widget-drag-handle h-4 w-4 cursor-grab text-gray-300 dark:text-gray-600 hover:text-gray-500 active:cursor-grabbing" />
              )}
              <h3 className="truncate text-xs font-semibold text-gray-700 dark:text-gray-300">
                {widget.title}
              </h3>
            </div>
            {editable && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onWidgetConfigure?.(widget)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  title="Configure widget"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onWidgetRemove?.(widget.id)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                  title="Remove widget"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Widget body */}
          <div className="h-[calc(100%-32px)]">
            <WidgetRenderer
              widget={widget}
              data={widgetData?.[widget.id]}
            />
          </div>
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
