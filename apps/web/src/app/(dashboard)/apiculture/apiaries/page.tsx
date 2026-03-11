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
import { useApiaries, type Apiary } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  abandoned: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PLACEHOLDER_APIARIES: Apiary[] = [
  {
    id: 'ap-1', name: 'Addis Bee Farm', owner: 'Ato Bekele Tadesse',
    country: 'Ethiopia', countryCode: 'ET', region: 'Oromia',
    lat: 8.980, lng: 38.757, totalColonies: 120, hiveType: 'Top-bar',
    status: 'active', registeredAt: '2024-03-15T10:00:00Z',
    createdAt: '2024-03-15T10:00:00Z', updatedAt: '2026-02-10T08:00:00Z',
  },
  {
    id: 'ap-2', name: 'Mount Kenya Apiaries', owner: 'Jane Wanjiku',
    country: 'Kenya', countryCode: 'KE', region: 'Central',
    lat: -0.152, lng: 37.308, totalColonies: 85, hiveType: 'Langstroth',
    status: 'active', registeredAt: '2023-06-20T09:00:00Z',
    createdAt: '2023-06-20T09:00:00Z', updatedAt: '2026-01-05T12:00:00Z',
  },
  {
    id: 'ap-3', name: 'Kilimanjaro Honey Co-op', owner: 'Joseph Moshi',
    country: 'Tanzania', countryCode: 'TZ', region: 'Kilimanjaro',
    lat: -3.067, lng: 37.356, totalColonies: 200, hiveType: 'Traditional',
    status: 'active', registeredAt: '2022-11-10T08:00:00Z',
    createdAt: '2022-11-10T08:00:00Z', updatedAt: '2026-02-01T14:00:00Z',
  },
  {
    id: 'ap-4', name: 'Limpopo Bee Project', owner: 'Sarah van der Merwe',
    country: 'South Africa', countryCode: 'ZA', region: 'Limpopo',
    lat: -23.400, lng: 29.417, totalColonies: 60, hiveType: 'Langstroth',
    status: 'active', registeredAt: '2024-01-05T11:00:00Z',
    createdAt: '2024-01-05T11:00:00Z', updatedAt: '2025-10-22T16:00:00Z',
  },
  {
    id: 'ap-5', name: 'Niger Delta Bees', owner: 'Emeka Okafor',
    country: 'Nigeria', countryCode: 'NG', region: 'Rivers',
    lat: 4.815, lng: 7.050, totalColonies: 45, hiveType: 'Top-bar',
    status: 'inactive', registeredAt: '2023-09-12T10:00:00Z',
    createdAt: '2023-09-12T10:00:00Z', updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'ap-6', name: 'Atlas Mountain Apiary', owner: 'Hassan El-Fassi',
    country: 'Morocco', countryCode: 'MA', region: 'Fès-Meknès',
    lat: 33.893, lng: -4.728, totalColonies: 150, hiveType: 'Langstroth',
    status: 'active', registeredAt: '2023-04-18T07:00:00Z',
    createdAt: '2023-04-18T07:00:00Z', updatedAt: '2026-01-30T11:00:00Z',
  },
  {
    id: 'ap-7', name: 'Casamance Bee Project', owner: 'Ousmane Diallo',
    country: 'Senegal', countryCode: 'SN', region: 'Ziguinchor',
    lat: 12.583, lng: -16.272, totalColonies: 35, hiveType: 'Traditional',
    status: 'abandoned', registeredAt: '2022-07-01T09:00:00Z',
    createdAt: '2022-07-01T09:00:00Z', updatedAt: '2025-12-15T14:00:00Z',
  },
];

export default function ApiariesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [hiveTypeFilter, setHiveTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useApiaries({
    page,
    limit,
    hiveType: hiveTypeFilter || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const apiaries = data?.data ?? PLACEHOLDER_APIARIES;
  const meta = data?.meta ?? { total: PLACEHOLDER_APIARIES.length, page: 1, limit: 10 };
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Apiaries</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Registered apiary locations, hive types, and colony counts
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search apiaries..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={hiveTypeFilter}
            onChange={(e) => { setHiveTypeFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Hive Types</option>
            <option value="Langstroth">Langstroth</option>
            <option value="Top-bar">Top-bar</option>
            <option value="Traditional">Traditional</option>
            <option value="Flow">Flow</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={7} cols={7} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load apiaries'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Owner</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Country</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Hive Type</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Colonies</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Registered</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {apiaries.map((apiary) => (
                  <tr key={apiary.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{apiary.name}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{apiary.owner}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{apiary.country}</p>
                      <p className="text-xs text-gray-400">{apiary.region}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{apiary.hiveType}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                      {apiary.totalColonies}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(apiary.registeredAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATUS_BADGE[apiary.status])}>
                        {apiary.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {apiaries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      No apiaries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {apiaries.length} of {meta.total} apiaries
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
