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
import { useCitesPermits, type CitesPermit } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const STATUS_BADGE: Record<string, string> = {
  issued: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  expired: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const APPENDIX_BADGE: Record<string, string> = {
  I: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  II: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  III: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const PLACEHOLDER_PERMITS: CitesPermit[] = [
  {
    id: 'cit-1', permitNumber: 'CITES-KE-2026-001', species: 'Loxodonta africana',
    appendix: 'I', purpose: 'Scientific', exportCountry: 'Kenya', importCountry: 'United Kingdom',
    quantity: 5, unit: 'samples', status: 'issued',
    issuedAt: '2026-01-15T10:00:00Z', expiresAt: '2026-07-15T10:00:00Z',
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'cit-2', permitNumber: 'CITES-ZA-2026-042', species: 'Ceratotherium simum',
    appendix: 'I', purpose: 'Zoo', exportCountry: 'South Africa', importCountry: 'Germany',
    quantity: 2, unit: 'specimens', status: 'pending',
    issuedAt: '', expiresAt: '',
    createdAt: '2026-02-05T09:00:00Z', updatedAt: '2026-02-10T14:00:00Z',
  },
  {
    id: 'cit-3', permitNumber: 'CITES-TZ-2025-198', species: 'Psittacus erithacus',
    appendix: 'I', purpose: 'Breeding', exportCountry: 'Tanzania', importCountry: 'UAE',
    quantity: 20, unit: 'specimens', status: 'issued',
    issuedAt: '2025-11-20T08:00:00Z', expiresAt: '2026-05-20T08:00:00Z',
    createdAt: '2025-11-15T10:00:00Z', updatedAt: '2025-11-20T08:00:00Z',
  },
  {
    id: 'cit-4', permitNumber: 'CITES-CM-2025-067', species: 'Prunus africana',
    appendix: 'II', purpose: 'Commercial', exportCountry: 'Cameroon', importCountry: 'France',
    quantity: 5_000, unit: 'kg bark', status: 'issued',
    issuedAt: '2025-09-01T10:00:00Z', expiresAt: '2026-03-01T10:00:00Z',
    createdAt: '2025-08-25T08:00:00Z', updatedAt: '2025-09-01T10:00:00Z',
  },
  {
    id: 'cit-5', permitNumber: 'CITES-MZ-2025-034', species: 'Hippocampus kuda',
    appendix: 'II', purpose: 'Commercial', exportCountry: 'Mozambique', importCountry: 'China',
    quantity: 200, unit: 'dried specimens', status: 'expired',
    issuedAt: '2025-03-01T10:00:00Z', expiresAt: '2025-09-01T10:00:00Z',
    createdAt: '2025-02-20T08:00:00Z', updatedAt: '2025-09-02T10:00:00Z',
  },
  {
    id: 'cit-6', permitNumber: 'CITES-NG-2026-012', species: 'Python regius',
    appendix: 'II', purpose: 'Commercial', exportCountry: 'Nigeria', importCountry: 'USA',
    quantity: 500, unit: 'specimens', status: 'issued',
    issuedAt: '2026-01-20T10:00:00Z', expiresAt: '2026-07-20T10:00:00Z',
    createdAt: '2026-01-15T08:00:00Z', updatedAt: '2026-01-20T10:00:00Z',
  },
  {
    id: 'cit-7', permitNumber: 'CITES-ET-2025-089', species: 'Giraffa camelopardalis',
    appendix: 'II', purpose: 'Education', exportCountry: 'Ethiopia', importCountry: 'Japan',
    quantity: 3, unit: 'specimens', status: 'revoked',
    issuedAt: '2025-06-10T10:00:00Z', expiresAt: '2025-12-10T10:00:00Z',
    createdAt: '2025-06-05T08:00:00Z', updatedAt: '2025-08-15T12:00:00Z',
  },
];

export default function CitesPermitsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appendixFilter, setAppendixFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useCitesPermits({
    page,
    limit,
    appendix: appendixFilter || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const permits = data?.data ?? PLACEHOLDER_PERMITS;
  const meta = data?.meta ?? { total: PLACEHOLDER_PERMITS.length, page: 1, limit: 10 };
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/wildlife"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CITES Permits</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            International trade permits for endangered species (CITES Appendix I, II, III)
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search permits..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={appendixFilter}
            onChange={(e) => { setAppendixFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Appendices</option>
            <option value="I">Appendix I</option>
            <option value="II">Appendix II</option>
            <option value="III">Appendix III</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Status</option>
            <option value="issued">Issued</option>
            <option value="pending">Pending</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={7} cols={8} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load CITES permits'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Permit No.</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Species</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Appendix</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Purpose</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Export → Import</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Quantity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Expires</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {permits.map((permit) => (
                  <tr key={permit.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{permit.permitNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="italic text-gray-700 dark:text-gray-300">{permit.species}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-bold', APPENDIX_BADGE[permit.appendix])}>
                        {permit.appendix}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{permit.purpose}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {permit.exportCountry} → {permit.importCountry}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {permit.quantity.toLocaleString()} {permit.unit}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {permit.expiresAt ? new Date(permit.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATUS_BADGE[permit.status])}>
                        {permit.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {permits.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      No CITES permits found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {permits.length} of {meta.total} permits
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
