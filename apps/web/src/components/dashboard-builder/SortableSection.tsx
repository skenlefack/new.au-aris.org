'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { DashboardSection, DashboardWidget } from '@/lib/api/dashboard-hooks';
import { SectionHeader } from './SectionHeader';
import { DroppableColumn } from './DroppableColumn';

interface SortableSectionProps {
  section: DashboardSection;
  widgetData?: Record<string, Record<string, unknown>>;
  editable?: boolean;
  onSectionUpdate?: (sectionId: string, updates: Partial<DashboardSection>) => void;
  onSectionRemove?: (sectionId: string) => void;
  onWidgetConfigure?: (widget: DashboardWidget) => void;
  onWidgetRemove?: (widgetId: string) => void;
}

export function SortableSection({
  section,
  widgetData,
  editable = false,
  onSectionUpdate,
  onSectionRemove,
  onWidgetConfigure,
  onWidgetRemove,
}: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: section.id,
    data: { type: 'section', sectionId: section.id },
    disabled: !editable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Group widgets by column index
  const widgetsByColumn: DashboardWidget[][] = [];
  for (let i = 0; i < section.columnCount; i++) {
    widgetsByColumn.push(
      section.widgets.filter((w) => (w.columnIndex ?? 0) === i),
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg transition-shadow',
        isDragging && 'opacity-50 shadow-xl ring-2 ring-[#1F4E79]/30 z-50',
      )}
      {...attributes}
    >
      <SectionHeader
        section={section}
        editable={editable}
        dragHandleProps={listeners}
        onTitleChange={(title) =>
          onSectionUpdate?.(section.id, { titleFr: title, titleEn: title })
        }
        onColumnCountChange={(count) =>
          onSectionUpdate?.(section.id, { columnCount: count })
        }
        onToggleCollapse={() =>
          onSectionUpdate?.(section.id, { isCollapsed: !section.isCollapsed })
        }
        onRemove={() => onSectionRemove?.(section.id)}
      />

      {/* Column grid */}
      {!section.isCollapsed && (
        <div
          className="rounded-b-lg border border-t-0 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${section.columnCount}, 1fr)`,
            gap: '12px',
          }}
        >
          {widgetsByColumn.map((columnWidgets, colIdx) => (
            <DroppableColumn
              key={`${section.id}-col-${colIdx}`}
              sectionId={section.id}
              columnIndex={colIdx}
              widgets={columnWidgets}
              widgetData={widgetData}
              editable={editable}
              onWidgetConfigure={onWidgetConfigure}
              onWidgetRemove={onWidgetRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
