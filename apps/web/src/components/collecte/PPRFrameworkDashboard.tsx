'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, CheckCircle, Clock, Calendar, BarChart3 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

/* ── Indicator Card ── */
function IndicatorCard({ code, title, color, borderColor }: {
  code: string; title: string; color: string; borderColor: string;
}) {
  return (
    <div className="rounded-lg border-l-4 bg-white p-3 shadow-sm dark:bg-gray-800" style={{ borderColor }}>
      <div className="flex items-start gap-2">
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold text-white" style={{ backgroundColor: borderColor }}>
          {code}
        </span>
        <p className="text-[10px] leading-relaxed text-gray-600 dark:text-gray-400">{title}</p>
      </div>
    </div>
  );
}

/* ── Output Group ── */
function OutputGroup({ number, title, color, children }: {
  number: number; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: color }}>
          {number}
        </span>
        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{title}</span>
      </div>
      <div className="space-y-1.5 pl-7">
        {children}
      </div>
    </div>
  );
}

/* ── Output Item ── */
function OutputItem({ code, title }: { code: string; title: string }) {
  return (
    <div className="rounded-lg border-l-4 border-[#059669] bg-white p-2.5 shadow-sm dark:bg-gray-800">
      <div className="flex items-start gap-2">
        <span className="shrink-0 rounded-full bg-[#059669] px-1.5 py-0.5 text-[8px] font-bold text-white">
          {code}
        </span>
        <p className="text-[9px] leading-relaxed text-gray-600 dark:text-gray-400">{title}</p>
      </div>
    </div>
  );
}

/* ── Status dot ── */
function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[9px] text-gray-500">{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════════════════════ */

export default function PPRFrameworkDashboard() {
  const t = useTranslations('collecte');

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="rounded-xl bg-[#e8f5e9] p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2E7D32] text-white">
              <span className="text-lg font-bold">AU</span>
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-[#2E7D32]">{t('pprFwTitle')}</h1>
              <p className="text-[11px] text-[#4CAF50]">{t('pprFwSubtitle')}</p>
              <span className="mt-1 inline-block rounded-full border border-[#4CAF50]/30 px-3 py-0.5 text-[10px] text-[#2E7D32]">
                {t('pprFwProgrammePeriod')}
              </span>
            </div>
          </div>
          {/* KPI Summary badges */}
          <div className="flex gap-2">
            <div className="flex flex-col items-center rounded-lg bg-[#DC2626] px-4 py-2 text-white">
              <span className="text-xl font-extrabold">3</span>
              <span className="text-[9px] font-medium">{t('pprFwBadgeImpact')}</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-[#F59E0B] px-4 py-2 text-white">
              <span className="text-xl font-extrabold">5</span>
              <span className="text-[9px] font-medium">{t('pprFwBadgeOutcome')}</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-[#059669] px-4 py-2 text-white">
              <span className="text-xl font-extrabold">12</span>
              <span className="text-[9px] font-medium">{t('pprFwBadgeOutput')}</span>
            </div>
          </div>
        </div>
        {/* Status legend */}
        <div className="mt-3 flex gap-4">
          <StatusDot color="#22c55e" label={t('pprFwLegendOnTrack')} />
          <StatusDot color="#3b82f6" label={t('pprFwLegendInProgress')} />
          <StatusDot color="#ef4444" label={t('pprFwLegendDataGap')} />
        </div>
      </div>

      {/* ── IMPACT LEVEL ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded-full border-2 border-[#DC2626] px-3 py-0.5 text-[11px] font-bold text-[#DC2626]">
            {t('pprFwImpactLevel')}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <IndicatorCard code="IMP-01" title={t('pprFwImp01')} color="#DC2626" borderColor="#DC2626" />
          <IndicatorCard code="IMP-02" title={t('pprFwImp02')} color="#DC2626" borderColor="#DC2626" />
          <IndicatorCard code="IMP-03" title={t('pprFwImp03')} color="#DC2626" borderColor="#DC2626" />
        </div>
      </div>

      {/* ── OUTCOME LEVEL ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded-full border-2 border-[#F59E0B] px-3 py-0.5 text-[11px] font-bold text-[#F59E0B]">
            {t('pprFwOutcomeLevel')}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <IndicatorCard code="OUT-01" title={t('pprFwOut01')} color="#F59E0B" borderColor="#F59E0B" />
          <IndicatorCard code="OUT-02" title={t('pprFwOut02')} color="#F59E0B" borderColor="#F59E0B" />
          <IndicatorCard code="OUT-03" title={t('pprFwOut03')} color="#F59E0B" borderColor="#F59E0B" />
          <IndicatorCard code="OUT-04" title={t('pprFwOut04')} color="#F59E0B" borderColor="#F59E0B" />
          <IndicatorCard code="OUT-05" title={t('pprFwOut05')} color="#F59E0B" borderColor="#F59E0B" />
        </div>
      </div>

      {/* ── OUTPUT LEVEL ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded-full border-2 border-[#059669] px-3 py-0.5 text-[11px] font-bold text-[#059669]">
            {t('pprFwOutputLevel')}
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-6">
          {/* 5 output groups */}
          <div className="lg:col-span-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <OutputGroup number={1} title={t('pprFwGroup1')} color="#1F4E79">
              <OutputItem code="OP1.1" title={t('pprFwOp11')} />
              <OutputItem code="OP1.2" title={t('pprFwOp12')} />
              <OutputItem code="OP1.3" title={t('pprFwOp13')} />
            </OutputGroup>

            <OutputGroup number={2} title={t('pprFwGroup2')} color="#0891B2">
              <OutputItem code="OP2.1" title={t('pprFwOp21')} />
              <OutputItem code="OP2.2" title={t('pprFwOp22')} />
            </OutputGroup>

            <OutputGroup number={3} title={t('pprFwGroup3')} color="#059669">
              <OutputItem code="OP3.1" title={t('pprFwOp31')} />
              <OutputItem code="OP3.2" title={t('pprFwOp32')} />
            </OutputGroup>

            <OutputGroup number={4} title={t('pprFwGroup4')} color="#D97706">
              <OutputItem code="OP4.1" title={t('pprFwOp41')} />
              <OutputItem code="OP4.2" title={t('pprFwOp42')} />
              <OutputItem code="OP4.3" title={t('pprFwOp43')} />
            </OutputGroup>

            <OutputGroup number={5} title={t('pprFwGroup5')} color="#7C3AED">
              <OutputItem code="OP5.1" title={t('pprFwOp51')} />
              <OutputItem code="OP5.2" title={t('pprFwOp52')} />
            </OutputGroup>
          </div>

          {/* Framework at a glance sidebar */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-[#1F4E79]/20 bg-[#1F4E79]/5 p-4 space-y-3 sticky top-4">
              <h3 className="text-sm font-bold text-[#1F4E79]">{t('pprFwGlanceTitle')}</h3>
              <div className="space-y-2">
                {[
                  { icon: Target, label: t('pprFwGlance1') },
                  { icon: Target, label: t('pprFwGlance2'), color: '#DC2626' },
                  { icon: TrendingUp, label: t('pprFwGlance3'), color: '#F59E0B' },
                  { icon: CheckCircle, label: t('pprFwGlance4'), color: '#059669' },
                  { icon: Calendar, label: t('pprFwGlance5') },
                  { icon: Clock, label: t('pprFwGlance6') },
                  { icon: BarChart3, label: t('pprFwGlance7') },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-2">
                    <item.icon className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: item.color ?? '#1F4E79' }} />
                    <span className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
