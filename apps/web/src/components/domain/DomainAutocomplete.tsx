'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDomainStore, type Domain } from '@/lib/stores/domain-store';
import { useLocaleStore } from '@/lib/stores/locale-store';

interface DomainAutocompleteProps {
  /** Currently selected domain IDs */
  value: string[];
  /** Called with new array of selected domain IDs */
  onChange: (domainIds: string[]) => void;
  /** Override available domains (default: from domain store allDomains) */
  domains?: Domain[];
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional className */
  className?: string;
  /** Label text */
  label?: string;
}

/**
 * Multi-select domain picker with search, chips, and keyboard navigation.
 * Reads available domains from the domain store.
 */
export function DomainAutocomplete({
  value,
  onChange,
  domains: propDomains,
  placeholder = 'Select domains...',
  disabled = false,
  className,
  label,
}: DomainAutocompleteProps) {
  const allDomains = useDomainStore((s) => s.allDomains);
  const locale = useLocaleStore((s) => s.locale);

  const domains = propDomains ?? allDomains;
  const selectedSet = useMemo(() => new Set(value), [value]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Get display name for a domain
  const getName = useCallback(
    (d: Domain) => d.name?.[locale] || d.name?.en || d.code,
    [locale],
  );

  // Filtered domains based on search query
  const filtered = useMemo(() => {
    if (!query) return domains;
    const q = query.toLowerCase();
    return domains.filter(
      (d) =>
        getName(d).toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q),
    );
  }, [domains, query, getName]);

  // Selected domain objects for chips
  const selectedDomains = useMemo(
    () => domains.filter((d) => selectedSet.has(d.id)),
    [domains, selectedSet],
  );

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

  function toggleDomain(domainId: string) {
    if (selectedSet.has(domainId)) {
      onChange(value.filter((id) => id !== domainId));
    } else {
      onChange([...value, domainId]);
    }
  }

  function removeDomain(domainId: string) {
    onChange(value.filter((id) => id !== domainId));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightIndex]) {
        toggleDomain(filtered[highlightIndex].id);
      }
    } else if (e.key === 'Backspace' && !query && value.length > 0) {
      // Remove last chip
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}

      {/* Input area with chips */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700',
          'bg-white dark:bg-gray-800 px-2.5 py-1.5 min-h-[38px]',
          'focus-within:ring-2 focus-within:ring-offset-0 focus-within:border-transparent',
          'transition-colors duration-150 cursor-text',
          disabled && 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50',
        )}
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        {/* Selected chips */}
        {selectedDomains.map((d) => (
          <span
            key={d.id}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: d.color ? `${d.color}20` : '#e5e7eb',
              color: d.color || '#374151',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: d.color || '#6b7280' }}
            />
            {getName(d)}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeDomain(d.id);
                }}
                className="ml-0.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}

        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedDomains.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[80px] bg-transparent text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none"
        />

        <ChevronDown
          className={cn(
            'h-4 w-4 flex-shrink-0 text-gray-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-[240px] w-full overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
              No domains found
            </li>
          ) : (
            filtered.map((d, i) => {
              const isSelected = selectedSet.has(d.id);
              return (
                <li
                  key={d.id}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors',
                    i === highlightIndex && 'bg-gray-50 dark:bg-gray-700/50',
                    isSelected && 'font-medium',
                  )}
                  onMouseEnter={() => setHighlightIndex(i)}
                  onClick={() => {
                    toggleDomain(d.id);
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                >
                  {/* Color dot */}
                  <span
                    className="h-3 w-3 flex-shrink-0 rounded-full border"
                    style={{
                      backgroundColor: d.color ? `${d.color}30` : '#f3f4f6',
                      borderColor: d.color || '#d1d5db',
                    }}
                  />
                  {/* Name */}
                  <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">
                    {getName(d)}
                  </span>
                  {/* Checkmark */}
                  {isSelected && (
                    <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
