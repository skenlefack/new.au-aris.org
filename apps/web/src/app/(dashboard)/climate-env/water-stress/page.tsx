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
import { useWaterStress, type WaterStress } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const SEVERITY_BADGE: Record<string, string> = {
  low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  moderate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PLACEHOLDER_WATER: WaterStress[] = [
  {
    id: 'ws-1', country: 'Kenya', countryCode: 'KE', region: 'Turkana',
    period: '2025-Q4', index: 4.2, waterAvailability: 'Severely limited',
    irrigatedAreaPct: 3.5, source: 'Aqueduct', severity: 'critical',
    createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-02-10T08:00:00Z',
  },
  {
    id: 'ws-2', country: 'Ethiopia', countryCode: 'ET', region: 'Somali',
    period: '2025-Q4', index: 3.8, waterAvailability: 'Limited',
    irrigatedAreaPct: 5.2, source: 'Aqueduct', severity: 'high',
    createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-02-05T12:00:00Z',
  },
  {
    id: 'ws-3', country: 'Nigeria', countryCode: 'NG', region: 'Borno',
    period: '2025-Q4', index: 3.5, waterAvailability: 'Limited',
    irrigatedAreaPct: 8.1, source: 'FEWS NET', severity: 'high',
    createdAt: '2026-01-20T08:00:00Z', updatedAt: '2026-02-01T14:00:00Z',
  },
  {
    id: 'ws-4', country: 'South Africa', countryCode: 'ZA', region: 'Western Cape',
    period: '2025-Q4', index: 2.1, waterAvailability: 'Moderate',
    irrigatedAreaPct: 22.5, source: 'Aqueduct', severity: 'moderate',
    createdAt: '2025-12-12T11:00:00Z', updatedAt: '2026-01-22T16:00:00Z',
  },
  {
    id: 'ws-5', country: 'Tanzania', countryCode: 'TZ', region: 'Dodoma',
    period: '2025-Q4', index: 2.8, waterAvailability: 'Moderate',
    irrigatedAreaPct: 6.3, source: 'Station', severity: 'moderate',
    createdAt: '2026-02-05T10:00:00Z', updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'ws-6', country: 'Senegal', countryCode: 'SN', region: 'Matam',
    period: '2025-Q3', index: 3.2, waterAvailability: 'Limited',
    irrigatedAreaPct: 12.0, source: 'FEWS NET', severity: 'high',
    createdAt: '2025-10-08T07:00:00Z', updatedAt: '2026-01-30T11:00:00Z',
  },
  {
    id: 'ws-7', country: 'Morocco', countryCode: 'MA', region: 'Souss-Massa',
    period: '2025-Q4', index: 1.5, waterAvailability: 'Adequate',
    irrigatedAreaPct: 35.0, source: 'Aqueduct', severity: 'low',
    createdAt: '2025-11-20T09:00:00Z', updatedAt: '2026-01-15T14:00:00Z',
  },
];

export default function WaterStressPage() {
  const t = useTranslations('climate');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useWaterStress({
    page,
    limit,
    severity: severityFilter || undefined,
    search: search || undefined,
  });

  const records = data?.data ?? PLACEHOLDER_WATER;
  const meta = data?.meta ?? { total: PLACEHOLDER_WATER.length, page: 1, limit: 10 };
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/climate-env"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('waterStress')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('waterStressDesc')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchWaterStress')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={severityFilter}
            onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">{t('allSeverity')}</option>
            <option value="low">{t('low')}</option>
            <option value="moderate">{t('moderate')}</option>
            <option value="high">{t('high')}</option>
            <option value="critical">{t('critical')}</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={7} cols={7} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load water stress data'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('region')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('country')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">{t('period')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">{t('index')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('availability')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">{t('irrigatedPct')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">{t('severity')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{r.region}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{r.country}</p>
                      <p className="text-xs text-gray-400">{r.countryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{r.period}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      <span className={r.index >= 3.5 ? 'text-red-600 dark:text-red-400' : r.index >= 2.5 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}>
                        {r.index.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.waterAvailability}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{r.irrigatedAreaPct.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', SEVERITY_BADGE[r.severity])}>
                        {r.severity}
                      </span>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      {t('noWaterStress')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('showing', { count: records.length, total: meta.total })}
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
