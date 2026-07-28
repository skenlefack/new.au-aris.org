'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import type { DashboardSection, DashboardWidget } from '@/lib/api/dashboard-hooks';
import { SectionHeader } from './SectionHeader';
import { DroppableColumn } from './DroppableColumn';

interface SortableSectionProps {
  section: DashboardSection;
  widgetData?: Record<string, Record<string, unknown>>;
  editable?: boolean;
  selectedTarget?: { sectionId: string; columnIndex: number } | null;
  onColumnSelect?: (sectionId: string, columnIndex: number) => void;
  onSectionUpdate?: (sectionId: string, updates: Partial<DashboardSection>) => void;
  onSectionRemove?: (sectionId: string) => void;
  onWidgetConfigure?: (widget: DashboardWidget) => void;
  onWidgetRemove?: (widgetId: string) => void;
  onWidgetDuplicate?: (widgetId: string) => void;
  onSectionDuplicate?: (sectionId: string) => void;
}

export function SortableSection({
  section,
  widgetData,
  editable = false,
  selectedTarget,
  onColumnSelect,
  onSectionUpdate,
  onSectionRemove,
  onWidgetConfigure,
  onWidgetRemove,
  onWidgetDuplicate,
  onSectionDuplicate,
}: SortableSectionProps) {
  const {
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

  // Only translate, never scale
  const tx = transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined;

  // Group widgets by column index
  const cols: DashboardWidget[][] = [];
  for (let i = 0; i < (Math.max(1, Math.min(12, Number(section.columnCount) || 2))); i++) {
    cols.push(section.widgets.filter((w) => (w.columnIndex ?? 0) === i));
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: tx, transition: transition ?? undefined }}
      className={cn(
        'rounded-lg',
        isDragging && 'opacity-40 ring-2 ring-[#1F4E79]/30 z-50',
      )}
    >
      <SectionHeader
        section={section}
        editable={editable}
        dragListeners={listeners}
        onTitleChange={({ titleFr, titleEn }) =>
          onSectionUpdate?.(section.id, { titleFr, titleEn })
        }
        onColumnCountChange={(count) =>
          onSectionUpdate?.(section.id, { columnCount: count })
        }
        onToggleCollapse={() =>
          onSectionUpdate?.(section.id, { isCollapsed: !section.isCollapsed })
        }
        onRemove={() => onSectionRemove?.(section.id)}
        onDuplicate={() => onSectionDuplicate?.(section.id)}
      />

      {!section.isCollapsed && (
        <div
          className="rounded-b-lg border border-t-0 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(1, Math.min(12, Number(section.columnCount) || 2))}, 1fr)`,
            gap: '12px',
          }}
        >
          {cols.map((columnWidgets, colIdx) => (
            <DroppableColumn
              key={`${section.id}-col-${colIdx}`}
              sectionId={section.id}
              columnIndex={colIdx}
              widgets={columnWidgets}
              widgetData={widgetData}
              editable={editable}
              isSelected={selectedTarget?.sectionId === section.id && selectedTarget?.columnIndex === colIdx}
              onSelect={() => onColumnSelect?.(section.id, colIdx)}
              onWidgetConfigure={onWidgetConfigure}
              onWidgetRemove={onWidgetRemove}
              onWidgetDuplicate={onWidgetDuplicate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
