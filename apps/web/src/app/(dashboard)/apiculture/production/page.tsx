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
import { useApicultureProduction, type ApicultureProduction } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const GRADE_BADGE: Record<string, string> = {
  A: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  B: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  C: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ungraded: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const PLACEHOLDER_PRODUCTION: ApicultureProduction[] = [
  {
    id: 'pr-1', apiaryName: 'Addis Bee Farm', country: 'Ethiopia', countryCode: 'ET',
    year: 2025, quarter: 4, honeyKg: 2_400, waxKg: 180, propolisKg: 45,
    pollenKg: 30, royalJellyKg: 2, harvestMethod: 'Traditional press',
    qualityGrade: 'B', createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-02-10T08:00:00Z',
  },
  {
    id: 'pr-2', apiaryName: 'Mount Kenya Apiaries', country: 'Kenya', countryCode: 'KE',
    year: 2025, quarter: 4, honeyKg: 1_870, waxKg: 120, propolisKg: 35,
    pollenKg: 50, royalJellyKg: 5, harvestMethod: 'Centrifugal extraction',
    qualityGrade: 'A', createdAt: '2025-11-20T09:00:00Z', updatedAt: '2026-01-05T12:00:00Z',
  },
  {
    id: 'pr-3', apiaryName: 'Kilimanjaro Honey Co-op', country: 'Tanzania', countryCode: 'TZ',
    year: 2025, quarter: 3, honeyKg: 4_200, waxKg: 310, propolisKg: 85,
    pollenKg: 60, royalJellyKg: 0, harvestMethod: 'Traditional press',
    qualityGrade: 'B', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-02-01T14:00:00Z',
  },
  {
    id: 'pr-4', apiaryName: 'Atlas Mountain Apiary', country: 'Morocco', countryCode: 'MA',
    year: 2025, quarter: 4, honeyKg: 3_600, waxKg: 250, propolisKg: 120,
    pollenKg: 80, royalJellyKg: 12, harvestMethod: 'Centrifugal extraction',
    qualityGrade: 'A', createdAt: '2025-08-12T11:00:00Z', updatedAt: '2025-10-22T16:00:00Z',
  },
  {
    id: 'pr-5', apiaryName: 'Limpopo Bee Project', country: 'South Africa', countryCode: 'ZA',
    year: 2026, quarter: 1, honeyKg: 980, waxKg: 65, propolisKg: 20,
    pollenKg: 15, royalJellyKg: 3, harvestMethod: 'Centrifugal extraction',
    qualityGrade: 'A', createdAt: '2026-02-05T10:00:00Z', updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'pr-6', apiaryName: 'Niger Delta Bees', country: 'Nigeria', countryCode: 'NG',
    year: 2025, quarter: 3, honeyKg: 450, waxKg: 35, propolisKg: 8,
    pollenKg: 5, royalJellyKg: 0, harvestMethod: 'Crush and strain',
    qualityGrade: 'C', createdAt: '2026-01-08T07:00:00Z', updatedAt: '2026-01-30T11:00:00Z',
  },
  {
    id: 'pr-7', apiaryName: 'Casamance Bee Project', country: 'Senegal', countryCode: 'SN',
    year: 2025, quarter: 2, honeyKg: 280, waxKg: 20, propolisKg: 5,
    pollenKg: 0, royalJellyKg: 0, harvestMethod: 'Traditional press',
    qualityGrade: 'ungraded', createdAt: '2025-10-20T09:00:00Z', updatedAt: '2025-12-15T14:00:00Z',
  },
];

export default function ProductionPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useApicultureProduction({
    page,
    limit,
    year: yearFilter ? Number(yearFilter) : undefined,
    qualityGrade: gradeFilter || undefined,
    search: search || undefined,
  });

  const production = data?.data ?? PLACEHOLDER_PRODUCTION;
  const meta = data?.meta ?? { total: PLACEHOLDER_PRODUCTION.length, page: 1, limit: 10 };
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/apiculture"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Production</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Honey, beeswax, propolis, pollen, and royal jelly output by apiary
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search production records..."
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
            <option value="">All Years</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
          <select
            value={gradeFilter}
            onChange={(e) => { setGradeFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Grades</option>
            <option value="A">Grade A</option>
            <option value="B">Grade B</option>
            <option value="C">Grade C</option>
            <option value="ungraded">Ungraded</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={7} cols={9} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load production data'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Apiary</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Country</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Period</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Honey (kg)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Wax (kg)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Propolis (kg)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Pollen (kg)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Method</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {production.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{p.apiaryName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{p.country}</p>
                      <p className="text-xs text-gray-400">{p.countryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">
                      {p.quarter ? `${p.year} Q${p.quarter}` : p.year}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-amber-700 dark:text-amber-400">
                      {p.honeyKg.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {p.waxKg.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {p.propolisKg.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {p.pollenKg.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{p.harvestMethod}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', GRADE_BADGE[p.qualityGrade])}>
                        {p.qualityGrade === 'ungraded' ? '—' : p.qualityGrade}
                      </span>
                    </td>
                  </tr>
                ))}
                {production.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                      No production records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {production.length} of {meta.total} records
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
