'use client';

import React from 'react';
import { useTranslations } from '@/lib/i18n/translations';
import { useFormBuilderStore } from './hooks/useFormBuilder';

export function FormBuilderStatusBar() {
  const t = useTranslations('collecte');
  const { form, lastSavedAt, isDirty } = useFormBuilderStore();
  const schema = useFormBuilderStore((s) => s.getSchema());

  const sectionCount = schema.sections.length;
  const fieldCount = schema.sections.reduce((sum, s) => sum + s.fields.length, 0);

  const savedLabel = lastSavedAt
    ? `${t('saved')} ${formatRelativeTime(lastSavedAt, t)}`
    : isDirty
      ? t('unsavedChanges')
      : t('noChanges');

  return (
    <div className="flex h-8 items-center justify-between border-t border-gray-200 bg-gray-50 px-4 text-[11px] text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
      <div className="flex items-center gap-4">
        <span>{sectionCount} {sectionCount !== 1 ? t('sections') : t('section')}</span>
        <span>{fieldCount} {fieldCount !== 1 ? t('fields') : t('field')}</span>
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

function formatRelativeTime(date: Date, t: (key: string, params?: Record<string, string | number>) => string): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 5) return t('justNow');
  if (diff < 60) return t('secondsAgo', { count: diff });
  if (diff < 3600) return t('minutesAgo', { count: Math.floor(diff / 60) });
  return t('hoursAgo', { count: Math.floor(diff / 3600) });
}
