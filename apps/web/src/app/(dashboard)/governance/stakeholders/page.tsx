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
import { useGovernanceStakeholders, type GovernanceStakeholder } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const PARTNERSHIP_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const PLACEHOLDER_STAKEHOLDERS: GovernanceStakeholder[] = [
  {
    id: 'sh-1', name: 'World Organisation for Animal Health (WOAH)', type: 'International Organization',
    country: 'France', countryCode: 'FR', sector: 'Animal Health',
    contactEmail: 'liaison@woah.org', partnershipStatus: 'active',
    createdAt: '2023-01-15T10:00:00Z', updatedAt: '2026-02-10T08:00:00Z',
  },
  {
    id: 'sh-2', name: 'FAO Regional Office for Africa', type: 'UN Agency',
    country: 'Ghana', countryCode: 'GH', sector: 'Multi-domain',
    contactEmail: 'raf@fao.org', partnershipStatus: 'active',
    createdAt: '2023-03-20T09:00:00Z', updatedAt: '2026-01-05T12:00:00Z',
  },
  {
    id: 'sh-3', name: 'Kenya Veterinary Board', type: 'National Authority',
    country: 'Kenya', countryCode: 'KE', sector: 'Veterinary Services',
    contactEmail: 'info@kvb.go.ke', partnershipStatus: 'active',
    createdAt: '2024-06-10T08:00:00Z', updatedAt: '2026-02-01T14:00:00Z',
  },
  {
    id: 'sh-4', name: 'IGAD Centre for Pastoral Areas', type: 'REC Body',
    country: 'Kenya', countryCode: 'KE', sector: 'Livestock & Pastoralism',
    contactEmail: 'icpac@igad.int', partnershipStatus: 'active',
    createdAt: '2023-11-12T11:00:00Z', updatedAt: '2025-10-22T16:00:00Z',
  },
  {
    id: 'sh-5', name: 'Nigeria Federal Veterinary Service', type: 'National Authority',
    country: 'Nigeria', countryCode: 'NG', sector: 'Veterinary Services',
    contactEmail: 'dg@fedvet.gov.ng', partnershipStatus: 'pending',
    createdAt: '2025-09-05T10:00:00Z', updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'sh-6', name: 'African Development Bank', type: 'Development Partner',
    country: 'Cote d\'Ivoire', countryCode: 'CI', sector: 'Finance & Development',
    contactEmail: 'agri@afdb.org', partnershipStatus: 'active',
    createdAt: '2024-01-08T07:00:00Z', updatedAt: '2026-01-30T11:00:00Z',
  },
  {
    id: 'sh-7', name: 'Institut Pasteur de Dakar', type: 'Research Institution',
    country: 'Senegal', countryCode: 'SN', sector: 'Diagnostics & Research',
    contactEmail: 'direction@pasteur.sn', partnershipStatus: 'inactive',
    createdAt: '2022-07-20T09:00:00Z', updatedAt: '2025-12-15T14:00:00Z',
  },
];

export default function StakeholdersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useGovernanceStakeholders({
    page,
    limit,
    type: typeFilter || undefined,
    partnershipStatus: statusFilter || undefined,
    search: search || undefined,
  });

  const stakeholders = data?.data ?? PLACEHOLDER_STAKEHOLDERS;
  const meta = data?.meta ?? { total: PLACEHOLDER_STAKEHOLDERS.length, page: 1, limit: 10 };
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Stakeholders</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Partner organizations, national authorities, and institutional stakeholders
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search stakeholders..."
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
            <option value="International Organization">International Organization</option>
            <option value="UN Agency">UN Agency</option>
            <option value="National Authority">National Authority</option>
            <option value="REC Body">REC Body</option>
            <option value="Development Partner">Development Partner</option>
            <option value="Research Institution">Research Institution</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={7} cols={6} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load stakeholders'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Organization</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Country</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Sector</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Contact</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {stakeholders.map((sh) => (
                  <tr key={sh.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{sh.name}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{sh.type}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{sh.country}</p>
                      <p className="text-xs text-gray-400">{sh.countryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{sh.sector}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{sh.contactEmail}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', PARTNERSHIP_BADGE[sh.partnershipStatus])}>
                        {sh.partnershipStatus}
                      </span>
                    </td>
                  </tr>
                ))}
                {stakeholders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                      No stakeholders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {stakeholders.length} of {meta.total} stakeholders
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
