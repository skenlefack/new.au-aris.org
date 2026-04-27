'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Settings, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardWidget } from '@/lib/api/dashboard-hooks';
import { WidgetRenderer } from './WidgetRenderer';

// Min heights per widget type for auto-height layout
const MIN_HEIGHTS: Record<string, string> = {
  KPI_CARD: '120px',
  LINE: '300px',
  BAR: '300px',
  PIE: '300px',
  STACKED_BAR: '300px',
  AREA: '300px',
  MAP: '400px',
  TABLE: '300px',
  GAUGE: '200px',
  TEXT_BLOCK: '100px',
  ALERT_FEED: '200px',
};

interface DraggableWidgetProps {
  widget: DashboardWidget;
  sectionId: string;
  columnIndex: number;
  data?: Record<string, unknown>;
  editable?: boolean;
  onConfigure?: () => void;
  onRemove?: () => void;
}

export function DraggableWidget({
  widget,
  sectionId,
  columnIndex,
  data,
  editable = false,
  onConfigure,
  onRemove,
}: DraggableWidgetProps) {
  const {
    attributes,
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

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    minHeight: MIN_HEIGHTS[widget.type] || '120px',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-[#1F4E79]/30 z-50',
        editable && !isDragging && 'hover:ring-1 hover:ring-[#1F4E79]/20 transition-shadow',
      )}
      {...attributes}
    >
      {/* Widget header */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-3 py-1.5 flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {editable && (
            <div
              {...listeners}
              className="cursor-grab text-gray-300 dark:text-gray-600 hover:text-gray-500 active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <h3 className="truncate text-xs font-semibold text-gray-700 dark:text-gray-300">
            {widget.title}
          </h3>
        </div>
        {editable && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onConfigure}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              title="Configure widget"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onRemove}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              title="Remove widget"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Widget body */}
      <div className="flex-1 min-h-0">
        <WidgetRenderer widget={widget} data={data} />
      </div>
    </div>
  );
}
