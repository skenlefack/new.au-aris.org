'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore, type UserRole } from '@/lib/stores/auth-store';
import {
  LayoutDashboard,
  HeartPulse,
  Wheat,
  Fish,
  TrendingUp,
  BookOpen,
  ClipboardList,
  GitPullRequestArrow,
  Database,
  ShieldCheck,
  ArrowLeftRight,
  BarChart3,
  FileBarChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Nav items                                                          */
/* ------------------------------------------------------------------ */

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  matchPrefix: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: <LayoutDashboard className="h-5 w-5" />,
    matchPrefix: '/',
  },
  {
    label: 'Animal Health',
    href: '/animal-health',
    icon: <HeartPulse className="h-5 w-5" />,
    matchPrefix: '/animal-health',
  },
  {
    label: 'Livestock',
    href: '/livestock',
    icon: <Wheat className="h-5 w-5" />,
    matchPrefix: '/livestock',
  },
  {
    label: 'Fisheries',
    href: '/fisheries',
    icon: <Fish className="h-5 w-5" />,
    matchPrefix: '/fisheries',
  },
  {
    label: 'Trade & SPS',
    href: '/trade',
    icon: <TrendingUp className="h-5 w-5" />,
    matchPrefix: '/trade',
  },
  {
    label: 'Knowledge',
    href: '/knowledge',
    icon: <BookOpen className="h-5 w-5" />,
    matchPrefix: '/knowledge',
  },
  {
    label: 'Collecte',
    href: '/collecte',
    icon: <ClipboardList className="h-5 w-5" />,
    matchPrefix: '/collecte',
  },
  {
    label: 'Workflow',
    href: '/workflow',
    icon: <GitPullRequestArrow className="h-5 w-5" />,
    matchPrefix: '/workflow',
  },
  {
    label: 'Master Data',
    href: '/master-data',
    icon: <Database className="h-5 w-5" />,
    matchPrefix: '/master-data',
  },
  {
    label: 'Quality',
    href: '/quality',
    icon: <ShieldCheck className="h-5 w-5" />,
    matchPrefix: '/quality',
  },
  {
    label: 'Interop',
    href: '/interop',
    icon: <ArrowLeftRight className="h-5 w-5" />,
    matchPrefix: '/interop',
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: <BarChart3 className="h-5 w-5" />,
    matchPrefix: '/analytics',
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: <FileBarChart className="h-5 w-5" />,
    matchPrefix: '/reports',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="h-5 w-5" />,
    matchPrefix: '/settings',
  },
];

/* ------------------------------------------------------------------ */
/*  Role-based access map                                              */
/*  Each role maps to the set of matchPrefix values it may access.     */
/* ------------------------------------------------------------------ */

const ROLE_ACCESS: Record<UserRole, Set<string>> = {
  FIELD_AGENT: new Set([
    '/',
    '/collecte',
    '/animal-health',
  ]),
  ANALYST: new Set([
    '/',
    '/animal-health',
    '/livestock',
    '/fisheries',
    '/trade',
    '/knowledge',
    '/analytics',
    '/reports',
  ]),
  WAHIS_FOCAL_POINT: new Set([
    '/',
    '/animal-health',
    '/livestock',
    '/fisheries',
    '/trade',
    '/knowledge',
    '/analytics',
    '/reports',
    '/interop',
  ]),
  DATA_STEWARD: new Set([
    '/',
    '/animal-health',
    '/livestock',
    '/fisheries',
    '/trade',
    '/knowledge',
    '/analytics',
    '/reports',
    '/quality',
    '/workflow',
  ]),
  NATIONAL_ADMIN: new Set([
    '/',
    '/animal-health',
    '/livestock',
    '/fisheries',
    '/trade',
    '/knowledge',
    '/analytics',
    '/reports',
    '/quality',
    '/workflow',
    '/master-data',
    '/settings',
  ]),
  REC_ADMIN: new Set([
    '/',
    '/animal-health',
    '/livestock',
    '/fisheries',
    '/trade',
    '/knowledge',
    '/collecte',
    '/workflow',
    '/master-data',
    '/quality',
    '/interop',
    '/analytics',
    '/reports',
    // Note: Settings excluded for REC_ADMIN
  ]),
  CONTINENTAL_ADMIN: new Set(
    NAV_ITEMS.map((i) => i.matchPrefix),
  ),
  SUPER_ADMIN: new Set(
    NAV_ITEMS.map((i) => i.matchPrefix),
  ),
};

/** Return the subset of nav items visible to the given role. */
function filterNavByRole(role: UserRole | undefined): NavItem[] {
  if (!role) return [];
  const allowed = ROLE_ACCESS[role];
  if (!allowed) return [];
  return NAV_ITEMS.filter((item) => allowed.has(item.matchPrefix));
}

/* ------------------------------------------------------------------ */
/*  Sidebar component                                                  */
/* ------------------------------------------------------------------ */

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const visibleItems = filterNavByRole(user?.role);

  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  /* ---- Active-link detection ---- */
  function isActive(item: NavItem): boolean {
    if (item.matchPrefix === '/') return pathname === '/';
    return pathname.startsWith(item.matchPrefix);
  }

  /* ---- Close mobile sidebar on Escape ---- */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        onMobileClose();
      }
    },
    [mobileOpen, onMobileClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /* ---- Focus management: move focus into sidebar when it opens on mobile ---- */
  useEffect(() => {
    if (mobileOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [mobileOpen]);

  /* ---- Close mobile sidebar on route change ---- */
  useEffect(() => {
    if (mobileOpen) {
      onMobileClose();
    }
    // Only react to pathname changes, not mobileOpen/onMobileClose identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /* ---- Shared sidebar panel content ---- */
  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-200 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-aris-primary-600 text-xs font-bold text-white">
            AR
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-gray-900">ARIS 3.0</h1>
              <p className="text-[10px] text-gray-400">AU-IBAR</p>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button
          ref={closeButtonRef}
          onClick={onMobileClose}
          className="ml-auto flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 space-y-1 overflow-y-auto p-3"
        aria-label="Main navigation"
      >
        {visibleItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium sidebar-transition',
                active
                  ? 'bg-aris-primary-50 text-aris-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                collapsed && 'justify-center px-0',
              )}
            >
              <span
                className={cn(
                  'flex-shrink-0',
                  active ? 'text-aris-primary-600' : 'text-gray-400',
                )}
              >
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden border-t border-gray-200 p-3 lg:block">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ----- Desktop sidebar (>= lg) ----- */}
      <aside
        ref={sidebarRef}
        className={cn(
          'hidden lg:flex h-screen flex-col border-r border-gray-200 bg-white sidebar-transition',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {sidebarContent}
      </aside>

      {/* ----- Mobile sidebar overlay (< lg) ----- */}

      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden',
          mobileOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        )}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white shadow-xl',
          'transition-transform duration-300 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Mobile navigation"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
