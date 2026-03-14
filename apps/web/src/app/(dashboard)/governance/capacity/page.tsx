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
import { useGovernanceCapacity, type GovernanceCapacity } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

function pvsColor(score: number): string {
  if (score >= 4) return 'text-green-600 dark:text-green-400';
  if (score >= 3) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 2) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

const PLACEHOLDER_CAPACITY: GovernanceCapacity[] = [
  {
    id: 'cap-1', organizationName: 'Kenya Directorate of Veterinary Services',
    country: 'Kenya', countryCode: 'KE', year: 2025,
    staffCount: 2_450, budgetUsd: 18_500_000, pvsSelfAssessmentScore: 3.6,
    oieStatus: 'Member', createdAt: '2025-03-15T10:00:00Z', updatedAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'cap-2', organizationName: 'Ethiopia Veterinary Institute',
    country: 'Ethiopia', countryCode: 'ET', year: 2025,
    staffCount: 3_800, budgetUsd: 12_300_000, pvsSelfAssessmentScore: 2.8,
    oieStatus: 'Member', createdAt: '2025-01-20T09:00:00Z', updatedAt: '2026-02-05T12:00:00Z',
  },
  {
    id: 'cap-3', organizationName: 'NAFDAC Veterinary Division',
    country: 'Nigeria', countryCode: 'NG', year: 2025,
    staffCount: 1_900, budgetUsd: 22_000_000, pvsSelfAssessmentScore: 3.1,
    oieStatus: 'Member', createdAt: '2025-06-10T08:00:00Z', updatedAt: '2026-02-01T14:00:00Z',
  },
  {
    id: 'cap-4', organizationName: 'DALRRD Animal Health Division',
    country: 'South Africa', countryCode: 'ZA', year: 2025,
    staffCount: 4_200, budgetUsd: 45_000_000, pvsSelfAssessmentScore: 4.2,
    oieStatus: 'Member', createdAt: '2025-04-12T11:00:00Z', updatedAt: '2025-10-22T16:00:00Z',
  },
  {
    id: 'cap-5', organizationName: 'Direction des Services Vétérinaires',
    country: 'Senegal', countryCode: 'SN', year: 2024,
    staffCount: 680, budgetUsd: 4_500_000, pvsSelfAssessmentScore: 2.4,
    oieStatus: 'Member', createdAt: '2024-10-20T09:00:00Z', updatedAt: '2025-12-15T14:00:00Z',
  },
  {
    id: 'cap-6', organizationName: 'Tanzania Veterinary Laboratory Agency',
    country: 'Tanzania', countryCode: 'TZ', year: 2025,
    staffCount: 1_350, budgetUsd: 8_200_000, pvsSelfAssessmentScore: 3.3,
    oieStatus: 'Member', createdAt: '2025-08-08T07:00:00Z', updatedAt: '2026-01-30T11:00:00Z',
  },
];

export default function CapacityPage() {
  const t = useTranslations('governance');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useGovernanceCapacity({
    page,
    limit,
    year: yearFilter ? Number(yearFilter) : undefined,
    search: search || undefined,
  });

  const capacities = data?.data ?? PLACEHOLDER_CAPACITY;
  const meta = data?.meta ?? { total: PLACEHOLDER_CAPACITY.length, page: 1, limit: 10 };
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('capacity')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('capacityDesc')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchCapacity')}
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
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load capacity data'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('organization')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('country')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">{t('year')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">{t('staffCount')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">{t('budgetUsd')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">{t('pvsScore')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">{t('oieStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {capacities.map((cap) => (
                  <tr key={cap.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{cap.organizationName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{cap.country}</p>
                      <p className="text-xs text-gray-400">{cap.countryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{cap.year}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {cap.staffCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                      ${cap.budgetUsd.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('font-bold', pvsColor(cap.pvsSelfAssessmentScore))}>
                        {cap.pvsSelfAssessmentScore.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-400"> /5</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{cap.oieStatus}</td>
                  </tr>
                ))}
                {capacities.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      {t('noCapacityFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('showing', { count: capacities.length, total: meta.total })}
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
