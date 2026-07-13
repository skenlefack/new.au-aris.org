'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Globe2, Users, GraduationCap, FolderKanban, Accessibility } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDomainSubmissions } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import { aggregatePaidSubmissions, type PaidCountryAgg } from '@/lib/paid';

export default function PaidByCountryPage() {
  const t = useTranslations('paid');

  const subsQuery = useDomainSubmissions('paid', { refreshInterval: 30_000 });
  const rawSubmissions: any[] = Array.isArray(subsQuery.data?.data) ? subsQuery.data.data : [];

  const agg = useMemo(() => aggregatePaidSubmissions(rawSubmissions), [rawSubmissions]);
  const countrySorted = useMemo(
    () => Array.from(agg.byCountry.values()).sort((a, b) => b.quantityImplemented - a.quantityImplemented),
    [agg],
  );

  const isLoading = subsQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/paid-collecte" className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('byCountry')}</h1>
          <p className="text-sm text-gray-500">{t('byCountryDesc')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : countrySorted.length === 0 ? (
        <div className="py-16 text-center text-gray-400">{t('noCampaignData')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{t('filterCountry')}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Qty Implemented</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Qty Targeted</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Expenditure</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">{t('totalProjects')}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">{t('submissions')}</th>
              </tr>
            </thead>
            <tbody>
              {countrySorted.map((c) => (
                <tr key={c.country} className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Globe2 className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-gray-900 dark:text-white">{c.country}</span>
                      <span className="text-[10px] text-gray-400">{c.code}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{c.quantityImplemented.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{c.quantityTargeted.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">${c.expenditure.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{c.projects.size}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{c.submissions}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold dark:border-gray-600 dark:bg-gray-800/50">
                <td className="px-4 py-3 text-gray-900 dark:text-white">Total ({countrySorted.length} {t('allCountries').toLowerCase()})</td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{agg.totalQuantityImplemented.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{agg.totalQuantityTargeted.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">${agg.totalExpenditure.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{agg.totalProjects}</td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{rawSubmissions.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
