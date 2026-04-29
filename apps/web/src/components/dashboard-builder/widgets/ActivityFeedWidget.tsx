'use client';

import React from 'react';
import { FileText, AlertTriangle, CheckCircle, Database, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

type ActivityType = 'report' | 'alert' | 'validation' | 'data' | 'system';

interface Activity {
  type: string;
  action: string;
  detail?: string;
  actor?: string;
  timestamp: string;
}

interface ActivityFeedWidgetProps {
  activities: Activity[];
  maxItems?: number;
}

const TYPE_CONFIG: Record<ActivityType, { icon: typeof FileText; color: string; dot: string }> = {
  report:     { icon: FileText,      color: 'text-blue-600',   dot: 'bg-blue-500' },
  alert:      { icon: AlertTriangle, color: 'text-red-600',    dot: 'bg-red-500' },
  validation: { icon: CheckCircle,   color: 'text-green-600',  dot: 'bg-green-500' },
  data:       { icon: Database,      color: 'text-purple-600', dot: 'bg-purple-500' },
  system:     { icon: Settings,      color: 'text-gray-500',   dot: 'bg-gray-400' },
};

function relativeTime(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return ts;
  }
}

export function ActivityFeedWidget({ activities, maxItems = 20 }: ActivityFeedWidgetProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No recent activity
      </div>
    );
  }

  const display = activities.slice(0, maxItems);

  return (
    <div className="h-full overflow-auto p-3">
      <div className="relative space-y-3">
        {/* vertical timeline line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />

        {display.map((act, i) => {
          const cfg = TYPE_CONFIG[(act.type as ActivityType)] ?? TYPE_CONFIG.system;
          const Icon = cfg.icon;
          return (
            <div key={i} className="relative flex items-start gap-3 pl-5">
              <div className={cn('absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-900', cfg.dot)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', cfg.color)} />
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                    {act.action}
                  </span>
                </div>
                {act.detail && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                    {act.detail}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                  {act.actor && <span>{act.actor}</span>}
                  <span>{relativeTime(act.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
