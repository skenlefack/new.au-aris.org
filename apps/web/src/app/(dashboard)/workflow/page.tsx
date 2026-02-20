'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  CornerUpLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowItems, type WorkflowItem } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const STATUS_BADGE: Record<string, { class: string; icon: React.ReactNode }> = {
  pending: {
    class: 'bg-amber-100 text-amber-700',
    icon: <Clock className="h-3 w-3" />,
  },
  approved: {
    class: 'bg-green-100 text-green-700',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  rejected: {
    class: 'bg-red-100 text-red-700',
    icon: <XCircle className="h-3 w-3" />,
  },
  returned: {
    class: 'bg-blue-100 text-blue-700',
    icon: <CornerUpLeft className="h-3 w-3" />,
  },
};

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

const ENTITY_LABELS: Record<string, string> = {
  health_event: 'Health Event',
  vaccination: 'Vaccination',
  lab_result: 'Lab Result',
  census: 'Census',
};

const LEVEL_LABELS: Record<number, string> = {
  1: 'L1 — National Technical',
  2: 'L2 — National Official',
  3: 'L3 — REC Harmonization',
  4: 'L4 — Continental',
};

const PLACEHOLDER_ITEMS: WorkflowItem[] = [
  {
    id: 'wf-1', entityType: 'health_event', entityId: 'ev-1',
    title: 'FMD Outbreak — Kenya, Rift Valley',
    country: 'Kenya', submittedBy: 'Dr. Ochieng',
    submittedAt: '2026-02-16T09:00:00Z', currentLevel: 2,
    status: 'pending', priority: 'high',
  },
  {
    id: 'wf-2', entityType: 'health_event', entityId: 'ev-2',
    title: 'PPR Outbreak — Ethiopia, Oromia',
    country: 'Ethiopia', submittedBy: 'Dr. Bekele',
    submittedAt: '2026-02-13T11:00:00Z', currentLevel: 3,
    status: 'pending', priority: 'high',
  },
  {
    id: 'wf-3', entityType: 'vaccination', entityId: 'vc-2',
    title: 'PPR National Campaign data — Ethiopia',
    country: 'Ethiopia', submittedBy: 'Dr. Bekele',
    submittedAt: '2026-02-14T08:00:00Z', currentLevel: 2,
    status: 'pending', assignedTo: 'Dr. Nakato', priority: 'medium',
  },
  {
    id: 'wf-4', entityType: 'health_event', entityId: 'ev-3',
    title: 'HPAI Report — Nigeria, Kano',
    country: 'Nigeria', submittedBy: 'Dr. Adamu',
    submittedAt: '2026-02-10T10:00:00Z', currentLevel: 2,
    status: 'approved', priority: 'high',
  },
  {
    id: 'wf-5', entityType: 'lab_result', entityId: 'lr-3',
    title: 'FMD virus isolation — AU-PANVAC',
    country: 'Kenya', submittedBy: 'KARI Muguga',
    submittedAt: '2026-02-17T12:00:00Z', currentLevel: 1,
    status: 'pending', priority: 'medium',
  },
  {
    id: 'wf-6', entityType: 'health_event', entityId: 'ev-4',
    title: 'ASF Suspected — Senegal, Dakar',
    country: 'Senegal', submittedBy: 'Dr. Diop',
    submittedAt: '2026-02-18T14:00:00Z', currentLevel: 1,
    status: 'pending', priority: 'low',
  },
  {
    id: 'wf-7', entityType: 'vaccination', entityId: 'vc-5',
    title: 'ND Village Poultry campaign — Ghana',
    country: 'Ghana', submittedBy: 'Dr. Mensah',
    submittedAt: '2026-01-05T09:00:00Z', currentLevel: 4,
    status: 'approved', priority: 'low',
  },
  {
    id: 'wf-8', entityType: 'health_event', entityId: 'ev-6',
    title: 'LSD Outbreak — Egypt, Nile Delta',
    country: 'Egypt', submittedBy: 'Dr. Hassan',
    submittedAt: '2026-02-08T11:00:00Z', currentLevel: 1,
    status: 'returned', priority: 'medium',
  },
];

export default function WorkflowPage() {
  const [page, setPage] = useState(1);
  const [levelFilter, setLevelFilter] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useWorkflowItems({
    page,
    limit,
    level: levelFilter,
    status: statusFilter || undefined,
    entityType: entityFilter || undefined,
  });

  const items = data?.data ?? PLACEHOLDER_ITEMS;
  const meta = data?.meta ?? {
    total: PLACEHOLDER_ITEMS.length,
    page: 1,
    limit: 10,
  };
  const totalPages = Math.ceil(meta.total / meta.limit);

  // Level tabs
  const levels = [
    { label: 'All Levels', value: undefined },
    { label: 'L1 Technical', value: 1 },
    { label: 'L2 Official', value: 2 },
    { label: 'L3 REC', value: 3 },
    { label: 'L4 Continental', value: 4 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Workflow Validations
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          4-level validation pipeline — review and approve submissions
        </p>
      </div>

      {/* Level tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        {levels.map((lvl) => (
          <button
            key={lvl.label}
            onClick={() => {
              setLevelFilter(lvl.value);
              setPage(1);
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              levelFilter === lvl.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {lvl.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="returned">Returned</option>
        </select>
        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="health_event">Health Event</option>
          <option value="vaccination">Vaccination</option>
          <option value="lab_result">Lab Result</option>
          <option value="census">Census</option>
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs text-amber-600">Pending</p>
          <p className="text-xl font-bold text-amber-700">
            {items.filter((i) => i.status === 'pending').length}
          </p>
        </div>
        <div className="rounded-card border border-green-200 bg-green-50 p-4">
          <p className="text-xs text-green-600">Approved</p>
          <p className="text-xl font-bold text-green-700">
            {items.filter((i) => i.status === 'approved').length}
          </p>
        </div>
        <div className="rounded-card border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-600">Rejected</p>
          <p className="text-xl font-bold text-red-700">
            {items.filter((i) => i.status === 'rejected').length}
          </p>
        </div>
        <div className="rounded-card border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs text-blue-600">Returned</p>
          <p className="text-xl font-bold text-blue-700">
            {items.filter((i) => i.status === 'returned').length}
          </p>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : isError ? (
        <QueryError
          message={
            error instanceof Error
              ? error.message
              : 'Failed to load workflow items'
          }
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Country</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Level</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => {
                  const badge = STATUS_BADGE[item.status];
                  return (
                    <tr key={item.id} className="cursor-pointer hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/workflow/${item.id}`}
                          className="font-medium text-gray-900 hover:text-aris-primary-600"
                        >
                          {item.title}
                        </Link>
                        <p className="text-xs text-gray-400">
                          by {item.submittedBy}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {ENTITY_LABELS[item.entityType] ?? item.entityType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{item.country}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-gray-700">
                          {LEVEL_LABELS[item.currentLevel] ?? `L${item.currentLevel}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            badge?.class ?? 'bg-gray-100 text-gray-600',
                          )}
                        >
                          {badge?.icon}
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            PRIORITY_BADGE[item.priority],
                          )}
                        >
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(item.submittedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      No workflow items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              Showing {items.length} of {meta.total} items
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-gray-600">
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
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
