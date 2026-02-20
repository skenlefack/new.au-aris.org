'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Filter, FileText, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataContracts } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';

function ComplianceBadge({ rate }: { rate: number }) {
  if (rate >= 0.95) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
        <CheckCircle2 className="h-3 w-3" />
        {(rate * 100).toFixed(1)}%
      </span>
    );
  }
  if (rate >= 0.8) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
        <AlertTriangle className="h-3 w-3" />
        {(rate * 100).toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
      <XCircle className="h-3 w-3" />
      {(rate * 100).toFixed(1)}%
    </span>
  );
}

export default function DataContractsSettingsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useDataContracts({
    page,
    limit: 20,
    status: statusFilter || undefined,
  });
  const contracts = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Data Contracts
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          View data contract compliance and SLA status
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={10} cols={7} />
      ) : (
        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">Contract</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Consumer</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3">Compliance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contracts.map((c) => (
                <tr
                  key={c.id}
                  className={cn(
                    'hover:bg-gray-50',
                    c.complianceRate < 0.8 ? 'bg-red-50/50' : '',
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-[10px] text-gray-500 max-w-[200px] truncate">
                      {c.description}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {c.provider}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {c.consumer}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 capitalize">
                    {c.frequency}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {c.timelinessSla}h
                  </td>
                  <td className="px-4 py-3">
                    <ComplianceBadge rate={c.complianceRate} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                        c.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : c.status === 'draft'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-red-100 text-red-700',
                      )}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {c.lastDelivery
                      ? new Date(c.lastDelivery).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No data contracts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.total > meta.limit && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Showing {(meta.page - 1) * meta.limit + 1}–
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * meta.limit >= meta.total} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
