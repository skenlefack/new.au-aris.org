'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Link2,
  GitBranch,
  Inbox,
  Send,
  ArrowLeftRight,
  FileText,
  Clock,
  Shield,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { useHubUnreadCount } from '@/lib/api/hub-hooks';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { key: 'dashboard', href: '/interop-hub', icon: LayoutDashboard, exact: true },
  { key: 'connections', href: '/interop-hub/connections', icon: Link2 },
  { key: 'pipelines', href: '/interop-hub/pipelines', icon: GitBranch },
  { key: 'inbox', href: '/interop-hub/inbox', icon: Inbox, badge: 'inbox' as const },
  { key: 'outbox', href: '/interop-hub/outbox', icon: Send, badge: 'outbox' as const },
  { key: 'transactions', href: '/interop-hub/transactions', icon: ArrowLeftRight },
  { key: 'agreements', href: '/interop-hub/agreements', icon: FileText },
  { key: 'schedules', href: '/interop-hub/schedules', icon: Clock },
  { key: 'audit', href: '/interop-hub/audit', icon: Shield },
];

export default function InteropHubLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations('interopHub');
  const { data: unreadData } = useHubUnreadCount();
  const unreadCount = unreadData?.data?.count ?? 0;

  function isActive(item: typeof NAV_ITEMS[number]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r bg-card lg:block">
        <div className="sticky top-16 space-y-1 p-3">
          <h2 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('title')}
          </h2>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{t(`nav.${item.key}`)}</span>
                {item.badge && unreadCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
