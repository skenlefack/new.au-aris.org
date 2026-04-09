'use client';

import { TrendingUp } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

interface DomainCurveSectionProps {
  domain: string;
  title?: string;
}

/**
 * Trend curve section for domain homepages.
 * Rendered conditionally when `sections.curve` is enabled in domain settings.
 * Will be wired to analytics time-series data when available.
 */
export function DomainCurveSection({ domain, title }: DomainCurveSectionProps) {
  const t = useTranslations('common');

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-amber-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title ?? t('curve')}
        </h3>
      </div>
      <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30">
        <div className="text-center">
          <TrendingUp className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-400">
            {t('curveComingSoon')}
          </p>
        </div>
      </div>
    </div>
  );
}
