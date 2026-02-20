'use client';

import React from 'react';
import { X, Bell, Check, CheckCheck, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/lib/api/hooks';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  outbreak: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-red-500 bg-red-50',
  },
  workflow: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-blue-500 bg-blue-50',
  },
  quality: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-amber-500 bg-amber-50',
  },
  system: {
    icon: <Info className="h-4 w-4" />,
    color: 'text-gray-500 bg-gray-100',
  },
};

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const { data, isLoading } = useNotifications({ limit: 50 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.data ?? [];

  // Group by date
  const groups = new Map<string, typeof notifications>();
  for (const n of notifications) {
    const key = formatDateGroup(n.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Notifications
            </h2>
            {unreadCount > 0 && (
              <span className="rounded-full bg-aris-accent-600 px-2 py-0.5 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-aris-primary-600 hover:bg-aris-primary-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400">
              <Bell className="h-10 w-10 mb-2" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            Array.from(groups.entries()).map(([date, items]) => (
              <div key={date}>
                <div className="sticky top-0 bg-gray-50 px-5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {date}
                  </p>
                </div>
                <div className="divide-y divide-gray-100">
                  {items.map((n) => {
                    const config =
                      TYPE_CONFIG[n.type] ?? TYPE_CONFIG['system'];
                    return (
                      <div
                        key={n.id}
                        className={cn(
                          'flex gap-3 px-5 py-3 transition-colors',
                          !n.readAt ? 'bg-blue-50/30' : 'hover:bg-gray-50',
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                            config.color,
                          )}
                        >
                          {config.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'text-sm',
                              !n.readAt ? 'font-medium text-gray-900' : 'text-gray-700',
                            )}
                          >
                            {n.title}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                            {n.body}
                          </p>
                          <p className="mt-1 text-[10px] text-gray-400">
                            {formatRelativeTime(n.createdAt)}
                          </p>
                        </div>
                        {!n.readAt && (
                          <button
                            onClick={() => markRead.mutate(n.id)}
                            className="flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
