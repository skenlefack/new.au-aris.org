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
import { useRangelands, type Rangeland } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { cn } from '@/lib/utils';

const PLACEHOLDER_DATA: Rangeland[] = [
  { id: 'rg-1', country: 'Kenya', countryCode: 'KE', region: 'Kajiado', year: 2025, vegetationIndex: 0.32, degradationLevel: 'moderate', areaHa: 1_250_000, carryingCapacity: 0.4, biomassKgHa: 820, source: 'MODIS NDVI', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-02-05T10:00:00Z' },
  { id: 'rg-2', country: 'Ethiopia', countryCode: 'ET', region: 'Somali Region', year: 2025, vegetationIndex: 0.18, degradationLevel: 'severe', areaHa: 3_400_000, carryingCapacity: 0.2, biomassKgHa: 340, source: 'MODIS NDVI', createdAt: '2026-01-08T09:00:00Z', updatedAt: '2026-02-01T11:00:00Z' },
  { id: 'rg-3', country: 'Niger', countryCode: 'NE', region: 'Agadez', year: 2025, vegetationIndex: 0.12, degradationLevel: 'severe', areaHa: 5_200_000, carryingCapacity: 0.1, biomassKgHa: 180, source: 'Sentinel-2', createdAt: '2025-12-15T07:00:00Z', updatedAt: '2026-01-20T14:00:00Z' },
  { id: 'rg-4', country: 'Tanzania', countryCode: 'TZ', region: 'Arusha', year: 2025, vegetationIndex: 0.45, degradationLevel: 'low', areaHa: 890_000, carryingCapacity: 0.6, biomassKgHa: 1_250, source: 'MODIS NDVI', createdAt: '2025-11-20T10:00:00Z', updatedAt: '2025-12-30T09:00:00Z' },
  { id: 'rg-5', country: 'South Africa', countryCode: 'ZA', region: 'Limpopo', year: 2025, vegetationIndex: 0.52, degradationLevel: 'none', areaHa: 620_000, carryingCapacity: 0.8, biomassKgHa: 1_680, source: 'Sentinel-2', createdAt: '2025-10-05T08:00:00Z', updatedAt: '2025-11-18T12:00:00Z' },
];

const DEGRADATION_STYLES: Record<string, string> = {
  none: 'bg-green-100 text-green-700',
  low: 'bg-yellow-100 text-yellow-700',
  moderate: 'bg-orange-100 text-orange-700',
  severe: 'bg-red-100 text-red-700',
};

export default function RangelandsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [degradationFilter, setDegradationFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useRangelands({
    page,
    limit,
    degradationLevel: degradationFilter || undefined,
    search: search || undefined,
  });

  const records = data?.data ?? PLACEHOLDER_DATA;
  const meta = data?.meta ?? { total: PLACEHOLDER_DATA.length, page: 1, limit: 10 };
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/climate"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rangelands</h1>
          <p className="mt-1 text-sm text-gray-500">
            Vegetation indices, biomass, and degradation monitoring
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by country or region..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={degradationFilter}
            onChange={(e) => { setDegradationFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="">All Levels</option>
            <option value="none">None</option>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load rangeland data'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Year</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">NDVI</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Biomass (kg/ha)</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Degradation</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Carrying Cap.</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.country}</p>
                      <p className="text-xs text-gray-400">{r.region}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{r.year}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{r.vegetationIndex.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.biomassKgHa.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', DEGRADATION_STYLES[r.degradationLevel] ?? 'bg-gray-100 text-gray-700')}>
                        {r.degradationLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.carryingCapacity.toFixed(1)} TLU/ha</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.source}</td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      No rangeland records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              Showing {records.length} of {meta.total} records
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-gray-600">
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
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
