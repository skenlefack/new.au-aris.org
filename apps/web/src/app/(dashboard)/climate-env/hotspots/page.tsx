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
import { useClimateHotspots, type ClimateHotspot } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const RISK_BADGE: Record<string, string> = {
  low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  moderate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PLACEHOLDER_HOTSPOTS: ClimateHotspot[] = [
  {
    id: 'hs-1', name: 'Horn of Africa Drought Corridor', country: 'Kenya', countryCode: 'KE',
    lat: 0.5, lng: 38.0, riskLevel: 'critical', riskType: 'Drought',
    affectedPopulation: 4_500_000, livestockAtRisk: 12_000_000,
    lastAssessed: '2026-02-01T00:00:00Z',
    createdAt: '2025-06-15T10:00:00Z', updatedAt: '2026-02-10T08:00:00Z',
  },
  {
    id: 'hs-2', name: 'Lake Chad Basin Desertification', country: 'Nigeria', countryCode: 'NG',
    lat: 13.0, lng: 14.0, riskLevel: 'critical', riskType: 'Desertification',
    affectedPopulation: 8_200_000, livestockAtRisk: 6_500_000,
    lastAssessed: '2026-01-15T00:00:00Z',
    createdAt: '2025-03-20T09:00:00Z', updatedAt: '2026-01-20T12:00:00Z',
  },
  {
    id: 'hs-3', name: 'Sahel Flood Plain', country: 'Senegal', countryCode: 'SN',
    lat: 14.5, lng: -14.0, riskLevel: 'high', riskType: 'Flood',
    affectedPopulation: 1_200_000, livestockAtRisk: 3_200_000,
    lastAssessed: '2025-12-01T00:00:00Z',
    createdAt: '2025-09-10T08:00:00Z', updatedAt: '2026-01-05T14:00:00Z',
  },
  {
    id: 'hs-4', name: 'Rift Valley Fever Zone', country: 'Tanzania', countryCode: 'TZ',
    lat: -4.0, lng: 35.0, riskLevel: 'high', riskType: 'Disease-Climate Nexus',
    affectedPopulation: 2_800_000, livestockAtRisk: 5_100_000,
    lastAssessed: '2026-01-20T00:00:00Z',
    createdAt: '2025-07-12T11:00:00Z', updatedAt: '2026-02-01T16:00:00Z',
  },
  {
    id: 'hs-5', name: 'Western Cape Water Crisis', country: 'South Africa', countryCode: 'ZA',
    lat: -33.9, lng: 18.4, riskLevel: 'moderate', riskType: 'Water Scarcity',
    affectedPopulation: 3_700_000, livestockAtRisk: 850_000,
    lastAssessed: '2025-11-15T00:00:00Z',
    createdAt: '2025-04-05T10:00:00Z', updatedAt: '2025-12-18T09:00:00Z',
  },
  {
    id: 'hs-6', name: 'Afar Depression Heat Zone', country: 'Ethiopia', countryCode: 'ET',
    lat: 11.5, lng: 41.0, riskLevel: 'critical', riskType: 'Extreme Heat',
    affectedPopulation: 1_800_000, livestockAtRisk: 4_200_000,
    lastAssessed: '2026-02-10T00:00:00Z',
    createdAt: '2025-08-08T07:00:00Z', updatedAt: '2026-02-15T11:00:00Z',
  },
  {
    id: 'hs-7', name: 'Limpopo Valley Cyclone Path', country: 'Mozambique', countryCode: 'MZ',
    lat: -23.0, lng: 32.0, riskLevel: 'moderate', riskType: 'Cyclone',
    affectedPopulation: 950_000, livestockAtRisk: 1_200_000,
    lastAssessed: '2025-10-01T00:00:00Z',
    createdAt: '2025-05-20T09:00:00Z', updatedAt: '2025-11-15T14:00:00Z',
  },
];

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

  const hotspots = data?.data ?? PLACEHOLDER_HOTSPOTS;
  const meta = data?.meta ?? { total: PLACEHOLDER_HOTSPOTS.length, page: 1, limit: 10 };
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Climate Hotspots</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Climate vulnerability hotspots, affected populations, and livestock at risk
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search hotspots..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={riskLevelFilter}
            onChange={(e) => { setRiskLevelFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
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
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Risk Types</option>
            <option value="Drought">Drought</option>
            <option value="Flood">Flood</option>
            <option value="Desertification">Desertification</option>
            <option value="Extreme Heat">Extreme Heat</option>
            <option value="Water Scarcity">Water Scarcity</option>
            <option value="Cyclone">Cyclone</option>
            <option value="Disease-Climate Nexus">Disease-Climate Nexus</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={7} cols={7} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load hotspots'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Hotspot</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Country</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Risk Type</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Affected Pop.</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Livestock at Risk</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Last Assessed</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {hotspots.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{h.name}</p>
                      <p className="text-xs text-gray-400">{h.lat.toFixed(1)}, {h.lng.toFixed(1)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{h.country}</p>
                      <p className="text-xs text-gray-400">{h.countryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{h.riskType}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                      {h.affectedPopulation.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={h.livestockAtRisk > 5_000_000 ? 'font-medium text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}>
                        {h.livestockAtRisk.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(h.lastAssessed).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', RISK_BADGE[h.riskLevel])}>
                        {h.riskLevel}
                      </span>
                    </td>
                  </tr>
                ))}
                {hotspots.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      No climate hotspots found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {hotspots.length} of {meta.total} hotspots
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
