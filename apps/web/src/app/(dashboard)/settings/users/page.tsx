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
  Clock,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DomainBadge } from '@/components/domain/DomainBadge';
import {
  useSettingsUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useToggleUserActive,
  type ManagedUser,
} from '@/lib/api/settings-hooks';
import { useDomainStore } from '@/lib/stores/domain-store';
import { useAuthStore } from '@/lib/stores/auth-store';

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

const ROLE_CONFIG: Record<UserRole, { label: string; description: string; color: string; iconColor: string }> = {
  SUPER_ADMIN:       { label: 'Super Admin',       description: 'Full system access',               color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',             iconColor: '#dc2626' },
  CONTINENTAL_ADMIN: { label: 'Continental Admin',  description: 'AU-IBAR continental oversight',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', iconColor: '#7c3aed' },
  REC_ADMIN:         { label: 'REC Admin',          description: 'Regional community coordinator',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',         iconColor: '#2563eb' },
  NATIONAL_ADMIN:    { label: 'National Admin',     description: 'National CVO office administrator',color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',     iconColor: '#16a34a' },
  DATA_STEWARD:      { label: 'Data Steward',       description: 'Data quality officer',             color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',     iconColor: '#d97706' },
  WAHIS_FOCAL_POINT: { label: 'WAHIS Focal Point',  description: 'Authorized WOAH reporter',         color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',         iconColor: '#0891b2' },
  ANALYST:           { label: 'Analyst',            description: 'Read-only data analyst',           color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',             iconColor: '#6b7280' },
  FIELD_AGENT:       { label: 'Field Agent',        description: 'Mobile data collector',            color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', iconColor: '#ea580c' },
};

const ALL_ROLES = Object.keys(ROLE_CONFIG) as UserRole[];
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
  // Ensure at least one of each category
  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += special[Math.floor(Math.random() * special.length)];
  for (let i = pwd.length; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  // Shuffle
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
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
  role: UserRole;
  tenantId: string;
  isActive: boolean;
  domainIds: string[];
}

const EMPTY_FORM: UserFormState = {
  email: '',
  phone: '',
  password: '',
  firstName: '',
  lastName: '',
  role: 'FIELD_AGENT',
  tenantId: '',
  isActive: true,
  domainIds: [],
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
  const createMut = useCreateUser();
  const updateMut = useUpdateUser();
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<UserFormState>(() => {
    if (editingUser) {
      return {
        email: editingUser.email,
        phone: editingUser.phone ?? '',
        password: '',
        firstName: editingUser.firstName,
        lastName: editingUser.lastName,
        role: editingUser.role as UserRole,
        tenantId: editingUser.tenantId,
        isActive: editingUser.isActive,
        domainIds: editingUser.domains?.map((d) => d.id) ?? [],
      };
    }
    return { ...EMPTY_FORM, tenantId: currentUser?.tenantId ?? '' };
  });

  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = `${form.firstName} ${form.lastName}`.trim();
    try {
      if (editingUser) {
        const body: Record<string, unknown> = {
          id: editingUser.id,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || null,
          role: form.role,
          isActive: form.isActive,
          domainIds: form.domainIds,
        };
        if (form.email !== editingUser.email) body.email = form.email;
        if (form.password) body.password = form.password;
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
          role: form.role,
          tenantId: form.tenantId,
          domainIds: form.domainIds.length > 0 ? form.domainIds : undefined,
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
  }, [form, editingUser, createMut, updateMut, onBack]);

  const handleGeneratePassword = useCallback(() => {
    const pwd = generatePassword(12);
    setForm((p) => ({ ...p, password: pwd }));
    setShowPassword(true);
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
              {editingUser ? 'Update account details, role and domain assignments' : 'Set up a new user account with role and domain access'}
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
          </div>
        </div>

        {/* ---- Section: Role & Status ---- */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
          <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Role & Permissions</h2>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Define access level and account status</p>
          </div>
          <div className="px-6 py-5 space-y-5">
            {/* Role selector — card grid */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ALL_ROLES.map((role) => {
                  const cfg = ROLE_CONFIG[role];
                  const selected = form.role === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, role }))}
                      className={cn(
                        'flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-all',
                        selected
                          ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/30 dark:bg-blue-900/20 dark:border-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                      )}
                    >
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', cfg.color)}>
                        {cfg.label}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{cfg.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active toggle */}
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
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDomain(d.id)}
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
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selected ? d.color : '#d1d5db' }} />
                      </span>
                      <div className="min-w-0">
                        <p className={cn('text-xs font-medium truncate', selected ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400')}>
                          {d.name?.en || d.code}
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
            Manage user accounts, roles and domain assignments
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
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All Roles</option>
          {ALL_ROLES.map((role) => (
            <option key={role} value={role}>{ROLE_CONFIG[role].label}</option>
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
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Role</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Domains</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-[80px]">Login</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-[70px]">Active</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {users.map((user) => {
                const roleKey = user.role as UserRole;
                const roleConfig = ROLE_CONFIG[roleKey] ?? { label: user.role, color: 'bg-gray-100 text-gray-600' };
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
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap', roleConfig.color)}>
                        {roleConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {user.domains && user.domains.length > 0 ? (
                          <>
                            {user.domains.slice(0, 2).map((d) => (
                              <DomainBadge key={d.code} code={d.code} name={d.name} color={d.color} size="xs" />
                            ))}
                            {user.domains.length > 2 && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 self-center">
                                +{user.domains.length - 2}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">--</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatRelativeTime(user.lastLoginAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
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
                  <td colSpan={7} className="px-4 py-16 text-center">
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
