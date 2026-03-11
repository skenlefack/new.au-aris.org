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
import { useProtectedAreas, type ProtectedArea } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  proposed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  degraded: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PLACEHOLDER_AREAS: ProtectedArea[] = [
  {
    id: 'pa-1', name: 'Serengeti National Park', country: 'Tanzania', countryCode: 'TZ',
    designation: 'National Park', areaKm2: 14_763, speciesCount: 1_500, established: 1951,
    managementAuthority: 'TANAPA', status: 'active', lat: -2.333, lng: 34.833,
    createdAt: '2025-01-15T10:00:00Z', updatedAt: '2026-02-10T08:00:00Z',
  },
  {
    id: 'pa-2', name: 'Kruger National Park', country: 'South Africa', countryCode: 'ZA',
    designation: 'National Park', areaKm2: 19_485, speciesCount: 1_982, established: 1926,
    managementAuthority: 'SANParks', status: 'active', lat: -23.988, lng: 31.554,
    createdAt: '2025-02-20T09:00:00Z', updatedAt: '2026-01-05T12:00:00Z',
  },
  {
    id: 'pa-3', name: 'Virunga National Park', country: 'DR Congo', countryCode: 'CD',
    designation: 'National Park', areaKm2: 7_800, speciesCount: 3_000, established: 1925,
    managementAuthority: 'ICCN', status: 'degraded', lat: -1.383, lng: 29.200,
    createdAt: '2025-03-10T08:00:00Z', updatedAt: '2026-02-01T14:00:00Z',
  },
  {
    id: 'pa-4', name: 'Masai Mara National Reserve', country: 'Kenya', countryCode: 'KE',
    designation: 'Game Reserve', areaKm2: 1_510, speciesCount: 850, established: 1961,
    managementAuthority: 'Narok County', status: 'active', lat: -1.500, lng: 35.100,
    createdAt: '2025-08-12T11:00:00Z', updatedAt: '2025-10-22T16:00:00Z',
  },
  {
    id: 'pa-5', name: 'Bazaruto Archipelago NP', country: 'Mozambique', countryCode: 'MZ',
    designation: 'Marine Reserve', areaKm2: 1_430, speciesCount: 2_000, established: 1971,
    managementAuthority: 'ANAC', status: 'active', lat: -21.650, lng: 35.500,
    createdAt: '2026-02-05T10:00:00Z', updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'pa-6', name: 'Ol Pejeta Conservancy', country: 'Kenya', countryCode: 'KE',
    designation: 'Community Conservancy', areaKm2: 364, speciesCount: 130, established: 2004,
    managementAuthority: 'Ol Pejeta', status: 'active', lat: 0.033, lng: 36.917,
    createdAt: '2026-01-08T07:00:00Z', updatedAt: '2026-01-30T11:00:00Z',
  },
  {
    id: 'pa-7', name: 'Pendjari Biosphere Reserve', country: 'Benin', countryCode: 'BJ',
    designation: 'Biosphere Reserve', areaKm2: 4_800, speciesCount: 460, established: 1986,
    managementAuthority: 'CENAGREF', status: 'active', lat: 11.050, lng: 1.550,
    createdAt: '2025-10-20T09:00:00Z', updatedAt: '2025-12-15T14:00:00Z',
  },
];

export default function ProtectedAreasPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useProtectedAreas({
    page,
    limit,
    designation: designationFilter || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const areas = data?.data ?? PLACEHOLDER_AREAS;
  const meta = data?.meta ?? { total: PLACEHOLDER_AREAS.length, page: 1, limit: 10 };
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/wildlife"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Protected Areas</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            National parks, game reserves, marine reserves, and WDPA-listed sites
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search protected areas..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={designationFilter}
            onChange={(e) => { setDesignationFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Designations</option>
            <option value="National Park">National Park</option>
            <option value="Game Reserve">Game Reserve</option>
            <option value="Marine Reserve">Marine Reserve</option>
            <option value="Community Conservancy">Community Conservancy</option>
            <option value="Biosphere Reserve">Biosphere Reserve</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="proposed">Proposed</option>
            <option value="degraded">Degraded</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={7} cols={7} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load protected areas'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Country</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Designation</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Area (km²)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Species</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Established</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {areas.map((area) => (
                  <tr key={area.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{area.name}</p>
                      <p className="text-xs text-gray-400">{area.managementAuthority}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{area.country}</p>
                      <p className="text-xs text-gray-400">{area.countryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{area.designation}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                      {area.areaKm2.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {area.speciesCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{area.established}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATUS_BADGE[area.status])}>
                        {area.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {areas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      No protected areas found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {areas.length} of {meta.total} areas
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
