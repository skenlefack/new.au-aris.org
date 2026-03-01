'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore, type UserRole } from '@/lib/stores/auth-store';
import type { LucideIcon } from 'lucide-react';
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
  BarChart2,
  FileBarChart,
  HardDrive,
  PieChart,
  Layers,
  Settings,
  X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  matchPrefix: string;
  badge?: string;
  disabled?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/* ------------------------------------------------------------------ */
/*  Navigation structure                                               */
/* ------------------------------------------------------------------ */

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'OVERVIEW',
    items: [
      { label: 'Dashboard', href: '/home', icon: LayoutDashboard, matchPrefix: '/home' },
    ],
  },
  {
    label: 'DOMAIN',
    items: [
      { label: 'Animal Health', href: '/animal-health', icon: HeartPulse, matchPrefix: '/animal-health' },
      { label: 'Livestock', href: '/livestock', icon: Wheat, matchPrefix: '/livestock' },
      { label: 'Fisheries', href: '/fisheries', icon: Fish, matchPrefix: '/fisheries' },
      { label: 'Trade & SPS', href: '/trade', icon: TrendingUp, matchPrefix: '/trade' },
      { label: 'Knowledge', href: '/knowledge', icon: BookOpen, matchPrefix: '/knowledge' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { label: 'Collecte', href: '/collecte', icon: ClipboardList, matchPrefix: '/collecte' },
      { label: 'Workflow', href: '/workflow', icon: GitPullRequestArrow, matchPrefix: '/workflow' },
      { label: 'Master Data', href: '/master-data', icon: Database, matchPrefix: '/master-data' },
    ],
  },
  {
    label: 'MONITORING',
    items: [
      { label: 'Quality', href: '/quality', icon: ShieldCheck, matchPrefix: '/quality' },
      { label: 'Interop', href: '/interop', icon: ArrowLeftRight, matchPrefix: '/interop' },
      { label: 'Analytics', href: '/analytics', icon: BarChart3, matchPrefix: '/analytics' },
      { label: 'Historical Data', href: '/historical', icon: HardDrive, matchPrefix: '/historical' },
      { label: 'Reports', href: '/reports', icon: FileBarChart, matchPrefix: '/reports' },
    ],
  },
  {
    label: 'BI TOOLS',
    items: [
      { label: 'Superset', href: '/bi-tools/superset', icon: Layers, matchPrefix: '/bi-tools/superset' },
      { label: 'Metabase', href: '/bi-tools/metabase', icon: PieChart, matchPrefix: '/bi-tools/metabase' },
      { label: 'Power BI', href: '#', icon: BarChart2, matchPrefix: '/bi-tools/powerbi', badge: 'Soon', disabled: true },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings, matchPrefix: '/settings' },
    ],
  },
];

/** Flat list for role access */
const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/* ------------------------------------------------------------------ */
/*  Role-based access map                                              */
/* ------------------------------------------------------------------ */

const ROLE_ACCESS: Record<UserRole, Set<string>> = {
  FIELD_AGENT: new Set(['/home', '/collecte', '/workflow', '/animal-health']),
  ANALYST: new Set([
    '/home', '/animal-health', '/livestock', '/fisheries', '/trade',
    '/knowledge', '/analytics', '/historical', '/reports',
    '/bi-tools/superset', '/bi-tools/metabase', '/bi-tools/powerbi',
  ]),
  WAHIS_FOCAL_POINT: new Set([
    '/home', '/animal-health', '/livestock', '/fisheries', '/trade',
    '/knowledge', '/analytics', '/historical', '/reports', '/interop',
    '/bi-tools/superset', '/bi-tools/metabase', '/bi-tools/powerbi',
  ]),
  DATA_STEWARD: new Set([
    '/home', '/animal-health', '/livestock', '/fisheries', '/trade',
    '/knowledge', '/analytics', '/historical', '/reports', '/quality', '/workflow',
    '/bi-tools/superset', '/bi-tools/metabase', '/bi-tools/powerbi',
  ]),
  NATIONAL_ADMIN: new Set([
    '/home', '/animal-health', '/livestock', '/fisheries', '/trade',
    '/knowledge', '/analytics', '/historical', '/reports', '/quality', '/workflow',
    '/master-data', '/settings',
    '/bi-tools/superset', '/bi-tools/metabase', '/bi-tools/powerbi',
  ]),
  REC_ADMIN: new Set([
    '/home', '/animal-health', '/livestock', '/fisheries', '/trade',
    '/knowledge', '/collecte', '/workflow', '/master-data', '/quality',
    '/interop', '/analytics', '/historical', '/reports', '/settings',
    '/bi-tools/superset', '/bi-tools/metabase', '/bi-tools/powerbi',
  ]),
  CONTINENTAL_ADMIN: new Set(ALL_NAV_ITEMS.map((i) => i.matchPrefix)),
  SUPER_ADMIN: new Set(ALL_NAV_ITEMS.map((i) => i.matchPrefix)),
};

/** Filter nav groups by role — removes empty groups */
function filterGroupsByRole(role: UserRole | undefined): NavGroup[] {
  if (!role) return [];
  const allowed = ROLE_ACCESS[role];
  if (!allowed) return [];
  return NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allowed.has(item.matchPrefix)),
    }))
    .filter((group) => group.items.length > 0);
}

/* ------------------------------------------------------------------ */
/*  Sidebar — Entity-colored gradient with decorative effects          */
/* ------------------------------------------------------------------ */

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const visibleGroups = filterGroupsByRole(user?.role);

  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  /* ---- Active-link detection ---- */
  function isActive(item: NavItem): boolean {
    if (item.matchPrefix === '/home') return pathname === '/home' || pathname === '/';
    return pathname.startsWith(item.matchPrefix);
  }

  /* ---- Close mobile sidebar on Escape ---- */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) onMobileClose();
    },
    [mobileOpen, onMobileClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /* ---- Focus management ---- */
  useEffect(() => {
    if (mobileOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [mobileOpen]);

  /* ---- Close mobile sidebar on route change ---- */
  useEffect(() => {
    if (mobileOpen) onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /* ---- Position tooltip at the right edge of the nav item (fixed) ---- */
  const handleTooltipEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!collapsed) return;
    const tooltip = e.currentTarget.querySelector('.sidebar-tooltip') as HTMLElement | null;
    if (!tooltip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    tooltip.style.top = `${rect.top + rect.height / 2}px`;
    tooltip.style.left = `${rect.right + 14}px`;
  }, [collapsed]);

  /* ---- Render a DISABLED nav item (Power BI "Soon") ---- */
  function renderDisabledItem(item: NavItem) {
    const Icon = item.icon;
    return (
      <div key={item.matchPrefix} className="group relative" onMouseEnter={handleTooltipEnter}>
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium cursor-not-allowed opacity-50',
            collapsed && 'justify-center px-0',
          )}
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-300 dark:text-slate-600">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          {!collapsed && (
            <span className="truncate text-slate-400 dark:text-slate-600">{item.label}</span>
          )}
          {!collapsed && item.badge && (
            <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              {item.badge}
            </span>
          )}
        </div>
        {collapsed && (
          <div className="sidebar-tooltip">
            <div className="sidebar-tooltip-arrow" />
            {item.label} ({item.badge})
          </div>
        )}
      </div>
    );
  }

  /* ---- Render an ACTIVE nav item (clickable link) ---- */
  function renderActiveItem(item: NavItem) {
    const active = isActive(item);
    const Icon = item.icon;
    return (
      <div key={item.href} className="group relative" onMouseEnter={handleTooltipEnter}>
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
            'transition-all duration-150',
            active
              ? 'sidebar-active-item text-slate-900 dark:text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white',
            collapsed && 'justify-center px-0',
          )}
        >
          <span
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
              active
                ? 'text-[var(--color-accent)]'
                : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300',
            )}
            style={active ? { backgroundColor: 'var(--color-accent-light)' } : undefined}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          {!collapsed && <span className="truncate">{item.label}</span>}
        </Link>

        {/* Tooltip — fixed position, escapes overflow-y-auto clipping */}
        {collapsed && (
          <div className="sidebar-tooltip">
            <div className="sidebar-tooltip-arrow" />
            {item.label}
          </div>
        )}
      </div>
    );
  }

  /* ---- Render nav item — dispatches to active or disabled ---- */
  function renderNavItem(item: NavItem) {
    if (item.disabled === true) {
      return renderDisabledItem(item);
    }
    return renderActiveItem(item);
  }

  /* ---- Decorative background effects (circles, arcs, bubbles) ---- */
  const decorativeElements = (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Large circle — top right */}
      <div
        className="absolute -top-16 -right-16 h-56 w-56 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(var(--color-accent-rgb), 0.10) 0%, transparent 70%)' }}
      />
      {/* Medium circle — bottom left */}
      <div
        className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(var(--color-accent-rgb), 0.08) 0%, transparent 70%)' }}
      />
      {/* Small bubble — center right */}
      <div
        className="absolute top-[45%] -right-6 h-28 w-28 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(var(--color-accent-rgb), 0.06) 0%, transparent 70%)' }}
      />
      {/* Arc / ring — upper left area */}
      <div
        className="absolute top-32 -left-14 h-48 w-48 rounded-full"
        style={{ border: '2px solid rgba(var(--color-accent-rgb), 0.06)' }}
      />
      {/* Small dot bubble — mid-left */}
      <div
        className="absolute top-[60%] left-6 h-10 w-10 rounded-full"
        style={{ background: 'rgba(var(--color-accent-rgb), 0.06)' }}
      />
      {/* Tiny accent dot — top center */}
      <div
        className="absolute top-20 left-[55%] h-5 w-5 rounded-full"
        style={{ background: 'rgba(var(--color-accent-rgb), 0.08)' }}
      />
      {/* Large arc ring — bottom right */}
      <div
        className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full"
        style={{ border: '1.5px solid rgba(var(--color-accent-rgb), 0.05)' }}
      />
    </div>
  );

  /* ---- Shared sidebar content ---- */
  const sidebarContent = (
    <>
      {/* Decorative background effects */}
      {decorativeElements}

      {/* Logo area */}
      <div className={cn(
        'relative z-10 flex h-16 flex-shrink-0 items-center px-4',
        'border-b border-slate-200/60 dark:border-white/[0.06]',
        collapsed && 'justify-center px-2',
      )}>
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/au-logo.png"
            alt="AU-IBAR"
            className={cn(
              'flex-shrink-0 object-contain',
              collapsed ? 'h-9 w-9' : 'h-10 w-10',
            )}
          />
          {!collapsed && (
            <span
              className="font-bold leading-none tracking-tight"
              style={{ fontSize: '1.9rem', color: '#800020' }}
            >
              ARIS
            </span>
          )}
        </div>

        {/* Mobile close button */}
        <button
          ref={closeButtonRef}
          onClick={onMobileClose}
          className="ml-auto flex items-center justify-center rounded-lg p-1.5 text-slate-400 dark:text-slate-500 hover:bg-black/[0.06] dark:hover:bg-white/10 hover:text-slate-600 dark:hover:text-white lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav
        className="relative z-10 flex-1 overflow-y-auto px-3 py-3 sidebar-scrollbar"
        aria-label="Main navigation"
      >
        {visibleGroups.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && 'mt-5')}>
            {/* Section label */}
            {collapsed ? (
              <div className="mx-auto my-2 h-px w-6 bg-slate-200 dark:bg-white/10" />
            ) : (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(renderNavItem)}
            </div>
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* ----- Desktop sidebar (>= lg) ----- */}
      <aside
        ref={sidebarRef}
        style={{ width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}
        className={cn(
          'relative hidden lg:flex h-screen flex-col flex-shrink-0',
          'border-r border-slate-200/80 dark:border-white/[0.06]',
          'sidebar-gradient',
          'sidebar-transition',
        )}
      >
        {sidebarContent}
      </aside>

      {/* ----- Mobile sidebar overlay (< lg) ----- */}

      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
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
          'relative fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col',
          'sidebar-gradient shadow-2xl',
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
