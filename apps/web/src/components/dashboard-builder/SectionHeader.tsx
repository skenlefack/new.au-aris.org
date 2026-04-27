'use client';

import React, { useState, useEffect } from 'react';
import { GripVertical, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
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

const COL_OPTIONS = [1, 2, 3, 4] as const;

export function SectionHeader({
  section,
  editable = false,
  dragHandleProps,
  onTitleChange,
  onColumnCountChange,
  onToggleCollapse,
  onRemove,
}: SectionHeaderProps) {
  // Use local state for the title input so user can freely type/clear
  const [localTitle, setLocalTitle] = useState(section.titleFr ?? '');

  // Sync from parent when section changes (e.g. after save/reload)
  useEffect(() => {
    setLocalTitle(section.titleFr ?? '');
  }, [section.id]); // only on section ID change, not every render

  const handleTitleBlur = () => {
    onTitleChange?.(localTitle);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const displayTitle = section.titleFr || section.titleEn || 'Untitled section';

  return (
    <div className="flex items-center gap-2 rounded-t-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
      {/* Drag handle */}
      {editable && (
        <div
          {...dragHandleProps}
          className="cursor-grab text-gray-300 dark:text-gray-600 hover:text-gray-500 active:cursor-grabbing flex-shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="rounded p-0.5 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 flex-shrink-0"
        type="button"
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
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 border-none outline-none focus:ring-1 focus:ring-[#1F4E79]/30 rounded px-1"
          placeholder="Section title..."
        />
      ) : (
        <span className="flex-1 min-w-0 text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">
          {displayTitle}
        </span>
      )}

      {/* Column count selector */}
      {editable && (
        <div className="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-0.5 flex-shrink-0">
          {COL_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onColumnCountChange?.(n)}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                Number(section.columnCount) === n
                  ? 'bg-[#1F4E79] text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={`${n} column${n > 1 ? 's' : ''}`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {/* Widget count */}
      <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">
        {section.widgets.length}
      </span>

      {/* Delete */}
      {editable && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 flex-shrink-0"
          title="Remove section"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
