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
import { useClimateData, type ClimateData } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const PLACEHOLDER_DATA: ClimateData[] = [
  { id: 'cd-1', country: 'Kenya', countryCode: 'KE', region: 'Nairobi', date: '2026-02-15', temperature: 24.5, rainfall: 45.2, humidity: 62, windSpeed: 12.3, source: 'KMD', createdAt: '2026-02-15T10:00:00Z', updatedAt: '2026-02-15T10:00:00Z' },
  { id: 'cd-2', country: 'Nigeria', countryCode: 'NG', region: 'Lagos', date: '2026-02-15', temperature: 31.2, rainfall: 12.8, humidity: 78, windSpeed: 8.5, source: 'NiMet', createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-02-15T09:00:00Z' },
  { id: 'cd-3', country: 'Ethiopia', countryCode: 'ET', region: 'Addis Ababa', date: '2026-02-15', temperature: 22.8, rainfall: 28.5, humidity: 55, windSpeed: 10.1, source: 'NMA Ethiopia', createdAt: '2026-02-15T08:00:00Z', updatedAt: '2026-02-15T08:00:00Z' },
  { id: 'cd-4', country: 'South Africa', countryCode: 'ZA', region: 'Gauteng', date: '2026-02-15', temperature: 27.3, rainfall: 52.1, humidity: 65, windSpeed: 14.7, source: 'SAWS', createdAt: '2026-02-15T07:00:00Z', updatedAt: '2026-02-15T07:00:00Z' },
  { id: 'cd-5', country: 'Morocco', countryCode: 'MA', region: 'Casablanca', date: '2026-02-15', temperature: 18.6, rainfall: 35.4, humidity: 71, windSpeed: 18.2, source: 'DMN Morocco', createdAt: '2026-02-15T06:00:00Z', updatedAt: '2026-02-15T06:00:00Z' },
  { id: 'cd-6', country: 'Tanzania', countryCode: 'TZ', region: 'Dar es Salaam', date: '2026-02-14', temperature: 29.8, rainfall: 8.2, humidity: 82, windSpeed: 6.3, source: 'TMA', createdAt: '2026-02-14T10:00:00Z', updatedAt: '2026-02-14T10:00:00Z' },
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
          <h1 className="text-2xl font-bold text-gray-900">Climate Data</h1>
          <p className="mt-1 text-sm text-gray-500">
            Temperature, rainfall, humidity, and wind observations
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
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="">All Sources</option>
            <option value="KMD">KMD (Kenya)</option>
            <option value="NiMet">NiMet (Nigeria)</option>
            <option value="NMA Ethiopia">NMA (Ethiopia)</option>
            <option value="SAWS">SAWS (South Africa)</option>
            <option value="DMN Morocco">DMN (Morocco)</option>
            <option value="TMA">TMA (Tanzania)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load climate data'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Temp (&deg;C)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Rainfall (mm)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Humidity (%)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Wind (km/h)</th>
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
                    <td className="px-4 py-3 text-gray-700">
                      {new Date(r.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {r.temperature.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.rainfall.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.humidity}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.windSpeed.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.source}</td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      No climate data records found
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
