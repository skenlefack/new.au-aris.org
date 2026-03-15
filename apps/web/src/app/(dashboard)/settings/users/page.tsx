'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Search,
  Pencil,
  UserX,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  UserCheck,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface PlaceholderUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  tenant: string;
  lastLogin: string | null;
  isActive: boolean;
}

type UserRole =
  | 'SUPER_ADMIN'
  | 'CONTINENTAL_ADMIN'
  | 'REC_ADMIN'
  | 'NATIONAL_ADMIN'
  | 'DATA_STEWARD'
  | 'WAHIS_FOCAL_POINT'
  | 'ANALYST'
  | 'FIELD_AGENT';

/* ─── Constants ──────────────────────────────────────────────────────────────── */

const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'bg-red-100 text-red-700' },
  CONTINENTAL_ADMIN: { label: 'Continental Admin', color: 'bg-purple-100 text-purple-700' },
  REC_ADMIN: { label: 'REC Admin', color: 'bg-blue-100 text-blue-700' },
  NATIONAL_ADMIN: { label: 'National Admin', color: 'bg-green-100 text-green-700' },
  DATA_STEWARD: { label: 'Data Steward', color: 'bg-amber-100 text-amber-700' },
  WAHIS_FOCAL_POINT: { label: 'WAHIS Focal Point', color: 'bg-cyan-100 text-cyan-700' },
  ANALYST: { label: 'Analyst', color: 'bg-gray-100 text-gray-600' },
  FIELD_AGENT: { label: 'Field Agent', color: 'bg-orange-100 text-orange-700' },
};

const ALL_ROLES = Object.keys(ROLE_CONFIG) as UserRole[];

const PLACEHOLDER_USERS: PlaceholderUser[] = [
  {
    id: 'u-001',
    firstName: 'Jean',
    lastName: 'Ouedraogo',
    email: 'j.ouedraogo@au-ibar.org',
    role: 'SUPER_ADMIN',
    tenant: 'AU-IBAR',
    lastLogin: '2026-03-15T08:12:00Z',
    isActive: true,
  },
  {
    id: 'u-002',
    firstName: 'Amina',
    lastName: 'Mwangi',
    email: 'a.mwangi@ke.au-aris.org',
    role: 'NATIONAL_ADMIN',
    tenant: 'Kenya',
    lastLogin: '2026-03-14T14:35:00Z',
    isActive: true,
  },
  {
    id: 'u-003',
    firstName: 'Bekele',
    lastName: 'Tessema',
    email: 'b.tessema@et.au-aris.org',
    role: 'NATIONAL_ADMIN',
    tenant: 'Ethiopia',
    lastLogin: '2026-03-13T09:20:00Z',
    isActive: true,
  },
  {
    id: 'u-004',
    firstName: 'Fatima',
    lastName: 'Diop',
    email: 'f.diop@sn.au-aris.org',
    role: 'DATA_STEWARD',
    tenant: 'Senegal',
    lastLogin: '2026-03-14T16:45:00Z',
    isActive: true,
  },
  {
    id: 'u-005',
    firstName: 'Adamu',
    lastName: 'Yusuf',
    email: 'a.yusuf@ng.au-aris.org',
    role: 'WAHIS_FOCAL_POINT',
    tenant: 'Nigeria',
    lastLogin: '2026-03-12T11:00:00Z',
    isActive: true,
  },
  {
    id: 'u-006',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 's.johnson@au-ibar.org',
    role: 'CONTINENTAL_ADMIN',
    tenant: 'AU-IBAR',
    lastLogin: '2026-03-15T07:50:00Z',
    isActive: true,
  },
  {
    id: 'u-007',
    firstName: 'Mohamed',
    lastName: 'Hassan',
    email: 'm.hassan@igad.int',
    role: 'REC_ADMIN',
    tenant: 'IGAD',
    lastLogin: '2026-03-11T13:30:00Z',
    isActive: false,
  },
  {
    id: 'u-008',
    firstName: 'James',
    lastName: 'Ochieng',
    email: 'j.ochieng@ke.au-aris.org',
    role: 'FIELD_AGENT',
    tenant: 'Kenya',
    lastLogin: null,
    isActive: true,
  },
];

const ITEMS_PER_PAGE = 5;

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function formatRelativeTime(dateStr: string | null): string {
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
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getRoleBadge(role: UserRole) {
  const config = ROLE_CONFIG[role];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        config.color,
      )}
    >
      {config.label}
    </span>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  /* ── Filtering ── */
  const filteredUsers = useMemo(() => {
    let result = PLACEHOLDER_USERS;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }

    if (roleFilter) {
      result = result.filter((u) => u.role === roleFilter);
    }

    if (statusFilter === 'active') {
      result = result.filter((u) => u.isActive);
    } else if (statusFilter === 'inactive') {
      result = result.filter((u) => !u.isActive);
    }

    return result;
  }, [search, roleFilter, statusFilter]);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  /* ── Stats ── */
  const totalUsers = PLACEHOLDER_USERS.length;
  const activeUsers = PLACEHOLDER_USERS.filter((u) => u.isActive).length;
  const pendingInvitations = PLACEHOLDER_USERS.filter((u) => u.lastLogin === null).length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
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
            Manage user accounts and roles
          </p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Users</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeUsers}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active Users</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingInvitations}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Pending Invitations</p>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All Roles</option>
          {ALL_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_CONFIG[role].label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* ── Users Table ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Email</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Role</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tenant</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Last Login</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {paginatedUsers.map((user) => (
                <tr
                  key={user.id}
                  className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-aris-primary-100 text-xs font-bold text-aris-primary-700 dark:bg-aris-primary-900/30 dark:text-aris-primary-400">
                        {user.firstName[0]}
                        {user.lastName[0]}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        Dr. {user.firstName} {user.lastName}
                      </span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {user.email}
                  </td>

                  {/* Role Badge */}
                  <td className="px-4 py-3">{getRoleBadge(user.role)}</td>

                  {/* Tenant */}
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {user.tenant}
                  </td>

                  {/* Last Login */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(user.lastLogin)}
                    </div>
                  </td>

                  {/* Status */}
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

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                        title="Edit user"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className={cn(
                          'rounded p-1.5 transition-colors',
                          user.isActive
                            ? 'text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400'
                            : 'text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400',
                        )}
                        title={user.isActive ? 'Deactivate user' : 'Activate user'}
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {paginatedUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
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

        {/* ── Pagination ── */}
        {filteredUsers.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {(page - 1) * ITEMS_PER_PAGE + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {Math.min(page * ITEMS_PER_PAGE, filteredUsers.length)}
              </span>{' '}
              of{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {filteredUsers.length}
              </span>{' '}
              users
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

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    page === p
                      ? 'bg-aris-primary-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
                  )}
                >
                  {p}
                </button>
              ))}

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
    </div>
  );
}
