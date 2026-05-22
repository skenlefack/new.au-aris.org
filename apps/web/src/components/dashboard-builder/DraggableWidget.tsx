'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { GripVertical, Settings, Trash2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import type { DashboardWidget } from '@/lib/api/dashboard-hooks';
import { WidgetRenderer } from './WidgetRenderer';

const MIN_HEIGHTS: Record<string, string> = {
  KPI_CARD: '72px',
  LINE: '300px',
  BAR: '420px',
  PIE: '220px',
  STACKED_BAR: '420px',
  AREA: '300px',
  MAP: '520px',
  TABLE: '300px',
  GAUGE: '200px',
  TEXT_BLOCK: '100px',
  ALERT_FEED: '200px',
  STAT_CARD: '120px',
  PROGRESS_BAR: '80px',
  DIVIDER: '40px',
  IMAGE: '200px',
  IFRAME: '400px',
  LIST: '200px',
  HEATMAP: '300px',
  RANKED_LIST: '250px',
  ACTIVITY_FEED: '250px',
  EPI_CURVE: '300px',
  DUAL_AXIS: '300px',
  COUNTER: '120px',
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
        'group relative flex flex-1 flex-col overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800',
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
            <h3 className="truncate text-xs font-semibold text-gray-700 dark:text-gray-300">
              {widget.title}
            </h3>
          </div>
          {editable && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
            </div>
          )}
        </div>
      )}

      {/* Body — flex-1 fills remaining height so charts match sibling widgets */}
      <div className="flex-1" style={{ minHeight: 0 }}>
        <WidgetRenderer widget={widget} data={data} />
      </div>
    </div>
  );
}
