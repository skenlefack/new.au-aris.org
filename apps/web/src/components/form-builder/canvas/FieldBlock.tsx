'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Copy, Trash2, Asterisk } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormBuilderStore } from '../hooks/useFormBuilder';
import { getFieldTypeDefinition } from '../utils/field-types';
import type { FormField } from '../utils/form-schema';

interface FieldBlockProps {
  field: FormField;
  sectionId: string;
}

export function FieldBlock({ field, sectionId }: FieldBlockProps) {
  const { selectedFieldId, selectField, removeField, duplicateField } = useFormBuilderStore();
  const isSelected = selectedFieldId === field.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
    data: {
      type: 'field',
      fieldId: field.id,
      sectionId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const typeDef = getFieldTypeDefinition(field.type);
  const Icon = typeDef?.icon;
  const label = field.label.en || field.label.fr || field.type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        selectField(field.id);
      }}
      className={cn(
        'group relative flex items-center gap-2 rounded-lg border bg-white p-3 transition-all',
        'dark:bg-gray-800',
        isSelected
          ? 'border-blue-400 ring-1 ring-blue-400/30 shadow-sm'
          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600',
        isDragging && 'opacity-50 shadow-lg z-50',
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Icon */}
      {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" />}

      {/* Label */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
            {label || 'Untitled field'}
          </span>
          {field.required && (
            <Asterisk className="h-3 w-3 flex-shrink-0 text-red-400" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-400">{typeDef?.label || field.type}</span>
          {field.code && (
            <span className="text-[10px] text-gray-300 font-mono">{field.code}</span>
          )}
        </div>
      </div>

      {/* Actions (hover) */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            duplicateField(field.id);
          }}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          title="Duplicate"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeField(field.id);
          }}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
