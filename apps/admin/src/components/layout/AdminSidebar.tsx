'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Shield,
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  ScrollText,
  Activity,
  Database,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Tenants', href: '/tenants', icon: <Building2 className="w-5 h-5" /> },
  { label: 'Users', href: '/users', icon: <Users className="w-5 h-5" /> },
  { label: 'Data Contracts', href: '/data-contracts', icon: <FileText className="w-5 h-5" /> },
  { label: 'Audit Log', href: '/audit', icon: <ScrollText className="w-5 h-5" /> },
  { label: 'Monitoring', href: '/monitoring', icon: <Activity className="w-5 h-5" /> },
  { label: 'Master Data', href: '/master-data', icon: <Database className="w-5 h-5" /> },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-admin-surface border-r border-admin-border transition-all duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-admin-border">
        <Shield className="w-7 h-7 text-primary-500 flex-shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-admin-heading truncate">
              ARIS Admin
            </p>
            <p className="text-xs text-admin-muted truncate">AU-IBAR</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-primary-900/50 text-primary-400 border border-primary-800/50'
                    : 'text-admin-muted hover:text-admin-text hover:bg-admin-hover',
                  collapsed && 'justify-center px-2',
                )}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-admin-border p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg text-admin-muted hover:text-admin-text hover:bg-admin-hover transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
