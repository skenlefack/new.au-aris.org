'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { usePvsEvaluations, type PvsEvaluation } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

function scoreColor(score: number): string {
  if (score >= 4) return 'text-green-600 dark:text-green-400';
  if (score >= 3) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 2) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 4) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 3) return 'bg-yellow-100 dark:bg-yellow-900/30';
  if (score >= 2) return 'bg-orange-100 dark:bg-orange-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

const PLACEHOLDER_PVS: PvsEvaluation[] = [
  {
    id: 'pvs-1', country: 'Kenya', countryCode: 'KE', evaluationYear: 2024,
    evaluationType: 'Full PVS', overallScore: 3.6,
    legislation: 4.0, laboratories: 3.5, riskAnalysis: 3.2, quarantine: 3.8,
    surveillance: 3.9, diseaseControl: 3.5, foodSafety: 3.3, vetEducation: 3.6,
    status: 'completed', createdAt: '2024-08-15T10:00:00Z', updatedAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'pvs-2', country: 'Ethiopia', countryCode: 'ET', evaluationYear: 2023,
    evaluationType: 'Gap Analysis', overallScore: 2.8,
    legislation: 3.0, laboratories: 2.5, riskAnalysis: 2.2, quarantine: 3.0,
    surveillance: 3.2, diseaseControl: 2.8, foodSafety: 2.5, vetEducation: 3.0,
    status: 'completed', createdAt: '2023-11-20T09:00:00Z', updatedAt: '2025-06-05T12:00:00Z',
  },
  {
    id: 'pvs-3', country: 'Nigeria', countryCode: 'NG', evaluationYear: 2025,
    evaluationType: 'Follow-up', overallScore: 3.1,
    legislation: 3.5, laboratories: 2.8, riskAnalysis: 2.5, quarantine: 3.2,
    surveillance: 3.5, diseaseControl: 3.0, foodSafety: 3.2, vetEducation: 3.1,
    status: 'in_progress', createdAt: '2025-03-10T08:00:00Z', updatedAt: '2026-02-01T14:00:00Z',
  },
  {
    id: 'pvs-4', country: 'South Africa', countryCode: 'ZA', evaluationYear: 2024,
    evaluationType: 'Full PVS', overallScore: 4.2,
    legislation: 4.5, laboratories: 4.3, riskAnalysis: 4.0, quarantine: 4.2,
    surveillance: 4.5, diseaseControl: 4.0, foodSafety: 4.1, vetEducation: 4.0,
    status: 'completed', createdAt: '2024-05-12T11:00:00Z', updatedAt: '2025-10-22T16:00:00Z',
  },
  {
    id: 'pvs-5', country: 'Senegal', countryCode: 'SN', evaluationYear: 2023,
    evaluationType: 'Full PVS', overallScore: 2.4,
    legislation: 2.5, laboratories: 2.0, riskAnalysis: 2.0, quarantine: 2.5,
    surveillance: 2.8, diseaseControl: 2.5, foodSafety: 2.2, vetEducation: 2.7,
    status: 'completed', createdAt: '2023-10-20T09:00:00Z', updatedAt: '2025-12-15T14:00:00Z',
  },
  {
    id: 'pvs-6', country: 'Tanzania', countryCode: 'TZ', evaluationYear: 2025,
    evaluationType: 'Gap Analysis', overallScore: 3.3,
    legislation: 3.5, laboratories: 3.0, riskAnalysis: 3.0, quarantine: 3.5,
    surveillance: 3.8, diseaseControl: 3.2, foodSafety: 3.0, vetEducation: 3.4,
    status: 'planned', createdAt: '2026-01-08T07:00:00Z', updatedAt: '2026-02-18T11:00:00Z',
  },
];

export default function PvsEvaluationsPage() {
  const t = useTranslations('governance');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = usePvsEvaluations({
    page,
    limit,
    year: yearFilter ? Number(yearFilter) : undefined,
    search: search || undefined,
  });

  const evaluations = data?.data ?? PLACEHOLDER_PVS;
  const meta = data?.meta ?? { total: PLACEHOLDER_PVS.length, page: 1, limit: 10 };
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/governance"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('pvs')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('pvsDesc')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchEvaluations')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={yearFilter}
            onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">{t('allYears')}</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
            <option value="2022">2022</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={11} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load PVS evaluations'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('country')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">{t('year')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('evaluationType')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">{t('overallScore')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">{t('legislation')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">{t('labs')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">{t('riskAnalysis')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">{t('surveillance')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">{t('diseaseControl')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">{t('foodSafety')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">{t('vetEducation')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {evaluations.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{ev.country}</p>
                      <p className="text-xs text-gray-400">{ev.countryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{ev.evaluationYear}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{ev.evaluationType}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-bold', scoreColor(ev.overallScore), scoreBg(ev.overallScore))}>
                        {ev.overallScore.toFixed(1)}
                      </span>
                    </td>
                    <td className={cn('px-4 py-3 text-center font-medium', scoreColor(ev.legislation))}>{ev.legislation.toFixed(1)}</td>
                    <td className={cn('px-4 py-3 text-center font-medium', scoreColor(ev.laboratories))}>{ev.laboratories.toFixed(1)}</td>
                    <td className={cn('px-4 py-3 text-center font-medium', scoreColor(ev.riskAnalysis))}>{ev.riskAnalysis.toFixed(1)}</td>
                    <td className={cn('px-4 py-3 text-center font-medium', scoreColor(ev.surveillance))}>{ev.surveillance.toFixed(1)}</td>
                    <td className={cn('px-4 py-3 text-center font-medium', scoreColor(ev.diseaseControl))}>{ev.diseaseControl.toFixed(1)}</td>
                    <td className={cn('px-4 py-3 text-center font-medium', scoreColor(ev.foodSafety))}>{ev.foodSafety.toFixed(1)}</td>
                    <td className={cn('px-4 py-3 text-center font-medium', scoreColor(ev.vetEducation))}>{ev.vetEducation.toFixed(1)}</td>
                  </tr>
                ))}
                {evaluations.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                      {t('noEvaluationsFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('showing', { count: evaluations.length, total: meta.total })}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
