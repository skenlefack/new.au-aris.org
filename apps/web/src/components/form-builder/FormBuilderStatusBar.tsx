'use client';

import React from 'react';
import { useFormBuilderStore } from './hooks/useFormBuilder';

export function FormBuilderStatusBar() {
  const { form, lastSavedAt, isDirty } = useFormBuilderStore();
  const schema = useFormBuilderStore((s) => s.getSchema());

  const sectionCount = schema.sections.length;
  const fieldCount = schema.sections.reduce((sum, s) => sum + s.fields.length, 0);

  const savedLabel = lastSavedAt
    ? `Saved ${formatRelativeTime(lastSavedAt)}`
    : isDirty
      ? 'Unsaved changes'
      : 'No changes';

  return (
    <div className="flex h-8 items-center justify-between border-t border-gray-200 bg-gray-50 px-4 text-[11px] text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
      <div className="flex items-center gap-4">
        <span>{sectionCount} section{sectionCount !== 1 ? 's' : ''}</span>
        <span>{fieldCount} field{fieldCount !== 1 ? 's' : ''}</span>
        {form?.domain && (
          <span className="capitalize">{form.domain.replace('_', ' ')}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={isDirty ? 'text-amber-500' : 'text-green-500'}>
          {isDirty ? '●' : '●'}
        </span>
        <span>{savedLabel}</span>
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
