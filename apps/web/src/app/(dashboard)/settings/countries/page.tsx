'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSettingsCountries, useSettingsRecs } from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search, Pencil, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CountriesListPage() {
  const searchParams = useSearchParams();
  const initialRec = searchParams.get('recCode') ?? '';
  const [search, setSearch] = useState('');
  const [recFilter, setRecFilter] = useState(initialRec);
  const [statusFilter, setStatusFilter] = useState('');
  const [operationalFilter, setOperationalFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const { canCreateCountry, canManageCountries } = useSettingsAccess();

  const { data: recsData } = useSettingsRecs({ limit: 100 });
  const { data, isLoading } = useSettingsCountries({
    search,
    recCode: recFilter,
    status: statusFilter,
    operational: operationalFilter,
    page,
    limit,
  });

  const countries: any[] = data?.data ?? [];
  const recs: any[] = recsData?.data ?? [];
  const meta = data?.meta ?? { total: countries.length, page: 1, limit };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Countries
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {meta.total} African Union Member States
          </p>
        </div>
        {canCreateCountry && (
          <Link
            href="/settings/countries/new"
            className="flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-aris-primary-700"
          >
            <Plus className="h-4 w-4" />
            Add Country
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search countries..."
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={recFilter}
          onChange={(e) => { setRecFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All RECs</option>
          {recs.map((rec: any) => (
            <option key={rec.code} value={rec.code}>
              {rec.name?.en ?? rec.code}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={operationalFilter}
          onChange={(e) => { setOperationalFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All</option>
          <option value="true">Operational</option>
          <option value="false">Pending</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Flag</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Code</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Capital</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Population</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">RECs</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Operational</th>
                {canManageCountries && (
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {countries.map((country: any) => {
                const pop = country.population ? Number(country.population) : 0;
                const popDisplay = pop >= 1_000_000
                  ? `${(pop / 1_000_000).toFixed(1)}M`
                  : pop >= 1_000
                    ? `${(pop / 1_000).toFixed(0)}K`
                    : String(pop);

                return (
                  <tr key={country.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-xl">{country.flag}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs dark:bg-gray-800">
                        {country.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {country.name?.en ?? country.code}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {country.capital?.en}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                      {popDisplay}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(country.recs ?? []).map((cr: any) => (
                          <span
                            key={cr.rec?.code ?? cr.recId}
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white"
                            style={{ backgroundColor: cr.rec?.accentColor ?? '#666' }}
                          >
                            {cr.rec?.code?.toUpperCase() ?? '?'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        country.isActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
                      )}>
                        {country.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        country.isOperational
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
                      )}>
                        {country.isOperational ? 'Yes' : 'Pending'}
                      </span>
                    </td>
                    {canManageCountries && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/settings/countries/${country.id}`}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <Link
                            href={`/country/${country.code}`}
                            target="_blank"
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
                            title="View on landing"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {countries.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No countries found
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
