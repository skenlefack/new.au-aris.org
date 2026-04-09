'use client';

import { BarChart3 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

interface DomainStatisticsSectionProps {
  domain: string;
  title?: string;
}

/**
 * Statistics summary section for domain homepages.
 * Rendered conditionally when `sections.statistics` is enabled in domain settings.
 * Will be wired to the analytics service when domain KPI aggregations are ready.
 */
export function DomainStatisticsSection({ domain, title }: DomainStatisticsSectionProps) {
  const t = useTranslations('common');

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-emerald-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title ?? t('statistics')}
        </h3>
      </div>
      <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30">
        <div className="text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-400">
            {t('statisticsComingSoon')}
          </p>
        </div>
      </div>
    </div>
  );
}
