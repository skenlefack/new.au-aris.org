'use client';

import React from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { DashboardSection, DashboardWidget } from '@/lib/api/dashboard-hooks';
import { SortableSection } from './SortableSection';

interface SectionListProps {
  sections: DashboardSection[];
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

export function SectionList({
  sections,
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
}: SectionListProps) {
  const sortedSections = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const sectionIds = sortedSections.map((s) => s.id);

  if (sortedSections.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
            No sections yet
          </p>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            {editable
              ? 'Click "Add Section" to get started'
              : 'This dashboard has no content'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
      <div className="flex flex-col gap-4">
        {sortedSections.map((section) => (
          <SortableSection
            key={section.id}
            section={section}
            widgetData={widgetData}
            editable={editable}
            selectedTarget={selectedTarget}
            onColumnSelect={onColumnSelect}
            onSectionUpdate={onSectionUpdate}
            onSectionRemove={onSectionRemove}
            onWidgetConfigure={onWidgetConfigure}
            onWidgetRemove={onWidgetRemove}
            onWidgetDuplicate={onWidgetDuplicate}
            onSectionDuplicate={onSectionDuplicate}
          />
        ))}
      </div>
    </SortableContext>
  );
}
