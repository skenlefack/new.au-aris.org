'use client';

import React from 'react';
import { useTranslations } from '@/lib/i18n/translations';

interface ConfigProps {
  config: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
}

export function TextBlockConfig({ config, onChange }: ConfigProps) {
  const t = useTranslations('dashboard');
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbContent')}</label>
        <textarea
          value={(config.content as string) ?? ''}
          onChange={(e) => onChange({ content: e.target.value })}
          rows={8}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono"
          placeholder={t('dbEnterTextContent')}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbFormat')}</label>
        <select
          value={(config.format as string) ?? 'plain'}
          onChange={(e) => onChange({ format: e.target.value })}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        >
          <option value="plain">{t('dbPlainText')}</option>
          <option value="markdown">{t('dbMarkdown')}</option>
        </select>
      </div>
    </div>
  );
}
