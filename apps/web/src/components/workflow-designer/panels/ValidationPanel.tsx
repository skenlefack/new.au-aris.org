'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

export function ValidationPanel({ errors }: { errors: string[] }) {
  const t = useTranslations('workflow');
  if (errors.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/95 shadow-lg backdrop-blur dark:border-amber-800 dark:bg-amber-900/30 p-3 max-w-[280px]">
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span className="text-xs font-bold text-amber-800 dark:text-amber-300">{t('designer.validationIssues')} ({errors.length})</span>
      </div>
      <ul className="space-y-1">
        {errors.slice(0, 5).map((err, i) => (
          <li key={i} className="text-[10px] text-amber-700 dark:text-amber-400 flex items-start gap-1">
            <span className="mt-0.5">•</span> {err}
          </li>
        ))}
        {errors.length > 5 && (
          <li className="text-[10px] text-amber-600 font-medium">... and {errors.length - 5} more</li>
        )}
      </ul>
    </div>
  );
}
