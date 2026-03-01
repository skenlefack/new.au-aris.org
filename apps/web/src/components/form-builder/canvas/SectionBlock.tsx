'use client';

import React, { useState } from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Settings2,
  Copy,
  Trash2,
  Plus,
  Columns2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormBuilderStore } from '../hooks/useFormBuilder';
import { FieldBlock } from './FieldBlock';
import type { FormSection } from '../utils/form-schema';

interface SectionBlockProps {
  section: FormSection;
  index: number;
}

export function SectionBlock({ section, index }: SectionBlockProps) {
  const {
    selectedSectionId,
    selectSection,
    removeSection,
    duplicateSection,
    updateSection,
    addField,
  } = useFormBuilderStore();

  const isSelected = selectedSectionId === section.id;
  const [isCollapsed, setIsCollapsed] = useState(section.isCollapsed);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: section.id,
    data: { type: 'section', sectionId: section.id },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `section-drop-${section.id}`,
    data: { type: 'section-drop', sectionId: section.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const sectionName = section.name.en || section.name.fr || `Section ${index + 1}`;
  const fieldIds = section.fields.map((f) => f.id);

  return (
    <div
      ref={setSortableRef}
      style={style}
      onClick={(e) => {
        // Only select section if clicking on the section itself, not a field
        if ((e.target as HTMLElement).closest('[data-field-block]')) return;
        selectSection(section.id);
      }}
      className={cn(
        'rounded-xl border bg-white transition-all',
        'dark:bg-gray-800/50',
        isSelected
          ? 'border-blue-400 ring-1 ring-blue-400/20'
          : 'border-gray-200 dark:border-gray-700',
        isDragging && 'opacity-50 shadow-xl z-50',
      )}
    >
      {/* Section Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700/50',
          section.color && 'border-l-4',
        )}
        style={section.color ? { borderLeftColor: section.color } : undefined}
      >
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {/* Section Name */}
        <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
          {sectionName}
        </span>

        {/* Column indicator */}
        <span className="flex items-center gap-1 text-[10px] text-gray-400">
          <Columns2 className="h-3 w-3" />
          {section.columns} col
        </span>

        {/* Field count */}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
          {section.fields.length}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              selectSection(section.id);
            }}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            title="Settings"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              duplicateSection(section.id);
            }}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeSection(section.id);
            }}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Section Content (fields) */}
      {!isCollapsed && (
        <div
          ref={setDropRef}
          className={cn(
            'p-3 min-h-[60px]',
            isOver && 'bg-blue-50/50 dark:bg-blue-900/10',
          )}
        >
          {section.fields.length === 0 ? (
            <div
              className={cn(
                'flex items-center justify-center rounded-lg border-2 border-dashed py-8 text-xs text-gray-400',
                isOver
                  ? 'border-blue-400 bg-blue-50 text-blue-500 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700',
              )}
            >
              {isOver ? 'Drop field here' : 'Drag fields here or click + to add'}
            </div>
          ) : (
            <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
              <div
                className={cn(
                  'grid gap-2',
                  section.columns === 1 && 'grid-cols-1',
                  section.columns === 2 && 'grid-cols-1 md:grid-cols-2',
                  section.columns === 3 && 'grid-cols-1 md:grid-cols-3',
                  section.columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
                )}
              >
                {section.fields
                  .sort((a, b) => a.order - b.order)
                  .map((field) => (
                    <div
                      key={field.id}
                      data-field-block
                      className={cn(
                        field.columnSpan === 2 && 'md:col-span-2',
                        field.columnSpan === 3 && 'md:col-span-3',
                        field.columnSpan === 4 && 'md:col-span-4',
                      )}
                    >
                      <FieldBlock field={field} sectionId={section.id} />
                    </div>
                  ))}
              </div>
            </SortableContext>
          )}

          {/* Add field button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              addField(section.id, 'text');
            }}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 py-1.5 text-xs text-gray-400 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-500 dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
          >
            <Plus className="h-3 w-3" />
            Add field
          </button>
        </div>
      )}
    </div>
  );
}
