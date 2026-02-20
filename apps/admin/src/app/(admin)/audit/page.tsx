'use client';

import { useState } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  Calendar,
} from 'lucide-react';
import { useAuditLog } from '@/lib/api/hooks';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-status-healthy/10 text-status-healthy',
  UPDATE: 'bg-blue-900/30 text-blue-300',
  DELETE: 'bg-status-down/10 text-status-down',
  VALIDATE: 'bg-primary-900/30 text-primary-400',
  REJECT: 'bg-status-degraded/10 text-status-degraded',
  EXPORT: 'bg-purple-900/30 text-purple-300',
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
];

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'VALIDATE', 'REJECT', 'EXPORT'];

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useAuditLog({
    page,
    limit: 25,
    entityId: search || undefined,
    entityType: entityType || undefined,
    action: action || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const entries = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 25 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-admin-heading">Audit Log</h1>
        <p className="text-sm text-admin-muted mt-1">
          Search and review all system actions by entity, user, action, and date
        </p>
      </div>

      {/* Search & Filter Toggle */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-input w-full pl-10"
            placeholder="Search by entity ID or user ID..."
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`admin-btn-secondary flex items-center gap-2 ${showFilters ? 'ring-2 ring-primary-600' : ''}`}
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="admin-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-admin-muted mb-1">
                Entity Type
              </label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="admin-input w-full"
              >
                <option value="">All Types</option>
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-admin-muted mb-1">
                Action
              </label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="admin-input w-full"
              >
                <option value="">All Actions</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
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
                onChange={(e) => setDateFrom(e.target.value)}
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
                onChange={(e) => setDateTo(e.target.value)}
                className="admin-input w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Log Table */}
      <div className="admin-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border">
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
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 bg-admin-surface rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : entries.length > 0 ? (
              entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-admin-border/50 hover:bg-admin-hover transition-colors"
                >
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
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-admin-muted"
                >
                  <ScrollText className="w-8 h-8 mx-auto mb-2 text-admin-border" />
                  No audit entries found
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {meta.total > meta.limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-admin-border">
            <span className="text-xs text-admin-muted">
              Page {meta.page} of {Math.ceil(meta.total / meta.limit)} ({meta.total} entries)
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="admin-btn-secondary text-xs disabled:opacity-50">Previous</button>
              <button onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(meta.total / meta.limit)} className="admin-btn-secondary text-xs disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClassificationBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    PUBLIC: 'bg-status-healthy/10 text-status-healthy',
    PARTNER: 'bg-blue-900/30 text-blue-300',
    RESTRICTED: 'bg-status-degraded/10 text-status-degraded',
    CONFIDENTIAL: 'bg-status-down/10 text-status-down',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${colors[level] ?? 'bg-admin-surface text-admin-muted'}`}>
      {level}
    </span>
  );
}
