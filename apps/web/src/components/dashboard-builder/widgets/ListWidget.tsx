'use client';

import React from 'react';
import { List } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

interface ListItem {
  label: string;
  value?: string | number;
  color?: string;
}

interface ListWidgetProps {
  items: ListItem[];
  ordered?: boolean;
}

export function ListWidget({ items, ordered = false }: ListWidgetProps) {
  const t = useTranslations('dashboard');
  if (!items || items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-gray-400 dark:text-gray-500">
        <List className="h-10 w-10" />
        <p className="text-xs">{t('dbNoItemsConfigured')}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800/50"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0 text-xs font-medium text-gray-400 dark:text-gray-500 w-5 text-right">
                {ordered ? `${idx + 1}.` : '\u2022'}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {item.label}
              </span>
            </div>
            {item.value != null && (
              <span
                className="ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: item.color ? `${item.color}20` : '#1F4E7920',
                  color: item.color ?? '#1F4E79',
                }}
              >
                {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
