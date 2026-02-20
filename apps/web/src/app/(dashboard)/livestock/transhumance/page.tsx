'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowLeft,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TranshumanceCorridorMarker } from '@/components/maps/TranshumanceMap';
import {
  useLivestockTranshumance,
  type TranshumanceCorridor,
} from '@/lib/api/hooks';
import { TableSkeleton, MapSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const TranshumanceMap = dynamic(
  () =>
    import('@/components/maps/TranshumanceMap').then(
      (mod) => mod.TranshumanceMap,
    ),
  { ssr: false, loading: () => <MapSkeleton /> },
);

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  disrupted: 'bg-red-100 text-red-700',
};

const PLACEHOLDER_CORRIDORS: TranshumanceCorridor[] = [
  {
    id: 'tc-1', name: 'Sahel Central Corridor',
    originCountry: 'Mali', destinationCountry: 'Burkina Faso',
    species: 'Cattle', estimatedAnimals: 85_000,
    seasonStart: '2025-10-01', seasonEnd: '2026-04-30',
    status: 'active', crossBorder: true,
    route: [
      [14.6, -1.0], [13.9, -1.5], [13.2, -1.8], [12.5, -1.5], [12.0, -1.2],
    ],
    createdAt: '2025-09-01T10:00:00Z', updatedAt: '2026-02-15T14:00:00Z',
  },
  {
    id: 'tc-2', name: 'IGAD Eastern Route',
    originCountry: 'Ethiopia', destinationCountry: 'Kenya',
    species: 'Cattle', estimatedAnimals: 120_000,
    seasonStart: '2025-11-01', seasonEnd: '2026-05-31',
    status: 'active', crossBorder: true,
    route: [
      [8.0, 38.7], [6.5, 38.0], [4.5, 37.5], [2.5, 37.0], [0.5, 36.8],
    ],
    createdAt: '2025-10-15T08:00:00Z', updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'tc-3', name: 'Lake Chad Basin Route',
    originCountry: 'Niger', destinationCountry: 'Nigeria',
    species: 'Cattle', estimatedAnimals: 65_000,
    seasonStart: '2025-10-15', seasonEnd: '2026-03-31',
    status: 'disrupted', crossBorder: true,
    route: [
      [14.0, 8.0], [13.5, 9.5], [13.0, 10.5], [12.5, 11.0], [12.0, 12.0],
    ],
    createdAt: '2025-09-20T10:00:00Z', updatedAt: '2026-02-19T08:00:00Z',
  },
  {
    id: 'tc-4', name: 'Senegal River Valley',
    originCountry: 'Senegal', destinationCountry: 'Mauritania',
    species: 'Sheep', estimatedAnimals: 45_000,
    seasonStart: '2025-12-01', seasonEnd: '2026-06-30',
    status: 'active', crossBorder: true,
    route: [
      [14.7, -17.4], [15.5, -15.5], [16.0, -14.5], [16.5, -13.5], [17.0, -12.5],
    ],
    createdAt: '2025-11-10T10:00:00Z', updatedAt: '2026-02-14T12:00:00Z',
  },
  {
    id: 'tc-5', name: 'Tanzania Northern Highlands',
    originCountry: 'Tanzania', destinationCountry: 'Tanzania',
    species: 'Cattle', estimatedAnimals: 30_000,
    seasonStart: '2025-06-01', seasonEnd: '2025-11-30',
    status: 'inactive', crossBorder: false,
    route: [
      [-2.5, 34.8], [-3.0, 35.2], [-3.5, 35.8], [-4.0, 36.2],
    ],
    createdAt: '2025-05-01T10:00:00Z', updatedAt: '2025-12-01T10:00:00Z',
  },
  {
    id: 'tc-6', name: 'Chad-Cameroon Transversal',
    originCountry: 'Chad', destinationCountry: 'Cameroon',
    species: 'Cattle', estimatedAnimals: 55_000,
    seasonStart: '2025-10-01', seasonEnd: '2026-04-15',
    status: 'active', crossBorder: true,
    route: [
      [12.1, 15.0], [11.0, 14.5], [10.0, 13.5], [9.0, 12.5], [8.0, 11.5],
    ],
    createdAt: '2025-09-15T10:00:00Z', updatedAt: '2026-02-16T14:00:00Z',
  },
];

export default function TranshumancePage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [crossBorderFilter, setCrossBorderFilter] = useState<string>('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } =
    useLivestockTranshumance({
      page,
      limit,
      status: statusFilter || undefined,
      crossBorder:
        crossBorderFilter === '' ? undefined : crossBorderFilter === 'true',
    });

  const corridors = data?.data ?? PLACEHOLDER_CORRIDORS;
  const meta = data?.meta ?? {
    total: PLACEHOLDER_CORRIDORS.length,
    page: 1,
    limit: 10,
  };
  const totalPages = Math.ceil(meta.total / meta.limit);

  const mapCorridors: TranshumanceCorridorMarker[] = corridors.map((c) => ({
    id: c.id,
    name: c.name,
    route: c.route,
    status: c.status,
    species: c.species,
    estimatedAnimals: c.estimatedAnimals,
  }));

  const activeCount = corridors.filter((c) => c.status === 'active').length;
  const disruptedCount = corridors.filter(
    (c) => c.status === 'disrupted',
  ).length;
  const totalAnimals = corridors.reduce(
    (sum, c) => sum + c.estimatedAnimals,
    0,
  );
  const crossBorderCount = corridors.filter((c) => c.crossBorder).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/livestock"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Transhumance Corridors
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Seasonal livestock movement routes across Africa
          </p>
        </div>
      </div>

      {/* Map */}
      {isError ? (
        <QueryError
          message={
            error instanceof Error
              ? error.message
              : 'Failed to load corridor data'
          }
          onRetry={() => refetch()}
        />
      ) : (
        <>
          <TranshumanceMap corridors={mapCorridors} height="500px" />

          {/* Legend */}
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <span className="font-medium text-gray-700">
              {corridors.length} corridors
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2E7D32]" />
              Active
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#9E9E9E]" />
              Inactive
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#C62828]" />
              Disrupted
            </span>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-card border border-green-200 bg-green-50 p-4">
              <p className="text-xs text-green-600">Active</p>
              <p className="text-xl font-bold text-green-700">{activeCount}</p>
            </div>
            <div className="rounded-card border border-red-200 bg-red-50 p-4">
              <p className="text-xs text-red-600">Disrupted</p>
              <p className="text-xl font-bold text-red-700">
                {disruptedCount}
              </p>
            </div>
            <div className="rounded-card border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-400">Est. Animals</p>
              <p className="text-xl font-bold text-gray-900">
                {totalAnimals.toLocaleString()}
              </p>
            </div>
            <div className="rounded-card border border-orange-200 bg-orange-50 p-4">
              <p className="text-xs text-orange-600">Cross-Border</p>
              <p className="text-xl font-bold text-orange-700">
                {crossBorderCount}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="disrupted">Disrupted</option>
          </select>
          <select
            value={crossBorderFilter}
            onChange={(e) => {
              setCrossBorderFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All Routes</option>
            <option value="true">Cross-Border Only</option>
            <option value="false">Domestic Only</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Corridor
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Route
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Species
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">
                    Est. Animals
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Season
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Cross-Border
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {corridors.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.name}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.originCountry} &rarr; {c.destinationCountry}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.species}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {c.estimatedAnimals.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(c.seasonStart).toLocaleDateString()} &mdash;{' '}
                      {new Date(c.seasonEnd).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          STATUS_BADGE[c.status],
                        )}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.crossBorder ? (
                        <span className="inline-block rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No</span>
                      )}
                    </td>
                  </tr>
                ))}
                {corridors.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-gray-400"
                    >
                      No transhumance corridors found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              Showing {corridors.length} of {meta.total} corridors
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
