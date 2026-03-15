'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Inbox,
  Timer,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowItems, useWorkflowAction, type WorkflowItem } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

/* ── Constants ────────────────────────────────────────────────────────────── */

const WORKFLOW_LEVELS: Record<number, { label: string; color: string; dot: string }> = {
  1: { label: 'National Data Steward', color: 'text-blue-700', dot: 'bg-blue-500' },
  2: { label: 'CVO / Data Owner', color: 'text-green-700', dot: 'bg-green-500' },
  3: { label: 'REC Data Steward', color: 'text-orange-700', dot: 'bg-orange-500' },
  4: { label: 'AU-IBAR', color: 'text-purple-700', dot: 'bg-purple-500' },
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  returned: 'bg-blue-100 text-blue-700',
};

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-gray-400',
  medium: 'bg-amber-400',
  high: 'bg-red-500',
};

const ENTITY_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  health_event: { label: 'Health Event', className: 'bg-red-50 text-red-700 border-red-200' },
  vaccination: { label: 'Vaccination', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  lab_result: { label: 'Lab Result', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  census: { label: 'Census', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const PLACEHOLDER_ITEMS: WorkflowItem[] = [
  {
    id: 'wf-001',
    entityType: 'health_event',
    entityId: 'he-101',
    title: 'FMD Outbreak - Rift Valley Province',
    country: 'Kenya',
    submittedBy: 'Dr. Ochieng Mwangi',
    submittedAt: '2026-03-10T08:30:00Z',
    currentLevel: 2,
    status: 'pending',
    assignedTo: 'Dr. Kimani (CVO)',
    priority: 'high',
  },
  {
    id: 'wf-002',
    entityType: 'health_event',
    entityId: 'he-102',
    title: 'PPR Surveillance Report - Oromia Region',
    country: 'Ethiopia',
    submittedBy: 'Dr. Bekele Tadesse',
    submittedAt: '2026-03-09T14:15:00Z',
    currentLevel: 3,
    status: 'pending',
    assignedTo: 'IGAD Data Steward',
    priority: 'high',
  },
  {
    id: 'wf-003',
    entityType: 'census',
    entityId: 'cn-201',
    title: 'National Livestock Census 2025 - Kano State',
    country: 'Nigeria',
    submittedBy: 'Dr. Adamu Bello',
    submittedAt: '2026-03-08T11:00:00Z',
    currentLevel: 1,
    status: 'pending',
    assignedTo: 'National Data Steward',
    priority: 'medium',
  },
  {
    id: 'wf-004',
    entityType: 'vaccination',
    entityId: 'vc-301',
    title: 'CBPP Vaccination Campaign - Northern Region',
    country: 'Uganda',
    submittedBy: 'Dr. Nakamya Rose',
    submittedAt: '2026-03-07T09:45:00Z',
    currentLevel: 2,
    status: 'approved',
    assignedTo: 'Dr. Otim (CVO)',
    priority: 'medium',
  },
  {
    id: 'wf-005',
    entityType: 'lab_result',
    entityId: 'lr-401',
    title: 'ASF Laboratory Confirmation - Dakar Samples',
    country: 'Senegal',
    submittedBy: 'Dr. Diop Amadou',
    submittedAt: '2026-03-06T16:20:00Z',
    currentLevel: 1,
    status: 'returned',
    assignedTo: 'National Data Steward',
    priority: 'low',
  },
  {
    id: 'wf-006',
    entityType: 'health_event',
    entityId: 'he-103',
    title: 'HPAI Outbreak Report - Western Cape',
    country: 'South Africa',
    submittedBy: 'Dr. Van der Merwe',
    submittedAt: '2026-03-05T07:10:00Z',
    currentLevel: 4,
    status: 'pending',
    assignedTo: 'AU-IBAR Analyst',
    priority: 'high',
  },
  {
    id: 'wf-007',
    entityType: 'census',
    entityId: 'cn-202',
    title: 'Small Ruminant Census - Kayes Region',
    country: 'Mali',
    submittedBy: 'Dr. Traore Moussa',
    submittedAt: '2026-03-04T13:00:00Z',
    currentLevel: 2,
    status: 'rejected',
    assignedTo: 'Dr. Coulibaly (CVO)',
    priority: 'low',
  },
  {
    id: 'wf-008',
    entityType: 'vaccination',
    entityId: 'vc-302',
    title: 'RVF Emergency Vaccination - Garissa County',
    country: 'Kenya',
    submittedBy: 'Dr. Hassan Abdi',
    submittedAt: '2026-03-03T10:30:00Z',
    currentLevel: 3,
    status: 'approved',
    assignedTo: 'IGAD Data Steward',
    priority: 'medium',
  },
];

const PAGE_SIZE = 10;

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* ── Main Page ────────────────────────────────────────────────────────────── */

export default function WorkflowPage() {
  /* ---- state ---- */
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | undefined>(undefined);
  const [actionComment, setActionComment] = useState<Record<string, string>>({});
  const [confirmingAction, setConfirmingAction] = useState<{
    id: string;
    action: 'approve' | 'reject' | 'return';
  } | null>(null);

  /* ---- hooks ---- */
  const {
    data: response,
    isLoading,
    isError,
    refetch,
  } = useWorkflowItems({
    page,
    limit: PAGE_SIZE,
    level: levelFilter,
    status: statusFilter,
    entityType: entityTypeFilter,
  });

  const workflowAction = useWorkflowAction();

  /* ---- derived data ---- */
  const apiItems = response?.data ?? [];
  const apiMeta = response?.meta;
  const hasApiData = apiItems.length > 0;

  // Use placeholder data when no API data is available
  const allItems = hasApiData ? apiItems : PLACEHOLDER_ITEMS;

  // Apply client-side search filtering on placeholder data
  const filteredItems = useMemo(() => {
    if (hasApiData) return apiItems; // API already filtered server-side
    let items = allItems;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.country.toLowerCase().includes(q) ||
          item.submittedBy.toLowerCase().includes(q),
      );
    }
    if (levelFilter) {
      items = items.filter((item) => item.currentLevel === levelFilter);
    }
    if (statusFilter) {
      items = items.filter((item) => item.status === statusFilter);
    }
    if (entityTypeFilter) {
      items = items.filter((item) => item.entityType === entityTypeFilter);
    }
    return items;
  }, [allItems, hasApiData, apiItems, searchQuery, levelFilter, statusFilter, entityTypeFilter]);

  const total = hasApiData ? (apiMeta?.total ?? apiItems.length) : filteredItems.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const displayItems = hasApiData
    ? filteredItems
    : filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ---- KPI calculations ---- */
  const kpiSource = hasApiData ? apiItems : PLACEHOLDER_ITEMS;
  const pendingCount = kpiSource.filter((i) => i.status === 'pending').length;
  const approvedThisWeek = kpiSource.filter((i) => {
    if (i.status !== 'approved') return false;
    const submitted = new Date(i.submittedAt);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return submitted >= weekAgo;
  }).length;
  const avgProcessingTime = '2.4 days';

  /* ---- action handler ---- */
  function handleAction(id: string, action: 'approve' | 'reject' | 'return') {
    const comment = actionComment[id] ?? '';
    workflowAction.mutate(
      { id, action, comment },
      {
        onSuccess: () => {
          setConfirmingAction(null);
          setActionComment((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        },
      },
    );
  }

  /* ---- render ---- */
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Validation Workflow
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Review and validate submitted data across the 4-level validation pipeline
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Pending Reviews */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Pending Reviews
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {pendingCount}
                </p>
              </div>
            </div>
            {pendingCount > 0 && (
              <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-amber-500 px-2 text-xs font-semibold text-white">
                {pendingCount}
              </span>
            )}
          </div>
        </div>

        {/* Approved This Week */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Approved This Week
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {approvedThisWeek}
              </p>
            </div>
          </div>
        </div>

        {/* Average Processing Time */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <Timer className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Average Processing Time
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {avgProcessingTime}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title, country, or submitter..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
        </div>

        {/* Level Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={levelFilter ?? ''}
            onChange={(e) => {
              setLevelFilter(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
            className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="">All Levels</option>
            <option value="1">Level 1 - National Data Steward</option>
            <option value="2">Level 2 - CVO / Data Owner</option>
            <option value="3">Level 3 - REC Data Steward</option>
            <option value="4">Level 4 - AU-IBAR</option>
          </select>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter ?? ''}
          onChange={(e) => {
            setStatusFilter(e.target.value || undefined);
            setPage(1);
          }}
          className="appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="returned">Returned</option>
        </select>

        {/* Entity Type Filter */}
        <select
          value={entityTypeFilter ?? ''}
          onChange={(e) => {
            setEntityTypeFilter(e.target.value || undefined);
            setPage(1);
          }}
          className="appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">All Types</option>
          <option value="health_event">Health Event</option>
          <option value="vaccination">Vaccination</option>
          <option value="lab_result">Lab Result</option>
          <option value="census">Census</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={9} />
      ) : isError ? (
        <QueryError message="Failed to load workflow items" onRetry={() => refetch()} />
      ) : displayItems.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 dark:border-gray-700 dark:bg-gray-900">
          <Inbox className="h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
            No workflow items found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchQuery || levelFilter || statusFilter || entityTypeFilter
              ? 'Try adjusting your filters to find what you are looking for.'
              : 'There are no items in the validation pipeline right now.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Submitted By</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {displayItems.map((item) => {
                  const level = WORKFLOW_LEVELS[item.currentLevel] ?? WORKFLOW_LEVELS[1];
                  const entityBadge = ENTITY_TYPE_BADGE[item.entityType] ?? {
                    label: item.entityType,
                    className: 'bg-gray-50 text-gray-700 border-gray-200',
                  };
                  const isConfirming =
                    confirmingAction?.id === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      {/* Title */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {item.title}
                        </span>
                      </td>

                      {/* Type Badge */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                            entityBadge.className,
                          )}
                        >
                          {entityBadge.label}
                        </span>
                      </td>

                      {/* Country */}
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {item.country}
                      </td>

                      {/* Submitted By */}
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {item.submittedBy}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {formatDate(item.submittedAt)}
                      </td>

                      {/* Level */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn('h-2 w-2 rounded-full', level.dot)}
                          />
                          <span
                            className={cn(
                              'text-xs font-medium',
                              level.color,
                            )}
                          >
                            L{item.currentLevel}
                          </span>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full',
                              PRIORITY_DOT[item.priority] ?? 'bg-gray-400',
                            )}
                          />
                          {item.priority.charAt(0).toUpperCase() +
                            item.priority.slice(1)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                            STATUS_STYLES[item.status] ?? 'bg-gray-100 text-gray-700',
                          )}
                        >
                          {item.status.charAt(0).toUpperCase() +
                            item.status.slice(1)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {item.status === 'pending' ? (
                          isConfirming ? (
                            <div className="flex flex-col items-end gap-2">
                              <input
                                type="text"
                                placeholder="Add a comment..."
                                value={actionComment[item.id] ?? ''}
                                onChange={(e) =>
                                  setActionComment((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                className="w-48 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                              />
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() =>
                                    handleAction(
                                      item.id,
                                      confirmingAction.action,
                                    )
                                  }
                                  disabled={workflowAction.isPending}
                                  className={cn(
                                    'rounded-md px-2.5 py-1 text-xs font-medium text-white',
                                    confirmingAction.action === 'approve'
                                      ? 'bg-green-600 hover:bg-green-700'
                                      : confirmingAction.action === 'reject'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-blue-600 hover:bg-blue-700',
                                    workflowAction.isPending &&
                                      'cursor-not-allowed opacity-50',
                                  )}
                                >
                                  {workflowAction.isPending
                                    ? 'Processing...'
                                    : `Confirm ${confirmingAction.action}`}
                                </button>
                                <button
                                  onClick={() => setConfirmingAction(null)}
                                  className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() =>
                                  setConfirmingAction({
                                    id: item.id,
                                    action: 'approve',
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                                title="Approve"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmingAction({
                                    id: item.id,
                                    action: 'reject',
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                title="Reject"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            --
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 0 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {(page - 1) * PAGE_SIZE + 1}
                </span>
                {' - '}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {Math.min(page * PAGE_SIZE, total)}
                </span>
                {' of '}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {total}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
