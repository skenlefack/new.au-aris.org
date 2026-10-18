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
  Waypoints,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { useHubUnreadCount } from '@/lib/api/hub-hooks';
import { cn } from '@/lib/utils';

const MAIN_NAV = [
  { key: 'dashboard', href: '/interop-hub', icon: LayoutDashboard, exact: true },
  { key: 'connections', href: '/interop-hub/connections', icon: Link2 },
  { key: 'pipelines', href: '/interop-hub/pipelines', icon: GitBranch },
  { key: 'inbox', href: '/interop-hub/inbox', icon: Inbox, badge: 'inbox' as const },
  { key: 'outbox', href: '/interop-hub/outbox', icon: Send, badge: 'outbox' as const },
  { key: 'transactions', href: '/interop-hub/transactions', icon: ArrowLeftRight },
  { key: 'agreements', href: '/interop-hub/agreements', icon: FileText },
  { key: 'schedules', href: '/interop-hub/schedules', icon: Clock },
];

const BOTTOM_NAV = [
  { key: 'audit', href: '/interop-hub/audit', icon: Shield },
];

function NavIcon({
  item,
  active,
  label,
  unreadCount,
}: {
  item: (typeof MAIN_NAV)[number];
  active: boolean;
  label: string;
  unreadCount: number;
}) {
  const Icon = item.icon;
  const showBadge = item.badge && unreadCount > 0;

  return (
    <Link
      href={item.href}
      className={cn(
        'group/tip relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200',
        active
          ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="h-[18px] w-[18px]" />

      {/* Badge */}
      {showBadge && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground animate-pulse">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      {/* Tooltip — CSS only, appears to the LEFT of the rail */}
      <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-md bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md border border-border/50 opacity-0 scale-95 transition-all duration-150 group-hover/tip:opacity-100 group-hover/tip:scale-100 z-50">
        {label}
        {/* Arrow */}
        <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full border-4 border-transparent border-l-popover" />
      </span>
    </Link>
  );
}

export default function InteropHubLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations('interopHub');
  const { data: unreadData } = useHubUnreadCount();
  const unreadCount = unreadData?.data?.count ?? 0;

  function isActive(item: { href: string; exact?: boolean }) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  const allNav = [...MAIN_NAV, ...BOTTOM_NAV];

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)]">
      {/* Main content — full width on mobile, leaves room for rail on lg */}
      <main className="min-w-0 flex-1 pb-16 lg:pb-0 lg:pr-12">{children}</main>

      {/* ── Right Icon Rail (desktop) ─────────────────────────── */}
      <aside className="fixed right-0 top-16 bottom-0 z-30 hidden w-12 flex-col items-center border-l bg-background/80 backdrop-blur-xl lg:flex">
        {/* Top nav items */}
        <div className="flex flex-1 flex-col items-center gap-1 pt-3">
          {MAIN_NAV.map((item) => (
            <NavIcon
              key={item.key}
              item={item}
              active={isActive(item)}
              label={t(`nav.${item.key}`)}
              unreadCount={unreadCount}
            />
          ))}
        </div>

        {/* Bottom section — pushed to bottom */}
        <div className="flex flex-col items-center gap-1 border-t border-border/40 pb-3 pt-2">
          {BOTTOM_NAV.map((item) => (
            <NavIcon
              key={item.key}
              item={item as (typeof MAIN_NAV)[number]}
              active={isActive(item)}
              label={t(`nav.${item.key}`)}
              unreadCount={0}
            />
          ))}

          {/* Hub brand icon */}
          <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
            <Waypoints className="h-3.5 w-3.5 text-primary/70" />
          </div>
        </div>
      </aside>

      {/* ── Bottom Bar (mobile) ───────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-30 flex h-14 items-center justify-around border-t bg-background/80 backdrop-blur-xl lg:hidden">
        {allNav.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          const showBadge = 'badge' in item && item.badge && unreadCount > 0;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              {showBadge && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-1 text-[8px] font-bold text-destructive-foreground animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              {active && (
                <span className="absolute -bottom-1 h-0.5 w-5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
