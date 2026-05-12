'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Plus,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCollectionCampaigns } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';

interface PlanningTarget {
  domainCode?: string;
  subDomainCode?: string;
}

interface PlanningsSectionProps {
  target: PlanningTarget;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'PLANNED' | 'COMPLETED';

const STATUS_FILTER_KEYS: { value: StatusFilter; tKey: string }[] = [
  { value: 'ALL', tKey: 'filterAll' },
  { value: 'ACTIVE', tKey: 'filterActive' },
  { value: 'PLANNED', tKey: 'filterUpcoming' },
  { value: 'COMPLETED', tKey: 'filterCompleted' },
];

const STATUS_BADGE: Record<string, { classes: string; icon: React.ElementType }> = {
  ACTIVE: { classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: Activity },
  PLANNED: { classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  DRAFT: { classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', icon: AlertCircle },
  COMPLETED: { classes: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: CheckCircle2 },
  CLOSED: { classes: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400', icon: CheckCircle2 },
};

/**
 * Section displaying collection campaigns (planifications) linked to a
 * domain or sub-domain. Supports status filtering, campaign cards with
 * progress, and a "new campaign" CTA.
 */
export function PlanningsSection({ target }: PlanningsSectionProps) {
  const t = useTranslations('collecte');
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  // Map page route codes to DB domain values (e.g. 'livestock-prod' → 'livestock')
  const DOMAIN_MAP: Record<string, string> = { 'livestock-prod': 'livestock' };
  const domainParam = DOMAIN_MAP[target.domainCode ?? ''] ?? target.domainCode?.replace(/-/g, '_') ?? undefined;

  const { data, isLoading } = useCollectionCampaigns({
    domain: domainParam,
    limit: 50,
  });

  const allCampaigns: any[] = Array.isArray(data?.data) ? data.data : [];

  // Filter by sub-domain code if provided (campaigns may have targets metadata)
  let campaigns = allCampaigns;
  if (target.subDomainCode) {
    campaigns = allCampaigns.filter((c: any) => {
      const targets = c.targets ?? c.metadata?.targets ?? [];
      if (Array.isArray(targets)) {
        return targets.some(
          (t: any) =>
            t.subDomainCode === target.subDomainCode ||
            t.code === target.subDomainCode,
        );
      }
      return true; // if no target info, show all
    });
  }

  // Apply status filter
  if (filter !== 'ALL') {
    campaigns = campaigns.filter((c: any) => c.status === filter);
  }

  const campaignUrl = target.domainCode
    ? `/collecte/campaigns?domain=${domainParam}`
    : '/collecte/campaigns';

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#1F4E79]" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('plannings')}
          </h2>
          {!isLoading && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
              {campaigns.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter pills */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5 dark:border-gray-600">
            {STATUS_FILTER_KEYS.map((sf) => (
              <button
                key={sf.value}
                onClick={() => setFilter(sf.value)}
                className={cn(
                  'rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                  filter === sf.value
                    ? 'bg-[#1F4E79] text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                )}
              >
                {t(sf.tKey)}
              </button>
            ))}
          </div>

          {/* New campaign */}
          <Link
            href={`/collecte/campaigns/new${target.domainCode ? `?domain=${domainParam}` : ''}`}
            className="flex items-center gap-1 rounded-md bg-[#1F4E79] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#1a4060]"
          >
            <Plus className="h-3 w-3" />
            {t('newCampaignShort')}
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
            <Calendar className="h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              {filter !== 'ALL'
                ? t('noCampaignsForFilter')
                : t('noCampaignsPlanned')}
            </p>
            <Link
              href={`/collecte/campaigns/new${target.domainCode ? `?domain=${domainParam}` : ''}`}
              className="mt-3 flex items-center gap-1 rounded-lg bg-[#1F4E79] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1a4060]"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('createACampaign')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c: any) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        )}

        {/* Footer link */}
        {campaigns.length > 0 && (
          <div className="mt-4 text-center">
            <Link
              href={campaignUrl}
              className="text-xs font-medium text-[#1F4E79] hover:underline dark:text-blue-400"
            >
              {t('viewAllCampaigns')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Campaign Card ─────────────────────────────────── */

const CARD_COLORS = ['#C62828', '#1565C0', '#2E7D32', '#E65100', '#6A1B9A', '#00838F'];

function CampaignCard({ campaign }: { campaign: any }) {
  const t = useTranslations('collecte');
  const c = campaign;
  const name =
    typeof c.name === 'object'
      ? c.name?.en ?? c.name?.fr ?? Object.values(c.name)[0]
      : c.name;
  const progress =
    c.targetSubmissions > 0
      ? Math.min(100, Math.round(((c.totalSubmissions ?? 0) / c.targetSubmissions) * 100))
      : 0;
  const status = STATUS_BADGE[c.status] ?? STATUS_BADGE.DRAFT;
  const StatusIcon = status.icon;
  const color = CARD_COLORS[Math.abs(hashCode(c.id)) % CARD_COLORS.length];

  return (
    <Link
      href={`/collecte/campaigns/${c.id}`}
      className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:from-gray-800 dark:to-gray-800/80"
    >
      {/* Top accent */}
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />

      <div className="flex items-start justify-between">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: color }}
        >
          <Activity className="h-4 w-4" />
        </div>
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
            status.classes,
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {c.status}
        </span>
      </div>

      <h4 className="mt-3 text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-[#1F4E79] dark:text-white">
        {name}
      </h4>

      {/* Progress */}
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {(c.totalSubmissions ?? 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-400">
            {c.targetSubmissions
              ? `/ ${c.targetSubmissions.toLocaleString()} ${t('targetLabel')}`
              : t('submissionsLabel')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold" style={{ color }}>
            {progress}%
          </p>
        </div>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, backgroundColor: color }}
        />
      </div>

      {/* Dates */}
      {(c.startDate || c.endDate) && (
        <p className="mt-2 text-[10px] text-gray-400">
          {c.startDate ? new Date(c.startDate).toLocaleDateString() : ''}
          {c.startDate && c.endDate ? ' - ' : ''}
          {c.endDate ? new Date(c.endDate).toLocaleDateString() : ''}
        </p>
      )}

      {/* Target badges */}
      {Array.isArray(c.targets) && c.targets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {c.targets.slice(0, 3).map((t: any, i: number) => (
            <span
              key={i}
              className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            >
              {t.label ?? t.code ?? t.subDomainCode}
            </span>
          ))}
          {c.targets.length > 3 && (
            <span className="text-[9px] text-gray-400">+{c.targets.length - 3}</span>
          )}
        </div>
      )}
    </Link>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
