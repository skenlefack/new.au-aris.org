'use client';

import React from 'react';

interface DividerWidgetProps {
  style?: 'line' | 'space' | 'dotted';
  label?: string;
}

export function DividerWidget({ style = 'line', label }: DividerWidgetProps) {
  if (style === 'space') {
    return <div className="min-h-[40px]" />;
  }

  const lineClass =
    style === 'dotted'
      ? 'border-t-2 border-dotted border-gray-300 dark:border-gray-600'
      : 'border-t border-gray-300 dark:border-gray-600';

  if (label) {
    return (
      <div className="flex min-h-[40px] items-center gap-3 px-4">
        <div className={`flex-1 ${lineClass}`} />
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {label}
        </span>
        <div className={`flex-1 ${lineClass}`} />
      </div>
    );
  }

  return (
    <div className="flex min-h-[40px] items-center px-4">
      <div className={`w-full ${lineClass}`} />
    </div>
  );
}
