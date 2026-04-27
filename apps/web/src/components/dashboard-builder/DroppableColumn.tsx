'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import type { DashboardWidget } from '@/lib/api/dashboard-hooks';
import { DraggableWidget } from './DraggableWidget';

interface DroppableColumnProps {
  sectionId: string;
  columnIndex: number;
  widgets: DashboardWidget[];
  widgetData?: Record<string, Record<string, unknown>>;
  editable?: boolean;
  onWidgetConfigure?: (widget: DashboardWidget) => void;
  onWidgetRemove?: (widgetId: string) => void;
}

export function DroppableColumn({
  sectionId,
  columnIndex,
  widgets,
  widgetData,
  editable = false,
  onWidgetConfigure,
  onWidgetRemove,
}: DroppableColumnProps) {
  const droppableId = `column-${sectionId}-${columnIndex}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: 'column', sectionId, columnIndex },
  });

  const sortedWidgets = [...widgets].sort((a, b) => a.sortOrder - b.sortOrder);
  const widgetIds = sortedWidgets.map((w) => w.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col gap-3 min-h-[80px] rounded-lg p-2 transition-colors',
        isOver && 'bg-[#1F4E79]/5 ring-2 ring-[#1F4E79]/20 ring-dashed',
        !isOver && editable && 'bg-gray-50/50 dark:bg-gray-900/30',
      )}
    >
      <SortableContext items={widgetIds} strategy={verticalListSortingStrategy}>
        {sortedWidgets.map((widget) => (
          <DraggableWidget
            key={widget.id}
            widget={widget}
            sectionId={sectionId}
            columnIndex={columnIndex}
            data={widgetData?.[widget.id]}
            editable={editable}
            onConfigure={() => onWidgetConfigure?.(widget)}
            onRemove={() => onWidgetRemove?.(widget.id)}
          />
        ))}
      </SortableContext>

      {sortedWidgets.length === 0 && editable && (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 py-8 text-xs text-gray-400">
          Drop widget here
        </div>
      )}
    </div>
  );
}
