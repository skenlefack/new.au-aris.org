'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuthStore, type UserRole } from '@/lib/stores/auth-store';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useUnreadNotifications } from '@/lib/api/hooks';
import {
  Bell,
  LogOut,
  User,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Globe,
  Building2,
  MapPin,
  Loader2,
  Search,
  Home,
  PanelLeft,
} from 'lucide-react';
import type { TenantNode, TenantLevel } from '@/lib/stores/tenant-store';
import { ConnectionIndicator } from '@/components/realtime/ConnectionIndicator';
import { NotificationPanel } from '@/components/realtime/NotificationPanel';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useUiStore } from '@/lib/stores/ui-store';
import { useUserFunctions } from '@/lib/api/settings-hooks';
import { useTranslations } from '@/lib/i18n/translations';

/* ------------------------------------------------------------------ */
/*  Role labels & colors                                               */
/* ------------------------------------------------------------------ */

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  CONTINENTAL_ADMIN: 'Continental Admin',
  REC_ADMIN: 'REC Admin',
  NATIONAL_ADMIN: 'National Admin',
  DATA_STEWARD: 'Data Steward',
  WAHIS_FOCAL_POINT: 'WAHIS Focal Point',
  ANALYST: 'Analyst',
  FIELD_AGENT: 'Field Agent',
};

const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CONTINENTAL_ADMIN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  REC_ADMIN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  NATIONAL_ADMIN: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  DATA_STEWARD: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  WAHIS_FOCAL_POINT: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  ANALYST: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  FIELD_AGENT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

/* ------------------------------------------------------------------ */
/*  Tenant tree helpers                                                */
/* ------------------------------------------------------------------ */

const LEVEL_ICON: Record<TenantLevel, React.ReactNode> = {
  CONTINENTAL: <Globe className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />,
  REC: <Building2 className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />,
  MEMBER_STATE: <MapPin className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />,
};

function findTenantById(
  nodes: TenantNode[],
  id: string,
): TenantNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findTenantById(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Breadcrumb label map                                               */
/* ------------------------------------------------------------------ */

const BREADCRUMB_LABELS: Record<string, string> = {
  '': 'Home',
  home: 'Home',
  'animal-health': 'Animal Health',
  events: 'Events',
  new: 'New Event',
  map: 'Map',
  outbreaks: 'Outbreaks',
  vaccination: 'Vaccination',
  laboratory: 'Laboratory',
  surveillance: 'Surveillance',
  livestock: 'Livestock & Production',
  census: 'Census',
  production: 'Production',
  transhumance: 'Transhumance',
  fisheries: 'Fisheries & Aquaculture',
  captures: 'Captures',
  vessels: 'Vessels',
  aquaculture: 'Aquaculture',
  trade: 'Trade & SPS',
  flows: 'Trade Flows',
  sps: 'SPS Certificates',
  markets: 'Market Prices',
  knowledge: 'Knowledge Hub',
  publications: 'Publications',
  elearning: 'E-Learning',
  faq: 'FAQ',
  collecte: 'Collecte',
  campaigns: 'Campaigns',
  submissions: 'Submissions',
  workflow: 'Workflow',
  'master-data': 'Master Data',
  geo: 'Geography',
  species: 'Species',
  denominators: 'Denominators',
  quality: 'Data Quality',
  interop: 'Interop Hub',
  'form-builder': 'Form Builder',
  analytics: 'Analytics',
  trends: 'Trends',
  comparison: 'Country Comparison',
  export: 'Export Builder',
  reports: 'Reports',
  generate: 'Generate Report',
  history: 'Report History',
  settings: 'Settings',
  profile: 'Profile',
  'data-contracts': 'Data Contracts',
  general: 'General',
  security: 'Security',
  i18n: 'Languages',
  'data-quality': 'Data Quality',
  countries: 'Countries',
  domains: 'Domains',
  recs: 'RECs',
  functions: 'Functions',
  users: 'Users',
  audit: 'Audit Log',
  system: 'System',
};

/* ------------------------------------------------------------------ */
/*  Header component                                                   */
/* ------------------------------------------------------------------ */

interface HeaderProps {
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
}

export function Header({ sidebarCollapsed, onSidebarToggle }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const { selectedTenantId, tenantTree, isLoading: isTenantLoading, setSelectedTenant } =
    useTenantStore();

  const tc = useTranslations('common');
  const th = useTranslations('header');
  const tn = useTranslations('nav');

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const userMenuRef = useRef<HTMLDivElement>(null);
  const tenantMenuRef = useRef<HTMLDivElement>(null);

  const { data: notifData } = useUnreadNotifications();
  const unreadCount = notifData?.data?.count ?? 0;

  // Fetch current user's primary function for header display
  const { data: userFnData } = useUserFunctions(user?.id ?? '');
  const primaryFn = (userFnData?.data as any[])?.find((uf: any) => uf.isPrimary)?.function
    ?? (userFnData?.data as any[])?.[0]?.function;
  const primaryFnLabel = primaryFn?.name?.en ?? null;

  const selectedTenant = selectedTenantId
    ? findTenantById(tenantTree, selectedTenantId)
    : null;

  // Fetch tenant tree on mount
  useEffect(() => {
    useTenantStore.getState().fetchTenantTree();
  }, []);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (tenantMenuRef.current && !tenantMenuRef.current.contains(e.target as Node)) {
        setTenantMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard support
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (userMenuOpen) setUserMenuOpen(false);
        if (tenantMenuOpen) setTenantMenuOpen(false);
      }
    },
    [userMenuOpen, tenantMenuOpen],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleTenantSelect(tenant: TenantNode) {
    setSelectedTenant(tenant.id, tenant);
    setTenantMenuOpen(false);
  }

  function renderTenantNode(node: TenantNode, depth: number = 0): React.ReactNode {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = node.id === selectedTenantId;

    return (
      <div key={node.id}>
        <div
          role="menuitem"
          tabIndex={0}
          className={cn(
            'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors duration-100',
            'hover:bg-gray-50 dark:hover:bg-gray-800',
            isSelected && 'bg-[var(--color-accent-light)] font-medium',
          )}
          style={{
            paddingLeft: `${depth * 16 + 12}px`,
            color: isSelected ? 'var(--color-accent)' : undefined,
          }}
          onClick={() => handleTenantSelect(node)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleTenantSelect(node);
            }
          }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="p-0.5"
              aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            >
              <ChevronDown
                className={cn(
                  'h-3 w-3 transition-transform duration-150',
                  isExpanded && 'rotate-180',
                )}
              />
            </button>
          ) : (
            <span className="w-4" />
          )}
          {LEVEL_ICON[node.level]}
          <span className="truncate">{node.name}</span>
          <span className="ml-auto text-[10px] text-gray-400">{node.code}</span>
        </div>
        {hasChildren && isExpanded &&
          node.children!.map((child) => renderTenantNode(child, depth + 1))}
      </div>
    );
  }

  function handleLogout() {
    queryClient.clear();
    logout();
    router.push('/');
  }

  const setSearchOpen = useUiStore((s) => s.setSearchOpen);

  /* ---- Breadcrumbs ---- */
  const segments = pathname.split('/').filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: BREADCRUMB_LABELS[seg] ?? seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  /* ---- User initials ---- */
  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`
    : '';

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200/80 bg-white px-4 shadow-sm dark:border-gray-800/80 dark:bg-gray-900 sm:px-6">
      {/* LEFT — Sidebar toggle + Breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Sidebar collapse/expand toggle (desktop only) */}
        <button
          onClick={onSidebarToggle}
          className="hidden lg:flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors duration-150"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-[18px] w-[18px]" />
          ) : (
            <ChevronLeft className="h-[18px] w-[18px]" />
          )}
        </button>

        <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-sm md:flex min-w-0">
          <Link
            href="/home"
            className="flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
          </Link>
          {crumbs.map((crumb) => (
            <React.Fragment key={crumb.href}>
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-gray-300 dark:text-gray-600" />
              {crumb.isLast ? (
                <span
                  className="truncate font-medium"
                  style={{ color: 'var(--color-accent)' }}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* CENTER — Search */}
      <div className="flex-1 flex justify-center px-2 md:px-6">
        <button
          onClick={() => setSearchOpen(true)}
          className={cn(
            'flex items-center gap-2.5 rounded-xl',
            'bg-slate-100 dark:bg-gray-800/60 px-4 py-2 text-sm text-gray-400 dark:text-gray-500',
            'hover:bg-slate-200/80 dark:hover:bg-gray-800',
            'transition-all duration-150 w-full max-w-md',
          )}
          aria-label="Search (Ctrl+K)"
        >
          <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <span className="hidden sm:inline truncate text-gray-400">{tn('searchPlaceholder')}</span>
          <kbd className="hidden rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 sm:inline ml-auto shadow-sm">
            {typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? '\u2318' : 'Ctrl+'}K
          </kbd>
        </button>
      </div>

      {/* RIGHT — Controls + User profile */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Context / Tenant selector */}
        <div ref={tenantMenuRef} className="relative">
          <button
            onClick={() => setTenantMenuOpen(!tenantMenuOpen)}
            aria-expanded={tenantMenuOpen}
            aria-haspopup="true"
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-all duration-150',
              tenantMenuOpen
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-lighter)]'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800',
            )}
          >
            {isTenantLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
            ) : (
              selectedTenant && LEVEL_ICON[selectedTenant.level]
            )}
            <span className="hidden font-medium text-gray-700 dark:text-gray-200 sm:inline max-w-[100px] truncate">
              {isTenantLoading
                ? th('loadingTenants')
                : selectedTenant?.name ?? th('selectTenant')}
            </span>
            <ChevronDown
              className={cn(
                'h-3 w-3 text-gray-400 transition-transform duration-150',
                tenantMenuOpen && 'rotate-180',
              )}
            />
          </button>

          {tenantMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-50 mt-2 max-h-80 w-72 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-900 animate-scale-in"
            >
              <div className="border-b border-gray-100 dark:border-gray-800 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {th('tenantHierarchy')}
                </p>
              </div>
              {isTenantLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">{th('loadingTenants')}</span>
                </div>
              ) : (
                tenantTree.map((t) => renderTenantNode(t))
              )}
            </div>
          )}
        </div>

        <LanguageSwitcher />
        <ThemeToggle />
        <ConnectionIndicator />

        {/* Notifications */}
        <button
          onClick={() => setNotificationOpen(true)}
          className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors duration-150"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white animate-count-bump">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <NotificationPanel
          open={notificationOpen}
          onClose={() => setNotificationOpen(false)}
        />

        {/* User profile — moved from sidebar bottom */}
        <div className="flex items-center gap-2 pl-2 ml-1 border-l border-gray-200 dark:border-gray-700">
          <div ref={userMenuRef} className="relative">
            {user ? (
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150"
              >
                <div className="relative">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'var(--color-accent-text)',
                      boxShadow: '0 0 0 2px var(--color-accent-light)',
                    }}
                  >
                    {initials}
                  </div>
                  {/* Online indicator */}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900 bg-green-500" />
                </div>
                {/* Name + function/role visible on md+ */}
                <div className="hidden md:block text-left min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[140px]">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[140px]">
                    {primaryFnLabel ?? user.role.replace(/_/g, ' ')}
                  </p>
                </div>
                <ChevronDown className="hidden h-3 w-3 text-gray-400 dark:text-gray-500 md:block" />
              </button>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
              </div>
            )}

            {userMenuOpen && user && (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-900 animate-scale-in"
              >
                <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                  {primaryFnLabel && (
                    <p className="mt-1 text-[11px] font-medium" style={{ color: 'var(--color-accent)' }}>
                      {primaryFnLabel}
                    </p>
                  )}
                  <span
                    className={cn(
                      'mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium',
                      ROLE_COLORS[user.role],
                    )}
                  >
                    {ROLE_LABELS[user.role]}
                  </span>
                </div>
                <div className="py-1">
                  <button
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      router.push('/settings');
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    {tc('profileSettings')}
                  </button>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800 py-1">
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    {tc('signOut')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
