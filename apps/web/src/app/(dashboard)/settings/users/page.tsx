'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Mail,
  Phone,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Globe,
  Save,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Briefcase,
  Lock,
  X,
  Clock,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DomainBadge } from '@/components/domain/DomainBadge';
import {
  useSettingsUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useToggleUserActive,
  useSettingsRoles,
  useSettingsFunctions,
  useLockedAccounts,
  useUnlockAccount,
  type ManagedUser,
  type RoleItem,
  type FunctionItem,
} from '@/lib/api/settings-hooks';
import { useDomainStore } from '@/lib/stores/domain-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useTenantStore, type TenantNode } from '@/lib/stores/tenant-store';
import * as LucideIcons from 'lucide-react';

/* ================================================================ */
/*  Types & Constants                                                */
/* ================================================================ */

type UserRole =
  | 'SUPER_ADMIN'
  | 'CONTINENTAL_ADMIN'
  | 'REC_ADMIN'
  | 'NATIONAL_ADMIN'
  | 'DATA_STEWARD'
  | 'WAHIS_FOCAL_POINT'
  | 'ANALYST'
  | 'FIELD_AGENT';

const ROLE_PRIORITY: Record<string, number> = {
  SUPER_ADMIN: 1,
  CONTINENTAL_ADMIN: 2,
  REC_ADMIN: 3,
  NATIONAL_ADMIN: 4,
  DATA_STEWARD: 5,
  WAHIS_FOCAL_POINT: 6,
  ANALYST: 7,
  FIELD_AGENT: 8,
};

const ITEMS_PER_PAGE = 20;

type PageView = 'list' | 'form';

/* ================================================================ */
/*  Helpers                                                          */
/* ================================================================ */

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

function generatePassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += special[Math.floor(Math.random() * special.length)];
  for (let i = pwd.length; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

/** Given all selected roles (function-derived + direct), determine the primary system role */
function computePrimaryRole(allRoles: RoleItem[], selectedRoleIds: Set<string>): UserRole {
  let best: UserRole = 'FIELD_AGENT';
  let bestPrio = 999;
  for (const role of allRoles) {
    if (!selectedRoleIds.has(role.id)) continue;
    const prio = ROLE_PRIORITY[role.code] ?? 999;
    if (prio < bestPrio) {
      bestPrio = prio;
      best = role.code as UserRole;
    }
  }
  return best;
}

/* ================================================================ */
/*  Form State                                                       */
/* ================================================================ */

interface UserFormState {
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  isActive: boolean;
  isTemporary: boolean;
  accountExpiresAt: string;
  domainIds: string[];
  functionIds: string[];
  directRoleIds: string[];
}

const EMPTY_FORM: UserFormState = {
  email: '',
  phone: '',
  password: '',
  firstName: '',
  lastName: '',
  tenantId: '',
  isActive: true,
  isTemporary: false,
  accountExpiresAt: '',
  domainIds: [],
  functionIds: [],
  directRoleIds: [],
};

/* ================================================================ */
/*  User Form (inline page, not modal)                               */
/* ================================================================ */

function UserForm({
  editingUser,
  onBack,
}: {
  editingUser: ManagedUser | null;
  onBack: () => void;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const allDomains = useDomainStore((s) => s.allDomains);
  const locale = useLocaleStore((s) => s.locale);
  const tenantTree = useTenantStore((s) => s.tenantTree);

  // Determine if current user can assign to other tenants
  const canAssignTenant = currentUser?.role === 'SUPER_ADMIN'
    || currentUser?.role === 'CONTINENTAL_ADMIN'
    || currentUser?.role === 'REC_ADMIN';

  // Build flat list of assignable tenants — use placeholder if API tree has no children
  const assignableTenants = useMemo(() => {
    if (!canAssignTenant) return [];
    const result: { id: string; name: string; code: string; level: string; recName?: string }[] = [];

    const collectNodes = (nodes: TenantNode[], parentRecName?: string) => {
      for (const node of nodes) {
        // REC_ADMIN can only assign within their own REC subtree
        if (currentUser?.role === 'REC_ADMIN' && node.level === 'CONTINENTAL') continue;
        if (currentUser?.role === 'REC_ADMIN' && node.level === 'REC' && node.id !== currentUser?.tenantId) continue;

        result.push({
          id: node.id,
          name: node.name,
          code: node.code,
          level: node.level,
          recName: parentRecName,
        });

        if (node.children) {
          const recName = node.level === 'REC' ? node.name : parentRecName;
          if (currentUser?.role === 'REC_ADMIN' && node.level === 'REC' && node.id !== currentUser?.tenantId) continue;
          collectNodes(node.children, recName);
        }
      }
    };
    collectNodes(tenantTree);
    return result;
  }, [canAssignTenant, tenantTree, currentUser]);

  // Tenant search state
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);

  const filteredTenants = useMemo(() => {
    if (!tenantSearch.trim()) return assignableTenants;
    const q = tenantSearch.toLowerCase();
    return assignableTenants.filter(
      (t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) || (t.recName ?? '').toLowerCase().includes(q),
    );
  }, [assignableTenants, tenantSearch]);

  const createMut = useCreateUser();
  const updateMut = useUpdateUser();
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load all roles and functions from the database
  const { data: rolesData } = useSettingsRoles({ limit: 100 });
  const allRoles: RoleItem[] = useMemo(() => (rolesData?.data ?? []).filter((r) => r.isActive), [rolesData]);

  const { data: functionsData } = useSettingsFunctions({ limit: 100, status: 'active' });
  const allFunctions: FunctionItem[] = useMemo(() => (functionsData as any)?.data ?? [], [functionsData]);

  const [form, setForm] = useState<UserFormState>(() => {
    if (editingUser) {
      // Extract function IDs from user's functions
      const functionIds = editingUser.functions?.map((uf) => uf.function?.id).filter(Boolean) as string[] ?? [];
      // Extract direct role IDs (source='direct') from roleAssignments
      const directRoleIds = editingUser.roleAssignments
        ?.filter((ra) => ra.source === 'direct')
        .map((ra) => ra.role.id) ?? [];

      const hasExpiry = !!editingUser.accountExpiresAt;
      return {
        email: editingUser.email,
        phone: editingUser.phone ?? '',
        password: '',
        firstName: editingUser.firstName,
        lastName: editingUser.lastName,
        tenantId: editingUser.tenantId,
        isActive: editingUser.isActive,
        isTemporary: hasExpiry,
        accountExpiresAt: hasExpiry ? editingUser.accountExpiresAt!.slice(0, 16) : '',
        domainIds: editingUser.domains?.map((d) => d.id) ?? [],
        functionIds,
        directRoleIds,
      };
    }
    return { ...EMPTY_FORM, tenantId: currentUser?.tenantId ?? '' };
  });

  const selectedTenantLabel = useMemo(() => {
    const t = assignableTenants.find((x) => x.id === form.tenantId);
    if (!t) return '';
    const suffix = t.level === 'CONTINENTAL' ? '(Continental)' : t.level === 'REC' ? '(REC)' : t.recName ? `(${t.recName})` : '';
    return `${t.name} ${suffix}`.trim();
  }, [assignableTenants, form.tenantId]);

  // Compute derived role IDs from selected functions
  const derivedRoleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const fnId of form.functionIds) {
      const fn = allFunctions.find((f) => f.id === fnId) as any;
      if (fn?.roles) {
        for (const fr of fn.roles) {
          const roleId = fr.role?.id ?? fr.roleId;
          if (roleId) ids.add(roleId);
        }
      }
    }
    return ids;
  }, [form.functionIds, allFunctions]);

  // All effective role IDs = function-derived + direct
  const allSelectedRoleIds = useMemo(() => {
    const all = new Set(derivedRoleIds);
    for (const id of form.directRoleIds) all.add(id);
    return all;
  }, [derivedRoleIds, form.directRoleIds]);

  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = `${form.firstName} ${form.lastName}`.trim();

    // Compute the primary system role from all effective roles
    const primaryRole = computePrimaryRole(allRoles, allSelectedRoleIds);

    try {
      if (editingUser) {
        const body: Record<string, unknown> = {
          id: editingUser.id,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || null,
          role: primaryRole,
          isActive: form.isActive,
          accountExpiresAt: form.isTemporary && form.accountExpiresAt
            ? new Date(form.accountExpiresAt).toISOString()
            : null,
          domainIds: form.domainIds,
          functionIds: form.functionIds,
          directRoleIds: form.directRoleIds,
        };
        if (form.email !== editingUser.email) body.email = form.email;
        if (form.password) body.password = form.password;
        // Send tenantId if organization changed
        if (form.tenantId && form.tenantId !== editingUser.tenantId) {
          body.tenantId = form.tenantId;
        }
        await updateMut.mutateAsync(body as any);
        toast.success('User updated', {
          description: `${fullName} has been updated successfully.`,
        });
      } else {
        await createMut.mutateAsync({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          role: primaryRole,
          tenantId: form.tenantId,
          accountExpiresAt: form.isTemporary && form.accountExpiresAt
            ? new Date(form.accountExpiresAt).toISOString()
            : undefined,
          domainIds: form.domainIds.length > 0 ? form.domainIds : undefined,
          functionIds: form.functionIds.length > 0 ? form.functionIds : undefined,
          directRoleIds: form.directRoleIds.length > 0 ? form.directRoleIds : undefined,
        });
        toast.success('User created', {
          description: `${fullName} (${form.email}) has been created successfully.`,
        });
      }
      setSaved(true);
      setTimeout(() => onBack(), 1000);
    } catch (err: any) {
      toast.error(editingUser ? 'Failed to update user' : 'Failed to create user', {
        description: err?.message ?? 'An unexpected error occurred. Please try again.',
      });
    }
  }, [form, editingUser, createMut, updateMut, onBack, allRoles, allSelectedRoleIds]);

  const handleGeneratePassword = useCallback(() => {
    const pwd = generatePassword(12);
    setForm((p) => ({ ...p, password: pwd }));
    setShowPassword(true);
  }, []);

  const toggleFunction = useCallback((fnId: string) => {
    setForm((prev) => ({
      ...prev,
      functionIds: prev.functionIds.includes(fnId)
        ? prev.functionIds.filter((id) => id !== fnId)
        : [...prev.functionIds, fnId],
    }));
  }, []);

  const toggleDirectRole = useCallback((roleId: string) => {
    setForm((prev) => ({
      ...prev,
      directRoleIds: prev.directRoleIds.includes(roleId)
        ? prev.directRoleIds.filter((id) => id !== roleId)
        : [...prev.directRoleIds, roleId],
    }));
  }, []);

  const toggleDomain = useCallback((domainId: string) => {
    setForm((prev) => ({
      ...prev,
      domainIds: prev.domainIds.includes(domainId)
        ? prev.domainIds.filter((id) => id !== domainId)
        : [...prev.domainIds, domainId],
    }));
  }, []);

  const selectAllDomains = useCallback(() => {
    setForm((prev) => ({ ...prev, domainIds: allDomains.map((d) => d.id) }));
  }, [allDomains]);

  const clearAllDomains = useCallback(() => {
    setForm((prev) => ({ ...prev, domainIds: [] }));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with back */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Users
        </button>
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl shadow-sm"
            style={{ backgroundColor: editingUser ? '#3b82f620' : '#10b98120' }}
          >
            {editingUser
              ? <Pencil className="h-5 w-5 text-blue-600" />
              : <UserPlus className="h-5 w-5 text-emerald-600" />
            }
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {editingUser ? `Edit ${editingUser.firstName} ${editingUser.lastName}` : 'Create New User'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {editingUser ? 'Update account details, functions, roles and domain assignments' : 'Set up a new user account with functions, roles and domain access'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ---- Section: Identity ---- */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
          <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Account Information</h2>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Name, email, phone and password</p>
          </div>
          <div className="px-6 py-5 space-y-5">
            {/* Name row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">First Name</label>
                <input
                  type="text"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="e.g. Amina"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Last Name</label>
                <input
                  type="text"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="e.g. Mwangi"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Email + Phone row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="e.g. user@au-aris.org"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/50 pl-9 pr-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">WhatsApp Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="e.g. +254 712 345 678"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/50 pl-9 pr-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Password + Generate */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {editingUser ? 'New Password' : 'Password'}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUser}
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder={editingUser ? 'Leave empty to keep current password' : 'Minimum 8 characters'}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 pr-11 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3.5 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Generate
                </button>
              </div>
              {!editingUser && (
                <p className="mt-1 text-[11px] text-gray-400">Must be at least 8 characters</p>
              )}
            </div>

            {/* Active toggle (edit only) */}
            {editingUser && (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Account Status</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {form.isActive ? 'User can log in and access the system' : 'User is blocked from logging in'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                    form.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                      form.isActive ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
              </div>
            )}

            {/* Temporary account toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Temporary Account</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {form.isTemporary
                      ? 'Account will expire on the specified date — login will be blocked after expiry'
                      : 'Permanent account with no expiry date'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, isTemporary: !p.isTemporary, accountExpiresAt: p.isTemporary ? '' : p.accountExpiresAt }))}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                    form.isTemporary ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                      form.isTemporary ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
              </div>

              {form.isTemporary && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10 px-4 py-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    <CalendarDays className="inline h-3.5 w-3.5 mr-1 text-amber-600" />
                    Access End Date
                  </label>
                  <input
                    type="datetime-local"
                    required={form.isTemporary}
                    value={form.accountExpiresAt}
                    onChange={(e) => setForm((p) => ({ ...p, accountExpiresAt: e.target.value }))}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 dark:border-amber-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
                  />
                  <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                    After this date, the user will be unable to log in until the date is extended by an administrator.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---- Section: Organisation / Tenant ---- */}
        {canAssignTenant && assignableTenants.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Organisation</h2>
              </div>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Select the organisation (AU-IBAR, REC or Member State) this user belongs to
              </p>
            </div>
            <div className="px-6 py-5">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Country / Organisation</label>
              <div className="relative">
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={tenantDropdownOpen ? tenantSearch : selectedTenantLabel}
                    onChange={(e) => { setTenantSearch(e.target.value); if (!tenantDropdownOpen) setTenantDropdownOpen(true); }}
                    onFocus={() => { setTenantDropdownOpen(true); setTenantSearch(''); }}
                    placeholder="Search country, REC or organisation..."
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/50 pl-9 pr-9 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  />
                  {form.tenantId && !tenantDropdownOpen && (
                    <button
                      type="button"
                      onClick={() => { setForm((p) => ({ ...p, tenantId: '' })); setTenantSearch(''); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown list */}
                {tenantDropdownOpen && (
                  <>
                    {/* Backdrop to close dropdown */}
                    <div className="fixed inset-0 z-10" onClick={() => setTenantDropdownOpen(false)} />
                    <div className="absolute z-20 bottom-full mb-1 w-full max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                      {filteredTenants.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          No matching organisation found
                        </div>
                      ) : (
                        (() => {
                          // Group by level/REC for visual sections
                          const continental = filteredTenants.filter((t) => t.level === 'CONTINENTAL');
                          const recs = filteredTenants.filter((t) => t.level === 'REC');
                          const countries = filteredTenants.filter((t) => t.level === 'MEMBER_STATE');

                          // Group countries by REC
                          const countryGroups = new Map<string, typeof countries>();
                          for (const c of countries) {
                            const key = c.recName ?? 'Other';
                            if (!countryGroups.has(key)) countryGroups.set(key, []);
                            countryGroups.get(key)!.push(c);
                          }

                          return (
                            <>
                              {/* Continental */}
                              {continental.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => { setForm((p) => ({ ...p, tenantId: t.id })); setTenantDropdownOpen(false); setTenantSearch(''); }}
                                  className={cn(
                                    'flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20',
                                    form.tenantId === t.id && 'bg-blue-50 dark:bg-blue-900/20',
                                  )}
                                >
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 flex-shrink-0">AU</span>
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-white truncate">{t.name}</p>
                                    <p className="text-[10px] text-purple-600 dark:text-purple-400">Continental</p>
                                  </div>
                                  {form.tenantId === t.id && <CheckCircle2 className="h-4 w-4 text-blue-600 ml-auto flex-shrink-0" />}
                                </button>
                              ))}

                              {/* RECs */}
                              {recs.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => { setForm((p) => ({ ...p, tenantId: t.id })); setTenantDropdownOpen(false); setTenantSearch(''); }}
                                  className={cn(
                                    'flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20',
                                    form.tenantId === t.id && 'bg-blue-50 dark:bg-blue-900/20',
                                  )}
                                >
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0">{t.code.slice(0, 2)}</span>
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-white truncate">{t.name}</p>
                                    <p className="text-[10px] text-blue-600 dark:text-blue-400">REC</p>
                                  </div>
                                  {form.tenantId === t.id && <CheckCircle2 className="h-4 w-4 text-blue-600 ml-auto flex-shrink-0" />}
                                </button>
                              ))}

                              {/* Countries grouped by REC */}
                              {Array.from(countryGroups.entries()).map(([recName, members]) => (
                                <div key={recName}>
                                  <div className="sticky top-0 bg-gray-50 dark:bg-gray-800 px-4 py-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-t border-gray-100 dark:border-gray-700">
                                    {recName}
                                  </div>
                                  {members.map((t) => (
                                    <button
                                      key={t.id}
                                      type="button"
                                      onClick={() => { setForm((p) => ({ ...p, tenantId: t.id })); setTenantDropdownOpen(false); setTenantSearch(''); }}
                                      className={cn(
                                        'flex items-center gap-3 w-full px-4 py-2 text-left text-sm transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20',
                                        form.tenantId === t.id && 'bg-blue-50 dark:bg-blue-900/20',
                                      )}
                                    >
                                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0">{t.code}</span>
                                      <div className="min-w-0">
                                        <p className="font-medium text-gray-900 dark:text-white truncate">{t.name}</p>
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500">Member State</p>
                                      </div>
                                      {form.tenantId === t.id && <CheckCircle2 className="h-4 w-4 text-blue-600 ml-auto flex-shrink-0" />}
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </>
                          );
                        })()
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---- Section: Functions ---- */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
          <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Functions</h2>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Select user functions (job titles). Each function brings its associated roles automatically.
              {form.functionIds.length > 0 && (
                <span className="ml-1 font-medium text-blue-600 dark:text-blue-400">
                  {form.functionIds.length} selected
                </span>
              )}
            </p>
          </div>
          <div className="px-6 py-5">
            {allFunctions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {allFunctions.map((fn) => {
                  const selected = form.functionIds.includes(fn.id);
                  const fnRoles = (fn as any).roles ?? [];
                  return (
                    <button
                      key={fn.id}
                      type="button"
                      onClick={() => toggleFunction(fn.id)}
                      className={cn(
                        'flex flex-col items-start gap-2 rounded-lg border px-3.5 py-3 text-left transition-all',
                        selected
                          ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/30 dark:bg-blue-900/20 dark:border-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                      )}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div className={cn(
                          'flex h-5 w-5 items-center justify-center rounded border flex-shrink-0 transition-colors',
                          selected
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300 dark:border-gray-600',
                        )}>
                          {selected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                        </div>
                        <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                          {fn.name?.en ?? fn.code}
                        </span>
                        <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500 capitalize flex-shrink-0">
                          {fn.level}
                        </span>
                      </div>
                      {/* Show associated roles */}
                      {fnRoles.length > 0 && (
                        <div className="flex flex-wrap gap-1 pl-7">
                          {fnRoles.map((fr: any) => (
                            <span
                              key={fr.role?.id ?? fr.roleId}
                              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
                              style={{ backgroundColor: fr.role?.color ?? '#6b7280' }}
                            >
                              {fr.role?.name?.en ?? fr.role?.code ?? 'Role'}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No functions available. Create functions in Settings &gt; Functions first.</p>
            )}
          </div>
        </div>

        {/* ---- Section: Roles ---- */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
          <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Roles</h2>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Roles inherited from functions are locked. You can assign additional direct roles.
              {allSelectedRoleIds.size > 0 && (
                <span className="ml-1 font-medium text-blue-600 dark:text-blue-400">
                  {allSelectedRoleIds.size} effective role{allSelectedRoleIds.size !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          <div className="px-6 py-5">
            {allRoles.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {allRoles.map((role) => {
                  const isDerived = derivedRoleIds.has(role.id);
                  const isDirect = form.directRoleIds.includes(role.id);
                  const isSelected = isDerived || isDirect;

                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => {
                        if (isDerived) return; // Cannot toggle function-derived roles
                        toggleDirectRole(role.id);
                      }}
                      disabled={isDerived}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-all',
                        isSelected
                          ? isDerived
                            ? 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800 cursor-not-allowed'
                            : 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/30 dark:bg-blue-900/20 dark:border-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                      )}
                    >
                      {/* Role color dot */}
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 text-white text-[10px] font-bold"
                        style={{ backgroundColor: role.color }}
                      >
                        {(role.name?.en ?? role.code).charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className={cn('text-xs font-medium truncate', isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400')}>
                            {role.name?.en ?? role.code}
                          </p>
                          {isDerived && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-400 flex-shrink-0">
                              <Lock className="h-2.5 w-2.5" />
                              function
                            </span>
                          )}
                          {isDirect && !isDerived && (
                            <span className="inline-flex rounded-full bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700 dark:text-blue-400 flex-shrink-0">
                              direct
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 capitalize">{role.level}</p>
                      </div>
                      {isSelected && !isDerived && (
                        <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      )}
                      {isDerived && (
                        <Lock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Loading roles...</p>
            )}

            {/* Effective roles summary */}
            {allSelectedRoleIds.size > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Effective Roles Summary
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allRoles
                    .filter((r) => allSelectedRoleIds.has(r.id))
                    .map((role) => (
                      <span
                        key={role.id}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium text-white"
                        style={{ backgroundColor: role.color }}
                      >
                        {role.name?.en ?? role.code}
                        {derivedRoleIds.has(role.id) && !form.directRoleIds.includes(role.id) && (
                          <Lock className="h-2.5 w-2.5 opacity-70" />
                        )}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---- Section: Domains ---- */}
        {allDomains.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
            <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Domain Access</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={selectAllDomains} className="text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors">
                    Select All
                  </button>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <button type="button" onClick={clearAllDomains} className="text-[11px] font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors">
                    Clear
                  </button>
                </div>
              </div>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Select which business domains this user can access ({form.domainIds.length}/{allDomains.length} selected)
              </p>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {allDomains.map((d) => {
                  const selected = form.domainIds.includes(d.id);
                  // Use the user's current locale with a cascading fallback so
                  // Kenyan/French/Portuguese/Arabic users see the localized name
                  // instead of always reading the English one.
                  const label = d.name?.[locale] || d.name?.en || d.code;
                  // Render the real domain icon (lucide-react name stored in
                  // domain.icon) falling back to a colored dot for unknown names.
                  const IconComp = d.icon
                    ? (LucideIcons as any)[d.icon] as React.ComponentType<{ className?: string }> | undefined
                    : undefined;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDomain(d.id)}
                      aria-pressed={selected}
                      title={`${label} (${d.code})`}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-all',
                        selected
                          ? 'border-transparent shadow-sm'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                      )}
                      style={selected ? {
                        backgroundColor: `${d.color}12`,
                        borderColor: `${d.color}30`,
                      } : undefined}
                    >
                      <span
                        className={cn('flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 transition-colors')}
                        style={{
                          backgroundColor: selected ? `${d.color}20` : '#f3f4f6',
                          color: selected ? d.color : '#9ca3af',
                        }}
                      >
                        {IconComp ? (
                          <IconComp className="h-4 w-4" />
                        ) : (
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selected ? d.color : '#d1d5db' }} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className={cn('text-xs font-medium truncate', selected ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400')}>
                          {label}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">{d.code}</p>
                      </div>
                      {selected && (
                        <CheckCircle2 className="h-4 w-4 ml-auto flex-shrink-0" style={{ color: d.color }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ---- Actions bar ---- */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 px-6 py-4">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || saved}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {editingUser ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ================================================================ */
/*  Locked Accounts Panel                                            */
/* ================================================================ */

function LockedAccountsPanel() {
  const me = useAuthStore((s) => s.user);
  const isSuperOrContinental = me?.role === 'SUPER_ADMIN' || me?.role === 'CONTINENTAL_ADMIN';
  const { data, isLoading } = useLockedAccounts();
  const unlockMut = useUnlockAccount();

  if (!isSuperOrContinental) return null;

  const locked = data?.data ?? [];
  if (isLoading || locked.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <div className="mb-3 flex items-center gap-2">
        <Lock className="h-4 w-4 text-red-600 dark:text-red-400" />
        <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
          Locked Accounts ({locked.length})
        </h3>
      </div>
      <div className="space-y-2">
        {locked.map((acc) => {
          const minutes = Math.ceil(acc.ttl / 60);
          return (
            <div
              key={acc.email}
              className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-gray-800"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{acc.email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {acc.attempts} failed attempts — auto-unlock in {minutes} min
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await unlockMut.mutateAsync(acc.email);
                    toast.success(`${acc.email} unlocked`);
                  } catch {
                    toast.error('Failed to unlock account');
                  }
                }}
                disabled={unlockMut.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <Lock className="h-3 w-3" />
                Unlock
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/*  Delete Confirm Dialog                                            */
/* ================================================================ */

function DeleteConfirm({
  user,
  onCancel,
  onConfirm,
  isPending,
}: {
  user: ManagedUser;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Delete User</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Are you sure you want to permanently delete <strong>{user.firstName} {user.lastName}</strong> ({user.email})?
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ */
/*  Main Page                                                        */
/* ================================================================ */

export default function UsersPage() {
  const [view, setView] = useState<PageView>('list');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null);

  // Load roles for the filter dropdown
  const { data: rolesData } = useSettingsRoles({ limit: 100 });
  const filterRoles: RoleItem[] = useMemo(() => (rolesData?.data ?? []).filter((r) => r.isActive), [rolesData]);

  const { data, isLoading, error } = useSettingsUsers({
    page,
    limit: ITEMS_PER_PAGE,
    search: search || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
  });

  const deleteMut = useDeleteUser();
  const toggleActiveMut = useToggleUserActive();

  const users = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: ITEMS_PER_PAGE };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const activeCount = useMemo(() => users.filter((u) => u.isActive).length, [users]);

  const handleEdit = useCallback((user: ManagedUser) => {
    setEditingUser(user);
    setView('form');
  }, []);

  const handleAdd = useCallback(() => {
    setEditingUser(null);
    setView('form');
  }, []);

  const handleBack = useCallback(() => {
    setView('list');
    setEditingUser(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deletingUser) return;
    const name = `${deletingUser.firstName} ${deletingUser.lastName}`;
    try {
      await deleteMut.mutateAsync(deletingUser.id);
      setDeletingUser(null);
      toast.success('User deleted', { description: `${name} has been removed.` });
    } catch (err: any) {
      toast.error('Failed to delete user', { description: err?.message ?? 'Please try again.' });
    }
  }, [deletingUser, deleteMut]);

  const handleToggleActive = useCallback((user: ManagedUser) => {
    const name = `${user.firstName} ${user.lastName}`;
    const willBeActive = !user.isActive;
    toggleActiveMut.mutate(
      { id: user.id, isActive: willBeActive },
      {
        onSuccess: () => toast.success(willBeActive ? 'User activated' : 'User deactivated', {
          description: `${name} is now ${willBeActive ? 'active' : 'inactive'}.`,
        }),
        onError: (err: any) => toast.error('Failed to update status', {
          description: err?.message ?? 'Please try again.',
        }),
      },
    );
  }, [toggleActiveMut]);

  /* ---- Form View ---- */
  if (view === 'form') {
    return <UserForm editingUser={editingUser} onBack={handleBack} />;
  }

  /* ---- List View ---- */
  return (
    <div className="space-y-6">
      {/* Delete confirm */}
      {deletingUser && (
        <DeleteConfirm
          user={deletingUser}
          onCancel={() => setDeletingUser(null)}
          onConfirm={handleDelete}
          isPending={deleteMut.isPending}
        />
      )}

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
            <Users className="h-6 w-6 text-blue-600" />
            User Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage user accounts, functions, roles and domain assignments
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {users.filter((u) => !!u.accountExpiresAt).length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Temporary Accounts</p>
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
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

      {/* Locked Accounts Panel */}
      <LockedAccountsPanel />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All Roles</option>
          {filterRoles.map((role) => (
            <option key={role.id} value={role.code}>{role.name?.en ?? role.code}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-800 dark:bg-red-900/20">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Failed to load users: {(error as any)?.message ?? 'Unknown error'}
          </p>
        </div>
      )}

      {/* Users Table */}
      {!isLoading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Email</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Organisation</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Roles</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-[70px]">Active</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {users.map((user) => {
                // Collect all effective roles for display
                const functionRoleIds = new Set<string>();
                for (const uf of (user.functions ?? [])) {
                  for (const fr of ((uf.function as any)?.roles ?? [])) {
                    functionRoleIds.add(fr.role?.id);
                  }
                }
                const directRoles = (user.roleAssignments ?? [])
                  .filter((ra) => ra.source === 'direct')
                  .map((ra) => ra.role);
                const allEffectiveRoles = new Map<string, { id: string; code: string; name: Record<string, string>; color: string }>();
                for (const uf of (user.functions ?? [])) {
                  for (const fr of ((uf.function as any)?.roles ?? [])) {
                    if (fr.role) allEffectiveRoles.set(fr.role.id, fr.role);
                  }
                }
                for (const r of directRoles) {
                  allEffectiveRoles.set(r.id, r);
                }
                const effectiveRolesList = Array.from(allEffectiveRoles.values());

                const canDelete = !user.lastLoginAt;
                const isToggling = toggleActiveMut.isPending && (toggleActiveMut.variables as any)?.id === user.id;

                return (
                  <tr key={user.id} className="transition-colors hover:bg-blue-50/30 dark:hover:bg-gray-800/50 group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-50 text-xs font-bold text-blue-700 dark:from-blue-900/40 dark:to-blue-800/20 dark:text-blue-400 flex-shrink-0">
                          {getInitials(user.firstName, user.lastName)}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {user.firstName} {user.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-[180px]">{user.email}</td>
                    <td className="px-4 py-3">
                      {user.tenant ? (
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
                            user.tenant.level === 'CONTINENTAL' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
                            user.tenant.level === 'REC' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
                          )}>
                            {user.tenant.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[140px]">
                        {effectiveRolesList.length > 0 ? (
                          <>
                            {effectiveRolesList.slice(0, 2).map((role) => (
                              <span
                                key={role.id}
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white whitespace-nowrap"
                                style={{ backgroundColor: role.color }}
                              >
                                {role.name?.en ?? role.code}
                              </span>
                            ))}
                            {effectiveRolesList.length > 2 && (
                              <span className="text-[10px] text-gray-400 self-center">+{effectiveRolesList.length - 2}</span>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {user.role.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(user)}
                          disabled={isToggling}
                          className={cn(
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0',
                            user.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
                            isToggling && 'opacity-50',
                          )}
                          title={user.isActive ? 'Click to deactivate' : 'Click to activate'}
                        >
                          <span
                            className={cn(
                              'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                              user.isActive ? 'translate-x-[18px]' : 'translate-x-[3px]',
                            )}
                          />
                        </button>
                        {user.accountExpiresAt && (() => {
                          const isExpired = new Date(user.accountExpiresAt!) < new Date();
                          return (
                            <span
                              className={cn(
                                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap',
                                isExpired
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                              )}
                              title={`Expires: ${new Date(user.accountExpiresAt!).toLocaleString()}`}
                            >
                              <Clock className="h-2.5 w-2.5" />
                              {isExpired ? 'Expired' : 'Temp'}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(user)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-all"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => setDeletingUser(user)}
                            className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all"
                            title="Delete user (never logged in)"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {users.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                        <Users className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="font-medium text-gray-900 dark:text-white">No users found</p>
                      <p className="text-xs text-gray-500">Try adjusting your search or filter criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {meta.total > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 px-4 py-3">
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
                  Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= totalPages - 3) p = totalPages - 6 + i;
                  else p = page - 3 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        page === p
                          ? 'bg-blue-600 text-white shadow-sm'
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
    </div>
  );
}
