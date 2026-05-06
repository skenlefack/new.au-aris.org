'use client';

import React, { useRef, useEffect } from 'react';
import { GripVertical, Trash2, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import type { DashboardSection } from '@/lib/api/dashboard-hooks';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

interface SectionHeaderProps {
  section: DashboardSection;
  editable?: boolean;
  dragListeners?: SyntheticListenerMap;
  onTitleChange?: (titles: { titleFr: string; titleEn: string }) => void;
  onColumnCountChange?: (count: number) => void;
  onToggleCollapse?: () => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
}

const COL_OPTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function SectionHeader({
  section,
  editable = false,
  dragListeners,
  onTitleChange,
  onColumnCountChange,
  onToggleCollapse,
  onRemove,
  onDuplicate,
}: SectionHeaderProps) {
  const inputFrRef = useRef<HTMLInputElement>(null);
  const inputEnRef = useRef<HTMLInputElement>(null);

  // Keep input values in sync with section prop
  useEffect(() => {
    if (inputFrRef.current) inputFrRef.current.value = section.titleFr ?? '';
    if (inputEnRef.current) inputEnRef.current.value = section.titleEn ?? '';
  }, [section.id]);

  const handleBlur = () => {
    onTitleChange?.({
      titleFr: inputFrRef.current?.value ?? '',
      titleEn: inputEnRef.current?.value ?? '',
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  const colCount = Number(section.columnCount) || 2;

  return (
    <div className="flex items-center gap-2 rounded-t-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
      {/* Drag handle — ONLY this element has drag listeners */}
      {editable && (
        <button
          type="button"
          className="cursor-grab text-gray-300 dark:text-gray-600 hover:text-gray-500 active:cursor-grabbing flex-shrink-0 touch-none"
          {...dragListeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {/* Collapse */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleCollapse?.(); }}
        className="rounded p-0.5 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 flex-shrink-0"
      >
        {section.isCollapsed
          ? <ChevronRight className="h-4 w-4" />
          : <ChevronDown className="h-4 w-4" />}
      </button>

      {/* Title — two side-by-side inputs for FR/EN */}
      {editable ? (
        <div className="flex flex-1 min-w-0 items-center gap-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase flex-shrink-0">FR</span>
          <input
            ref={inputFrRef}
            type="text"
            defaultValue={section.titleFr ?? ''}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 border-none outline-none focus:ring-1 focus:ring-[#1F4E79]/30 rounded px-1"
            placeholder="Titre section..."
          />
          <span className="text-[10px] font-bold text-gray-400 uppercase flex-shrink-0 ml-1">EN</span>
          <input
            ref={inputEnRef}
            type="text"
            defaultValue={section.titleEn ?? ''}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 border-none outline-none focus:ring-1 focus:ring-[#1F4E79]/30 rounded px-1"
            placeholder="Section title..."
          />
        </div>
      ) : (
        <span className="flex-1 min-w-0 text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">
          {section.titleFr || section.titleEn || ''}
        </span>
      )}

      {/* Column count — simple buttons, stopPropagation to prevent dnd interference */}
      {editable && (
        <div className="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-0.5 flex-shrink-0">
          {COL_OPTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onColumnCountChange?.(n);
              }}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                colCount === n
                  ? 'bg-[#1F4E79] text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {/* Count */}
      <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">
        {section.widgets.length}
      </span>

      {/* Duplicate */}
      {editable && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
          className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:text-blue-400 flex-shrink-0"
          title="Duplicate section"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Delete */}
      {editable && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 flex-shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
