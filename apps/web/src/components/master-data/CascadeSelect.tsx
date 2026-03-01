'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRefDataForSelect, type RefDataType, type SelectOption } from '@/lib/api/ref-data-hooks';

interface CascadeSelectProps {
  label: string;
  type: RefDataType;
  value: string | string[] | null;
  onChange: (value: string | string[] | null) => void;
  parentFilter?: Record<string, string>;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  error?: string;
  locale?: string;
}

export function CascadeSelect({
  label,
  type,
  value,
  onChange,
  parentFilter,
  multiple = false,
  disabled = false,
  required = false,
  placeholder,
  error,
  locale = 'en',
}: CascadeSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasParentFilter = parentFilter ? Object.values(parentFilter).some((v) => !!v) : true;
  const { data, isLoading } = useRefDataForSelect(type, parentFilter, hasParentFilter && !disabled);

  const options = data?.data ?? [];

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => {
      const name = o.name[locale] ?? o.name['en'] ?? '';
      return name.toLowerCase().includes(lower) || o.code.toLowerCase().includes(lower);
    });
  }, [options, search, locale]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  function getName(opt: SelectOption): string {
    return opt.name[locale] ?? opt.name['en'] ?? opt.code;
  }

  function getSelectedNames(): string {
    if (!value) return '';
    if (multiple && Array.isArray(value)) {
      return value
        .map((v) => {
          const opt = options.find((o) => o.id === v);
          return opt ? getName(opt) : '';
        })
        .filter(Boolean)
        .join(', ');
    }
    const opt = options.find((o) => o.id === value);
    return opt ? getName(opt) : '';
  }

  function handleSelect(id: string) {
    if (multiple) {
      const current = Array.isArray(value) ? value : [];
      if (current.includes(id)) {
        const next = current.filter((v) => v !== id);
        onChange(next.length > 0 ? next : null);
      } else {
        onChange([...current, id]);
      }
    } else {
      onChange(id);
      setOpen(false);
      setSearch('');
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setSearch('');
  }

  const isSelected = (id: string) => {
    if (multiple && Array.isArray(value)) return value.includes(id);
    return value === id;
  };

  const hasValue = multiple ? Array.isArray(value) && value.length > 0 : !!value;

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm',
            'transition-colors focus:outline-none focus:ring-1',
            disabled
              ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800'
              : open
                ? 'border-aris-primary-500 ring-1 ring-aris-primary-500 bg-white dark:bg-gray-900'
                : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900',
            error && 'border-red-400 focus:border-red-500 focus:ring-red-500',
          )}
        >
          <span className={cn('truncate', !hasValue && 'text-gray-400')}>
            {hasValue ? getSelectedNames() : (placeholder ?? `Select ${label.toLowerCase()}...`)}
          </span>
          <div className="flex items-center gap-1">
            {hasValue && !disabled && (
              <span onClick={handleClear} className="rounded p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="h-3.5 w-3.5 text-gray-400" />
              </span>
            )}
            <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
          </div>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
            {/* Search input */}
            <div className="border-b border-gray-100 p-2 dark:border-gray-800">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs focus:border-aris-primary-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>

            {/* Options list */}
            <div className="max-h-60 overflow-y-auto p-1">
              {isLoading && (
                <div className="px-3 py-4 text-center text-xs text-gray-400">Loading...</div>
              )}
              {!isLoading && filteredOptions.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-gray-400">
                  {search ? 'No results found' : 'No options available'}
                </div>
              )}
              {filteredOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    isSelected(opt.id)
                      ? 'bg-aris-primary-50 text-aris-primary-700 dark:bg-aris-primary-900/30 dark:text-aris-primary-300'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800',
                  )}
                >
                  {multiple && (
                    <span
                      className={cn(
                        'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border',
                        isSelected(opt.id)
                          ? 'border-aris-primary-500 bg-aris-primary-500 text-white'
                          : 'border-gray-300 dark:border-gray-600',
                      )}
                    >
                      {isSelected(opt.id) && (
                        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  )}
                  <span className="flex-1 truncate">{getName(opt)}</span>
                  <span className="flex-shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {opt.code}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
