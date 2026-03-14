'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Target,
  Users,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  XCircle,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useCollectionCampaigns,
  useActivateCampaign,
  usePauseCampaign,
  useCompleteCampaign,
} from '@/lib/api/workflow-hooks';

function i18n(val: unknown): string {
  if (!val) return '—';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, string>;
    return obj['en'] ?? obj['fr'] ?? Object.values(obj)[0] ?? '—';
  }
  return String(val);
}

const STATUS_CONFIG: Record<string, { tKey: string; color: string; icon: React.ReactNode }> = {
  PLANNED: { tKey: 'tabPlanned', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: <Clock className="h-3.5 w-3.5" /> },
  ACTIVE: { tKey: 'tabActive', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: <Play className="h-3.5 w-3.5" /> },
  PAUSED: { tKey: 'paused', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: <Pause className="h-3.5 w-3.5" /> },
  COMPLETED: { tKey: 'tabCompleted', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  CANCELLED: { tKey: 'cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: <XCircle className="h-3.5 w-3.5" /> },
};

const DOMAIN_LABELS: Record<string, string> = {
  animal_health: 'Animal Health',
  livestock: 'Livestock',
  fisheries: 'Fisheries',
  wildlife: 'Wildlife',
  apiculture: 'Apiculture',
  trade_sps: 'Trade & SPS',
  governance: 'Governance',
  climate_env: 'Climate & Env',
};

export default function CampaignsPage() {
  const t = useTranslations('collecte');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');

  const { data: res, isLoading } = useCollectionCampaigns({
    page,
    limit: 20,
    status: statusFilter || undefined,
    domain: domainFilter || undefined,
  });

  const activateMut = useActivateCampaign();
  const pauseMut = usePauseCampaign();
  const completeMut = useCompleteCampaign();

  const campaigns = res?.data ?? [];
  const meta = res?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('collectionCampaigns')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('collectionCampaignsDesc')}
          </p>
        </div>
        <Link
          href="/collecte/campaigns/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          {t('newCampaign')}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        >
          <option value="">{t('allStatuses')}</option>
          <option value="PLANNED">{t('tabPlanned')}</option>
          <option value="ACTIVE">{t('tabActive')}</option>
          <option value="PAUSED">{t('paused')}</option>
          <option value="COMPLETED">{t('tabCompleted')}</option>
          <option value="CANCELLED">{t('cancelled')}</option>
        </select>
        <select
          value={domainFilter}
          onChange={(e) => { setDomainFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        >
          <option value="">{t('allDomains')}</option>
          {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Campaign list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-12 text-center">
          <Target className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
            {t('noCampaignsFound')}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('createCampaignToStart')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign: any) => {
            const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG['PLANNED'];
            const targetCountries = campaign.targetCountries ?? [];
            const progress = campaign.progress ?? {};
            const submitted = progress.submitted ?? 0;
            const target = campaign.targetSubmissions ?? 0;
            const pct = target > 0 ? Math.round((submitted / target) * 100) : 0;

            return (
              <div
                key={campaign.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/collecte/campaigns/${campaign.id}`}
                        className="text-sm font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {i18n(campaign.name)}
                      </Link>
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        statusCfg.color,
                      )}>
                        {statusCfg.icon}
                        {t(statusCfg.tKey)}
                      </span>
                      <span className="rounded bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400">
                        {campaign.code}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                      {i18n(campaign.description)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : '—'} —{' '}
                        {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="h-3.5 w-3.5" />
                        {target} {t('targetSubmissions')}
                      </span>
                      {campaign.domain && (
                        <span className="rounded bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-blue-700 dark:text-blue-300">
                          {DOMAIN_LABELS[campaign.domain] ?? campaign.domain}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {campaign._count?.assignments ?? 0} {t('agents').toLowerCase()}
                      </span>
                      {targetCountries.length > 0 && (
                        <span className="flex items-center gap-1">
                          {targetCountries.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="ml-4 flex items-center gap-2">
                    {campaign.status === 'PLANNED' && (
                      <button
                        onClick={() => activateMut.mutate(campaign.id)}
                        disabled={activateMut.isPending}
                        className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <Play className="h-3 w-3" /> {t('activate')}
                      </button>
                    )}
                    {campaign.status === 'ACTIVE' && (
                      <>
                        <button
                          onClick={() => pauseMut.mutate(campaign.id)}
                          disabled={pauseMut.isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                        >
                          <Pause className="h-3 w-3" /> {t('pause')}
                        </button>
                        <button
                          onClick={() => completeMut.mutate(campaign.id)}
                          disabled={completeMut.isPending}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3 w-3" /> {t('complete')}
                        </button>
                      </>
                    )}
                    {campaign.status === 'PAUSED' && (
                      <button
                        onClick={() => activateMut.mutate(campaign.id)}
                        disabled={activateMut.isPending}
                        className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <Play className="h-3 w-3" /> {t('resume')}
                      </button>
                    )}
                    <Link
                      href={`/collecte/campaigns/${campaign.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <BarChart3 className="h-3 w-3" /> {t('details')}
                    </Link>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>{t('progressLabel')} {submitted} / {target} ({pct}%)</span>
                    {progress.validated != null && (
                      <span>{t('validatedLabel')} {progress.validated}</span>
                    )}
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="flex h-full">
                      {progress.validated > 0 && (
                        <div
                          className="bg-green-500 transition-all"
                          style={{ width: `${target > 0 ? (progress.validated / target) * 100 : 0}%` }}
                        />
                      )}
                      <div
                        className="bg-blue-400 transition-all"
                        style={{ width: `${target > 0 ? ((submitted - (progress.validated ?? 0)) / target) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {meta && meta.total > meta.limit && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('showing')} {(meta.page - 1) * meta.limit + 1}–
                {Math.min(meta.page * meta.limit, meta.total)} / {meta.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {t('previous')}
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * (meta.limit ?? 20) >= meta.total}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {t('next')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
