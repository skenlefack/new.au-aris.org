'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  label: string;
  value: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Show a clear button when a value is selected */
  clearable?: boolean;
  /** Callback when search term changes (for server-side search) */
  onSearchChange?: (term: string) => void;
}

/**
 * SearchableSelect — dropdown select with inline search.
 * Dropdown width matches the trigger width exactly.
 * Soft search: filters as you type, case-insensitive, matches anywhere.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className,
  clearable = true,
  onSearchChange,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    // When onSearchChange is provided, the parent handles server-side filtering
    // so we skip client-side filtering and show all options as-is
    if (onSearchChange) return options;
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) =>
      o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [filtered.length]);

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

  const selectOption = useCallback((opt: SearchableSelectOption) => {
    onChange(opt.value);
    setOpen(false);
  }, [onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
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
        if (filtered[highlightIndex]) {
          selectOption(filtered[highlightIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  }, [open, filtered, highlightIndex, selectOption, openDropdown]);

  return (
    <div ref={containerRef} className={cn('relative', className)} onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <button
        type="button"
        onClick={openDropdown}
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
          'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
          'hover:border-gray-300 dark:hover:border-gray-600',
          'focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open && 'border-blue-400 ring-1 ring-blue-400',
        )}
      >
        <span className={cn(
          'truncate',
          selectedOption ? 'text-gray-800 dark:text-white' : 'text-gray-400 dark:text-gray-500',
        )}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="rounded p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="h-3 w-3 text-gray-400" />
            </span>
          )}
          <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      {/* Dropdown — same width as trigger */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {/* Search */}
          {options.length > 5 && (
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
              <Search className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); onSearchChange?.(e.target.value); }}
                placeholder="Search..."
                className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500"
              />
            </div>
          )}

          {/* Options */}
          <ul ref={listRef} className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-sm text-gray-400 dark:text-gray-500">
                {onSearchChange && query.length < 3 ? 'Type 3+ characters to search...' : 'No results'}
              </li>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightIndex;
                return (
                  <li
                    key={opt.value}
                    onClick={() => selectOption(opt)}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm transition-colors',
                      isHighlighted && 'bg-gray-50 dark:bg-gray-800',
                      isSelected
                        ? 'font-medium text-blue-700 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300',
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-blue-500" />}
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
