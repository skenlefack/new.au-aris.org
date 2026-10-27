'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

export function AnalyticsTab() {
  const t = useTranslations('mdm');

  return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
        <BarChart3 className="h-8 w-8" />
      </div>
      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
        {t('analyticsComingSoon')}
      </h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs text-center">
        {t('analyticsComingSoonDescription')}
      </p>
    </div>
  );
}
