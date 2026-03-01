'use client';

import React from 'react';
import {
  ClipboardCheck, FileUp, AlertTriangle, ArrowUpRight, Megaphone, Upload,
} from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import { cn } from '@/lib/utils';
import type { ActivityItem } from '../demo-data';

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  submission: { icon: ClipboardCheck, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/30' },
  validation: { icon: ClipboardCheck, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30' },
  import: { icon: Upload, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
  alert: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
  export: { icon: ArrowUpRight, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  campaign: { icon: Megaphone, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface MetricActivityWidgetProps {
  title: string;
  subtitle?: string;
  activities: ActivityItem[];
  demo?: boolean;
}

export function MetricActivityWidget({ title, subtitle, activities, demo }: MetricActivityWidgetProps) {
  return (
    <WidgetWrapper title={title} subtitle={subtitle} demo={demo} noPadding>
      <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-[400px] overflow-y-auto">
        {activities.map((act) => {
          const cfg = TYPE_CONFIG[act.type] ?? TYPE_CONFIG.submission;
          const Icon = cfg.icon;
          return (
            <div key={act.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <div className={cn('mt-0.5 flex-shrink-0 rounded-lg p-1.5', cfg.bg)}>
                <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{act.action}</p>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">{act.detail}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                  <span>{act.actor}</span>
                  <span className="text-gray-300 dark:text-gray-600">&middot;</span>
                  <span>{act.country}</span>
                  <span className="text-gray-300 dark:text-gray-600">&middot;</span>
                  <span>{timeAgo(act.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetWrapper>
  );
}
