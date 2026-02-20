'use client';

import { useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Globe,
  MapPin,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useTenants, useCreateTenant, useUpdateTenant } from '@/lib/api/hooks';
import type { Tenant } from '@/lib/api/hooks';

export default function TenantsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useTenants({
    page,
    limit: 20,
    search: search || undefined,
    level: levelFilter || undefined,
  });
  const createMutation = useCreateTenant();
  const updateMutation = useUpdateTenant();

  const tenants = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 20 };

  const handleToggleActive = (tenant: Tenant) => {
    updateMutation.mutate({ id: tenant.id, isActive: !tenant.isActive });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-admin-heading">
            Tenant Management
          </h1>
          <p className="text-sm text-admin-muted mt-1">
            Manage AU-IBAR, RECs, and Member State tenants
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="admin-btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Tenant
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <CreateTenantForm
          onSubmit={(data) => {
            createMutation.mutate(data, {
              onSuccess: () => setShowCreate(false),
            });
          }}
          loading={createMutation.isPending}
          onCancel={() => setShowCreate(false)}
        />
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
            placeholder="Search tenants by name or code..."
          />
        </div>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="admin-input"
        >
          <option value="">All Levels</option>
          <option value="CONTINENTAL">Continental</option>
          <option value="REC">REC</option>
          <option value="MEMBER_STATE">Member State</option>
        </select>
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border">
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Tenant
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Level
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Code
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Country
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Status
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Created
              </th>
              <th className="text-right text-xs font-medium text-admin-muted px-4 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-admin-border/50">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-4 bg-admin-surface rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : tenants.length > 0 ? (
              tenants.map((tenant) => (
                <tr
                  key={tenant.id}
                  className="border-b border-admin-border/50 hover:bg-admin-hover transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <LevelIcon level={tenant.level} />
                      <span className="text-sm font-medium text-admin-text">
                        {tenant.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <LevelBadge level={tenant.level} />
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-admin-muted">
                    {tenant.code}
                  </td>
                  <td className="px-4 py-3 text-sm text-admin-muted">
                    {tenant.countryCode ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        tenant.isActive
                          ? 'bg-status-healthy/10 text-status-healthy'
                          : 'bg-status-down/10 text-status-down'
                      }`}
                    >
                      {tenant.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-admin-muted">
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleActive(tenant)}
                      className="p-1.5 rounded hover:bg-admin-surface transition-colors"
                      title={tenant.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {tenant.isActive ? (
                        <ToggleRight className="w-5 h-5 text-status-healthy" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-admin-muted" />
                      )}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-admin-muted"
                >
                  No tenants found
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {meta.total > meta.limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-admin-border">
            <span className="text-xs text-admin-muted">
              Page {meta.page} of {Math.ceil(meta.total / meta.limit)} ({meta.total} total)
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
                disabled={page >= Math.ceil(meta.total / meta.limit)}
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

function LevelIcon({ level }: { level: string }) {
  switch (level) {
    case 'CONTINENTAL':
      return <Globe className="w-4 h-4 text-primary-400" />;
    case 'REC':
      return <Building2 className="w-4 h-4 text-secondary-200" />;
    default:
      return <MapPin className="w-4 h-4 text-accent-200" />;
  }
}

function LevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    CONTINENTAL: 'bg-primary-900/30 text-primary-400',
    REC: 'bg-secondary-900/30 text-secondary-200',
    MEMBER_STATE: 'bg-accent-900/30 text-accent-200',
  };
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded ${colors[level] ?? 'bg-admin-surface text-admin-muted'}`}
    >
      {level}
    </span>
  );
}

function CreateTenantForm({
  onSubmit,
  loading,
  onCancel,
}: {
  onSubmit: (data: Partial<Tenant>) => void;
  loading: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [level, setLevel] = useState<string>('MEMBER_STATE');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, code, level: level as Tenant['level'] });
  };

  return (
    <div className="admin-card p-6">
      <h3 className="text-lg font-semibold text-admin-heading mb-4">
        Create New Tenant
      </h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-admin-text mb-1">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="admin-input w-full"
            placeholder="Republic of Kenya"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-admin-text mb-1">
            Code
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="admin-input w-full"
            placeholder="KE"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-admin-text mb-1">
            Level
          </label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="admin-input w-full"
          >
            <option value="MEMBER_STATE">Member State</option>
            <option value="REC">REC</option>
            <option value="CONTINENTAL">Continental</option>
          </select>
        </div>
        <div className="md:col-span-3 flex gap-3">
          <button type="submit" disabled={loading} className="admin-btn-primary">
            {loading ? 'Creating...' : 'Create Tenant'}
          </button>
          <button type="button" onClick={onCancel} className="admin-btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
