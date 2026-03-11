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
import { useClimateData, type ClimateData } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

function tempColor(temp: number): string {
  if (temp >= 40) return 'text-red-600 dark:text-red-400';
  if (temp >= 35) return 'text-orange-600 dark:text-orange-400';
  if (temp >= 25) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-blue-600 dark:text-blue-400';
}

const PLACEHOLDER_CLIMATE: ClimateData[] = [
  {
    id: 'cd-1', country: 'Kenya', countryCode: 'KE', region: 'Rift Valley',
    date: '2026-02-15T00:00:00Z', temperature: 28.5, rainfall: 45.2,
    humidity: 62, windSpeed: 12.3, source: 'CHIRPS',
    createdAt: '2026-02-15T10:00:00Z', updatedAt: '2026-02-15T10:00:00Z',
  },
  {
    id: 'cd-2', country: 'Ethiopia', countryCode: 'ET', region: 'Oromia',
    date: '2026-02-14T00:00:00Z', temperature: 32.1, rainfall: 12.8,
    humidity: 45, windSpeed: 8.5, source: 'ERA5',
    createdAt: '2026-02-14T09:00:00Z', updatedAt: '2026-02-14T09:00:00Z',
  },
  {
    id: 'cd-3', country: 'Nigeria', countryCode: 'NG', region: 'Kano',
    date: '2026-02-13T00:00:00Z', temperature: 38.7, rainfall: 0,
    humidity: 22, windSpeed: 18.1, source: 'CHIRPS',
    createdAt: '2026-02-13T08:00:00Z', updatedAt: '2026-02-13T08:00:00Z',
  },
  {
    id: 'cd-4', country: 'Tanzania', countryCode: 'TZ', region: 'Arusha',
    date: '2026-02-12T00:00:00Z', temperature: 26.3, rainfall: 78.5,
    humidity: 75, windSpeed: 6.2, source: 'Station',
    createdAt: '2026-02-12T11:00:00Z', updatedAt: '2026-02-12T11:00:00Z',
  },
  {
    id: 'cd-5', country: 'South Africa', countryCode: 'ZA', region: 'Limpopo',
    date: '2026-02-11T00:00:00Z', temperature: 34.9, rainfall: 5.1,
    humidity: 38, windSpeed: 14.7, source: 'ERA5',
    createdAt: '2026-02-11T10:00:00Z', updatedAt: '2026-02-11T10:00:00Z',
  },
  {
    id: 'cd-6', country: 'Senegal', countryCode: 'SN', region: 'Saint-Louis',
    date: '2026-02-10T00:00:00Z', temperature: 36.2, rainfall: 0,
    humidity: 28, windSpeed: 22.5, source: 'CHIRPS',
    createdAt: '2026-02-10T07:00:00Z', updatedAt: '2026-02-10T07:00:00Z',
  },
  {
    id: 'cd-7', country: 'Morocco', countryCode: 'MA', region: 'Marrakech-Safi',
    date: '2026-02-09T00:00:00Z', temperature: 18.4, rainfall: 32.0,
    humidity: 68, windSpeed: 9.8, source: 'Station',
    createdAt: '2026-02-09T09:00:00Z', updatedAt: '2026-02-09T09:00:00Z',
  },
];

export default function ClimateDataPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useClimateData({
    page,
    limit,
    source: sourceFilter || undefined,
    search: search || undefined,
  });

  const records = data?.data ?? PLACEHOLDER_CLIMATE;
  const meta = data?.meta ?? { total: PLACEHOLDER_CLIMATE.length, page: 1, limit: 10 };
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Climate Data</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Temperature, rainfall, humidity, and wind speed observations
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search climate data..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Sources</option>
            <option value="CHIRPS">CHIRPS</option>
            <option value="ERA5">ERA5</option>
            <option value="Station">Station</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={7} cols={8} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load climate data'}
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
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Temp. (&deg;C)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Rainfall (mm)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Humidity (%)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Wind (km/h)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Source</th>
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
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(r.date).toLocaleDateString()}
                    </td>
                    <td className={cn('px-4 py-3 text-right font-medium', tempColor(r.temperature))}>
                      {r.temperature.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {r.rainfall > 0 ? r.rainfall.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{r.humidity}%</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{r.windSpeed.toFixed(1)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{r.source}</td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      No climate data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {records.length} of {meta.total} records
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
