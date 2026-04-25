'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';
import {
  useIndicators,
  useIndicatorTypes,
  useUpdateIndicator,
} from '@/lib/api/indicator-hooks';
import type { Indicator, IndicatorMeasurementMode } from '@/lib/api/indicator-hooks';
import { Pagination } from '@/components/ui/Pagination';
import { ForbiddenPage } from '@/components/ui/ForbiddenPage';
import {
  Loader2,
  Plus,
  Pencil,
  Search,
  Activity,
  Eye,
} from 'lucide-react';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN']);

const MODE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  MANUAL_ENTRY:          { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Manual' },
  AUTO_FROM_FORM:        { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Auto (form)' },
  AUTO_FROM_KPI_SOURCE:  { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'Auto (KPI)' },
  COMPOSITE_FORMULA:     { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Formula' },
};

export default function IndicatorsPage() {
  const user = useAuthStore((s) => s.user);
  if (!user || !ADMIN_ROLES.has(user.role)) return <ForbiddenPage />;
  return <IndicatorsList />;
}

function IndicatorsList() {
  const addToast = useRealtimeStore((s) => s.addToast);

  // Filters
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const { data: typesData } = useIndicatorTypes();
  const types = typesData?.data ?? [];

  const { data, isLoading } = useIndicators({
    page,
    limit,
    typeCode: typeFilter || undefined,
    measurementMode: (modeFilter as IndicatorMeasurementMode) || undefined,
    active: activeFilter !== '' ? activeFilter === 'true' : undefined,
    search: search.trim() || undefined,
  });

  const updateMutation = useUpdateIndicator();
  const indicators = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit };

  const handleToggleActive = async (ind: Indicator) => {
    try {
      await updateMutation.mutateAsync({ id: ind.id, active: !ind.active });
      addToast({
        type: 'success',
        title: ind.active ? 'Indicator deactivated' : 'Indicator activated',
        message: `${ind.code} ${ind.active ? 'deactivated' : 'activated'} successfully.`,
      });
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to toggle status.' });
    }
  };

  const updateFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1F4E79] to-[#1F4E79]/80 text-white shadow-sm">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Indicators</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {meta.total} indicator{meta.total !== 1 ? 's' : ''} configured
            </p>
          </div>
        </div>
        <Link
          href="/settings/indicators/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1F4E79]/90"
        >
          <Plus className="h-4 w-4" />
          New indicator
        </Link>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => updateFilter(setSearch)(e.target.value)}
            placeholder="Search (code, name)..."
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <select value={typeFilter} onChange={(e) => updateFilter(setTypeFilter)(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white">
          <option value="">All types</option>
          {types.map((t) => <option key={t.code} value={t.code}>{t.labelEn} ({t.code})</option>)}
        </select>

        <select value={modeFilter} onChange={(e) => updateFilter(setModeFilter)(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white">
          <option value="">All modes</option>
          <option value="MANUAL_ENTRY">Manual</option>
          <option value="AUTO_FROM_FORM">Auto (form)</option>
          <option value="AUTO_FROM_KPI_SOURCE">Auto (KPI)</option>
          <option value="COMPOSITE_FORMULA">Formula</option>
        </select>

        <select value={activeFilter} onChange={(e) => updateFilter(setActiveFilter)(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white">
          <option value="">Active & inactive</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Code</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Name (FR)</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Type</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Mode</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Unit</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Active</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {indicators.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                        No indicators found.
                      </td>
                    </tr>
                  ) : (
                    indicators.map((ind) => {
                      const typeObj = types.find((t) => t.code === ind.typeCode);
                      const modeBadge = MODE_BADGES[ind.measurementMode ?? ''] ?? MODE_BADGES.MANUAL_ENTRY;
                      return (
                        <tr key={ind.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60">
                          <td className="px-4 py-3">
                            <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              {ind.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{ind.nameFr}</td>
                          <td className="px-4 py-3">
                            {typeObj ? (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                                style={{ backgroundColor: typeObj.color ?? '#6B7280' }}
                              >
                                {typeObj.labelEn}
                              </span>
                            ) : (
                              <span className="text-gray-400">{ind.typeCode}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${modeBadge.bg} ${modeBadge.text}`}>
                              {modeBadge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{ind.unit ?? 'count'}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(ind)}
                              disabled={updateMutation.isPending}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                ind.active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                              }`}
                              title={ind.active ? 'Deactivate' : 'Activate'}
                            >
                              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${ind.active ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Link href={`/settings/indicators/${ind.id}`}
                                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                                title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <Link href={`/settings/indicators/${ind.id}?tab=values`}
                                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-[#1F4E79]/10 hover:text-[#1F4E79] dark:hover:bg-[#1F4E79]/20 dark:hover:text-[#1F4E79]"
                                title="View values">
                                <Eye className="h-4 w-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {meta.total > 0 && (
              <Pagination
                page={page}
                total={meta.total}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
                pageSizeOptions={[10, 20, 50, 100]}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
