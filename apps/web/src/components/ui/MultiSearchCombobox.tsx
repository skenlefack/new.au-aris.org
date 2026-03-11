'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Search, Loader2, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MultiSearchComboboxProps<T> {
  value: T[];
  onChange: (items: T[]) => void;
  items: T[];
  labelKey: string | ((item: T) => string);
  filterKey?: string | ((item: T) => string);
  idKey?: string | ((item: T) => string);
  placeholder?: string;
  allLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  renderItem?: (item: T, selected: boolean) => React.ReactNode;
  renderChip?: (item: T) => React.ReactNode;
}

function getField<T>(item: T, key: string | ((item: T) => string)): string {
  if (typeof key === 'function') return key(item);
  const val = (item as Record<string, unknown>)[key];
  return typeof val === 'string' ? val : String(val ?? '');
}

export function MultiSearchCombobox<T>({
  value,
  onChange,
  items,
  labelKey,
  filterKey,
  idKey,
  placeholder = 'Select...',
  allLabel = 'All',
  disabled = false,
  loading = false,
  className,
  renderItem,
  renderChip,
}: MultiSearchComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const resolvedFilterKey = filterKey ?? labelKey;
  const resolvedIdKey = idKey ?? labelKey;

  const getId = useCallback(
    (item: T) => getField(item, resolvedIdKey),
    [resolvedIdKey],
  );

  const selectedIds = useMemo(
    () => new Set(value.map((v) => getId(v))),
    [value, getId],
  );

  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(getId(item)));

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((item) => {
      const text = getField(item, resolvedFilterKey);
      return text.toLowerCase().includes(q);
    });
  }, [items, query, resolvedFilterKey]);

  // +1 for "All" row
  const totalRows = filtered.length + 1;

  useEffect(() => {
    setHighlightIndex(0);
  }, [filtered.length]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open]);

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

  const toggleItem = useCallback(
    (item: T) => {
      const itemId = getId(item);
      if (selectedIds.has(itemId)) {
        onChange(value.filter((v) => getId(v) !== itemId));
      } else {
        onChange([...value, item]);
      }
    },
    [value, onChange, selectedIds, getId],
  );

  const toggleAll = useCallback(() => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...items]);
    }
  }, [allSelected, items, onChange]);

  const removeItem = useCallback(
    (e: React.MouseEvent, item: T) => {
      e.stopPropagation();
      const itemId = getId(item);
      onChange(value.filter((v) => getId(v) !== itemId));
    },
    [value, onChange, getId],
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
          setHighlightIndex((prev) => Math.min(prev + 1, totalRows - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightIndex === 0) {
            toggleAll();
          } else {
            const item = filtered[highlightIndex - 1];
            if (item) toggleItem(item);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [open, filtered, highlightIndex, totalRows, toggleItem, toggleAll, openDropdown],
  );

  return (
    <div ref={containerRef} className={cn('relative', className)} onKeyDown={handleKeyDown}>
      {/* Trigger area */}
      <button
        type="button"
        onClick={openDropdown}
        disabled={disabled}
        className={cn(
          'flex w-full min-h-[42px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
          'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
          'hover:border-gray-300 dark:hover:border-gray-600',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open && 'border-aris-primary-400 ring-1 ring-aris-primary-400',
        )}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1.5 min-w-0">
          {value.length === 0 ? (
            <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
          ) : (
            value.map((item) => {
              const id = getId(item);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-md bg-aris-primary-50 px-2 py-0.5 text-xs font-medium text-aris-primary-700 dark:bg-aris-primary-900/30 dark:text-aris-primary-300"
                >
                  {renderChip ? renderChip(item) : getField(item, labelKey)}
                  {!disabled && (
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => removeItem(e, item)}
                      className="rounded hover:bg-aris-primary-100 dark:hover:bg-aris-primary-800/50"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </span>
              );
            })
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1">
          {value.length > 0 && (
            <span className="rounded-full bg-aris-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-aris-primary-700 dark:bg-aris-primary-900/40 dark:text-aris-primary-300">
              {value.length}
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
          <ul ref={listRef} className="max-h-56 overflow-y-auto py-1">
            {/* "All" option */}
            <li
              onClick={toggleAll}
              onMouseEnter={() => setHighlightIndex(0)}
              className={cn(
                'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium transition-colors',
                highlightIndex === 0 && 'bg-gray-50 dark:bg-gray-800',
                'text-gray-700 dark:text-gray-300',
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                  allSelected
                    ? 'border-aris-primary-500 bg-aris-primary-500 text-white'
                    : 'border-gray-300 dark:border-gray-600',
                )}
              >
                {allSelected && <Check className="h-3 w-3" />}
              </span>
              {allLabel}
            </li>

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
                const isSelected = selectedIds.has(getId(item));
                const rowIdx = idx + 1; // offset for "All"
                const isHighlighted = rowIdx === highlightIndex;
                return (
                  <li
                    key={getId(item)}
                    onClick={() => toggleItem(item)}
                    onMouseEnter={() => setHighlightIndex(rowIdx)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors',
                      isHighlighted && 'bg-gray-50 dark:bg-gray-800',
                      'text-gray-700 dark:text-gray-300',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                        isSelected
                          ? 'border-aris-primary-500 bg-aris-primary-500 text-white'
                          : 'border-gray-300 dark:border-gray-600',
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                    {renderItem ? renderItem(item, isSelected) : getField(item, labelKey)}
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
