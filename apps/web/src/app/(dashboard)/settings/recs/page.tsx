'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSettingsRecs, useDeleteRec } from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search, Pencil, Users, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RecsListPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const { canCreateRec, canManageRecs, canDeleteRec } = useSettingsAccess();

  const { data, isLoading } = useSettingsRecs({ search, status: statusFilter, page, limit });
  const deleteMutation = useDeleteRec();

  const recs: any[] = data?.data ?? [];
  const meta = data?.meta ?? { total: recs.length, page: 1, limit };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Regional Economic Communities
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage the 8 RECs and their member state associations
          </p>
        </div>
        {canCreateRec && (
          <Link
            href="/settings/recs/new"
            className="flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-aris-primary-700"
          >
            <Plus className="h-4 w-4" />
            Add REC
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search RECs..."
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Color</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Code</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Full Name</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Members</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Region</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">HQ</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                {canManageRecs && (
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {recs.map((rec: any) => (
                <tr key={rec.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div
                      className="h-6 w-6 rounded-full border border-gray-200 dark:border-gray-600"
                      style={{ backgroundColor: rec.accentColor }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs dark:bg-gray-800">
                      {rec.code?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {rec.name?.en ?? rec.code}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {rec.fullName?.en}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-sm">
                      <Users className="h-3.5 w-3.5 text-gray-400" />
                      {rec._count?.countries ?? rec.countries?.length ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {rec.region?.en}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {rec.headquarters}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      rec.isActive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
                    )}>
                      {rec.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManageRecs && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/settings/recs/${rec.id}`}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/settings/countries?recCode=${rec.code}`}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
                          title="View countries"
                        >
                          <Users className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {recs.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No RECs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination
            page={meta.page}
            total={meta.total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(v) => { setLimit(v); setPage(1); }}
          />
        </div>
      )}
    </div>
  );
}
