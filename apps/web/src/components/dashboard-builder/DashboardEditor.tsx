'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
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
  const [activeDragItem, setActiveDragItem] = useState<{
    type: 'widget' | 'section';
    widget?: DashboardWidget;
    sectionId?: string;
  } | null>(null);

  // Track selected column for palette click-to-add
  const [selectedTarget, setSelectedTarget] = useState<{
    sectionId: string;
    columnIndex: number;
  } | null>(null);

  // Throttle dragOver to avoid excessive re-renders
  const lastDragOverRef = useRef<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // ── Section CRUD ──

  const handleAddSection = useCallback(() => {
    const newSection: DashboardSection = {
      id: genTempId(),
      dashboardId: '',
      titleFr: '',
      titleEn: '',
      titleAr: null,
      titlePt: null,
      columnCount: 1,
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

  // ── Column selection handler (passed to DroppableColumn) ──

  const handleColumnSelect = useCallback(
    (sectionId: string, columnIndex: number) => {
      setSelectedTarget({ sectionId, columnIndex });
    },
    [],
  );

  // ── Palette add (click) — uses selected column or first available ──

  const handlePaletteAdd = useCallback(
    (type: WidgetType) => {
      const target = selectedTarget ?? { sectionId: sections[0]?.id, columnIndex: 0 };
      if (!target.sectionId) return;
      onAddWidget(type, target.sectionId, target.columnIndex);
    },
    [sections, onAddWidget, selectedTarget],
  );

  // ── DnD handlers ──

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === 'widget') {
      setActiveDragItem({ type: 'widget', widget: data.widget as DashboardWidget });
    } else if (data?.type === 'section') {
      setActiveDragItem({ type: 'section', sectionId: data.sectionId as string });
    }
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;

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

      // Throttle: skip if same target as last event
      const key = `${targetSectionId}-${targetColumnIndex}`;
      if (key === lastDragOverRef.current && sourceSectionId === targetSectionId && sourceColumnIndex === targetColumnIndex) return;
      lastDragOverRef.current = key;

      if (sourceSectionId === targetSectionId && sourceColumnIndex === targetColumnIndex) return;

      onSectionsChange(
        sections.map((sec) => {
          if (sec.id === sourceSectionId && sec.id === targetSectionId) {
            return {
              ...sec,
              widgets: sec.widgets.map((w) =>
                w.id === activeWidgetId
                  ? { ...w, columnIndex: targetColumnIndex! }
                  : w,
              ),
            };
          }
          if (sec.id === sourceSectionId) {
            return { ...sec, widgets: sec.widgets.filter((w) => w.id !== activeWidgetId) };
          }
          if (sec.id === targetSectionId) {
            const sourceSection = sections.find((s) => s.id === sourceSectionId);
            const widget = sourceSection?.widgets.find((w) => w.id === activeWidgetId);
            if (!widget) return sec;
            return {
              ...sec,
              widgets: [...sec.widgets, { ...widget, columnIndex: targetColumnIndex!, sortOrder: sec.widgets.length }],
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
      setActiveDragItem(null);
      lastDragOverRef.current = '';

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
      collisionDetection={pointerWithin}
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
            selectedTarget={selectedTarget}
            onColumnSelect={handleColumnSelect}
            onSectionUpdate={handleSectionUpdate}
            onSectionRemove={handleSectionRemove}
            onWidgetConfigure={onWidgetConfigure}
            onWidgetRemove={onWidgetRemove}
          />

          {/* Add section button */}
          <button
            type="button"
            onClick={handleAddSection}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 py-3 text-sm font-medium text-gray-500 hover:border-[#1F4E79]/40 hover:text-[#1F4E79] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Section
          </button>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDragItem?.type === 'widget' && activeDragItem.widget && (
          <div className="rounded-xl border-2 border-[#1F4E79]/40 bg-white shadow-2xl dark:bg-gray-900 dark:border-[#1F4E79]/30 w-56 pointer-events-none">
            <div className="px-3 py-2">
              <p className="text-xs font-semibold text-[#1F4E79] truncate">
                {activeDragItem.widget.title}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {activeDragItem.widget.type.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
        )}
        {activeDragItem?.type === 'section' && (
          <div className="rounded-lg border-2 border-[#1F4E79]/30 bg-[#1F4E79]/5 py-3 px-6 text-sm font-medium text-[#1F4E79] shadow-2xl pointer-events-none">
            Moving section...
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
