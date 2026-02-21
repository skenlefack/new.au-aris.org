'use client';

import { useState } from 'react';
import {
  FileText,
  Search,
  Plus,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { useDataContracts, useCreateDataContract } from '@/lib/api/hooks';

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  ACTIVE: {
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    color: 'bg-status-healthy/10 text-status-healthy',
  },
  DRAFT: {
    icon: <Clock className="w-3.5 h-3.5" />,
    color: 'bg-status-degraded/10 text-status-degraded',
  },
  EXPIRED: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    color: 'bg-status-down/10 text-status-down',
  },
};

const DOMAINS = [
  'health',
  'livestock',
  'fisheries',
  'wildlife',
  'apiculture',
  'trade',
  'governance',
  'climate',
];

export default function DataContractsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useDataContracts({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter || undefined,
  });
  const createMutation = useCreateDataContract();

  const contracts = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 20 };

  // Compliance overview
  const activeContracts = contracts.filter((c) => c.status === 'ACTIVE');
  const avgCompliance = activeContracts.length > 0
    ? Math.round(
        activeContracts.reduce((s, c) => s + c.complianceRate, 0) /
          activeContracts.length,
      )
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-admin-heading">
            Data Contracts
          </h1>
          <p className="text-sm text-admin-muted mt-1">
            Manage data delivery agreements with compliance tracking
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="admin-btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Contract
        </button>
      </div>

      {/* Compliance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="admin-card p-4 flex items-center gap-4">
          <div className="p-2 rounded-lg bg-primary-900/30">
            <FileText className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <p className="text-kpi-sm text-admin-heading">{contracts.length}</p>
            <p className="text-xs text-admin-muted">Total Contracts</p>
          </div>
        </div>
        <div className="admin-card p-4 flex items-center gap-4">
          <div className="p-2 rounded-lg bg-status-healthy/10">
            <CheckCircle className="w-5 h-5 text-status-healthy" />
          </div>
          <div>
            <p className="text-kpi-sm text-admin-heading">{activeContracts.length}</p>
            <p className="text-xs text-admin-muted">Active Contracts</p>
          </div>
        </div>
        <div className="admin-card p-4 flex items-center gap-4">
          <div className={`p-2 rounded-lg ${avgCompliance >= 80 ? 'bg-status-healthy/10' : 'bg-status-degraded/10'}`}>
            <CheckCircle className={`w-5 h-5 ${avgCompliance >= 80 ? 'text-status-healthy' : 'text-status-degraded'}`} />
          </div>
          <div>
            <p className="text-kpi-sm text-admin-heading">{avgCompliance}%</p>
            <p className="text-xs text-admin-muted">Avg Compliance</p>
          </div>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="admin-card p-6">
          <h3 className="text-lg font-semibold text-admin-heading mb-4">
            Create Data Contract
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createMutation.mutate(
                {
                  name: fd.get('name') as string,
                  domain: fd.get('domain') as string,
                  entityType: fd.get('entityType') as string,
                  frequency: fd.get('frequency') as string,
                  slaDeadlineDays: parseInt(fd.get('sla') as string, 10),
                } as never,
                { onSuccess: () => setShowCreate(false) },
              );
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <input name="name" className="admin-input" placeholder="Contract name" required />
            <select name="domain" className="admin-input" required>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <input name="entityType" className="admin-input" placeholder="Entity type" required />
            <select name="frequency" className="admin-input">
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUALLY">Annually</option>
            </select>
            <input name="sla" type="number" className="admin-input" placeholder="SLA days" defaultValue="30" />
            <div className="flex gap-3 items-end">
              <button type="submit" disabled={createMutation.isPending} className="admin-btn-primary">
                Create
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="admin-btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-input w-full pl-10"
            placeholder="Search contracts..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="admin-input"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border">
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">Contract</th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">Domain</th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">Frequency</th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">SLA</th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">Compliance</th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-admin-border/50">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 bg-admin-surface rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : contracts.length > 0 ? (
              contracts.map((c) => (
                <tr key={c.id} className="border-b border-admin-border/50 hover:bg-admin-hover transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-admin-text">{c.name}</p>
                    <p className="text-xs text-admin-muted">{c.entityType}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-admin-muted capitalize">{c.domain}</td>
                  <td className="px-4 py-3 text-xs text-admin-muted">{c.frequency}</td>
                  <td className="px-4 py-3 text-xs text-admin-muted">{c.slaDeadlineDays}d</td>
                  <td className="px-4 py-3">
                    <ComplianceBar rate={c.complianceRate} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-admin-muted">
                  No data contracts found
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {meta.total > meta.limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-admin-border">
            <span className="text-xs text-admin-muted">
              Page {meta.page} of {Math.ceil(meta.total / meta.limit)}
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

function ComplianceBar({ rate }: { rate: number }) {
  const color =
    rate >= 80 ? 'bg-status-healthy' : rate >= 50 ? 'bg-status-degraded' : 'bg-status-down';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-admin-surface rounded-full overflow-hidden max-w-[80px]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <span className="text-xs font-mono text-admin-muted">{rate}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG['DRAFT'];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${config.color}`}>
      {config.icon}
      {status}
    </span>
  );
}
