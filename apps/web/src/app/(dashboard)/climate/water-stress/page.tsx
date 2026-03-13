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
import { useWaterStress, type WaterStress } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { cn } from '@/lib/utils';

const PLACEHOLDER_DATA: WaterStress[] = [
  { id: 'ws-1', country: 'Libya', countryCode: 'LY', region: 'Tripolitania', period: '2025-H2', index: 4.2, waterAvailability: 'Very Low', irrigatedAreaPct: 22.5, source: 'FAO AQUASTAT', severity: 'critical', createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-02-10T08:00:00Z' },
  { id: 'ws-2', country: 'Egypt', countryCode: 'EG', region: 'Upper Nile', period: '2025-H2', index: 3.8, waterAvailability: 'Low', irrigatedAreaPct: 85.2, source: 'FAO AQUASTAT', severity: 'high', createdAt: '2026-01-12T09:00:00Z', updatedAt: '2026-02-08T11:00:00Z' },
  { id: 'ws-3', country: 'Somalia', countryCode: 'SO', region: 'Jubba Valley', period: '2025-H2', index: 3.5, waterAvailability: 'Low', irrigatedAreaPct: 8.1, source: 'FEWS NET', severity: 'high', createdAt: '2025-12-20T08:00:00Z', updatedAt: '2026-01-15T14:00:00Z' },
  { id: 'ws-4', country: 'Niger', countryCode: 'NE', region: 'Sahel', period: '2025-H2', index: 2.9, waterAvailability: 'Moderate', irrigatedAreaPct: 4.3, source: 'FAO AQUASTAT', severity: 'moderate', createdAt: '2025-11-10T07:00:00Z', updatedAt: '2026-01-05T10:00:00Z' },
  { id: 'ws-5', country: 'Kenya', countryCode: 'KE', region: 'Northern Kenya', period: '2025-H2', index: 2.4, waterAvailability: 'Moderate', irrigatedAreaPct: 6.8, source: 'NDMA Kenya', severity: 'moderate', createdAt: '2025-10-25T11:00:00Z', updatedAt: '2025-12-20T09:00:00Z' },
];

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function WaterStressPage() {
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
          <h1 className="text-2xl font-bold text-gray-900">Water Stress</h1>
          <p className="mt-1 text-sm text-gray-500">
            Water availability and stress indices across Africa
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
            value={severityFilter}
            onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load water stress data'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Period</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Stress Index</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Availability</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Irrigated %</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Severity</th>
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
                    <td className="px-4 py-3 text-gray-700">{r.period}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{r.index.toFixed(1)}</td>
                    <td className="px-4 py-3 text-gray-700">{r.waterAvailability}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.irrigatedAreaPct.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', SEVERITY_STYLES[r.severity] ?? 'bg-gray-100 text-gray-700')}>
                        {r.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.source}</td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      No water stress records found
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
