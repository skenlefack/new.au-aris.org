'use client';

import React from 'react';
import { Globe, TrendingUp, DollarSign, FileCheck, ShieldCheck, CheckCircle, GraduationCap, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';

/* ── KPI Card ── */
function Kpi({ icon: Icon, value, subtitle, label, color }: {
  icon: any; value: string | number; subtitle: string; label: string; color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-gray-800">
      <Icon className="h-5 w-5" style={{ color }} />
      <span className="text-2xl font-extrabold" style={{ color }}>{value}</span>
      <span className="text-[9px] text-gray-400 leading-tight">{subtitle}</span>
      <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">{label}</span>
    </div>
  );
}

/* ── Progress row ── */
function ProgressRow({ label, value, max, pct, color }: {
  label: string; value?: string; max?: number; pct: number; color?: string;
}) {
  const c = color ?? (pct >= 80 ? '#22c55e' : pct >= 50 ? '#1F4E79' : '#f59e0b');
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-[55%] text-[10px] text-gray-600 dark:text-gray-400 truncate">{label}</span>
      {value && <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 w-14 text-right">{value}</span>}
      <span className="text-[10px] font-bold w-8 text-right" style={{ color: c }}>{pct}%</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden dark:bg-gray-700">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: c }} />
      </div>
    </div>
  );
}

/* ── Mini gauge ── */
function MiniGauge({ value, target, label, baseline, baselineLabel }: {
  value: number; target: number; label: string; baseline?: number; baselineLabel?: string;
}) {
  const pct = target > 0 ? Math.round((value / target) * 100) : 0;
  const h = 80;
  const filled = Math.min(pct, 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16" style={{ height: h }}>
        <div className="absolute bottom-0 w-full rounded-t bg-gray-100 dark:bg-gray-700" style={{ height: h }} />
        <div className="absolute bottom-0 w-full rounded-t bg-[#1F4E79]" style={{ height: `${(filled / 100) * h}px` }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-extrabold text-white drop-shadow">{value}</span>
        </div>
      </div>
      <span className="text-[9px] text-gray-500 text-center leading-tight">{label}</span>
      {baseline != null && (
        <span className="text-[8px] text-gray-400">{baselineLabel}: {baseline}</span>
      )}
    </div>
  );
}

/* ── Severity dot ── */
function SevDot({ level }: { level: string }) {
  const colors: Record<string, string> = { High: '#DC2626', Medium: '#F59E0B', Low: '#22c55e' };
  return <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ backgroundColor: colors[level] ?? '#6B7280' }} />;
}

/* ══════════════════════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════════════════════ */

export default function PPRAnnualDashboard() {
  const t = useTranslations('collecte');
  return (
    <div className="space-y-4 text-gray-800 dark:text-gray-200">
      {/* ── Header ── */}
      <div className="rounded-xl bg-[#1F4E79] px-6 py-4 text-white flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-white/50">{t('pprAnnualOrgLine')}</p>
          <h1 className="text-lg font-extrabold mt-1">{t('pprAnnualTitle')}</h1>
          <p className="text-sm font-semibold text-white/80">{t('pprAnnualSubtitle')}</p>
          <p className="text-[10px] text-white/50 mt-1">{t('pprAnnualReportingPeriod')}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-white/60">{t('pprAnnualFundedBy')}</span>
          <span className="text-2xl font-extrabold text-[#C9A227]">PPR</span>
        </div>
      </div>

      {/* ── Filters row ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {[
          { label: t('pprFilterYear'), value: '2026' },
          { label: t('pprFilterQuarter'), value: t('pprFilterAll') },
          { label: t('pprFilterCountry'), value: t('pprFilterAll') },
          { label: t('pprFilterRec'), value: t('pprFilterAll') },
          { label: t('pprFilterComponent'), value: t('pprFilterAll') },
        ].map((f) => (
          <div key={f.label} className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[10px] dark:border-gray-700 dark:bg-gray-800">
            <span className="text-gray-400">{f.label}: </span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">{f.value}</span>
          </div>
        ))}
        <span className="text-[9px] text-gray-400 ml-auto">{t('pprAnnualLastUpdate')}</span>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-4 gap-2 lg:grid-cols-8">
        <Kpi icon={Globe} value={48} subtitle={t('pprKpiAuMemberStates')} label={t('pprKpiCountriesCovered')} color="#1F4E79" />
        <Kpi icon={TrendingUp} value="78%" subtitle={t('pprKpiOverallImplementation')} label={t('pprKpiProgrammeProgress')} color="#059669" />
        <Kpi icon={DollarSign} value="77%" subtitle={t('pprKpiBudgetDetail')} label={t('pprKpiBudgetExecution')} color="#D97706" />
        <Kpi icon={FileCheck} value="100%" subtitle={t('pprKpiCountriesReportingDetail')} label={t('pprKpiCountriesReporting')} color="#0891B2" />
        <Kpi icon={ShieldCheck} value={29} subtitle={t('pprKpiTarget49')} label={t('pprKpiPprFreeCountries')} color="#22c55e" />
        <Kpi icon={CheckCircle} value={8} subtitle={t('pprKpiTarget48')} label={t('pprKpiCountriesReady')} color="#6D28D9" />
        <Kpi icon={GraduationCap} value={265} subtitle={t('pprKpiTarget300')} label={t('pprKpiExpertsTrained')} color="#EA580C" />
        <Kpi icon={FlaskConical} value={22} subtitle={t('pprKpiTarget25')} label={t('pprKpiLaboratories')} color="#7C3AED" />
      </div>

      {/* ── Row: Implementation Map + Impact + Outcomes ── */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Implementation Status by Country */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">{t('pprImplStatusByCountry')}</h3>
          <div className="h-40 flex items-center justify-center bg-[#e8f5e9] rounded-lg text-[10px] text-gray-400">
            {t('pprMapPlaceholder')}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {[
              { color: '#22c55e', label: t('pprLegendOnTrack') },
              { color: '#60a5fa', label: t('pprLegendGoodProgress') },
              { color: '#f59e0b', label: t('pprLegendModerateProgress') },
              { color: '#ef4444', label: t('pprLegendNeedsSupport') },
              { color: '#9ca3af', label: t('pprLegendNotApplicable') },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-[8px] text-gray-500">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Impact Indicators */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-3">{t('pprImpactIndicators')}</h3>
          <div className="flex justify-around">
            <MiniGauge value={5.1} target={100} label={t('pprGaugeAvgPrevalence')} baseline={7.5} baselineLabel={t('pprBaseline2022')} />
            <MiniGauge value={8} target={49} label={t('pprGaugeCountriesFreeWoah')} baseline={6} baselineLabel={t('pprBaseline2022')} />
            <MiniGauge value={8} target={49} label={t('pprGaugeCountriesMaintaining')} baseline={6} baselineLabel={t('pprBaseline2022')} />
          </div>
        </div>

        {/* Outcome Indicators */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">{t('pprOutcomeIndicators')}</h3>
          <div className="space-y-1">
            <ProgressRow label={t('pprOutcomeFunctionalCoord')} pct={100} />
            <ProgressRow label={t('pprOutcomeStrategyFramework')} pct={100} />
            <ProgressRow label={t('pprOutcomeCountriesReady')} value="29 / 48" pct={60} />
            <ProgressRow label={t('pprOutcomeSurveillance')} value="14 / 15" pct={93} />
            <ProgressRow label={t('pprOutcomeVaccination')} pct={85} />
          </div>
        </div>
      </div>

      {/* ── Row: Output Indicators + Performance by Component + Financial ── */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Output Indicators */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">{t('pprOutputIndicators')}</h3>
          <div className="space-y-0.5">
            {[
              { label: t('pprOutputExpertsTrained'), value: '265 / 300', pct: 88 },
              { label: t('pprOutputLabsStrengthened'), value: '22 / 25', pct: 88 },
              { label: t('pprOutputCountriesSurveillance'), value: '13 / 15', pct: 87 },
              { label: t('pprOutputContinentalMapping'), value: '1 / 1', pct: 100 },
              { label: t('pprOutputVaccinationGuidelines'), value: '1 / 1', pct: 100 },
              { label: t('pprOutputVaccineQA'), value: '1 / 1', pct: 100 },
              { label: t('pprOutputPrivateSectorPlatforms'), value: '4 / 5', pct: 80 },
              { label: t('pprOutputCommStrategy'), value: '1 / 1', pct: 100 },
              { label: t('pprOutputGenderInclusion'), value: '1 / 1', pct: 100 },
              { label: t('pprOutputKnowledgeProducts'), value: '12 / 15', pct: 80 },
              { label: t('pprOutputResourceMobilization'), value: '7 / 10', pct: 70 },
              { label: t('pprOutputReadinessAssessments'), value: '40 / 48', pct: 83 },
            ].map((o) => (
              <ProgressRow key={o.label} {...o} />
            ))}
          </div>
        </div>

        {/* Programme Performance by Component */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">{t('pprPerfByComponent')}</h3>
          <div className="space-y-2">
            {[
              { label: t('pprCompGovernance'), pct: 85, color: '#1F4E79' },
              { label: t('pprCompLaboratories'), pct: 88, color: '#0891B2' },
              { label: t('pprCompCapacityBuilding'), pct: 88, color: '#059669' },
              { label: t('pprCompDataSystems'), pct: 75, color: '#D97706' },
              { label: t('pprCompPrivateSector'), pct: 80, color: '#7C3AED' },
              { label: t('pprCompResourceMobilization'), pct: 70, color: '#EA580C' },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <span className="w-[45%] text-[10px] text-gray-600 dark:text-gray-400 truncate">{c.label}</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden dark:bg-gray-700">
                  <div className="h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
                </div>
                <span className="text-[10px] font-bold w-8 text-right">{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Snapshot + Country Performance */}
        <div className="space-y-3">
          {/* Financial */}
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">{t('pprFinancialSnapshot')}</h3>
            <div className="flex items-center gap-3">
              <div className="relative h-20 w-20 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1F4E79" strokeWidth="12"
                    strokeDasharray={`${77 * 2.51} ${251}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-extrabold text-[#1F4E79]">77%</span>
                </div>
              </div>
              <div className="text-[9px] space-y-1">
                <div><span className="font-bold text-[#1F4E79]">{t('pprFinApprovedBudget')}:</span> €15.2M</div>
                <div><span className="font-bold text-[#059669]">{t('pprFinSpent')}:</span> €11.7M</div>
                <div><span className="font-bold text-[#60a5fa]">{t('pprFinCommitted')}:</span> €1.2M</div>
                <div><span className="font-bold text-[#D97706]">{t('pprFinRemaining')}:</span> €2.3M</div>
              </div>
            </div>
          </div>
          {/* Country Performance Top 5 */}
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">{t('pprCountryPerfTop5')}</h3>
            <div className="space-y-0.5">
              {[
                { flag: '🇸🇳', name: 'Senegal', pct: 92 },
                { flag: '🇰🇪', name: 'Kenya', pct: 89 },
                { flag: '🇪🇹', name: 'Ethiopia', pct: 85 },
                { flag: '🇳🇦', name: 'Namibia', pct: 82 },
                { flag: '🇹🇿', name: 'Tanzania', pct: 78 },
              ].map((c) => (
                <div key={c.name} className="flex items-center gap-2">
                  <span className="text-sm">{c.flag}</span>
                  <span className="w-16 text-[10px] text-gray-600 dark:text-gray-400">{c.name}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden dark:bg-gray-700">
                    <div className="h-full rounded-full bg-[#059669]" style={{ width: `${c.pct}%` }} />
                  </div>
                  <span className="text-[10px] font-bold w-8 text-right">{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row: Risks + Achievements + Priorities + Data Quality ── */}
      <div className="grid gap-3 lg:grid-cols-4">
        {/* Risks */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">{t('pprRisksChallenges')}</h3>
          <div className="space-y-1.5 text-[9px] text-gray-600 dark:text-gray-400">
            <div><SevDot level="High" /><b>{t('pprRiskHigh')}</b> — {t('pprRisk1')}</div>
            <div><SevDot level="Medium" /><b>{t('pprRiskMedium')}</b> — {t('pprRisk2')}</div>
            <div><SevDot level="Medium" /><b>{t('pprRiskMedium')}</b> — {t('pprRisk3')}</div>
            <div><SevDot level="Low" /><b>{t('pprRiskMedium')}</b> — {t('pprRisk4')}</div>
          </div>
        </div>

        {/* Key Achievements */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">{t('pprKeyAchievements')}</h3>
          <ul className="space-y-1.5 text-[9px] text-gray-600 dark:text-gray-400 list-disc pl-3">
            <li>{t('pprAchievement1')}</li>
            <li>{t('pprAchievement2')}</li>
            <li>{t('pprAchievement3')}</li>
            <li>{t('pprAchievement4')}</li>
          </ul>
        </div>

        {/* Priority Actions */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">{t('pprPriorityActions')}</h3>
          <ol className="space-y-1.5 text-[9px] text-gray-600 dark:text-gray-400 list-decimal pl-3">
            <li>{t('pprPriority1')}</li>
            <li>{t('pprPriority2')}</li>
            <li>{t('pprPriority3')}</li>
            <li>{t('pprPriority4')}</li>
          </ol>
        </div>

        {/* Data Quality Status */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">{t('pprDataQualityStatus')}</h3>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
              <span className="text-gray-600 dark:text-gray-400">{t('pprDqGood')}</span>
              <span className="ml-auto font-bold text-gray-700 dark:text-gray-300">{t('pprDq26Countries')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
              <span className="text-gray-600 dark:text-gray-400">{t('pprDqFair')}</span>
              <span className="ml-auto font-bold text-gray-700 dark:text-gray-300">{t('pprDq17Countries')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
              <span className="text-gray-600 dark:text-gray-400">{t('pprDqPoor')}</span>
              <span className="ml-auto font-bold text-gray-700 dark:text-gray-300">{t('pprDq5Countries')}</span>
            </div>
          </div>
          <div className="mt-2 rounded bg-gray-50 dark:bg-gray-700/50 p-2">
            <h4 className="text-[9px] font-bold text-gray-500 mb-1">{t('pprDqNeedingAttention')}</h4>
            <div className="grid grid-cols-2 gap-x-3 text-[9px] text-gray-500">
              <div>1. Country A</div><div>4. Country D</div>
              <div>2. Country B</div><div>5. Country E</div>
              <div>3. Country C</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between text-[8px] text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
        <span>{t('pprAnnualFooterDisclaimer')}</span>
        <span>{t('pprAnnualFooterUnit')}</span>
      </div>
    </div>
  );
}
