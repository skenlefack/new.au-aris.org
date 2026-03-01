'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Plus,
  ChevronLeft,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Biohazard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRefDataList, useDeleteRefData, type RefDataType, type RefDataItem } from '@/lib/api/ref-data-hooks';
import { getTypeConfig, type RefDataTypeConfig } from '@/components/master-data/ref-data-config';
import { useAuthStore } from '@/lib/stores/auth-store';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';

const ADMIN_ROLES = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN'];
const DEFAULT_LIMIT = 10;

function ScopeBadge({ item }: { item: RefDataItem }) {
  const s = item.scope;
  if (s === 'continental') return <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">Continental</span>;
  if (s === 'regional') return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Regional</span>;
  return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">National</span>;
}

function StatusBadge({ active }: { active: boolean }) {
  if (active) return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle className="h-3 w-3" /> Active</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400"><XCircle className="h-3 w-3" /> Inactive</span>;
}

function getLocalizedName(item: RefDataItem, locale = 'en'): string {
  if (!item.name) return item.code;
  return (item.name as any)[locale] ?? (item.name as any)['en'] ?? item.code;
}

function getParentName(item: RefDataItem, config: RefDataTypeConfig, locale = 'en'): string {
  if (config.slug === 'species' && item.group) return getLocalizedName(item.group as any, locale);
  if (config.slug === 'age-groups' && item.species) return getLocalizedName(item.species as any, locale);
  if (config.slug === 'clinical-signs' && item.disease) return getLocalizedName(item.disease as any, locale);
  if (config.slug === 'control-measures' && item.disease) return getLocalizedName(item.disease as any, locale);
  return '';
}

function ExtraCell({ item, key: k }: { item: RefDataItem; key: string }) {
  const val = (item as any)[k];
  if (val === null || val === undefined) return <span className="text-gray-400">-</span>;
  if (k === 'isNotifiable') return val ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <span className="text-gray-400">No</span>;
  if (k === 'isZoonotic') return val ? <Biohazard className="h-4 w-4 text-amber-500" /> : <span className="text-gray-400">No</span>;
  return <span>{String(val)}</span>;
}

export default function RefDataListPage() {
  const params = useParams();
  const router = useRouter();
  const typeSlug = params.type as string;
  const config = getTypeConfig(typeSlug);

  const user = useAuthStore((s) => s.user);
  const isAdmin = user && ADMIN_ROLES.includes(user.role);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [scopeFilter, setScopeFilter] = useState('');

  const { data, isLoading, error } = useRefDataList(typeSlug as RefDataType, {
    page,
    limit,
    search: search || undefined,
    scope: scopeFilter || undefined,
  });

  const deleteMutation = useDeleteRefData(typeSlug as RefDataType);

  if (!config) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Unknown reference data type: {typeSlug}</p>
      </div>
    );
  }

  const items = data?.data ?? [];
  const meta = data?.meta;
  const Icon = config.icon;

  function handleDelete(id: string, name: string) {
    if (confirm(`Deactivate "${name}"? This will mark it as inactive.`)) {
      deleteMutation.mutate(id);
    }
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function handleLimitChange(newLimit: number) {
    setLimit(newLimit);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/master-data"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', config.bgColor)}>
            <Icon className={cn('h-5 w-5', config.color)} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{config.label}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{config.labelFr}</p>
          </div>
          {meta && (
            <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {meta.total} total
            </span>
          )}
        </div>
        {isAdmin && (
          <Link
            href={`/master-data/${typeSlug}/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-aris-primary-700"
          >
            <Plus className="h-4 w-4" />
            Add {config.label.replace(/s$/, '')}
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={`Search ${config.label.toLowerCase()}...`}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={scopeFilter}
          onChange={(e) => { setScopeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All Scopes</option>
          <option value="continental">Continental</option>
          <option value="regional">Regional</option>
          <option value="national">National</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Failed to load data. Make sure the master-data service is running on port 3003.
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={DEFAULT_LIMIT} cols={5} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name (EN)</th>
                  <th className="px-4 py-3">Name (FR)</th>
                  {config.parentType && <th className="px-4 py-3">{config.parentLabel}</th>}
                  {config.extraColumns?.map((col) => (
                    <th key={col.key} className="px-4 py-3">{col.label}</th>
                  ))}
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Status</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item) => {
                  const nameEn = getLocalizedName(item, 'en');
                  const nameFr = getLocalizedName(item, 'fr');
                  const isReadOnly = !isAdmin || (
                    item.scope === 'continental' && !['SUPER_ADMIN', 'CONTINENTAL_ADMIN'].includes(user?.role ?? '')
                  ) || (
                    item.scope === 'regional' && !['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN'].includes(user?.role ?? '')
                  );

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        'transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50',
                        isReadOnly && isAdmin && 'bg-gray-50/50 dark:bg-gray-800/20',
                      )}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700 dark:text-gray-300">{item.code}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{nameEn}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{nameFr}</td>
                      {config.parentType && (
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {getParentName(item, config)}
                        </td>
                      )}
                      {config.extraColumns?.map((col) => (
                        <td key={col.key} className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          <ExtraCell item={item} key={col.key} />
                        </td>
                      ))}
                      <td className="px-4 py-3"><ScopeBadge item={item} /></td>
                      <td className="px-4 py-3"><StatusBadge active={item.isActive} /></td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          {!isReadOnly && (
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                href={`/master-data/${typeSlug}/${item.id}`}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <button
                                onClick={() => handleDelete(item.id, nameEn)}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                title="Deactivate"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {items.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={20} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                      No {config.label.toLowerCase()} found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.total > 0 && (
            <Pagination
              page={page}
              total={meta.total}
              limit={limit}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          )}
        </div>
      )}
    </div>
  );
}
