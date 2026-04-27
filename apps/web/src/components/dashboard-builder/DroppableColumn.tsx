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
  isSelected?: boolean;
  onSelect?: () => void;
  onWidgetConfigure?: (widget: DashboardWidget) => void;
  onWidgetRemove?: (widgetId: string) => void;
}

export function DroppableColumn({
  sectionId,
  columnIndex,
  widgets,
  widgetData,
  editable = false,
  isSelected = false,
  onSelect,
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
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      className={cn(
        'flex flex-col gap-3 min-h-[80px] rounded-lg p-2 transition-all cursor-pointer',
        isOver && 'bg-[#1F4E79]/10 ring-2 ring-[#1F4E79]/30',
        isSelected && !isOver && 'ring-2 ring-[#1F4E79]/40 bg-[#1F4E79]/5',
        !isOver && !isSelected && editable && 'bg-gray-50/50 dark:bg-gray-900/30 hover:bg-gray-100/50 dark:hover:bg-gray-800/30',
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
        <div className={cn(
          'flex items-center justify-center rounded-lg border-2 border-dashed py-8 text-xs transition-colors',
          isSelected
            ? 'border-[#1F4E79]/40 text-[#1F4E79] bg-[#1F4E79]/5'
            : 'border-gray-200 dark:border-gray-700 text-gray-400',
        )}>
          {isSelected ? 'Click a widget to add here' : 'Click to select'}
        </div>
      )}
    </div>
  );
}
