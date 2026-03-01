'use client';

import React, { useState } from 'react';
import { Maximize2, Minimize2, MoreVertical, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WidgetWrapperProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  demo?: boolean;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
  noPadding?: boolean;
}

export function WidgetWrapper({
  title,
  subtitle,
  icon,
  accentColor,
  demo,
  children,
  className,
  headerRight,
  noPadding,
}: WidgetWrapperProps) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-3">
          <div className="flex items-center gap-3">
            {icon && <span className="text-gray-500">{icon}</span>}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
              {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Minimize2 className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-800/80 shadow-sm overflow-hidden transition-shadow duration-200 hover:shadow-md',
        className,
      )}
    >
      {/* Accent top bar */}
      {accentColor && (
        <div className="h-[3px] w-full" style={{ backgroundColor: accentColor }} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{icon}</span>}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{title}</h3>
            {subtitle && <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {demo && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
              Demo
            </span>
          )}
          {headerRight}
          <button
            onClick={() => setExpanded(true)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors"
            title="Expand"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-h-0', !noPadding && 'p-4')}>
        {children}
      </div>
    </div>
  );
}
