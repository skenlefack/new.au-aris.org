'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Filter,
  AlertTriangle,
  CheckCircle2,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDenominators } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';

export default function DenominatorComparisonPage() {
  const t = useTranslations('masterData');
  const [page, setPage] = useState(1);
  const [countryFilter, setCountryFilter] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  const { data, isLoading } = useDenominators({
    page,
    limit: 50,
    country: countryFilter || undefined,
    species: speciesFilter || undefined,
    year: yearFilter ? Number(yearFilter) : undefined,
  });

  const denominators = data?.data ?? [];
  const meta = data?.meta;

  // Summary statistics
  const withBothValues = denominators.filter(
    (d) => d.nationalCensusValue != null,
  );
  const highVariance = withBothValues.filter((d) => {
    const variance = d.variance ?? (
      d.nationalCensusValue && d.faostatValue
        ? Math.abs(
            ((d.nationalCensusValue - d.faostatValue) / d.faostatValue) * 100,
          )
        : 0
    );
    return variance > 20;
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/master-data"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToMasterData')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {t('denominatorsTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('denominatorsSubtitle')}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-gray-500">
            {t('totalRecords')}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {meta?.total ?? denominators.length}
          </p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-gray-500">
            {t('withBothSources')}
          </p>
          <p className="mt-1 text-2xl font-bold text-aris-primary-600">
            {withBothValues.length}
          </p>
        </div>
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium uppercase text-gray-500">
            {t('highVariance')} ({'>'}{t('highVariancePct')})
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {highVariance.length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder={t('searchCountry')}
          value={countryFilter}
          onChange={(e) => {
            setCountryFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none"
        />
        <input
          type="text"
          placeholder={t('searchSpecies')}
          value={speciesFilter}
          onChange={(e) => {
            setSpeciesFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none"
        />
        <select
          value={yearFilter}
          onChange={(e) => {
            setYearFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
        >
          <option value="">{t('allYears')}</option>
          {Array.from({ length: 10 }, (_, i) => 2026 - i).map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Comparison table */}
      {isLoading ? (
        <TableSkeleton rows={15} cols={8} />
      ) : (
        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">{t('country')}</th>
                <th className="px-4 py-3">{t('species')}</th>
                <th className="px-4 py-3">{t('year')}</th>
                <th className="px-4 py-3 text-right">{t('faostatValue')}</th>
                <th className="px-4 py-3 text-right">{t('censusValue')}</th>
                <th className="px-4 py-3 text-right">{t('variance')}</th>
                <th className="px-4 py-3">{t('status')}</th>
                <th className="px-4 py-3">{t('notes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {denominators.map((d) => {
                const variance =
                  d.variance ??
                  (d.nationalCensusValue && d.faostatValue
                    ? ((d.nationalCensusValue - d.faostatValue) /
                        d.faostatValue) *
                      100
                    : null);

                const absVariance =
                  variance !== null ? Math.abs(variance) : null;

                return (
                  <tr
                    key={d.id}
                    className={cn(
                      'hover:bg-gray-50',
                      absVariance !== null && absVariance > 20
                        ? 'bg-red-50/50'
                        : '',
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {d.country}
                      <span className="ml-1 font-mono text-xs text-gray-400">
                        ({d.countryCode})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{d.species}</td>
                    <td className="px-4 py-3 text-gray-600">{d.year}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-blue-700">
                      {d.faostatValue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-green-700">
                      {d.nationalCensusValue?.toLocaleString() ?? (
                        <span className="text-gray-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {variance !== null ? (
                        <span
                          className={cn(
                            'text-xs font-bold',
                            absVariance! > 20
                              ? 'text-red-600'
                              : absVariance! > 10
                                ? 'text-amber-600'
                                : 'text-green-600',
                          )}
                        >
                          {variance > 0 ? '+' : ''}
                          {variance.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {absVariance === null ? (
                        <span className="text-xs text-gray-400">
                          {t('missingCensus')}
                        </span>
                      ) : absVariance > 20 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          {t('reviewNeeded')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('aligned')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                      {d.notes ?? ''}
                    </td>
                  </tr>
                );
              })}
              {denominators.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    {t('noDenominatorData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total > meta.limit && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {t('showingRange', {
              from: String((meta.page - 1) * meta.limit + 1),
              to: String(Math.min(meta.page * meta.limit, meta.total)),
              total: String(meta.total),
            })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t('previous')}
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * meta.limit >= meta.total}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t('next')}
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="rounded-card border border-gray-200 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">
          {t('varianceLegend')}
        </h3>
        <div className="flex items-center gap-6 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
            <span className="text-gray-600">{t('legendAligned')}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-gray-600">{t('legendModerate')}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
            <span className="text-gray-600">{t('legendHigh')}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
