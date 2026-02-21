'use client';

import React from 'react';
import { Printer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PrintButtonProps {
  className?: string;
  label?: string;
}

export function PrintButton({ className, label = 'Print' }: PrintButtonProps) {
  return (
    <button
      onClick={() => window.print()}
      className={cn(
        'no-print flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50',
        'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
        className,
      )}
      aria-label={label}
    >
      <Printer className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
