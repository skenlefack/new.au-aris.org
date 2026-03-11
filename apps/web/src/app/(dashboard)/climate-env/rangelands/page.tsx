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
import { useRangelands, type Rangeland } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const DEGRADATION_BADGE: Record<string, string> = {
  none: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  low: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  moderate: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  severe: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PLACEHOLDER_RANGELANDS: Rangeland[] = [
  {
    id: 'rl-1', country: 'Kenya', countryCode: 'KE', region: 'Turkana',
    year: 2025, vegetationIndex: 0.18, degradationLevel: 'severe',
    areaHa: 1_250_000, carryingCapacity: 8, biomassKgHa: 420,
    source: 'MODIS NDVI', createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-02-10T08:00:00Z',
  },
  {
    id: 'rl-2', country: 'Ethiopia', countryCode: 'ET', region: 'Afar',
    year: 2025, vegetationIndex: 0.22, degradationLevel: 'moderate',
    areaHa: 980_000, carryingCapacity: 12, biomassKgHa: 650,
    source: 'MODIS NDVI', createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-02-05T12:00:00Z',
  },
  {
    id: 'rl-3', country: 'Nigeria', countryCode: 'NG', region: 'Sokoto',
    year: 2025, vegetationIndex: 0.35, degradationLevel: 'low',
    areaHa: 560_000, carryingCapacity: 18, biomassKgHa: 1_200,
    source: 'Sentinel-2', createdAt: '2026-01-20T08:00:00Z', updatedAt: '2026-02-01T14:00:00Z',
  },
  {
    id: 'rl-4', country: 'South Africa', countryCode: 'ZA', region: 'Limpopo',
    year: 2025, vegetationIndex: 0.42, degradationLevel: 'none',
    areaHa: 720_000, carryingCapacity: 22, biomassKgHa: 1_800,
    source: 'Sentinel-2', createdAt: '2025-12-12T11:00:00Z', updatedAt: '2026-01-22T16:00:00Z',
  },
  {
    id: 'rl-5', country: 'Tanzania', countryCode: 'TZ', region: 'Manyara',
    year: 2025, vegetationIndex: 0.30, degradationLevel: 'low',
    areaHa: 890_000, carryingCapacity: 15, biomassKgHa: 950,
    source: 'MODIS NDVI', createdAt: '2026-02-05T10:00:00Z', updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'rl-6', country: 'Senegal', countryCode: 'SN', region: 'Ferlo',
    year: 2025, vegetationIndex: 0.15, degradationLevel: 'severe',
    areaHa: 450_000, carryingCapacity: 6, biomassKgHa: 280,
    source: 'MODIS NDVI', createdAt: '2025-10-08T07:00:00Z', updatedAt: '2026-01-30T11:00:00Z',
  },
  {
    id: 'rl-7', country: 'Sudan', countryCode: 'SD', region: 'North Kordofan',
    year: 2025, vegetationIndex: 0.25, degradationLevel: 'moderate',
    areaHa: 1_100_000, carryingCapacity: 10, biomassKgHa: 580,
    source: 'MODIS NDVI', createdAt: '2025-11-20T09:00:00Z', updatedAt: '2026-01-15T14:00:00Z',
  },
];

export default function RangelandsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [degradationFilter, setDegradationFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useRangelands({
    page,
    limit,
    degradationLevel: degradationFilter || undefined,
    year: yearFilter ? Number(yearFilter) : undefined,
    search: search || undefined,
  });

  const rangelands = data?.data ?? PLACEHOLDER_RANGELANDS;
  const meta = data?.meta ?? { total: PLACEHOLDER_RANGELANDS.length, page: 1, limit: 10 };
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Rangelands</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Vegetation indices, degradation levels, biomass, and carrying capacity
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search rangelands..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={degradationFilter}
            onChange={(e) => { setDegradationFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Degradation</option>
            <option value="none">None</option>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
          </select>
          <select
            value={yearFilter}
            onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Years</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={7} cols={8} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load rangeland data'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Region</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Country</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Year</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">NDVI</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Area (ha)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Biomass (kg/ha)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Carrying Cap.</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Degradation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {rangelands.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{r.region}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{r.country}</p>
                      <p className="text-xs text-gray-400">{r.countryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{r.year}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-medium', r.vegetationIndex < 0.2 ? 'text-red-600 dark:text-red-400' : r.vegetationIndex < 0.3 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400')}>
                        {r.vegetationIndex.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {r.areaHa.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {r.biomassKgHa.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {r.carryingCapacity} TLU/ha
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', DEGRADATION_BADGE[r.degradationLevel])}>
                        {r.degradationLevel}
                      </span>
                    </td>
                  </tr>
                ))}
                {rangelands.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      No rangeland records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {rangelands.length} of {meta.total} records
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
