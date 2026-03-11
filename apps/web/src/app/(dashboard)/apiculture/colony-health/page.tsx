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
import { useColonyHealth, type ColonyHealth } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const STRENGTH_BADGE: Record<string, string> = {
  strong: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  moderate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  weak: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const QUEEN_BADGE: Record<string, string> = {
  present: 'text-green-600 dark:text-green-400',
  absent: 'text-red-600 dark:text-red-400',
  unknown: 'text-gray-400 dark:text-gray-500',
};

const PLACEHOLDER_HEALTH: ColonyHealth[] = [
  {
    id: 'ch-1', apiaryName: 'Addis Bee Farm', country: 'Ethiopia', countryCode: 'ET',
    inspectionDate: '2026-02-15T10:00:00Z', coloniesInspected: 120, healthyColonies: 98,
    infectedColonies: 22, pest: 'Varroa destructor', pestPrevalence: 18.3,
    queenStatus: 'present', colonyStrength: 'moderate', mortality: 5.2,
    treatment: 'Oxalic acid strips',
    createdAt: '2026-02-15T10:00:00Z', updatedAt: '2026-02-18T08:00:00Z',
  },
  {
    id: 'ch-2', apiaryName: 'Mount Kenya Apiaries', country: 'Kenya', countryCode: 'KE',
    inspectionDate: '2026-02-10T09:00:00Z', coloniesInspected: 85, healthyColonies: 79,
    infectedColonies: 6, pest: 'Small hive beetle', pestPrevalence: 7.1,
    queenStatus: 'present', colonyStrength: 'strong', mortality: 2.4,
    treatment: 'Beetle traps',
    createdAt: '2026-02-10T09:00:00Z', updatedAt: '2026-02-12T12:00:00Z',
  },
  {
    id: 'ch-3', apiaryName: 'Kilimanjaro Honey Co-op', country: 'Tanzania', countryCode: 'TZ',
    inspectionDate: '2026-01-28T08:00:00Z', coloniesInspected: 200, healthyColonies: 145,
    infectedColonies: 55, pest: 'Varroa destructor', pestPrevalence: 27.5,
    queenStatus: 'absent', colonyStrength: 'weak', mortality: 12.8,
    treatment: 'Formic acid pads',
    createdAt: '2026-01-28T08:00:00Z', updatedAt: '2026-02-05T14:00:00Z',
  },
  {
    id: 'ch-4', apiaryName: 'Limpopo Bee Project', country: 'South Africa', countryCode: 'ZA',
    inspectionDate: '2026-02-05T11:00:00Z', coloniesInspected: 60, healthyColonies: 54,
    infectedColonies: 6, pest: 'American foulbrood', pestPrevalence: 10.0,
    queenStatus: 'present', colonyStrength: 'moderate', mortality: 3.3,
    treatment: 'Colony destruction + requeening',
    createdAt: '2026-02-05T11:00:00Z', updatedAt: '2026-02-08T16:00:00Z',
  },
  {
    id: 'ch-5', apiaryName: 'Atlas Mountain Apiary', country: 'Morocco', countryCode: 'MA',
    inspectionDate: '2026-02-01T10:00:00Z', coloniesInspected: 150, healthyColonies: 140,
    infectedColonies: 10, pest: 'Nosema ceranae', pestPrevalence: 6.7,
    queenStatus: 'present', colonyStrength: 'strong', mortality: 1.3,
    treatment: 'Fumagillin',
    createdAt: '2026-02-01T10:00:00Z', updatedAt: '2026-02-04T09:00:00Z',
  },
  {
    id: 'ch-6', apiaryName: 'Niger Delta Bees', country: 'Nigeria', countryCode: 'NG',
    inspectionDate: '2026-01-20T09:00:00Z', coloniesInspected: 45, healthyColonies: 28,
    infectedColonies: 17, pest: 'Wax moth', pestPrevalence: 37.8,
    queenStatus: 'unknown', colonyStrength: 'weak', mortality: 22.2,
    treatment: 'Comb management + BT application',
    createdAt: '2026-01-20T09:00:00Z', updatedAt: '2026-01-25T14:00:00Z',
  },
];

export default function ColonyHealthPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [pestFilter, setPestFilter] = useState('');
  const [strengthFilter, setStrengthFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useColonyHealth({
    page,
    limit,
    pest: pestFilter || undefined,
    colonyStrength: strengthFilter || undefined,
    search: search || undefined,
  });

  const records = data?.data ?? PLACEHOLDER_HEALTH;
  const meta = data?.meta ?? { total: PLACEHOLDER_HEALTH.length, page: 1, limit: 10 };
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Colony Health</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Inspection records, pest prevalence, colony strength, and mortality rates
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search inspections..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={pestFilter}
            onChange={(e) => { setPestFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Pests</option>
            <option value="Varroa destructor">Varroa destructor</option>
            <option value="Small hive beetle">Small hive beetle</option>
            <option value="Wax moth">Wax moth</option>
            <option value="American foulbrood">American foulbrood</option>
            <option value="Nosema ceranae">Nosema ceranae</option>
          </select>
          <select
            value={strengthFilter}
            onChange={(e) => { setStrengthFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Strength</option>
            <option value="strong">Strong</option>
            <option value="moderate">Moderate</option>
            <option value="weak">Weak</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={9} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load colony health data'}
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
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Inspected</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Infected</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Pest</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Queen</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Strength</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Mortality %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{r.apiaryName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{r.country}</p>
                      <p className="text-xs text-gray-400">{r.countryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(r.inspectionDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{r.coloniesInspected}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={r.infectedColonies > 0 ? 'font-medium text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}>
                        {r.infectedColonies}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="italic text-gray-700 dark:text-gray-300">{r.pest}</p>
                      <p className="text-xs text-gray-400">{r.pestPrevalence}% prevalence</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('text-xs font-medium capitalize', QUEEN_BADGE[r.queenStatus])}>
                        {r.queenStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', STRENGTH_BADGE[r.colonyStrength])}>
                        {r.colonyStrength}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-medium', r.mortality > 10 ? 'text-red-600 dark:text-red-400' : r.mortality > 5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400')}>
                        {r.mortality}%
                      </span>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                      No colony health records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {records.length} of {meta.total} inspections
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
