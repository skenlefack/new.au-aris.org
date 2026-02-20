'use client';

import { useState } from 'react';
import {
  Users,
  Search,
  Shield,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useUsers, useUpdateUser } from '@/lib/api/hooks';
import type { User } from '@/lib/api/hooks';

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-danger-500/10 text-danger-500',
  CONTINENTAL_ADMIN: 'bg-primary-900/30 text-primary-400',
  REC_ADMIN: 'bg-secondary-900/30 text-secondary-200',
  NATIONAL_ADMIN: 'bg-accent-900/30 text-accent-200',
  DATA_STEWARD: 'bg-blue-900/30 text-blue-300',
  WAHIS_FOCAL_POINT: 'bg-purple-900/30 text-purple-300',
  ANALYST: 'bg-gray-800 text-gray-300',
  FIELD_AGENT: 'bg-emerald-900/30 text-emerald-300',
};

const ALL_ROLES = [
  'SUPER_ADMIN',
  'CONTINENTAL_ADMIN',
  'REC_ADMIN',
  'NATIONAL_ADMIN',
  'DATA_STEWARD',
  'WAHIS_FOCAL_POINT',
  'ANALYST',
  'FIELD_AGENT',
];

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data, isLoading } = useUsers({
    page,
    limit: 20,
    search: search || undefined,
    role: roleFilter || undefined,
  });
  const updateMutation = useUpdateUser();

  const users = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 20 };

  const handleRoleChange = (user: User, newRole: string) => {
    updateMutation.mutate({ id: user.id, role: newRole } as never);
    setEditingUser(null);
  };

  const handleToggleActive = (user: User) => {
    updateMutation.mutate({ id: user.id, isActive: !user.isActive } as never);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-admin-heading">
          User Management
        </h1>
        <p className="text-sm text-admin-muted mt-1">
          Manage users across all tenants — role assignment and account status
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-input w-full pl-10"
            placeholder="Search by email, name..."
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="admin-input"
        >
          <option value="">All Roles</option>
          {ALL_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border">
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                User
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Role
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Tenant
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                MFA
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Last Login
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Status
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
            ) : users.length > 0 ? (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-admin-border/50 hover:bg-admin-hover transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-admin-text">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-admin-muted">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {editingUser?.id === user.id ? (
                      <select
                        defaultValue={user.role}
                        onChange={(e) => handleRoleChange(user, e.target.value)}
                        onBlur={() => setEditingUser(null)}
                        className="admin-input text-xs"
                        autoFocus
                      >
                        {ALL_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingUser(user)}
                        className={`text-xs font-medium px-2 py-0.5 rounded cursor-pointer hover:opacity-80 ${
                          ROLE_COLORS[user.role] ?? 'bg-admin-surface text-admin-muted'
                        }`}
                        title="Click to change role"
                      >
                        {user.role}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-admin-muted">
                    {user.tenantId.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    {user.mfaEnabled ? (
                      <Shield className="w-4 h-4 text-status-healthy" />
                    ) : (
                      <span className="text-xs text-admin-muted">Off</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-admin-muted">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        user.isActive
                          ? 'bg-status-healthy/10 text-status-healthy'
                          : 'bg-status-down/10 text-status-down'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleActive(user)}
                      className="p-1.5 rounded hover:bg-admin-surface transition-colors"
                      title={user.isActive ? 'Deactivate user' : 'Activate user'}
                    >
                      {user.isActive ? (
                        <UserX className="w-4 h-4 text-admin-muted hover:text-danger-500" />
                      ) : (
                        <UserCheck className="w-4 h-4 text-admin-muted hover:text-status-healthy" />
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
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>

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
