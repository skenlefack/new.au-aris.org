'use client';

import React from 'react';
import { GripVertical, Trash2, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { DashboardSection } from '@/lib/api/dashboard-hooks';

interface SectionHeaderProps {
  section: DashboardSection;
  editable?: boolean;
  dragHandleProps?: Record<string, unknown>;
  onTitleChange?: (title: string) => void;
  onColumnCountChange?: (count: 1 | 2 | 3 | 4) => void;
  onToggleCollapse?: () => void;
  onRemove?: () => void;
}

const COLUMN_OPTIONS: Array<{ value: 1 | 2 | 3 | 4; label: string }> = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
];

export function SectionHeader({
  section,
  editable = false,
  dragHandleProps,
  onTitleChange,
  onColumnCountChange,
  onToggleCollapse,
  onRemove,
}: SectionHeaderProps) {
  const title = section.titleFr || section.titleEn || 'Section';

  return (
    <div className="flex items-center gap-2 rounded-t-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
      {/* Drag handle */}
      {editable && (
        <div
          {...dragHandleProps}
          className="cursor-grab text-gray-300 dark:text-gray-600 hover:text-gray-500 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="rounded p-0.5 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600"
      >
        {section.isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {/* Title */}
      {editable ? (
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          className="flex-1 bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 border-none outline-none focus:ring-1 focus:ring-[#1F4E79]/30 rounded px-1"
          placeholder="Section title..."
        />
      ) : (
        <span className="flex-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
          {title}
        </span>
      )}

      {/* Column count selector */}
      {editable && (
        <div className="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-0.5">
          {COLUMN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onColumnCountChange?.(opt.value)}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                section.columnCount === opt.value
                  ? 'bg-[#1F4E79] text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={`${opt.value} column${opt.value > 1 ? 's' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Widget count badge */}
      <span className="text-xs text-gray-400 tabular-nums">
        {section.widgets.length} widget{section.widgets.length !== 1 ? 's' : ''}
      </span>

      {/* Delete */}
      {editable && (
        <button
          onClick={onRemove}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          title="Remove section"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
