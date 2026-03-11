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
import { useLegalFrameworks, type LegalFramework } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ADOPTED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  IN_FORCE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REPEALED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const TYPE_BADGE: Record<string, string> = {
  LAW: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  REGULATION: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  POLICY: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  STANDARD: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  GUIDELINE: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const PLACEHOLDER_FRAMEWORKS: LegalFramework[] = [
  {
    id: 'lf-1', title: 'Animal Health Act', type: 'LAW', domain: 'Animal Health',
    adoptionDate: '2023-06-15T00:00:00Z', status: 'IN_FORCE',
    country: 'Kenya', countryCode: 'KE', dataClassification: 'PUBLIC',
    createdAt: '2023-06-15T10:00:00Z', updatedAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'lf-2', title: 'Veterinary Medicines Regulation', type: 'REGULATION', domain: 'Animal Health',
    adoptionDate: '2024-01-10T00:00:00Z', status: 'IN_FORCE',
    country: 'Ethiopia', countryCode: 'ET', dataClassification: 'PUBLIC',
    createdAt: '2024-01-10T09:00:00Z', updatedAt: '2026-02-05T12:00:00Z',
  },
  {
    id: 'lf-3', title: 'National Livestock Policy', type: 'POLICY', domain: 'Livestock',
    adoptionDate: '2022-09-20T00:00:00Z', status: 'IN_FORCE',
    country: 'Tanzania', countryCode: 'TZ', dataClassification: 'PUBLIC',
    createdAt: '2022-09-20T08:00:00Z', updatedAt: '2025-11-15T14:00:00Z',
  },
  {
    id: 'lf-4', title: 'SPS Standards Framework', type: 'STANDARD', domain: 'Trade & SPS',
    adoptionDate: '2025-03-01T00:00:00Z', status: 'ADOPTED',
    country: 'Nigeria', countryCode: 'NG', dataClassification: 'PUBLIC',
    createdAt: '2025-03-01T10:00:00Z', updatedAt: '2026-01-20T09:00:00Z',
  },
  {
    id: 'lf-5', title: 'Wildlife Conservation Act', type: 'LAW', domain: 'Wildlife',
    adoptionDate: '2020-11-30T00:00:00Z', status: 'IN_FORCE',
    country: 'South Africa', countryCode: 'ZA', dataClassification: 'PUBLIC',
    createdAt: '2020-11-30T10:00:00Z', updatedAt: '2025-08-22T16:00:00Z',
  },
  {
    id: 'lf-6', title: 'Draft Fisheries Regulation', type: 'REGULATION', domain: 'Fisheries',
    adoptionDate: '', status: 'DRAFT',
    country: 'Senegal', countryCode: 'SN', dataClassification: 'RESTRICTED',
    createdAt: '2026-01-08T07:00:00Z', updatedAt: '2026-02-18T11:00:00Z',
  },
  {
    id: 'lf-7', title: 'Veterinary Services Guidelines', type: 'GUIDELINE', domain: 'Governance',
    adoptionDate: '2019-05-15T00:00:00Z', status: 'REPEALED',
    country: 'Morocco', countryCode: 'MA', dataClassification: 'PUBLIC',
    createdAt: '2019-05-15T10:00:00Z', updatedAt: '2024-12-01T09:00:00Z',
  },
];

export default function LegalFrameworksPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useLegalFrameworks({
    page,
    limit,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const frameworks = data?.data ?? PLACEHOLDER_FRAMEWORKS;
  const meta = data?.meta ?? { total: PLACEHOLDER_FRAMEWORKS.length, page: 1, limit: 10 };
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/governance"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Legal Frameworks</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            National and regional laws, regulations, policies, and standards
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search legal frameworks..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Types</option>
            <option value="LAW">Law</option>
            <option value="REGULATION">Regulation</option>
            <option value="POLICY">Policy</option>
            <option value="STANDARD">Standard</option>
            <option value="GUIDELINE">Guideline</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="ADOPTED">Adopted</option>
            <option value="IN_FORCE">In Force</option>
            <option value="REPEALED">Repealed</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={7} cols={6} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load legal frameworks'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Title</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Domain</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Country</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Adopted</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {frameworks.map((fw) => (
                  <tr key={fw.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{fw.title}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', TYPE_BADGE[fw.type])}>
                        {fw.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{fw.domain}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{fw.country}</p>
                      <p className="text-xs text-gray-400">{fw.countryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {fw.adoptionDate ? new Date(fw.adoptionDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[fw.status])}>
                        {fw.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {frameworks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                      No legal frameworks found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {frameworks.length} of {meta.total} frameworks
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
