'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Filter, Rss, AlertTriangle, CheckCircle2, Info, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmpresFeed } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';

const CONFIDENCE_COLORS: Record<string, string> = {
  rumor: 'bg-gray-100 text-gray-600',
  unverified: 'bg-amber-100 text-amber-700',
  verified: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  received: <Clock className="h-3.5 w-3.5 text-gray-500" />,
  processed: <Info className="h-3.5 w-3.5 text-blue-500" />,
  matched: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  discarded: <AlertTriangle className="h-3.5 w-3.5 text-gray-400" />,
};

export default function EmpresFeedPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState('');

  const { data, isLoading } = useEmpresFeed({
    page,
    limit: 20,
    status: statusFilter || undefined,
    confidence: confidenceFilter || undefined,
  });
  const feeds = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/interop"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Interop Hub
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          EMPRES Feeds
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          FAO Emergency Prevention System signal intelligence feeds
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="received">Received</option>
          <option value="processed">Processed</option>
          <option value="matched">Matched</option>
          <option value="discarded">Discarded</option>
        </select>
        <select
          value={confidenceFilter}
          onChange={(e) => { setConfidenceFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
        >
          <option value="">All confidence</option>
          <option value="rumor">Rumor</option>
          <option value="unverified">Unverified</option>
          <option value="verified">Verified</option>
          <option value="confirmed">Confirmed</option>
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
                <th className="px-4 py-3">Signal ID</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Disease</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {feeds.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {f.signalId}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[300px] truncate">
                    {f.title}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.disease}</td>
                  <td className="px-4 py-3 text-gray-600">{f.country}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                        CONFIDENCE_COLORS[f.confidence] ?? 'bg-gray-100 text-gray-600',
                      )}
                    >
                      {f.confidence}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs capitalize text-gray-600">
                      {STATUS_ICONS[f.status]}
                      {f.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(f.receivedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {feeds.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No EMPRES feeds found
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
