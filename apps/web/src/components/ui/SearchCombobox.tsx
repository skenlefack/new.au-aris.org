'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Search, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchComboboxProps<T> {
  value: T | null;
  onChange: (item: T | null) => void;
  items: T[];
  labelKey: string | ((item: T) => string);
  filterKey?: string | ((item: T) => string);
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

function getLabel<T>(item: T, labelKey: string | ((item: T) => string)): string {
  if (typeof labelKey === 'function') return labelKey(item);
  const val = (item as Record<string, unknown>)[labelKey];
  return typeof val === 'string' ? val : String(val ?? '');
}

export function SearchCombobox<T>({
  value,
  onChange,
  items,
  labelKey,
  filterKey,
  placeholder = 'Select...',
  disabled = false,
  loading = false,
  className,
}: SearchComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const resolvedFilterKey = filterKey ?? labelKey;

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((item) => {
      const text = getLabel(item, resolvedFilterKey);
      return text.toLowerCase().includes(q);
    });
  }, [items, query, resolvedFilterKey]);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [filtered.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [disabled]);

  const select = useCallback(
    (item: T) => {
      onChange(item);
      setOpen(false);
      setQuery('');
    },
    [onChange],
  );

  const clear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      setQuery('');
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault();
          openDropdown();
        }
        return;
      }
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[highlightIndex]) select(filtered[highlightIndex]);
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [open, filtered, highlightIndex, select, openDropdown],
  );

  const displayLabel = value ? getLabel(value, labelKey) : '';

  return (
    <div ref={containerRef} className={cn('relative', className)} onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={openDropdown}
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
          'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
          'hover:border-gray-300 dark:hover:border-gray-600',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open && 'border-aris-primary-400 ring-1 ring-aris-primary-400',
        )}
      >
        <span className={cn('truncate', !value && 'text-gray-400 dark:text-gray-500')}>
          {displayLabel || placeholder}
        </span>
        <span className="flex items-center gap-1">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={clear}
              className="rounded p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </span>
          )}
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
          )}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>

          {/* Items list */}
          <ul ref={listRef} className="max-h-48 overflow-y-auto py-1">
            {loading ? (
              <li className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-sm text-gray-400 dark:text-gray-500">
                No results found
              </li>
            ) : (
              filtered.map((item, idx) => {
                const label = getLabel(item, labelKey);
                const isHighlighted = idx === highlightIndex;
                const isSelected = value && getLabel(value, labelKey) === label;
                return (
                  <li
                    key={idx}
                    onClick={() => select(item)}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={cn(
                      'cursor-pointer px-3 py-2 text-sm transition-colors',
                      isHighlighted && 'bg-gray-50 dark:bg-gray-800',
                      isSelected && 'font-medium text-aris-primary-600 dark:text-aris-primary-400',
                      !isSelected && 'text-gray-700 dark:text-gray-300',
                    )}
                  >
                    {label}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
