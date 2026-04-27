'use client';

import React, { useCallback, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type {
  DashboardSection,
  DashboardWidget,
  WidgetType,
} from '@/lib/api/dashboard-hooks';
import { SectionList } from './SectionList';
import { WidgetPalette } from './WidgetPalette';
import { WidgetRenderer } from './WidgetRenderer';

interface DashboardEditorProps {
  sections: DashboardSection[];
  widgetData?: Record<string, Record<string, unknown>>;
  onSectionsChange: (sections: DashboardSection[]) => void;
  onAddWidget: (
    type: WidgetType,
    sectionId: string,
    columnIndex: number,
  ) => void;
  onWidgetConfigure?: (widget: DashboardWidget) => void;
  onWidgetRemove?: (widgetId: string) => void;
}

let tempIdCounter = 0;
function genTempId() {
  return `temp-section-${Date.now()}-${++tempIdCounter}`;
}

export function DashboardEditor({
  sections,
  widgetData,
  onSectionsChange,
  onAddWidget,
  onWidgetConfigure,
  onWidgetRemove,
}: DashboardEditorProps) {
  const [activeWidget, setActiveWidget] = useState<DashboardWidget | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  // ── Section CRUD ──

  const handleAddSection = useCallback(() => {
    const newSection: DashboardSection = {
      id: genTempId(),
      dashboardId: '',
      titleFr: `Section ${sections.length + 1}`,
      titleEn: `Section ${sections.length + 1}`,
      titleAr: null,
      titlePt: null,
      columnCount: 2,
      sortOrder: sections.length,
      isCollapsed: false,
      config: {},
      widgets: [],
    };
    onSectionsChange([...sections, newSection]);
  }, [sections, onSectionsChange]);

  const handleSectionUpdate = useCallback(
    (sectionId: string, updates: Partial<DashboardSection>) => {
      onSectionsChange(
        sections.map((s) => (s.id === sectionId ? { ...s, ...updates } : s)),
      );
    },
    [sections, onSectionsChange],
  );

  const handleSectionRemove = useCallback(
    (sectionId: string) => {
      onSectionsChange(sections.filter((s) => s.id !== sectionId));
    },
    [sections, onSectionsChange],
  );

  // ── Palette add (click) ──

  const handlePaletteAdd = useCallback(
    (type: WidgetType) => {
      // Add to first section, first column
      const targetSection = sections[0];
      if (!targetSection) return;
      onAddWidget(type, targetSection.id, 0);
    },
    [sections, onAddWidget],
  );

  // ── DnD handlers ──

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === 'widget') {
      setActiveWidget(data.widget as DashboardWidget);
    } else if (data?.type === 'section') {
      setActiveSection(data.sectionId as string);
    }
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;

      // Only handle widget moves
      if (activeData?.type !== 'widget') return;

      const activeWidgetId = activeData.widgetId as string;
      let targetSectionId: string | undefined;
      let targetColumnIndex: number | undefined;

      if (overData?.type === 'column') {
        targetSectionId = overData.sectionId as string;
        targetColumnIndex = overData.columnIndex as number;
      } else if (overData?.type === 'widget') {
        targetSectionId = overData.sectionId as string;
        targetColumnIndex = overData.columnIndex as number;
      }

      if (!targetSectionId || targetColumnIndex === undefined) return;

      const sourceSectionId = activeData.sectionId as string;
      const sourceColumnIndex = activeData.columnIndex as number;

      // Skip if same location
      if (sourceSectionId === targetSectionId && sourceColumnIndex === targetColumnIndex) return;

      // Move widget to target column
      onSectionsChange(
        sections.map((sec) => {
          if (sec.id === sourceSectionId && sec.id === targetSectionId) {
            // Same section, different column
            const widget = sec.widgets.find((w) => w.id === activeWidgetId);
            if (!widget) return sec;
            return {
              ...sec,
              widgets: sec.widgets.map((w) =>
                w.id === activeWidgetId
                  ? { ...w, columnIndex: targetColumnIndex!, sectionId: targetSectionId }
                  : w,
              ),
            };
          }
          if (sec.id === sourceSectionId) {
            // Remove from source
            return {
              ...sec,
              widgets: sec.widgets.filter((w) => w.id !== activeWidgetId),
            };
          }
          if (sec.id === targetSectionId) {
            // Add to target
            const sourceSection = sections.find((s) => s.id === sourceSectionId);
            const widget = sourceSection?.widgets.find((w) => w.id === activeWidgetId);
            if (!widget) return sec;
            const movedWidget = {
              ...widget,
              sectionId: targetSectionId,
              columnIndex: targetColumnIndex!,
              sortOrder: sec.widgets.filter((w) => (w.columnIndex ?? 0) === targetColumnIndex).length,
            };
            return {
              ...sec,
              widgets: [...sec.widgets, movedWidget],
            };
          }
          return sec;
        }),
      );
    },
    [sections, onSectionsChange],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveWidget(null);
      setActiveSection(null);

      if (!over || active.id === over.id) return;

      const activeData = active.data.current;
      const overData = over.data.current;

      // Section reorder
      if (activeData?.type === 'section' && overData?.type === 'section') {
        const oldIndex = sections.findIndex((s) => s.id === active.id);
        const newIndex = sections.findIndex((s) => s.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(sections, oldIndex, newIndex).map(
            (s, i) => ({ ...s, sortOrder: i }),
          );
          onSectionsChange(reordered);
        }
        return;
      }

      // Widget reorder within same column
      if (activeData?.type === 'widget' && overData?.type === 'widget') {
        const sectionId = activeData.sectionId as string;
        const colIdx = activeData.columnIndex as number;
        const overSectionId = overData.sectionId as string;
        const overColIdx = overData.columnIndex as number;

        if (sectionId === overSectionId && colIdx === overColIdx) {
          onSectionsChange(
            sections.map((sec) => {
              if (sec.id !== sectionId) return sec;
              const colWidgets = sec.widgets
                .filter((w) => (w.columnIndex ?? 0) === colIdx)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              const otherWidgets = sec.widgets.filter(
                (w) => (w.columnIndex ?? 0) !== colIdx,
              );
              const oldIdx = colWidgets.findIndex((w) => w.id === active.id);
              const newIdx = colWidgets.findIndex((w) => w.id === over.id);
              if (oldIdx === -1 || newIdx === -1) return sec;
              const reordered = arrayMove(colWidgets, oldIdx, newIdx).map(
                (w, i) => ({ ...w, sortOrder: i }),
              );
              return { ...sec, widgets: [...otherWidgets, ...reordered] };
            }),
          );
        }
      }
    },
    [sections, onSectionsChange],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full">
        {/* Left sidebar — Widget Palette */}
        <div className="w-64 flex-shrink-0">
          <WidgetPalette onAdd={handlePaletteAdd} />
        </div>

        {/* Main content — Sections */}
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-gray-950 p-6">
          <SectionList
            sections={sections}
            widgetData={widgetData}
            editable
            onSectionUpdate={handleSectionUpdate}
            onSectionRemove={handleSectionRemove}
            onWidgetConfigure={onWidgetConfigure}
            onWidgetRemove={onWidgetRemove}
          />

          {/* Add section button */}
          <button
            onClick={handleAddSection}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 py-3 text-sm font-medium text-gray-500 hover:border-[#1F4E79]/40 hover:text-[#1F4E79] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Section
          </button>
        </div>
      </div>

      {/* Drag overlay for smooth visual feedback */}
      <DragOverlay>
        {activeWidget && (
          <div className="rounded-xl border bg-white shadow-xl dark:bg-gray-900 dark:border-gray-800 opacity-90 w-64">
            <div className="border-b border-gray-100 dark:border-gray-800 px-3 py-1.5">
              <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                {activeWidget.title}
              </h3>
            </div>
            <div className="h-24">
              <WidgetRenderer widget={activeWidget} />
            </div>
          </div>
        )}
        {activeSection && (
          <div className="rounded-lg border-2 border-[#1F4E79]/30 bg-[#1F4E79]/5 py-4 px-6 text-sm font-medium text-[#1F4E79] shadow-xl">
            Moving section...
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
