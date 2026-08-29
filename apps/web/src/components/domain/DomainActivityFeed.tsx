'use client';

import React from 'react';
import { FileText, CheckCircle2, Play, Clock, ArrowRight, Globe2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { AFRICA_COUNTRIES } from '@/components/dashboard/maps/africa-geo-data';
import type { DomainSummary } from '@/lib/api/domain-summary-hooks';

interface DomainActivityFeedProps {
  activities: DomainSummary['recentActivity'] | null;
  loading?: boolean;
  domainColor?: string;
}

const TYPE_CONFIG = {
  submission: { icon: FileText, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', ring: 'ring-blue-100 dark:ring-blue-800/40', labelKey: 'activitySubmission' },
  validation: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', ring: 'ring-emerald-100 dark:ring-emerald-800/40', labelKey: 'activityValidation' },
  campaign_start: { icon: Play, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/30', ring: 'ring-violet-100 dark:ring-violet-800/40', labelKey: 'activityCampaignStarted' },
};

const COUNTRY_MAP = new Map(AFRICA_COUNTRIES.map((c) => [c.code, c]));

function resolveCountry(code?: string): { name: string; flag: string } | null {
  if (!code) return null;
  const c = COUNTRY_MAP.get(code.toUpperCase());
  if (!c) return null;
  // Simple flag from code
  const flag = String.fromCodePoint(
    ...code.toUpperCase().split('').map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
  return { name: c.name, flag };
}

function parseFormName(raw?: string): string {
  if (!raw) return '';
  // Handle JSON name objects: {"en":"...", "fr":"..."}
  if (raw.startsWith('{')) {
    try {
      const obj = JSON.parse(raw);
      return obj.fr || obj.en || raw;
    } catch {
      return raw;
    }
  }
  return raw;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function DomainActivityFeed({ activities, loading, domainColor }: DomainActivityFeedProps) {
  const t = useTranslations('domain');
  const accentColor = domainColor || '#1F4E79';

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <div className="border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <div className="h-5 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className="h-9 w-9 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-3 w-32 animate-pulse rounded bg-gray-50 dark:bg-gray-800/50" />
              </div>
              <div className="h-3 w-16 animate-pulse rounded bg-gray-50 dark:bg-gray-800/50" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <div className="border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Activity className="h-4 w-4" style={{ color: accentColor }} />
            {t('recentActivity')}
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-800 mb-3">
            <Clock className="h-5 w-5 text-gray-300 dark:text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-400 dark:text-gray-500">{t('noRecentActivity')}</p>
          <p className="mt-1 text-xs text-gray-300 dark:text-gray-600">{t('noRecentActivityHint')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: accentColor }} />
          {t('recentActivity')}
          <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {activities.length}
          </span>
        </h3>
      </div>

      {/* Timeline */}
      <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
        {activities.map((a, i) => {
          const cfg = TYPE_CONFIG[a.type] ?? TYPE_CONFIG.submission;
          const Icon = cfg.icon;
          const country = resolveCountry(a.country);
          const formName = parseFormName(a.formName);

          return (
            <div
              key={i}
              className="group flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition-colors"
            >
              {/* Icon */}
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl ring-1 shrink-0', cfg.bg, cfg.ring)}>
                <Icon className={cn('h-4 w-4', cfg.color)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {t(cfg.labelKey)}
                  </span>
                  {country && (
                    <>
                      <ArrowRight className="h-3 w-3 text-gray-300 dark:text-gray-600 shrink-0" />
                      <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                        <span className="text-sm">{country.flag}</span>
                        {country.name}
                      </span>
                    </>
                  )}
                  {!country && a.country && (
                    <>
                      <ArrowRight className="h-3 w-3 text-gray-300 dark:text-gray-600 shrink-0" />
                      <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                        <Globe2 className="h-3 w-3" />
                        {a.country}
                      </span>
                    </>
                  )}
                </div>
                {formName && (
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-md">
                    {formName}
                  </p>
                )}
              </div>

              {/* Timestamp */}
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                  {timeAgo(a.timestamp)}
                </p>
                <p className="text-[10px] text-gray-300 dark:text-gray-600">
                  {formatDate(a.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
