'use client';

import React, { useRef, useEffect, useState } from 'react';
import { GripVertical, Trash2, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import type { DashboardSection } from '@/lib/api/dashboard-hooks';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { useTranslations } from '@/lib/i18n/translations';

const SECTION_LANGS = ['fr', 'en', 'pt', 'ar', 'es', 'sw'] as const;

interface SectionHeaderProps {
  section: DashboardSection;
  editable?: boolean;
  dragListeners?: SyntheticListenerMap;
  onTitleChange?: (titles: Record<string, string>) => void;
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
  const t = useTranslations('dashboard');
  const [activeLang, setActiveLang] = useState<string>('fr');
  const inputRef = useRef<HTMLInputElement>(null);
  const titlesRef = useRef<Record<string, string>>({
    fr: section.titleFr ?? '', en: section.titleEn ?? '',
    pt: (section as any).titlePt ?? '', ar: (section as any).titleAr ?? '',
    es: (section as any).titleEs ?? '', sw: (section as any).titleSw ?? '',
  });

  useEffect(() => {
    titlesRef.current = {
      fr: section.titleFr ?? '', en: section.titleEn ?? '',
      pt: (section as any).titlePt ?? '', ar: (section as any).titleAr ?? '',
      es: (section as any).titleEs ?? '', sw: (section as any).titleSw ?? '',
    };
    if (inputRef.current) inputRef.current.value = titlesRef.current[activeLang] ?? '';
  }, [section.id]);

  const handleBlur = () => {
    titlesRef.current[activeLang] = inputRef.current?.value ?? '';
    onTitleChange?.({
      titleFr: titlesRef.current.fr, titleEn: titlesRef.current.en,
      titlePt: titlesRef.current.pt, titleAr: titlesRef.current.ar,
      titleEs: titlesRef.current.es, titleSw: titlesRef.current.sw,
    });
  };

  const switchLang = (lang: string) => {
    titlesRef.current[activeLang] = inputRef.current?.value ?? '';
    setActiveLang(lang);
    if (inputRef.current) inputRef.current.value = titlesRef.current[lang] ?? '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  const colCount = Number(section.columnCount) || 2;
  const sectionColor = (section.config as any)?.color || '#1F4E79';

  return (
    <div
      className="flex items-center gap-2 rounded-t-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 relative overflow-hidden"
    >
      {/* Section color accent bar */}
      {!editable && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: sectionColor }}
        />
      )}

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

      {/* Title — language tabs + single input */}
      {editable ? (
        <div className="flex flex-1 min-w-0 items-center gap-1">
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {SECTION_LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => switchLang(l)}
                className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded transition-colors ${
                  activeLang === l
                    ? 'bg-[#1F4E79] text-white'
                    : titlesRef.current[l]
                      ? 'text-emerald-600 hover:bg-gray-200 dark:hover:bg-gray-700'
                      : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <input
            ref={inputRef}
            type="text"
            defaultValue={titlesRef.current[activeLang] ?? ''}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
            className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 border-none outline-none focus:ring-1 focus:ring-[#1F4E79]/30 rounded px-1"
            placeholder={`Section title (${activeLang.toUpperCase()})`}
          />
        </div>
      ) : (
        <span className="flex-1 min-w-0 text-[13px] font-bold text-gray-700 dark:text-gray-200 truncate tracking-tight pl-1">
          {section.title || section.titleFr || section.titleEn || ''}
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

      {/* Count badge */}
      <span
        className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums flex-shrink-0"
        style={{
          backgroundColor: `${sectionColor}15`,
          color: sectionColor,
        }}
      >
        {section.widgets.length}
      </span>

      {/* Duplicate */}
      {editable && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
          className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:text-blue-400 flex-shrink-0"
          title={t('duplicateSection')}
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
