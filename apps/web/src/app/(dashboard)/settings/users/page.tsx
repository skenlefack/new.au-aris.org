'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  useSettingsUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResetUserPassword,
  useAssignUserFunction,
  useRemoveUserFunction,
  useSettingsFunctions,
  type ManagedUser,
  type FunctionItem,
} from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { Pagination } from '@/components/ui/Pagination';
import {
  Users as UsersIcon,
  Plus,
  Search,
  Pencil,
  Trash2,
  KeyRound,
  Briefcase,
  Loader2,
  X,
  Check,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'CONTINENTAL_ADMIN', label: 'Continental Admin', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'REC_ADMIN', label: 'REC Admin', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'NATIONAL_ADMIN', label: 'National Admin', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { value: 'DATA_STEWARD', label: 'Data Steward', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  { value: 'WAHIS_FOCAL_POINT', label: 'WAHIS Focal', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'ANALYST', label: 'Analyst', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { value: 'FIELD_AGENT', label: 'Field Agent', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
];

function getRoleBadge(role: string) {
  const found = ROLES.find((r) => r.value === role);
  if (!found) return <span className="text-xs">{role}</span>;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', found.color)}>
      {found.label}
    </span>
  );
}

function generatePassword(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function getPrimaryFunction(user: ManagedUser): string {
  const primary = user.functions?.find((f) => f.isPrimary);
  if (primary) return primary.function.name?.en ?? primary.function.code;
  if (user.functions && user.functions.length > 0) return user.functions[0].function.name?.en ?? user.functions[0].function.code;
  return '-';
}

interface UserFormData {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  locale: string;
  password: string;
  isActive: boolean;
}

const EMPTY_USER_FORM: UserFormData = {
  email: '',
  firstName: '',
  lastName: '',
  role: 'FIELD_AGENT',
  tenantId: '',
  locale: 'en',
  password: '',
  isActive: true,
};

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const { isSuperAdmin, isContinentalAdmin, isRecAdmin, isNationalAdmin } = useSettingsAccess();
  const canManage = isSuperAdmin || isContinentalAdmin || isRecAdmin || isNationalAdmin;
  const canCreate = isSuperAdmin || isContinentalAdmin || isRecAdmin || isNationalAdmin;
  const canDelete = isSuperAdmin;
  const canResetPassword = isSuperAdmin || isContinentalAdmin;

  const { data, isLoading } = useSettingsUsers({
    search, role: roleFilter || undefined, status: statusFilter || undefined, page, limit,
  });

  const users: ManagedUser[] = data?.data ?? [];
  const meta = data?.meta ?? { total: users.length, page: 1, limit };

  // Load functions for assignment dropdown
  const { data: fnData } = useSettingsFunctions({ limit: 100 });
  const allFunctions: FunctionItem[] = fnData?.data ?? [];

  const createMut = useCreateUser();
  const updateMut = useUpdateUser();
  const deleteMut = useDeleteUser();
  const resetPwdMut = useResetUserPassword();
  const assignFnMut = useAssignUserFunction();
  const removeFnMut = useRemoveUserFunction();

  // View state
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormData>(EMPTY_USER_FORM);
  const [showPwd, setShowPwd] = useState(false);

  // Password reset dialog (keep as modal — quick action)
  const [resetPwdUser, setResetPwdUser] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);

  // Function assignment dialog (keep as modal — contextual list)
  const [assignFnUser, setAssignFnUser] = useState<ManagedUser | null>(null);
  const [selectedFnId, setSelectedFnId] = useState('');
  const [fnIsPrimary, setFnIsPrimary] = useState(false);

  const openCreate = useCallback(() => {
    const pwd = generatePassword();
    setForm({ ...EMPTY_USER_FORM, password: pwd });
    setEditingId(null);
    setView('form');
    setShowPwd(false);
  }, []);

  const openEdit = useCallback((u: ManagedUser) => {
    setForm({
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      tenantId: u.tenantId,
      locale: u.locale,
      password: '',
      isActive: u.isActive,
    });
    setEditingId(u.id);
    setView('form');
  }, []);

  const handleBack = useCallback(() => {
    setView('list');
    setEditingId(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (editingId) {
      await updateMut.mutateAsync({
        id: editingId,
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        locale: form.locale,
        isActive: form.isActive,
      });
    } else {
      await createMut.mutateAsync({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        tenantId: form.tenantId,
        locale: form.locale,
      });
    }
    setView('list');
    setEditingId(null);
  }, [form, editingId, createMut, updateMut]);

  const handleDelete = useCallback(async (id: string, email: string) => {
    if (!confirm(`Delete user "${email}"? This cannot be undone.`)) return;
    await deleteMut.mutateAsync(id);
  }, [deleteMut]);

  const handleResetPassword = useCallback(async () => {
    if (!resetPwdUser || !newPassword) return;
    await resetPwdMut.mutateAsync({ id: resetPwdUser.id, password: newPassword });
    setResetPwdUser(null);
    setNewPassword('');
  }, [resetPwdUser, newPassword, resetPwdMut]);

  const handleAssignFunction = useCallback(async () => {
    if (!assignFnUser || !selectedFnId) return;
    await assignFnMut.mutateAsync({
      userId: assignFnUser.id,
      functionId: selectedFnId,
      isPrimary: fnIsPrimary,
    });
    setAssignFnUser(null);
    setSelectedFnId('');
    setFnIsPrimary(false);
  }, [assignFnUser, selectedFnId, fnIsPrimary, assignFnMut]);

  const handleRemoveFunction = useCallback(async (userId: string, functionId: string) => {
    await removeFnMut.mutateAsync({ userId, functionId });
  }, [removeFnMut]);

  if (view === 'form') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <UsersIcon className="h-6 w-6 text-aris-primary-600" />
              {editingId ? 'Edit User' : 'New User'}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {editingId ? `Editing: ${form.firstName} ${form.lastName}` : 'Create a new user account'}
            </p>
          </div>
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        {/* Inline form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* First Name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="John"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="Doe"
              />
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="user@au-aris.org"
              />
            </div>

            {/* Role */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Language
              </label>
              <select
                value={form.locale}
                onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="pt">Português</option>
                <option value="ar">العربية</option>
              </select>
            </div>

            {/* Tenant ID (only on create) */}
            {!editingId && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tenant ID <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.tenantId}
                  onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  placeholder="UUID of tenant"
                />
              </div>
            )}

            {/* Active toggle (edit only) */}
            {editingId && (
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-aris-primary-600"
                  />
                  Active account
                </label>
              </div>
            )}
          </div>

          {/* Password (only on create) */}
          {!editingId && (
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 max-w-lg">
                <div className="relative flex-1">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-16 text-sm font-mono dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(form.password)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Copy"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Generate
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-700 pt-4">
            <button
              onClick={handleBack}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.email || !form.firstName || !form.lastName || createMut.isPending || updateMut.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
            >
              {(createMut.isPending || updateMut.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UsersIcon className="h-6 w-6 text-aris-primary-600" />
            Users Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage user accounts, roles, and function assignments
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-aris-primary-700"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
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

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">User</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Email</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Role</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Function</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tenant</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">MFA</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Last Login</th>
                  {canManage && (
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-aris-primary-100 text-xs font-bold text-aris-primary-700 dark:bg-aris-primary-900/30 dark:text-aris-primary-400">
                          {u.firstName?.[0]}{u.lastName?.[0]}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {u.firstName} {u.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">{getRoleBadge(u.role)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                      {getPrimaryFunction(u)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {u.tenant?.name ?? u.tenantId?.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      {u.mfaEnabled ? (
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ShieldAlert className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        u.isActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
                      )}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(u)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
                            title="Edit user"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setAssignFnUser(u)}
                            className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                            title="Manage functions"
                          >
                            <Briefcase className="h-4 w-4" />
                          </button>
                          {canResetPassword && (
                            <button
                              onClick={() => { setResetPwdUser(u); setNewPassword(generatePassword()); setShowNewPwd(false); }}
                              className="rounded p-1 text-gray-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20 dark:hover:text-amber-400"
                              title="Reset password"
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(u.id, u.email)}
                              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                              title="Delete user"
                              disabled={deleteMut.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={meta.page}
            total={meta.total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(v) => { setLimit(v); setPage(1); }}
          />
        </div>
      )}

      {/* ─── Reset Password Modal (essential — quick security action) ─── */}
      {resetPwdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-500" />
                Reset Password
              </h2>
              <button onClick={() => setResetPwdUser(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Reset password for <span className="font-medium text-gray-900 dark:text-white">{resetPwdUser.email}</span>
            </p>

            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-16 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(!showNewPwd)}
                    className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(newPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Copy"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setNewPassword(generatePassword())}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Generate
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setResetPwdUser(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={!newPassword || newPassword.length < 8 || resetPwdMut.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {resetPwdMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Assign Function Modal (essential — contextual list management) ─── */}
      {assignFnUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-500" />
                Functions: {assignFnUser.firstName} {assignFnUser.lastName}
              </h2>
              <button onClick={() => setAssignFnUser(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Current functions */}
            {assignFnUser.functions && assignFnUser.functions.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Current Assignments</p>
                <div className="space-y-1.5">
                  {assignFnUser.functions.map((uf) => (
                    <div key={uf.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900 dark:text-white">{uf.function.name?.en ?? uf.function.code}</span>
                        {uf.isPrimary && (
                          <span className="rounded-full bg-aris-primary-100 px-1.5 py-0.5 text-[9px] font-bold text-aris-primary-700 dark:bg-aris-primary-900/30 dark:text-aris-primary-400">
                            PRIMARY
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">{uf.function.level}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveFunction(assignFnUser.id, uf.function.id)}
                        className="text-gray-300 hover:text-red-500"
                        title="Remove"
                        disabled={removeFnMut.isPending}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add function */}
            <div className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Add Function</p>
              <select
                value={selectedFnId}
                onChange={(e) => setSelectedFnId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select a function...</option>
                {allFunctions
                  .filter((fn) => !assignFnUser.functions?.some((uf) => uf.function.id === fn.id))
                  .map((fn) => (
                    <option key={fn.id} value={fn.id}>
                      [{fn.level}] {fn.name?.en ?? fn.code} ({fn.category ?? '-'})
                    </option>
                  ))
                }
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={fnIsPrimary}
                  onChange={(e) => setFnIsPrimary(e.target.checked)}
                  className="rounded"
                />
                Set as primary function
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setAssignFnUser(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Close
              </button>
              <button
                onClick={handleAssignFunction}
                disabled={!selectedFnId || assignFnMut.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {assignFnMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
