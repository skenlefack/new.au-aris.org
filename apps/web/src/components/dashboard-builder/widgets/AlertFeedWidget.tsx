'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Severity = 'critical' | 'warning' | 'info' | 'success';

interface AlertItem {
  id: string;
  title: string;
  severity: Severity;
  timestamp: string;
  description?: string;
}

interface AlertFeedWidgetProps {
  alerts: AlertItem[];
  maxItems?: number;
}

const SEVERITY_CONFIG: Record<
  Severity,
  { icon: typeof AlertTriangle; color: string; bg: string }
> = {
  critical: {
    icon: AlertCircle,
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-950/30',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
  },
  info: {
    icon: Info,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
  },
  success: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-950/30',
  },
};

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return ts;
  }
}

export function AlertFeedWidget({ alerts, maxItems = 20 }: AlertFeedWidgetProps) {
  const display = alerts.slice(0, maxItems);

  if (display.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No alerts
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-2">
      <div className="space-y-1.5">
        {display.map((alert) => {
          const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info;
          const Icon = cfg.icon;
          return (
            <div
              key={alert.id}
              className={cn(
                'flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors',
                cfg.bg,
              )}
            >
              <Icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', cfg.color)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                    {alert.title}
                  </p>
                  <span className="flex-shrink-0 text-[11px] text-gray-400">
                    {formatTimestamp(alert.timestamp)}
                  </span>
                </div>
                {alert.description && (
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {alert.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
