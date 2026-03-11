'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import {
  Globe,
  Flag,
  Cog,
  Shield,
  Bell,
  Languages,
  ShieldCheck,
  Layers,
  ClipboardList,
  Server,
  ChevronLeft,
  Briefcase,
  Users,
  GitPullRequestArrow,
  Link2,
  BarChart3,
  Building2,
} from 'lucide-react';

interface SettingsNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  section: string;
}

const NAV_ITEMS: SettingsNavItem[] = [
  { href: '/settings', label: 'Overview', icon: <Cog className="h-4 w-4" />, section: 'overview' },
  { href: '/settings/recs', label: 'RECs', icon: <Globe className="h-4 w-4" />, section: 'recs' },
  { href: '/settings/countries', label: 'Countries', icon: <Flag className="h-4 w-4" />, section: 'countries' },
  { href: '/settings/functions', label: 'Functions', icon: <Briefcase className="h-4 w-4" />, section: 'functions' },
  { href: '/settings/users', label: 'Users', icon: <Users className="h-4 w-4" />, section: 'users' },
  { href: '/settings/general', label: 'General', icon: <Cog className="h-4 w-4" />, section: 'general' },
  { href: '/settings/security', label: 'Security', icon: <Shield className="h-4 w-4" />, section: 'security' },
  { href: '/settings/notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" />, section: 'notifications' },
  { href: '/settings/i18n', label: 'Languages', icon: <Languages className="h-4 w-4" />, section: 'i18n' },
  { href: '/settings/data-quality', label: 'Data Quality', icon: <ShieldCheck className="h-4 w-4" />, section: 'data-quality' },
  { href: '/settings/domains', label: 'Domains', icon: <Layers className="h-4 w-4" />, section: 'domains' },
  { href: '/settings/workflow', label: 'Workflow', icon: <GitPullRequestArrow className="h-4 w-4" />, section: 'workflow' },
  { href: '/settings/validation-chains', label: 'Validation Chains', icon: <Link2 className="h-4 w-4" />, section: 'validation-chains' },
  { href: '/settings/infrastructures', label: 'Infra. Types', icon: <Building2 className="h-4 w-4" />, section: 'infrastructures' },
  { href: '/settings/bi-access', label: 'BI Data Access', icon: <BarChart3 className="h-4 w-4" />, section: 'bi-access' },
  { href: '/settings/audit', label: 'Audit Log', icon: <ClipboardList className="h-4 w-4" />, section: 'audit' },
  { href: '/settings/system', label: 'System', icon: <Server className="h-4 w-4" />, section: 'system' },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { canViewSection, isSuperAdmin, isContinentalAdmin } = useSettingsAccess();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.section === 'overview') return true;
    if (isSuperAdmin || isContinentalAdmin) return true;
    return canViewSection(item.section);
  });

  return (
    <div className="flex gap-6">
      {/* Settings sidebar */}
      <aside className="hidden w-52 shrink-0 lg:block">
        <div className="sticky top-4 space-y-1">
          <Link
            href="/home"
            className="mb-4 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ChevronLeft className="h-3 w-3" />
            Back to Dashboard
          </Link>

          {visibleItems.map((item) => {
            const active = item.href === '/settings'
              ? pathname === '/settings'
              : pathname.startsWith(item.href) && item.href !== '/settings';

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-aris-primary-50 text-aris-primary-700 dark:bg-aris-primary-900/30 dark:text-aris-primary-400'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white',
                )}
              >
                <span className={cn(active ? 'text-aris-primary-600 dark:text-aris-primary-400' : 'text-gray-400 dark:text-gray-500')}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
