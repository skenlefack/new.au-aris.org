'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore, type UserRole } from '@/lib/stores/auth-store';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useUnreadNotifications } from '@/lib/api/hooks';
import {
  Bell,
  LogOut,
  User,
  ChevronDown,
  Globe,
  Building2,
  MapPin,
  Loader2,
  Search,
} from 'lucide-react';
import type { TenantNode, TenantLevel } from '@/lib/stores/tenant-store';
import { ConnectionIndicator } from '@/components/realtime/ConnectionIndicator';
import { NotificationPanel } from '@/components/realtime/NotificationPanel';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useUiStore } from '@/lib/stores/ui-store';

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
  SUPER_ADMIN: 'bg-red-100 text-red-700',
  CONTINENTAL_ADMIN: 'bg-aris-primary-50 text-aris-primary-700',
  REC_ADMIN: 'bg-aris-secondary-50 text-aris-secondary-700',
  NATIONAL_ADMIN: 'bg-blue-100 text-blue-700',
  DATA_STEWARD: 'bg-purple-100 text-purple-700',
  WAHIS_FOCAL_POINT: 'bg-teal-100 text-teal-700',
  ANALYST: 'bg-gray-100 text-gray-700',
  FIELD_AGENT: 'bg-amber-100 text-amber-700',
};

const LEVEL_ICON: Record<TenantLevel, React.ReactNode> = {
  CONTINENTAL: <Globe className="h-3.5 w-3.5 text-aris-primary-600" />,
  REC: <Building2 className="h-3.5 w-3.5 text-aris-secondary-600" />,
  MEMBER_STATE: <MapPin className="h-3.5 w-3.5 text-aris-accent-600" />,
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

export function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { selectedTenantId, tenantTree, isLoading: isTenantLoading, setSelectedTenant } =
    useTenantStore();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const userMenuRef = useRef<HTMLDivElement>(null);
  const tenantMenuRef = useRef<HTMLDivElement>(null);

  const { data: notifData } = useUnreadNotifications();
  const unreadCount = notifData?.data?.count ?? 0;

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
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
      if (
        tenantMenuRef.current &&
        !tenantMenuRef.current.contains(e.target as Node)
      ) {
        setTenantMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard support: Escape closes dropdowns
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

  function renderTenantNode(
    node: TenantNode,
    depth: number = 0,
  ): React.ReactNode {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = node.id === selectedTenantId;

    return (
      <div key={node.id}>
        <div
          role="menuitem"
          tabIndex={0}
          className={cn(
            'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50',
            isSelected && 'bg-aris-primary-50 font-medium text-aris-primary-700',
          )}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
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
                  'h-3 w-3 transition-transform',
                  isExpanded && 'rotate-180',
                )}
              />
            </button>
          ) : (
            <span className="w-4" />
          )}
          {LEVEL_ICON[node.level]}
          <span>{node.name}</span>
          <span className="ml-auto text-[10px] text-gray-400">{node.code}</span>
        </div>
        {hasChildren &&
          isExpanded &&
          node.children!.map((child) => renderTenantNode(child, depth + 1))}
      </div>
    );
  }

  function handleLogout() {
    logout();
    router.push('/login');
  }

  // User skeleton when user is null (loading / not yet hydrated)
  function renderUserSkeleton() {
    return (
      <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
        <div className="hidden md:block">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="mt-1 h-3 w-16 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  const setSearchOpen = useUiStore((s) => s.setSearchOpen);

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900">
      {/* Tenant selector */}
      <div ref={tenantMenuRef} className="relative">
        <button
          onClick={() => setTenantMenuOpen(!tenantMenuOpen)}
          aria-expanded={tenantMenuOpen}
          aria-haspopup="true"
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800"
        >
          {isTenantLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
          ) : (
            selectedTenant && LEVEL_ICON[selectedTenant.level]
          )}
          <span className="font-medium dark:text-gray-200">
            {isTenantLoading
              ? 'Loading...'
              : selectedTenant?.name ?? 'Select tenant'}
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-gray-400 transition-transform',
              tenantMenuOpen && 'rotate-180',
            )}
          />
        </button>

        {tenantMenuOpen && (
          <div
            role="menu"
            className="absolute left-0 z-50 mt-2 max-h-80 w-72 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Tenant hierarchy
              </p>
            </div>
            {isTenantLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">
                  Loading tenants...
                </span>
              </div>
            ) : (
              tenantTree.map((t) => renderTenantNode(t))
            )}
          </div>
        )}
      </div>

      {/* Right side -- search + language + theme + connection + notifications + user */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-400 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-500 dark:hover:border-gray-600 dark:hover:bg-gray-800"
          aria-label="Search (Ctrl+K)"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden rounded border border-gray-200 px-1 py-0.5 text-[10px] sm:inline dark:border-gray-600">
            ⌘K
          </kbd>
        </button>

        <LanguageSwitcher />
        <ThemeToggle />
        <ConnectionIndicator />

        <button
          onClick={() => setNotificationOpen(true)}
          className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-aris-accent-600 text-[9px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <NotificationPanel
          open={notificationOpen}
          onClose={() => setNotificationOpen(false)}
        />

        {/* User menu */}
        <div ref={userMenuRef} className="relative">
          {user ? (
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-aris-primary-100 text-sm font-semibold text-aris-primary-700">
                {user.firstName[0]}
                {user.lastName[0]}
              </div>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user.firstName} {user.lastName}
                </p>
                <span
                  className={cn(
                    'inline-block rounded-full px-2 py-0.5 text-[10px] font-medium',
                    ROLE_COLORS[user.role],
                  )}
                >
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 text-gray-400 dark:text-gray-500 md:block" />
            </button>
          ) : (
            renderUserSkeleton()
          )}

          {userMenuOpen && user && (
            <div
              role="menu"
              className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="border-b border-gray-100 px-4 py-2 md:hidden dark:border-gray-800">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <button
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  router.push('/settings');
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <User className="h-4 w-4" />
                Profile & Settings
              </button>
              <button
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
