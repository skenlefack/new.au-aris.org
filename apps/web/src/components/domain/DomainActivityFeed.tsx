'use client';

import React from 'react';
import { FileText, CheckCircle2, Play, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DomainSummary } from '@/lib/api/domain-summary-hooks';

interface DomainActivityFeedProps {
  activities: DomainSummary['recentActivity'] | null;
  loading?: boolean;
}

const TYPE_CONFIG = {
  submission: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', label: 'Soumission' },
  validation: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', label: 'Validation' },
  campaign_start: { icon: Play, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', label: 'Campagne lancee' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export function DomainActivityFeed({ activities, loading }: DomainActivityFeedProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-50 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-gray-400" />
          Activite recente
        </h3>
        <p className="text-sm text-gray-400 text-center py-6">Aucune activite recente</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-gray-400" />
        Activite recente
      </h3>
      <div className="space-y-2">
        {activities.map((a, i) => {
          const cfg = TYPE_CONFIG[a.type] ?? TYPE_CONFIG.submission;
          const Icon = cfg.icon;
          return (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg shrink-0', cfg.bg)}>
                <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {cfg.label}{a.formName ? ` -- ${a.formName}` : ''}
                </p>
                {a.country && (
                  <p className="text-[10px] text-gray-400 truncate">{a.country}</p>
                )}
              </div>
              <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(a.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
