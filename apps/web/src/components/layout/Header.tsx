'use client';

import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import type { TenantNode, TenantLevel } from '@/lib/stores/tenant-store';
import { ConnectionIndicator } from '@/components/realtime/ConnectionIndicator';
import { NotificationPanel } from '@/components/realtime/NotificationPanel';

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
  const { selectedTenantId, tenantTree, setSelectedTenant } = useTenantStore();

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

  // Use placeholder user for demo
  const displayUser = user ?? {
    firstName: 'Dr. Amina',
    lastName: 'Mwangi',
    email: 'a.mwangi@au-ibar.org',
    role: 'CONTINENTAL_ADMIN' as UserRole,
  };

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
          className={cn(
            'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50',
            isSelected && 'bg-aris-primary-50 font-medium text-aris-primary-700',
          )}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => handleTenantSelect(node)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="p-0.5"
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

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Tenant selector */}
      <div ref={tenantMenuRef} className="relative">
        <button
          onClick={() => setTenantMenuOpen(!tenantMenuOpen)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:border-gray-300 hover:bg-gray-50"
        >
          {selectedTenant && LEVEL_ICON[selectedTenant.level]}
          <span className="font-medium">
            {selectedTenant?.name ?? 'Select tenant'}
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-gray-400 transition-transform',
              tenantMenuOpen && 'rotate-180',
            )}
          />
        </button>

        {tenantMenuOpen && (
          <div className="absolute left-0 z-50 mt-2 max-h-80 w-72 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Tenant hierarchy
              </p>
            </div>
            {tenantTree.map((t) => renderTenantNode(t))}
          </div>
        )}
      </div>

      {/* Right side — connection status + notifications + user */}
      <div className="flex items-center gap-4">
        <ConnectionIndicator />

        <button
          onClick={() => setNotificationOpen(true)}
          className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
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
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-aris-primary-100 text-sm font-semibold text-aris-primary-700">
              {displayUser.firstName[0]}
              {displayUser.lastName[0]}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium text-gray-900">
                {displayUser.firstName} {displayUser.lastName}
              </p>
              <span
                className={cn(
                  'inline-block rounded-full px-2 py-0.5 text-[10px] font-medium',
                  ROLE_COLORS[displayUser.role],
                )}
              >
                {ROLE_LABELS[displayUser.role]}
              </span>
            </div>
            <ChevronDown className="hidden h-3.5 w-3.5 text-gray-400 md:block" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <div className="border-b border-gray-100 px-4 py-2 md:hidden">
                <p className="text-sm font-medium text-gray-900">
                  {displayUser.firstName} {displayUser.lastName}
                </p>
                <p className="text-xs text-gray-500">{displayUser.email}</p>
              </div>
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  router.push('/settings');
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <User className="h-4 w-4" />
                Profile & Settings
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
