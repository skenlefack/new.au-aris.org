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
import { useClimateHotspots, type ClimateHotspot } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { cn } from '@/lib/utils';

const PLACEHOLDER_DATA: ClimateHotspot[] = [
  { id: 'hs-1', name: 'Lake Chad Basin', country: 'Chad', countryCode: 'TD', lat: 13.0, lng: 14.0, riskLevel: 'critical', riskType: 'Water Scarcity', affectedPopulation: 2_500_000, livestockAtRisk: 1_800_000, lastAssessed: '2026-01-20', createdAt: '2026-01-20T10:00:00Z', updatedAt: '2026-02-15T08:00:00Z' },
  { id: 'hs-2', name: 'Horn of Africa Corridor', country: 'Somalia', countryCode: 'SO', lat: 2.0, lng: 45.3, riskLevel: 'critical', riskType: 'Drought', affectedPopulation: 4_200_000, livestockAtRisk: 3_100_000, lastAssessed: '2026-01-15', createdAt: '2026-01-15T09:00:00Z', updatedAt: '2026-02-10T11:00:00Z' },
  { id: 'hs-3', name: 'Sahel Belt', country: 'Niger', countryCode: 'NE', lat: 14.0, lng: 5.5, riskLevel: 'high', riskType: 'Desertification', affectedPopulation: 3_800_000, livestockAtRisk: 2_200_000, lastAssessed: '2025-12-10', createdAt: '2025-12-10T08:00:00Z', updatedAt: '2026-01-25T14:00:00Z' },
  { id: 'hs-4', name: 'Lower Zambezi', country: 'Mozambique', countryCode: 'MZ', lat: -17.0, lng: 35.5, riskLevel: 'high', riskType: 'Flooding', affectedPopulation: 1_200_000, livestockAtRisk: 450_000, lastAssessed: '2026-02-01', createdAt: '2026-02-01T07:00:00Z', updatedAt: '2026-02-20T10:00:00Z' },
  { id: 'hs-5', name: 'Turkana Basin', country: 'Kenya', countryCode: 'KE', lat: 3.1, lng: 35.6, riskLevel: 'moderate', riskType: 'Heat Stress', affectedPopulation: 890_000, livestockAtRisk: 620_000, lastAssessed: '2025-11-25', createdAt: '2025-11-25T11:00:00Z', updatedAt: '2025-12-30T09:00:00Z' },
];

const RISK_STYLES: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function HotspotsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [riskLevelFilter, setRiskLevelFilter] = useState('');
  const [riskTypeFilter, setRiskTypeFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useClimateHotspots({
    page,
    limit,
    riskLevel: riskLevelFilter || undefined,
    riskType: riskTypeFilter || undefined,
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
          <h1 className="text-2xl font-bold text-gray-900">Climate Hotspots</h1>
          <p className="mt-1 text-sm text-gray-500">
            Climate vulnerability zones and risk assessment
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search hotspots..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={riskLevelFilter}
            onChange={(e) => { setRiskLevelFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="">All Risk Levels</option>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select
            value={riskTypeFilter}
            onChange={(e) => { setRiskTypeFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="Drought">Drought</option>
            <option value="Flooding">Flooding</option>
            <option value="Desertification">Desertification</option>
            <option value="Water Scarcity">Water Scarcity</option>
            <option value="Heat Stress">Heat Stress</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load hotspot data'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name / Location</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Risk Level</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Affected Pop.</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Livestock at Risk</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Last Assessed</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Coordinates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-400">{r.country} ({r.countryCode})</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.riskType}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', RISK_STYLES[r.riskLevel] ?? 'bg-gray-100 text-gray-700')}>
                        {r.riskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {r.affectedPopulation.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.livestockAtRisk.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      {new Date(r.lastAssessed).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.lat.toFixed(1)}, {r.lng.toFixed(1)}
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      No climate hotspots found
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
