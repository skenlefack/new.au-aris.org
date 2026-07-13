'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDomainSubmissions } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import { aggregatePaidSubmissions, SECTOR_COLORS } from '@/lib/paid';

export default function PaidBySectorPage() {
  const t = useTranslations('paid');

  const subsQuery = useDomainSubmissions('paid', { refreshInterval: 30_000 });
  const rawSubmissions: any[] = Array.isArray(subsQuery.data?.data) ? subsQuery.data.data : [];

  const agg = useMemo(() => aggregatePaidSubmissions(rawSubmissions), [rawSubmissions]);
  const sectorsSorted = useMemo(
    () => Array.from(agg.bySector.values()).sort((a, b) => b.quantityImplemented - a.quantityImplemented),
    [agg],
  );

  const isLoading = subsQuery.isLoading;
  const maxBenef = sectorsSorted[0]?.quantityImplemented || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/paid-collecte" className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('bySector')}</h1>
          <p className="text-sm text-gray-500">{t('bySectorDesc')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : sectorsSorted.length === 0 ? (
        <div className="py-16 text-center text-gray-400">{t('noCampaignData')}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sectorsSorted.map((s) => {
            const color = SECTOR_COLORS[s.sector] ?? '#9E9E9E';
            const pct = Math.round((s.quantityImplemented / maxBenef) * 100);
            return (
              <div
                key={s.sector}
                className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
                style={{ borderLeft: `4px solid ${color}` }}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" style={{ color }} />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{s.sector}</h3>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-500">Qty Implemented</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{s.quantityImplemented.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">{t('submissions')}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{s.submissions}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">{t('totalProjects')}</p>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">{s.projects.size}</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
