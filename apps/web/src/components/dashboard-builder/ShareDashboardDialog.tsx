'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  User2,
  Shield,
  Flag,
  Globe2,
  Eye,
  Copy,
  Search,
  Loader2,
  Check,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useDashboardShares,
  useShareDashboard,
  useRevokeShare,
  useSearchUsers,
  type ShareRecord,
  type CreateShareInput,
} from '@/lib/api/dashboard-share-hooks';
import { RECS, REC_ORDER } from '@/data/recs-config';
import { COUNTRIES } from '@/data/countries-config';
import { useTranslations } from '@/lib/i18n/translations';

// ─── Types ──────────────────────────────────────────────────────────────────

type ShareType = 'USER' | 'ROLE' | 'COUNTRY' | 'REC' | 'PUBLIC';
type Permission = 'VIEW' | 'CLONE';

export interface ShareDashboardDialogProps {
  open: boolean;
  onClose: () => void;
  dashboardId: string;
  dashboardTitle?: string;
}

interface SelectedTarget {
  type: ShareType;
  id: string;
  label: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ALL_ROLES = [
  'SUPER_ADMIN',
  'CONTINENTAL_ADMIN',
  'REC_ADMIN',
  'NATIONAL_ADMIN',
  'DATA_STEWARD',
  'WAHIS_FOCAL_POINT',
  'ANALYST',
  'FIELD_AGENT',
  'KNOWLEDGE_MANAGER',
];

const TABS: { type: ShareType; icon: React.ElementType; label: string }[] = [
  { type: 'USER', icon: User2, label: 'User' },
  { type: 'ROLE', icon: Shield, label: 'Role' },
  { type: 'COUNTRY', icon: Flag, label: 'Country' },
  { type: 'REC', icon: Globe2, label: 'REC' },
  { type: 'PUBLIC', icon: Eye, label: 'Public' },
];

const SHARE_TYPE_ICON: Record<string, React.ElementType> = {
  USER: User2,
  ROLE: Shield,
  COUNTRY: Flag,
  REC: Globe2,
  PUBLIC: Eye,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRoleName(role: string): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Sort countries alphabetically
const SORTED_COUNTRIES = Object.values(COUNTRIES).sort((a, b) =>
  a.name.localeCompare(b.name),
);

// ─── Sub-components ─────────────────────────────────────────────────────────

function UserTab({
  onSelect,
  selected,
}: {
  onSelect: (t: SelectedTarget) => void;
  selected: SelectedTarget | null;
}) {
  const t = useTranslations('dashboard');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useSearchUsers(debouncedQuery);
  const users = data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchByNameOrEmail')}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
        />
      </div>

      <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}
        {!isLoading && debouncedQuery.length < 2 && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">
            {t('typeAtLeast2Chars')}
          </p>
        )}
        {!isLoading && debouncedQuery.length >= 2 && users.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">
            {t('noUsersFound')}
          </p>
        )}
        {users.map((u) => {
          const isSelected = selected?.id === u.id;
          return (
            <button
              key={u.id}
              onClick={() =>
                onSelect({
                  type: 'USER',
                  id: u.id,
                  label: `${u.firstName} ${u.lastName} (${u.email})`,
                })
              }
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                isSelected ? 'bg-blue-50 dark:bg-blue-950/30' : ''
              }`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1F4E79]/10 text-[#1F4E79] dark:bg-[#1F4E79]/20">
                <User2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {u.firstName} {u.lastName}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {u.email}
                </p>
              </div>
              {isSelected && (
                <Check className="h-4 w-4 shrink-0 text-[#1F4E79]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoleTab({
  onSelect,
  selected,
}: {
  onSelect: (t: SelectedTarget) => void;
  selected: SelectedTarget | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ALL_ROLES.map((role) => {
        const isSelected = selected?.id === role;
        return (
          <button
            key={role}
            onClick={() =>
              onSelect({
                type: 'ROLE',
                id: role,
                label: formatRoleName(role),
              })
            }
            className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-all ${
              isSelected
                ? 'border-[#1F4E79] bg-[#1F4E79]/10 text-[#1F4E79] dark:border-[#1F4E79] dark:bg-[#1F4E79]/20 dark:text-blue-300'
                : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{formatRoleName(role)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CountryTab({
  onSelect,
  selected,
}: {
  onSelect: (t: SelectedTarget) => void;
  selected: SelectedTarget | null;
}) {
  const t = useTranslations('dashboard');
  const [filter, setFilter] = useState('');

  const filtered = useMemo(
    () =>
      filter
        ? SORTED_COUNTRIES.filter(
            (c) =>
              c.name.toLowerCase().includes(filter.toLowerCase()) ||
              c.code.toLowerCase().includes(filter.toLowerCase()),
          )
        : SORTED_COUNTRIES,
    [filter],
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('filterCountries')}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
        />
      </div>

      <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">
            {t('noCountriesMatch')}
          </p>
        )}
        {filtered.map((c) => {
          const isSelected = selected?.id === (c.tenantId ?? c.code);
          return (
            <button
              key={c.code}
              onClick={() =>
                onSelect({
                  type: 'COUNTRY',
                  id: c.tenantId ?? c.code,
                  label: `${c.flag} ${c.name}`,
                })
              }
              className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                isSelected ? 'bg-blue-50 dark:bg-blue-950/30' : ''
              }`}
            >
              <span className="text-lg">{c.flag}</span>
              <span className="flex-1 truncate text-sm text-gray-900 dark:text-white">
                {c.name}
              </span>
              {c.tenantId && (
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {t('active')}
                </span>
              )}
              {isSelected && (
                <Check className="h-4 w-4 shrink-0 text-[#1F4E79]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RecTab({
  onSelect,
  selected,
}: {
  onSelect: (t: SelectedTarget) => void;
  selected: SelectedTarget | null;
}) {
  const t = useTranslations('dashboard');
  return (
    <div className="grid grid-cols-2 gap-2">
      {REC_ORDER.map((code) => {
        const rec = RECS[code];
        if (!rec) return null;
        const isSelected = selected?.id === rec.tenantId;
        return (
          <button
            key={code}
            onClick={() =>
              onSelect({
                type: 'REC',
                id: rec.tenantId,
                label: rec.name,
              })
            }
            className={`relative overflow-hidden rounded-lg border px-3 py-3 text-left transition-all ${
              isSelected
                ? 'border-[#1F4E79] bg-[#1F4E79]/5 dark:border-[#1F4E79] dark:bg-[#1F4E79]/15'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800'
            }`}
          >
            {/* Color stripe */}
            <div
              className="absolute inset-y-0 left-0 w-1 rounded-l-lg"
              style={{ backgroundColor: rec.color }}
            />
            <div className="pl-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {rec.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {rec.memberCount} {t('members')}
              </p>
            </div>
            {isSelected && (
              <Check className="absolute right-2 top-2 h-4 w-4 text-[#1F4E79]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function PublicTab({
  isPublic,
  onToggle,
}: {
  isPublic: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('dashboard');
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Globe2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('publicAccess')}
          </h4>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('publicAccessDesc')}
          </p>
        </div>
        <button
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
            isPublic ? 'bg-[#1F4E79]' : 'bg-gray-200 dark:bg-gray-700'
          }`}
          role="switch"
          aria-checked={isPublic}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              isPublic ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

// ─── Active Shares List ─────────────────────────────────────────────────────

function ActiveSharesList({ dashboardId }: { dashboardId: string }) {
  const t = useTranslations('dashboard');
  const { data, isLoading } = useDashboardShares(dashboardId);
  const revokeMutation = useRevokeShare();

  const shares: ShareRecord[] = useMemo(() => {
    const raw = data?.data;
    return Array.isArray(raw) ? raw.filter((s) => s.status === 'ACTIVE') : [];
  }, [data]);

  const handleRevoke = (share: ShareRecord) => {
    revokeMutation.mutate(
      { dashboardId, shareId: share.id },
      {
        onSuccess: () => toast.success(t('shareRevoked')),
        onError: () => toast.error(t('shareRevokeFailed')),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  if (shares.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400">
        {t('noActiveShares')}
      </p>
    );
  }

  return (
    <div className="max-h-40 space-y-1.5 overflow-y-auto">
      {shares.map((share) => {
        const Icon = SHARE_TYPE_ICON[share.share_type] ?? Eye;
        return (
          <div
            key={share.id}
            className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60"
          >
            <Icon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
            <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
              {share.share_label ?? share.share_type}
            </span>

            {/* Permission badge */}
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                share.permission === 'VIEW'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
              }`}
            >
              {share.permission}
            </span>

            {/* Expiry badge */}
            {share.expires_at && (
              <span className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <Clock className="h-2.5 w-2.5" />
                {formatDate(share.expires_at)}
              </span>
            )}

            {/* Revoke button */}
            <button
              onClick={() => handleRevoke(share)}
              disabled={revokeMutation.isPending}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/30 dark:hover:text-red-400"
              title={t('revokeShare')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Dialog ────────────────────────────────────────────────────────────

export function ShareDashboardDialog({
  open,
  onClose,
  dashboardId,
  dashboardTitle,
}: ShareDashboardDialogProps) {
  const [selectedTab, setSelectedTab] = useState<ShareType>('USER');
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(
    null,
  );
  const [permission, setPermission] = useState<Permission>('VIEW');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [isPublicToggle, setIsPublicToggle] = useState(false);

  const t = useTranslations('dashboard');
  const shareMutation = useShareDashboard();

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setSelectedTab('USER');
      setSelectedTarget(null);
      setPermission('VIEW');
      setExpiresAt('');
      setIsPublicToggle(false);
    }
  }, [open]);

  // ESC to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  // When switching tabs, clear selection
  const handleTabChange = (tab: ShareType) => {
    setSelectedTab(tab);
    setSelectedTarget(null);
    setIsPublicToggle(false);
  };

  const handleShare = () => {
    const input: CreateShareInput = {
      dashboardId,
      shareType: selectedTab,
      permission,
      expiresAt: expiresAt || undefined,
    };

    if (selectedTab === 'PUBLIC') {
      input.shareLabel = 'Public';
    } else if (selectedTarget) {
      input.shareLabel = selectedTarget.label;
      if (selectedTab === 'USER') {
        input.sharedWithUserId = selectedTarget.id;
      } else if (selectedTab === 'ROLE') {
        input.sharedWithRole = selectedTarget.id;
      } else if (selectedTab === 'COUNTRY' || selectedTab === 'REC') {
        input.sharedWithTenantId = selectedTarget.id;
      }
    } else {
      toast.error(t('selectTarget'));
      return;
    }

    shareMutation.mutate(input, {
      onSuccess: () => {
        toast.success(t('shareSuccess'));
        setSelectedTarget(null);
        setIsPublicToggle(false);
      },
      onError: (err) => {
        toast.error((err as Error).message ?? t('shareFailed'));
      },
    });
  };

  const canShare =
    selectedTab === 'PUBLIC' ? isPublicToggle : selectedTarget !== null;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('shareDashboard')}
            </h2>
            {dashboardTitle && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {dashboardTitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Scrollable body ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Tab bar */}
          <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {TABS.map((tab) => {
              const isActive = selectedTab === tab.type;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.type}
                  onClick={() => handleTabChange(tab.type)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white text-[#1F4E79] shadow-sm dark:bg-gray-700 dark:text-blue-300'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="mb-4">
            {selectedTab === 'USER' && (
              <UserTab onSelect={setSelectedTarget} selected={selectedTarget} />
            )}
            {selectedTab === 'ROLE' && (
              <RoleTab onSelect={setSelectedTarget} selected={selectedTarget} />
            )}
            {selectedTab === 'COUNTRY' && (
              <CountryTab
                onSelect={setSelectedTarget}
                selected={selectedTarget}
              />
            )}
            {selectedTab === 'REC' && (
              <RecTab onSelect={setSelectedTarget} selected={selectedTarget} />
            )}
            {selectedTab === 'PUBLIC' && (
              <PublicTab
                isPublic={isPublicToggle}
                onToggle={() => setIsPublicToggle((prev) => !prev)}
              />
            )}
          </div>

          {/* Permission selector */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('permission')}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setPermission('VIEW')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                  permission === 'VIEW'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950/30 dark:text-blue-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800'
                }`}
              >
                <Eye className="h-4 w-4" />
                {t('permissionView')}
              </button>
              <button
                onClick={() => setPermission('CLONE')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                  permission === 'CLONE'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 dark:border-purple-600 dark:bg-purple-950/30 dark:text-purple-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800'
                }`}
              >
                <Copy className="h-4 w-4" />
                {t('permissionClone')}
              </button>
            </div>
          </div>

          {/* Expiry */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('expiresOptional')}
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Share button */}
          <button
            onClick={handleShare}
            disabled={!canShare || shareMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#163a5c] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#1F4E79] dark:hover:bg-[#163a5c]"
          >
            {shareMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {t('shareDashboard')}
          </button>

          {/* ── Divider ────────────────────────────────────── */}
          <div className="my-5 border-t border-gray-200 dark:border-gray-700" />

          {/* ── Active shares ──────────────────────────────── */}
          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('activeShares')}
            </h3>
            <ActiveSharesList dashboardId={dashboardId} />
          </div>
        </div>
      </div>
    </div>
  );
}
