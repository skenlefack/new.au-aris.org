'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  ClipboardList,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Pause,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCampaigns, type CollecteCampaign } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';

const STATUS_CONFIG: Record<
  CollecteCampaign['status'],
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: 'Draft',
    color: 'bg-gray-100 text-gray-700',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  active: {
    label: 'Active',
    color: 'bg-green-100 text-green-700',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  paused: {
    label: 'Paused',
    color: 'bg-amber-100 text-amber-700',
    icon: <Pause className="h-3.5 w-3.5" />,
  },
  completed: {
    label: 'Completed',
    color: 'bg-blue-100 text-blue-700',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-700',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

export default function CollectePage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useCampaigns({
    page,
    limit: 10,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const campaigns = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Collecte</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Campaign orchestration and data collection
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/collecte/forms"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ClipboardList className="h-4 w-4" />
            Form Builder
          </Link>
          <Link
            href="/collecte/campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Campaign list */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : campaigns.length === 0 ? (
        <div className="rounded-card border border-gray-200 bg-white p-12 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-900">
            No campaigns found
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Create your first data collection campaign to get started.
          </p>
          <Link
            href="/collecte/campaigns/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const progress =
              campaign.targetSubmissions > 0
                ? Math.round(
                    (campaign.totalSubmissions / campaign.targetSubmissions) *
                      100,
                  )
                : 0;
            const validatedPct =
              campaign.totalSubmissions > 0
                ? Math.round(
                    (campaign.validatedSubmissions /
                      campaign.totalSubmissions) *
                      100,
                  )
                : 0;
            const statusCfg = STATUS_CONFIG[campaign.status];

            return (
              <Link
                key={campaign.id}
                href={`/collecte/campaigns/${campaign.id}`}
                className="block rounded-card border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {campaign.name}
                      </h3>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                          statusCfg.color,
                        )}
                      >
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 truncate">
                      {campaign.description}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <ClipboardList className="h-3.5 w-3.5" />
                        {campaign.templateName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {campaign.assignedAgents} agents
                      </span>
                      <span>
                        {new Date(campaign.startDate).toLocaleDateString()} —{' '}
                        {new Date(campaign.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 text-right text-xs text-gray-500">
                    <div className="font-medium text-gray-900">
                      {campaign.totalSubmissions} / {campaign.targetSubmissions}
                    </div>
                    <div>submissions</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Progress: {progress}%</span>
                    <span>Validated: {validatedPct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div className="flex h-full">
                      <div
                        className="bg-aris-primary-500 transition-all"
                        style={{
                          width: `${
                            campaign.targetSubmissions > 0
                              ? (campaign.validatedSubmissions /
                                  campaign.targetSubmissions) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                      <div
                        className="bg-aris-primary-200 transition-all"
                        style={{
                          width: `${
                            campaign.targetSubmissions > 0
                              ? ((campaign.totalSubmissions -
                                  campaign.validatedSubmissions) /
                                  campaign.targetSubmissions) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-aris-primary-500" />
                      Validated ({campaign.validatedSubmissions})
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-aris-primary-200" />
                      Pending (
                      {campaign.totalSubmissions -
                        campaign.validatedSubmissions -
                        campaign.rejectedSubmissions}
                      )
                    </span>
                    {campaign.rejectedSubmissions > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
                        Rejected ({campaign.rejectedSubmissions})
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Pagination */}
          {meta && meta.total > meta.limit && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">
                Showing {(meta.page - 1) * meta.limit + 1}–
                {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * meta.limit >= meta.total}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
