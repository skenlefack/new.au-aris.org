'use client';

import React, { useState } from 'react';
import {
  Clock, Search, ChevronLeft, ChevronRight,
  Settings, Globe, Flag, Shield, FileText,
  Upload, Trash2, CheckCircle, XCircle, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuditLog, type AuditEntry } from '@/lib/api/hooks';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'VALIDATE', label: 'Validate' },
  { value: 'REJECT', label: 'Reject' },
  { value: 'EXPORT', label: 'Export' },
];

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All Entities' },
  { value: 'health_event', label: 'Health Events' },
  { value: 'vaccination', label: 'Vaccinations' },
  { value: 'lab_result', label: 'Lab Results' },
  { value: 'census', label: 'Census' },
  { value: 'trade_flow', label: 'Trade Flows' },
  { value: 'sps_certificate', label: 'SPS Certificates' },
  { value: 'user', label: 'Users' },
  { value: 'config', label: 'Configuration' },
];

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CREATE: <FileText className="h-4 w-4 text-blue-500" />,
  UPDATE: <Settings className="h-4 w-4 text-amber-500" />,
  DELETE: <Trash2 className="h-4 w-4 text-red-500" />,
  VALIDATE: <CheckCircle className="h-4 w-4 text-green-500" />,
  REJECT: <XCircle className="h-4 w-4 text-red-500" />,
  EXPORT: <Upload className="h-4 w-4 text-indigo-500" />,
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  UPDATE: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  DELETE: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  VALIDATE: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  REJECT: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  EXPORT: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400',
};

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const limit = 20;

  const { data, isLoading, isError } = useAuditLog({
    page,
    limit,
    action: actionFilter || undefined,
    entityType: entityTypeFilter || undefined,
    search: search || undefined,
  });

  const entries = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit };
  const totalPages = Math.max(1, Math.ceil(meta.total / limit));
  const hasEntries = entries.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Track all configuration changes and administrative actions
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search audit entries..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={entityTypeFilter}
          onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          {ENTITY_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Entries */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        )}

        {isError && (
          <div className="px-4 py-8 text-center text-sm text-red-500 dark:text-red-400">
            Failed to load audit entries. Please try again.
          </div>
        )}

        {!isLoading && !isError && !hasEntries && (
          <div className="px-4 py-12 text-center">
            <Filter className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No audit entries found.
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Audit entries are generated automatically when data is modified.
            </p>
          </div>
        )}

        {!isLoading && hasEntries && (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {entries.map((entry) => (
              <AuditEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta.total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, meta.total)} of {meta.total} entries
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const icon = ACTION_ICONS[entry.action] ?? <Settings className="h-4 w-4 text-gray-400" />;
  const actionColor = ACTION_COLORS[entry.action] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-900 dark:text-white">
          <span className="font-medium">{entry.actor.email}</span>{' '}
          <span className="text-gray-500 dark:text-gray-400">
            {entry.action.toLowerCase()}d
          </span>{' '}
          <span className="font-medium">
            {entry.entityType.replace(/_/g, ' ')}
          </span>
          {entry.entityId && (
            <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">
              ({entry.entityId.substring(0, 8)})
            </span>
          )}
        </p>
        {entry.reason && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 italic">
            &ldquo;{entry.reason}&rdquo;
          </p>
        )}
        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
          <Clock className="h-3 w-3" />
          {formatTimestamp(entry.timestamp)}
          <span className="mx-1">·</span>
          <Shield className="h-3 w-3" />
          {entry.dataClassification}
        </p>
      </div>
      <span className={cn('rounded px-2 py-0.5 text-[10px] font-medium', actionColor)}>
        {entry.action}
      </span>
    </div>
  );
}
