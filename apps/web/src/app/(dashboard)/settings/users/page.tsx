'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Search,
  Pencil,
  UserX,
  UserCheck as UserCheckIcon,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  UserCheck,
  Mail,
  X,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DomainBadge } from '@/components/domain/DomainBadge';
import {
  useSettingsUsers,
  useCreateUser,
  useUpdateUser,
  type ManagedUser,
} from '@/lib/api/settings-hooks';
import { useDomainStore } from '@/lib/stores/domain-store';
import { useAuthStore } from '@/lib/stores/auth-store';

/* ---- Types ---- */

type UserRole =
  | 'SUPER_ADMIN'
  | 'CONTINENTAL_ADMIN'
  | 'REC_ADMIN'
  | 'NATIONAL_ADMIN'
  | 'DATA_STEWARD'
  | 'WAHIS_FOCAL_POINT'
  | 'ANALYST'
  | 'FIELD_AGENT';

/* ---- Constants ---- */

const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  CONTINENTAL_ADMIN: { label: 'Continental Admin', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  REC_ADMIN: { label: 'REC Admin', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  NATIONAL_ADMIN: { label: 'National Admin', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  DATA_STEWARD: { label: 'Data Steward', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  WAHIS_FOCAL_POINT: { label: 'WAHIS Focal Point', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  ANALYST: { label: 'Analyst', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  FIELD_AGENT: { label: 'Field Agent', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
};

const ALL_ROLES = Object.keys(ROLE_CONFIG) as UserRole[];
const ITEMS_PER_PAGE = 20;

/* ---- Helpers ---- */

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || '?')[0]}${(lastName || '?')[0]}`.toUpperCase();
}

/* ---- Add/Edit User Dialog ---- */

interface UserFormState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
  isActive: boolean;
  domainIds: string[];
}

const EMPTY_FORM: UserFormState = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: 'FIELD_AGENT',
  tenantId: '',
  isActive: true,
  domainIds: [],
};

function UserDialog({
  open,
  onClose,
  editingUser,
}: {
  open: boolean;
  onClose: () => void;
  editingUser: ManagedUser | null;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const allDomains = useDomainStore((s) => s.allDomains);
  const createMut = useCreateUser();
  const updateMut = useUpdateUser();
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      if (editingUser) {
        setForm({
          email: editingUser.email,
          password: '',
          firstName: editingUser.firstName,
          lastName: editingUser.lastName,
          role: editingUser.role as UserRole,
          tenantId: editingUser.tenantId,
          isActive: editingUser.isActive,
          domainIds: editingUser.domains?.map((d) => d.id) ?? [],
        });
      } else {
        setForm({
          ...EMPTY_FORM,
          tenantId: currentUser?.tenantId ?? '',
        });
      }
      setShowPassword(false);
    }
  }, [open, editingUser, currentUser?.tenantId]);

  const isPending = createMut.isPending || updateMut.isPending;
  const error = createMut.error || updateMut.error;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const body: Record<string, unknown> = {
          id: editingUser.id,
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
          isActive: form.isActive,
          domainIds: form.domainIds,
        };
        if (form.email !== editingUser.email) body.email = form.email;
        if (form.password) body.password = form.password;
        await updateMut.mutateAsync(body as any);
      } else {
        await createMut.mutateAsync({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
          tenantId: form.tenantId,
          domainIds: form.domainIds.length > 0 ? form.domainIds : undefined,
        });
      }
      onClose();
    } catch {
      // error is handled via mutation state
    }
  }, [form, editingUser, createMut, updateMut, onClose]);

  const toggleDomain = useCallback((domainId: string) => {
    setForm((prev) => ({
      ...prev,
      domainIds: prev.domainIds.includes(domainId)
        ? prev.domainIds.filter((id) => id !== domainId)
        : [...prev.domainIds, domainId],
    }));
  }, []);

  const selectAllDomains = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      domainIds: allDomains.map((d) => d.id),
    }));
  }, [allDomains]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingUser ? 'Edit User' : 'Add New User'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {(error as any)?.message ?? 'An error occurred'}
            </div>
          )}

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">First Name</label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Last Name</label>
              <input
                type="text"
                required
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {editingUser ? 'New Password (leave empty to keep current)' : 'Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required={!editingUser}
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={editingUser ? 'Leave empty to keep current' : 'Minimum 8 characters'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>{ROLE_CONFIG[role].label}</option>
              ))}
            </select>
          </div>

          {/* Domains */}
          {allDomains.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Domains</label>
                <button type="button" onClick={selectAllDomains} className="text-[10px] text-blue-600 hover:text-blue-700">
                  Select All
                </button>
              </div>
              <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                {allDomains.map((d) => {
                  const selected = form.domainIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDomain(d.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all border',
                        selected
                          ? 'border-transparent shadow-sm'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300',
                      )}
                      style={selected ? {
                        backgroundColor: `${d.color}20`,
                        color: d.color,
                        borderColor: `${d.color}40`,
                      } : undefined}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: selected ? d.color : '#d1d5db' }}
                      />
                      {d.name?.en || d.code}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active toggle (edit only) */}
          {editingUser && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Status</label>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  form.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow',
                    form.isActive ? 'translate-x-6' : 'translate-x-1',
                  )}
                />
              </button>
              <span className="text-xs text-gray-500">{form.isActive ? 'Active' : 'Inactive'}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingUser ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---- Main Page ---- */

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);

  const { data, isLoading, error } = useSettingsUsers({
    page,
    limit: ITEMS_PER_PAGE,
    search: search || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
  });

  const users = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: ITEMS_PER_PAGE };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  const activeCount = useMemo(() => users.filter((u) => u.isActive).length, [users]);

  const handleEdit = useCallback((user: ManagedUser) => {
    setEditingUser(user);
    setDialogOpen(true);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingUser(null);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingUser(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Settings
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-aris-primary-600" />
            User Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage user accounts, roles and domain assignments
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{meta.total}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Users</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active (this page)</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {users.filter((u) => !u.lastLoginAt).length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Never Logged In</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All Roles</option>
          {ALL_ROLES.map((role) => (
            <option key={role} value={role}>{ROLE_CONFIG[role].label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Failed to load users: {(error as any)?.message ?? 'Unknown error'}
          </p>
        </div>
      )}

      {/* Users Table */}
      {!isLoading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Email</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Role</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Domains</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tenant</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Last Login</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map((user) => {
                  const roleKey = user.role as UserRole;
                  const roleConfig = ROLE_CONFIG[roleKey] ?? { label: user.role, color: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={user.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            {getInitials(user.firstName, user.lastName)}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {user.firstName} {user.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap', roleConfig.color)}>
                          {roleConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {user.domains && user.domains.length > 0 ? (
                            <>
                              {user.domains.slice(0, 3).map((d) => (
                                <DomainBadge key={d.code} code={d.code} name={d.name} color={d.color} size="xs" />
                              ))}
                              {user.domains.length > 3 && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 self-center">
                                  +{user.domains.length - 3}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">--</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {user.tenant?.name ?? '--'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(user.lastLoginAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                            user.isActive
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
                          )}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(user)}
                            className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                            title="Edit user"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {users.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                        <p className="font-medium text-gray-900 dark:text-white">No users found</p>
                        <p className="text-xs">Try adjusting your search or filter criteria.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta.total > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing{' '}
                <span className="font-medium text-gray-900 dark:text-white">{(page - 1) * ITEMS_PER_PAGE + 1}</span>
                {' '}to{' '}
                <span className="font-medium text-gray-900 dark:text-white">{Math.min(page * ITEMS_PER_PAGE, meta.total)}</span>
                {' '}of{' '}
                <span className="font-medium text-gray-900 dark:text-white">{meta.total}</span>
                {' '}users
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) {
                    p = i + 1;
                  } else if (page <= 4) {
                    p = i + 1;
                  } else if (page >= totalPages - 3) {
                    p = totalPages - 6 + i;
                  } else {
                    p = page - 3 + i;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        page === p
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <UserDialog open={dialogOpen} onClose={handleCloseDialog} editingUser={editingUser} />
    </div>
  );
}
