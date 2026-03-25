'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDomainStore } from '@/lib/stores/domain-store';
import { useLocaleStore } from '@/lib/stores/locale-store';

interface DomainSelectorProps {
  /** Current value (domain code or 'all') */
  value: string;
  /** Called when user picks a different domain */
  onChange: (code: string) => void;
  /** Show "All Domains" as first option (default: true) */
  showAll?: boolean;
  /** Label text above the select */
  label?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional className */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * Domain dropdown that only shows domains the user has access to.
 * Reads from useDomainStore.userDomains.
 * Falls back to allDomains if userDomains is empty (SUPER_ADMIN).
 */
export function DomainSelector({
  value,
  onChange,
  showAll = true,
  label,
  disabled,
  className,
  size = 'md',
}: DomainSelectorProps) {
  const userDomains = useDomainStore((s) => s.userDomains);
  const allDomains = useDomainStore((s) => s.allDomains);
  const locale = useLocaleStore((s) => s.locale);

  // Use userDomains if populated, otherwise allDomains
  const domains = userDomains.length > 0 ? userDomains : allDomains;

  const options = domains.map((d) => ({
    value: d.code,
    label: d.name[locale] || d.name.en || d.code,
    color: d.color,
  }));

  return (
    <div className={className}>
      {label && (
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'w-full appearance-none rounded-lg border border-gray-200 dark:border-gray-700',
            'bg-white dark:bg-gray-800 pr-8 font-medium',
            'text-gray-700 dark:text-gray-300',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'transition-colors duration-150',
            size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs',
            disabled && 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50',
          )}
        >
          {showAll && <option value="all">All Domains</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}
