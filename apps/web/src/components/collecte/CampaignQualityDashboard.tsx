'use client';

import React from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  BarChart3,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCollectionCampaign, useWorkflowInstances } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';

/* ── Types ──────────────────────────────────────────────────────────────── */

interface CampaignQualityDashboardProps {
  campaignId: string;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const FUNNEL_LEVELS = [
  { key: 'NATIONAL_TECHNICAL', label: 'L1', color: 'bg-blue-500' },
  { key: 'NATIONAL_OFFICIAL', label: 'L2', color: 'bg-green-500' },
  { key: 'REC_HARMONIZATION', label: 'L3', color: 'bg-orange-500' },
  { key: 'CONTINENTAL_PUBLICATION', label: 'L4', color: 'bg-purple-500' },
  { key: 'COMPLETED', label: 'Done', color: 'bg-emerald-600' },
] as const;

/* ── Component ──────────────────────────────────────────────────────────── */

export default function CampaignQualityDashboard({ campaignId }: CampaignQualityDashboardProps) {
  const t = useTranslations('collecte');
  const { data: campaignRes } = useCollectionCampaign(campaignId);
  const campaign = (campaignRes as any)?.data as any | undefined;

  // Fetch workflow instances linked to this campaign's submissions
  const { data: wfRes } = useWorkflowInstances({ limit: 1000, entityId: campaignId });
  const wfInstances: any[] = wfRes?.data ?? [];

  // KPI data from campaign progress
  const progress = campaign?.progress;
  const totalSubmissions = progress?.totalSubmissions ?? 0;
  const validated = progress?.validated ?? 0;
  const rejected = progress?.rejected ?? 0;
  const pending = totalSubmissions - validated - rejected;
  const target = campaign?.targetSubmissions ?? 0;
  const pct = target > 0 ? Math.min(Math.round((totalSubmissions / target) * 100), 100) : 0;

  // Validation funnel: count instances by current level
  const funnelCounts: Record<string, number> = {};
  FUNNEL_LEVELS.forEach((l) => { funnelCounts[l.key] = 0; });
  wfInstances.forEach((inst) => {
    if (inst.status === 'COMPLETED' || inst.status === 'APPROVED') {
      funnelCounts['COMPLETED'] = (funnelCounts['COMPLETED'] ?? 0) + 1;
    } else if (inst.currentLevel && funnelCounts[inst.currentLevel] !== undefined) {
      funnelCounts[inst.currentLevel] += 1;
    }
  });
  const maxFunnel = Math.max(1, ...Object.values(funnelCounts));

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          bg="bg-blue-50 dark:bg-blue-900/20"
          label={t('totalSubmissions')}
          value={totalSubmissions}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          bg="bg-green-50 dark:bg-green-900/20"
          label={t('validated')}
          value={validated}
          accent="text-green-600"
        />
        <KpiCard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          bg="bg-amber-50 dark:bg-amber-900/20"
          label={t('pending')}
          value={pending}
          accent="text-amber-600"
        />
        <KpiCard
          icon={<XCircle className="h-5 w-5 text-red-600" />}
          bg="bg-red-50 dark:bg-red-900/20"
          label={t('rejected')}
          value={rejected}
          accent="text-red-600"
        />
      </div>

      {/* Completion bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <Target className="h-4 w-4 text-gray-400" />
            {t('campaignProgress')}
          </h3>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('targetReached', { current: String(totalSubmissions), target: String(target || '--') })}
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">{pct}%</p>
      </div>

      {/* Validation Funnel */}
      {wfInstances.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-4">
            <BarChart3 className="h-4 w-4 text-gray-400" />
            {t('validationFunnel')}
          </h3>
          <div className="space-y-2.5">
            {FUNNEL_LEVELS.map((level) => {
              const count = funnelCounts[level.key] ?? 0;
              const barPct = maxFunnel > 0 ? Math.round((count / maxFunnel) * 100) : 0;
              return (
                <div key={level.key} className="flex items-center gap-3">
                  <span className="w-10 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">
                    {level.label}
                  </span>
                  <div className="flex-1 h-6 rounded-md bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
                    <div
                      className={cn('h-full rounded-md transition-all duration-500', level.color)}
                      style={{ width: `${Math.max(barPct, count > 0 ? 3 : 0)}%` }}
                    />
                    {count > 0 && (
                      <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-semibold text-white drop-shadow-sm">
                        {count}
                      </span>
                    )}
                  </div>
                  <span className="w-8 text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function KpiCard({ icon, bg, label, value, accent }: {
  icon: React.ReactNode; bg: string; label: string; value: number; accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', bg)}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className={cn('text-xl font-bold text-gray-900 dark:text-white', accent)}>
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
