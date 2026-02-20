'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  HeartPulse,
  ClipboardList,
  GitPullRequestArrow,
  Database,
  ShieldCheck,
  ArrowLeftRight,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

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
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="h-5 w-5" />,
    matchPrefix: '/settings',
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  function isActive(item: NavItem): boolean {
    if (item.matchPrefix === '/') return pathname === '/';
    return pathname.startsWith(item.matchPrefix);
  }

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-gray-200 bg-white sidebar-transition',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
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
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
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

      {/* Collapse toggle */}
      <div className="border-t border-gray-200 p-3">
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
    </aside>
  );
}
