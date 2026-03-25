'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useLocaleStore } from '@/lib/stores/locale-store';

interface DomainBadgeProps {
  /** Domain code (e.g. 'animal-health') */
  code: string;
  /** Multilingual name record */
  name?: Record<string, string>;
  /** Hex color */
  color?: string;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md';
  /** Additional className */
  className?: string;
}

/**
 * Small colored pill badge displaying a domain name/code.
 */
export function DomainBadge({ code, name, color, size = 'sm', className }: DomainBadgeProps) {
  const locale = useLocaleStore((s) => s.locale);
  const label = name?.[locale] || name?.en || code;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'xs' && 'px-1.5 py-0.5 text-[10px]',
        size === 'sm' && 'px-2 py-0.5 text-[11px]',
        size === 'md' && 'px-2.5 py-1 text-xs',
        className,
      )}
      style={{
        backgroundColor: color ? `${color}18` : '#6b728018',
        color: color || '#6b7280',
      }}
    >
      <span
        className={cn(
          'flex-shrink-0 rounded-full',
          size === 'xs' ? 'h-1.5 w-1.5' : 'h-2 w-2',
        )}
        style={{ backgroundColor: color || '#6b7280' }}
      />
      {label}
    </span>
  );
}
