'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  Calendar,
  Download,
  Printer,
  Shield,
  Database,
  Clock,
  HardDrive,
  X,
  ChevronRight,
  ChevronDown,
  FileText,
  Minus,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  useAuditLog,
  useAuditEntry,
  useAuditRetention,
  type AuditEntry,
} from '@/lib/api/hooks';

// ── Constants ──

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-status-healthy/10 text-status-healthy',
  UPDATE: 'bg-blue-900/30 text-blue-300',
  DELETE: 'bg-status-down/10 text-status-down',
  VALIDATE: 'bg-primary-900/30 text-primary-400',
  REJECT: 'bg-status-degraded/10 text-status-degraded',
  EXPORT: 'bg-purple-900/30 text-purple-300',
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  PUBLIC: 'bg-status-healthy/10 text-status-healthy',
  PARTNER: 'bg-blue-900/30 text-blue-300',
  RESTRICTED: 'bg-status-degraded/10 text-status-degraded',
  CONFIDENTIAL: 'bg-status-down/10 text-status-down',
};

const ENTITY_TYPES = [
  'health_event',
  'vaccination',
  'lab_result',
  'campaign',
  'submission',
  'tenant',
  'user',
  'data_contract',
  'workflow_instance',
  'livestock_census',
  'fish_capture',
  'wildlife_inventory',
  'trade_flow',
  'apiary',
  'pvs_evaluation',
  'climate_data',
];

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'VALIDATE', 'REJECT', 'EXPORT'];

// ── Diff Utilities ──

type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

interface DiffField {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  status: DiffStatus;
}

function computeDiff(
  prev: Record<string, unknown> | null,
  next: Record<string, unknown> | null,
): DiffField[] {
  const allKeys = new Set<string>();
  if (prev) Object.keys(prev).forEach((k) => allKeys.add(k));
  if (next) Object.keys(next).forEach((k) => allKeys.add(k));

  const fields: DiffField[] = [];
  for (const key of Array.from(allKeys).sort()) {
    const inPrev = prev != null && key in prev;
    const inNext = next != null && key in next;
    const oldValue = inPrev ? prev![key] : undefined;
    const newValue = inNext ? next![key] : undefined;

    let status: DiffStatus;
    if (!inPrev && inNext) {
      status = 'added';
    } else if (inPrev && !inNext) {
      status = 'removed';
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      status = 'changed';
    } else {
      status = 'unchanged';
    }

    fields.push({ key, oldValue, newValue, status });
  }

  return fields;
}

function formatValue(value: unknown): string {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

const DIFF_BG: Record<DiffStatus, string> = {
  added: 'bg-green-900/20',
  removed: 'bg-red-900/20',
  changed: 'bg-yellow-900/20',
  unchanged: '',
};

const DIFF_INDICATOR: Record<DiffStatus, { icon: typeof Plus; color: string }> = {
  added: { icon: Plus, color: 'text-green-400' },
  removed: { icon: Minus, color: 'text-red-400' },
  changed: { icon: RefreshCw, color: 'text-yellow-400' },
  unchanged: { icon: ChevronRight, color: 'text-admin-muted' },
};

// ── CSV Export ──

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function exportToCSV(entries: AuditEntry[]) {
  const headers = [
    'Timestamp',
    'Action',
    'Entity Type',
    'Entity ID',
    'Actor User ID',
    'Actor Role',
    'Actor Tenant ID',
    'Data Classification',
    'Reason',
  ];

  const rows = entries.map((e) => [
    new Date(e.timestamp).toISOString(),
    e.action,
    e.entityType,
    e.entityId,
    e.actor.userId,
    e.actor.role,
    e.actor.tenantId,
    e.dataClassification,
    e.reason ?? '',
  ]);

  const csv = [headers.map(escapeCSV).join(','), ...rows.map((r) => r.map(escapeCSV).join(','))].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `audit-log-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Print ──

function handlePrint(entries: AuditEntry[]) {
  const date = new Date().toISOString().slice(0, 10);
  const rows = entries
    .map(
      (e) =>
        `<tr>
          <td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:12px;font-family:monospace;white-space:nowrap">${new Date(e.timestamp).toLocaleString()}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:12px">${e.action}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:12px">${e.entityType}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:12px;font-family:monospace">${e.entityId}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:12px;font-family:monospace">${e.actor.userId}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:12px">${e.actor.role}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:12px">${e.dataClassification}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:12px">${e.reason ?? ''}</td>
        </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html><head><title>ARIS Audit Log - ${date}</title>
<style>body{font-family:Arial,sans-serif;margin:20px}h1{font-size:18px}table{border-collapse:collapse;width:100%}th{text-align:left;padding:6px 8px;border-bottom:2px solid #333;font-size:12px;background:#f5f5f5}</style>
</head><body>
<h1>ARIS Audit Log</h1>
<p style="font-size:12px;color:#666">Exported: ${new Date().toLocaleString()} | Entries: ${entries.length}</p>
<table><thead><tr>
<th>Timestamp</th><th>Action</th><th>Entity Type</th><th>Entity ID</th><th>Actor</th><th>Role</th><th>Classification</th><th>Reason</th>
</tr></thead><tbody>${rows}</tbody></table>
</body></html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }
}

// ── DiffViewer Component ──

function DiffViewer({
  entryId,
  onClose,
}: {
  entryId: string;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useAuditEntry(entryId);

  const diffFields = useMemo(() => {
    if (!detail) return [];
    return computeDiff(detail.previousVersion, detail.newVersion);
  }, [detail]);

  const hasChanges = diffFields.some((f) => f.status !== 'unchanged');

  if (isLoading) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-6">
          <div className="admin-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 w-48 bg-admin-surface rounded animate-pulse" />
              <button onClick={onClose} className="admin-btn-secondary text-xs">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 bg-admin-surface rounded animate-pulse" />
              ))}
            </div>
          </div>
        </td>
      </tr>
    );
  }

  if (!detail) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-6">
          <div className="admin-card p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-admin-muted">Failed to load entry details.</p>
              <button onClick={onClose} className="admin-btn-secondary text-xs">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={6} className="px-0 py-0">
        <div className="border-t border-b border-primary-600/30 bg-admin-surface/30">
          <div className="px-6 py-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary-400" />
                <h3 className="text-lg font-semibold text-admin-heading">
                  Change Detail
                </h3>
                <span className="text-xs font-mono text-admin-muted">
                  {detail.entityType} / {detail.entityId}
                </span>
              </div>
              <button onClick={onClose} className="admin-btn-secondary text-xs flex items-center gap-1">
                <X className="w-3 h-3" />
                Close
              </button>
            </div>

            {/* Entry metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div>
                <span className="block text-xs font-medium text-admin-muted mb-1">Action</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${ACTION_COLORS[detail.action] ?? 'bg-admin-surface text-admin-muted'}`}>
                  {detail.action}
                </span>
              </div>
              <div>
                <span className="block text-xs font-medium text-admin-muted mb-1">Timestamp</span>
                <span className="text-xs font-mono text-admin-muted">{new Date(detail.timestamp).toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-admin-muted mb-1">Actor</span>
                <span className="text-xs font-mono text-admin-muted">{detail.actor.userId}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-admin-muted mb-1">Reason</span>
                <span className="text-xs text-admin-muted">{detail.reason ?? '—'}</span>
              </div>
            </div>

            {/* Diff Legend */}
            <div className="flex items-center gap-4 mb-3 text-xs text-admin-muted">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-green-900/20 border border-green-700/30" /> Added
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-red-900/20 border border-red-700/30" /> Removed
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-yellow-900/20 border border-yellow-700/30" /> Changed
              </span>
            </div>

            {!detail.previousVersion && !detail.newVersion ? (
              <div className="text-center py-6 text-sm text-admin-muted">
                No version data available for this entry.
              </div>
            ) : !hasChanges && detail.previousVersion && detail.newVersion ? (
              <div className="text-center py-6 text-sm text-admin-muted">
                No differences detected between versions.
              </div>
            ) : (
              /* Side-by-side diff table */
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-admin-border">
                      <th className="text-left text-xs font-medium text-admin-muted px-4 py-3 w-8" />
                      <th className="text-left text-xs font-medium text-admin-muted px-4 py-3 w-1/5">
                        Field
                      </th>
                      <th className="text-left text-xs font-medium text-admin-muted px-4 py-3 w-2/5">
                        Previous Version
                      </th>
                      <th className="text-left text-xs font-medium text-admin-muted px-4 py-3 w-2/5">
                        New Version
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffFields.map((field) => {
                      const Indicator = DIFF_INDICATOR[field.status].icon;
                      return (
                        <tr key={field.key} className={`${DIFF_BG[field.status]} border-b border-admin-border/30`}>
                          <td className="px-4 py-2">
                            <Indicator className={`w-3 h-3 ${DIFF_INDICATOR[field.status].color}`} />
                          </td>
                          <td className="px-4 py-2 font-mono font-medium text-admin-text">
                            {field.key}
                          </td>
                          <td className="px-4 py-2">
                            {field.status === 'added' ? (
                              <span className="text-admin-muted italic">—</span>
                            ) : (
                              <pre className={`font-mono whitespace-pre-wrap break-all ${field.status === 'removed' ? 'text-red-300' : field.status === 'changed' ? 'text-yellow-300' : 'text-admin-muted'}`}>
                                {formatValue(field.oldValue)}
                              </pre>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {field.status === 'removed' ? (
                              <span className="text-admin-muted italic">—</span>
                            ) : (
                              <pre className={`font-mono whitespace-pre-wrap break-all ${field.status === 'added' ? 'text-green-300' : field.status === 'changed' ? 'text-yellow-300' : 'text-admin-muted'}`}>
                                {formatValue(field.newValue)}
                              </pre>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── ClassificationBadge ──

function ClassificationBadge({ level }: { level: string }) {
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded ${
        CLASSIFICATION_COLORS[level] ?? 'bg-admin-surface text-admin-muted'
      }`}
    >
      {level}
    </span>
  );
}

// ── Main Page ──

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [reasonSearch, setReasonSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useAuditLog({
    page,
    limit: 25,
    entityId: search || undefined,
    reasonSearch: reasonSearch || undefined,
    entityType: entityType || undefined,
    action: action || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const { data: retention, isLoading: retentionLoading } = useAuditRetention();

  const entries = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 25 };
  const totalPages = Math.ceil(meta.total / meta.limit);

  const hasActiveFilters = entityType || action || dateFrom || dateTo || reasonSearch;

  const handleRowClick = useCallback(
    (entryId: string) => {
      setExpandedEntryId((prev) => (prev === entryId ? null : entryId));
    },
    [],
  );

  const handleExportCSV = useCallback(() => {
    if (entries.length > 0) exportToCSV(entries);
  }, [entries]);

  const handlePrintClick = useCallback(() => {
    if (entries.length > 0) handlePrint(entries);
  }, [entries]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-admin-heading">Audit Log</h1>
        <p className="text-sm text-admin-muted mt-1">
          Search and review all system actions by entity, user, action, and date
        </p>
      </div>

      {/* Retention Policy Info Bar */}
      <div className="admin-card p-4">
        <div className="flex flex-wrap items-center gap-6">
          {retentionLoading ? (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-4 w-24 bg-admin-surface rounded animate-pulse" />
                </div>
              ))}
            </>
          ) : retention ? (
            <>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary-400" />
                <span className="text-xs text-admin-muted">Retention:</span>
                <span className="text-xs font-medium text-admin-text">
                  {retention.retentionDays} days
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-primary-400" />
                <span className="text-xs text-admin-muted">Total Entries:</span>
                <span className="text-xs font-medium text-admin-text">
                  {retention.totalEntries.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-400" />
                <span className="text-xs text-admin-muted">Oldest Entry:</span>
                <span className="text-xs font-mono text-admin-text">
                  {retention.oldestEntry
                    ? new Date(retention.oldestEntry).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-primary-400" />
                <span className="text-xs text-admin-muted">Storage Used:</span>
                <span className="text-xs font-medium text-admin-text">
                  {retention.storageUsed}
                </span>
              </div>
            </>
          ) : (
            <span className="text-xs text-admin-muted">Retention policy unavailable</span>
          )}
        </div>
      </div>

      {/* Search Bar + Filter Toggle + Export Buttons */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[250px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="admin-input w-full pl-10"
            placeholder="Search by entity ID or user ID..."
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`admin-btn-secondary flex items-center gap-2 ${
            showFilters || hasActiveFilters ? 'ring-2 ring-primary-600' : ''
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 text-xs bg-primary-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
              !
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleExportCSV}
            disabled={entries.length === 0}
            className="admin-btn-secondary flex items-center gap-2 text-xs disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handlePrintClick}
            disabled={entries.length === 0}
            className="admin-btn-secondary flex items-center gap-2 text-xs disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Advanced Filters (Collapsible) */}
      {showFilters && (
        <div className="admin-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-admin-muted mb-1">
                Entity Type
              </label>
              <select
                value={entityType}
                onChange={(e) => {
                  setEntityType(e.target.value);
                  setPage(1);
                }}
                className="admin-input w-full"
              >
                <option value="">All Types</option>
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-admin-muted mb-1">
                Action
              </label>
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setPage(1);
                }}
                className="admin-input w-full"
              >
                <option value="">All Actions</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-admin-muted mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="admin-input w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-admin-muted mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="admin-input w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-admin-muted mb-1">
                <Search className="w-3 h-3 inline mr-1" />
                Reason Search
              </label>
              <input
                type="text"
                value={reasonSearch}
                onChange={(e) => {
                  setReasonSearch(e.target.value);
                  setPage(1);
                }}
                className="admin-input w-full"
                placeholder="Search in reason field..."
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setEntityType('');
                  setAction('');
                  setDateFrom('');
                  setDateTo('');
                  setReasonSearch('');
                  setPage(1);
                }}
                className="admin-btn-secondary text-xs"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="admin-card overflow-hidden" ref={printRef}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border">
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3 w-8" />
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Timestamp
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Action
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Entity
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Actor
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Classification
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Reason
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-admin-border/50">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-4 bg-admin-surface rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : entries.length > 0 ? (
              entries.map((entry) => {
                const isExpanded = expandedEntryId === entry.id;
                return (
                  <AuditRow
                    key={entry.id}
                    entry={entry}
                    isExpanded={isExpanded}
                    onToggle={handleRowClick}
                    onClose={() => setExpandedEntryId(null)}
                  />
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-admin-muted"
                >
                  <ScrollText className="w-8 h-8 mx-auto mb-2 text-admin-border" />
                  No audit entries found
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {meta.total > meta.limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-admin-border">
            <span className="text-xs text-admin-muted">
              Page {meta.page} of {totalPages} ({meta.total.toLocaleString()} entries)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="admin-btn-secondary text-xs disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="admin-btn-secondary text-xs disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AuditRow Component ──

function AuditRow({
  entry,
  isExpanded,
  onToggle,
  onClose,
}: {
  entry: AuditEntry;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <tr
        onClick={() => onToggle(entry.id)}
        className="border-b border-admin-border/50 hover:bg-admin-hover transition-colors cursor-pointer"
      >
        <td className="px-4 py-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-primary-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-admin-muted" />
          )}
        </td>
        <td className="px-4 py-3 text-xs font-mono text-admin-muted whitespace-nowrap">
          {new Date(entry.timestamp).toLocaleString()}
        </td>
        <td className="px-4 py-3">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${
              ACTION_COLORS[entry.action] ?? 'bg-admin-surface text-admin-muted'
            }`}
          >
            {entry.action}
          </span>
        </td>
        <td className="px-4 py-3">
          <p className="text-sm text-admin-text">{entry.entityType}</p>
          <p className="text-xs font-mono text-admin-muted">
            {entry.entityId.slice(0, 12)}...
          </p>
        </td>
        <td className="px-4 py-3">
          <p className="text-xs font-mono text-admin-muted">
            {entry.actor.userId.slice(0, 8)}...
          </p>
          <p className="text-xs text-admin-muted">{entry.actor.role}</p>
        </td>
        <td className="px-4 py-3">
          <ClassificationBadge level={entry.dataClassification} />
        </td>
        <td className="px-4 py-3 text-xs text-admin-muted max-w-[200px] truncate">
          {entry.reason ?? '—'}
        </td>
      </tr>
      {isExpanded && <DiffViewer entryId={entry.id} onClose={onClose} />}
    </>
  );
}
