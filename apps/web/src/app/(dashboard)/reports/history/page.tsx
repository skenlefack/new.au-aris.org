'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Download,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileBarChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReportHistory } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'Pending',
    color: 'bg-amber-100 text-amber-700',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  generating: {
    label: 'Generating',
    color: 'bg-blue-100 text-blue-700',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-100 text-green-700',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-100 text-red-700',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function ReportHistoryPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 20;

  const { data, isLoading } = useReportHistory({
    page,
    limit,
    status: statusFilter || undefined,
  });

  const reports = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Reports
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Report History
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              View and download previously generated reports
            </p>
          </div>
          <Link
            href="/reports/generate"
            className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700"
          >
            <FileBarChart className="h-4 w-4" />
            Generate Report
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <AlertCircle className="h-4 w-4 text-gray-400" />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="generating">Generating</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={8} />
      ) : reports.length === 0 ? (
        <div className="rounded-card border border-gray-200 bg-white p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-900">
            No reports generated yet
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Generate a report from the templates page to see it here.
          </p>
          <Link
            href="/reports"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700"
          >
            <FileBarChart className="h-4 w-4" />
            View Templates
          </Link>
        </div>
      ) : (
        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-4 py-3">Report Name</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Generated By</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map((report) => {
                  const statusCfg =
                    STATUS_CONFIG[report.status] ?? STATUS_CONFIG.pending;

                  return (
                    <tr key={report.id} className="hover:bg-gray-50">
                      {/* Report Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {report.templateName}
                            </p>
                            {report.fileSize != null && report.fileSize > 0 && (
                              <p className="text-[11px] text-gray-400">
                                {formatFileSize(report.fileSize)}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Country */}
                      <td className="px-4 py-3 text-gray-600">
                        {report.country ?? (
                          <span className="text-gray-400">All</span>
                        )}
                      </td>

                      {/* Period */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600">
                          {new Date(report.periodStart).toLocaleDateString()}
                          {' - '}
                          {new Date(report.periodEnd).toLocaleDateString()}
                        </span>
                      </td>

                      {/* Format */}
                      <td className="px-4 py-3">
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono uppercase">
                          {report.format}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                            statusCfg.color,
                          )}
                        >
                          {statusCfg.icon}
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Generated By */}
                      <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[140px]">
                        {report.generatedBy}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3">
                        <span
                          className="text-xs text-gray-500"
                          title={new Date(report.createdAt).toLocaleString()}
                        >
                          {formatRelativeTime(report.createdAt)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {report.status === 'completed' && report.downloadUrl ? (
                          <a
                            href={report.downloadUrl}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-aris-primary-700"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </a>
                        ) : (
                          <button
                            disabled
                            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-400"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total > meta.limit && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-gray-500">
            Showing {(meta.page - 1) * meta.limit + 1}
            {' - '}
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}{' '}
            reports
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <span className="px-2 text-xs text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
