'use client';

import React from 'react';
import { Globe, TrendingUp, DollarSign, FileCheck, ShieldCheck, CheckCircle, GraduationCap, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  return (
    <div className="space-y-4 text-gray-800 dark:text-gray-200">
      {/* ── Header ── */}
      <div className="rounded-xl bg-[#1F4E79] px-6 py-4 text-white flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-white/50">AU-IBAR | African Union — Interafrican Bureau for Animal Resources</p>
          <h1 className="text-lg font-extrabold mt-1">PAN-AFRICAN PPR ERADICATION PROGRAMME</h1>
          <p className="text-sm font-semibold text-white/80">ANNUAL PERFORMANCE DASHBOARD 2026</p>
          <p className="text-[10px] text-white/50 mt-1">Reporting Period: January — December 2026</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-white/60">Funded by the European Union</span>
          <span className="text-2xl font-extrabold text-[#C9A227]">PPR</span>
        </div>
      </div>

      {/* ── Filters row ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {[
          { label: 'Year', value: '2026' },
          { label: 'Quarter', value: 'All' },
          { label: 'Country', value: 'All' },
          { label: 'REC', value: 'All' },
          { label: 'Component', value: 'All' },
        ].map((f) => (
          <div key={f.label} className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[10px] dark:border-gray-700 dark:bg-gray-800">
            <span className="text-gray-400">{f.label}: </span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">{f.value}</span>
          </div>
        ))}
        <span className="text-[9px] text-gray-400 ml-auto">Last Update: 25 May 2027 10:30</span>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-4 gap-2 lg:grid-cols-8">
        <Kpi icon={Globe} value={48} subtitle="AU Member States" label="Countries Covered" color="#1F4E79" />
        <Kpi icon={TrendingUp} value="78%" subtitle="Overall Implementation" label="Programme Progress" color="#059669" />
        <Kpi icon={DollarSign} value="77%" subtitle="€11.7 M / €15.2 M" label="Budget Execution" color="#D97706" />
        <Kpi icon={FileCheck} value="100%" subtitle="48 / 48 Countries" label="Countries Reporting" color="#0891B2" />
        <Kpi icon={ShieldCheck} value={29} subtitle="Target: 49" label="PPR-Free Countries" color="#22c55e" />
        <Kpi icon={CheckCircle} value={8} subtitle="Target: 48" label="Countries Ready" color="#6D28D9" />
        <Kpi icon={GraduationCap} value={265} subtitle="Target: 300" label="Experts Trained" color="#EA580C" />
        <Kpi icon={FlaskConical} value={22} subtitle="Target: 25" label="Laboratories" color="#7C3AED" />
      </div>

      {/* ── Row: Implementation Map + Impact + Outcomes ── */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Implementation Status by Country */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">IMPLEMENTATION STATUS BY COUNTRY</h3>
          <div className="h-40 flex items-center justify-center bg-[#e8f5e9] rounded-lg text-[10px] text-gray-400">
            [Map placeholder — colored by implementation status]
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {[
              { color: '#22c55e', label: 'On Track' },
              { color: '#60a5fa', label: 'Good Progress' },
              { color: '#f59e0b', label: 'Moderate Progress' },
              { color: '#ef4444', label: 'Needs Support' },
              { color: '#9ca3af', label: 'Not Applicable' },
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
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-3">IMPACT INDICATORS</h3>
          <div className="flex justify-around">
            <MiniGauge value={5.1} target={100} label="Average PPR Prevalence (%)" baseline={7.5} baselineLabel="Baseline (2022)" />
            <MiniGauge value={8} target={49} label="Countries PPR-Free (WOAH Official)" baseline={6} baselineLabel="Baseline (2022)" />
            <MiniGauge value={8} target={49} label="Countries Maintaining PPR-Free Status" baseline={6} baselineLabel="Baseline (2022)" />
          </div>
        </div>

        {/* Outcome Indicators */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">OUTCOME INDICATORS</h3>
          <div className="space-y-1">
            <ProgressRow label="Functional Coordination System" pct={100} />
            <ProgressRow label="Strategy, Framework & Resources Adopted" pct={100} />
            <ProgressRow label="Countries Ready for Implementation" value="29 / 48" pct={60} />
            <ProgressRow label="Strengthened Surveillance Systems" value="14 / 15" pct={93} />
            <ProgressRow label="Harmonized Vaccination System" pct={85} />
          </div>
        </div>
      </div>

      {/* ── Row: Output Indicators + Performance by Component + Financial ── */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Output Indicators */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">OUTPUT INDICATORS</h3>
          <div className="space-y-0.5">
            {[
              { label: 'Experts trained', value: '265 / 300', pct: 88 },
              { label: 'Laboratories strengthened', value: '22 / 25', pct: 88 },
              { label: 'Countries supported on surveillance', value: '13 / 15', pct: 87 },
              { label: 'Continental mapping completed', value: '1 / 1', pct: 100 },
              { label: 'Vaccination guidelines produced', value: '1 / 1', pct: 100 },
              { label: 'Vaccine quality assurance protocol', value: '1 / 1', pct: 100 },
              { label: 'Regional private sector platforms', value: '4 / 5', pct: 80 },
              { label: 'Communication & advocacy strategy', value: '1 / 1', pct: 100 },
              { label: 'Gender & social inclusion mainstreamed', value: '1 / 1', pct: 100 },
              { label: 'Knowledge products & publications', value: '12 / 15', pct: 80 },
              { label: 'Resource mobilization initiatives', value: '7 / 10', pct: 70 },
              { label: 'Country readiness assessments', value: '40 / 48', pct: 83 },
            ].map((o) => (
              <ProgressRow key={o.label} {...o} />
            ))}
          </div>
        </div>

        {/* Programme Performance by Component */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">PROGRAMME PERFORMANCE BY COMPONENT</h3>
          <div className="space-y-2">
            {[
              { label: 'Governance & Coordination', pct: 85, color: '#1F4E79' },
              { label: 'Laboratories', pct: 88, color: '#0891B2' },
              { label: 'Capacity Building', pct: 88, color: '#059669' },
              { label: 'Data Systems', pct: 75, color: '#D97706' },
              { label: 'Private Sector Engagement', pct: 80, color: '#7C3AED' },
              { label: 'Resource Mobilization', pct: 70, color: '#EA580C' },
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
            <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">FINANCIAL SNAPSHOT</h3>
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
                <div><span className="font-bold text-[#1F4E79]">Approved Budget:</span> €15.2M</div>
                <div><span className="font-bold text-[#059669]">Spent:</span> €11.7M</div>
                <div><span className="font-bold text-[#60a5fa]">Committed:</span> €1.2M</div>
                <div><span className="font-bold text-[#D97706]">Remaining:</span> €2.3M</div>
              </div>
            </div>
          </div>
          {/* Country Performance Top 5 */}
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">COUNTRY PERFORMANCE (TOP 5)</h3>
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
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">RISKS & CHALLENGES</h3>
          <div className="space-y-1.5 text-[9px] text-gray-600 dark:text-gray-400">
            <div><SevDot level="High" /><b>High</b> — Procurement and supply chain delays</div>
            <div><SevDot level="Medium" /><b>Medium</b> — Funding gaps for vaccination campaigns</div>
            <div><SevDot level="Medium" /><b>Medium</b> — Variable reporting quality across countries</div>
            <div><SevDot level="Low" /><b>Medium</b> — Interruptions affecting field activities</div>
          </div>
        </div>

        {/* Key Achievements */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">KEY ACHIEVEMENTS IN 2026</h3>
          <ul className="space-y-1.5 text-[9px] text-gray-600 dark:text-gray-400 list-disc pl-3">
            <li>Continental PPR Strategy and Action Framework adopted</li>
            <li>20 core indicators operationalized and dashboard launched</li>
            <li>265 professionals trained across 48 countries</li>
            <li>21 laboratories strengthened with diagnostic capacity</li>
          </ul>
        </div>

        {/* Priority Actions */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">PRIORITY ACTIONS FOR 2027</h3>
          <ol className="space-y-1.5 text-[9px] text-gray-600 dark:text-gray-400 list-decimal pl-3">
            <li>Complete readiness assessments in all countries</li>
            <li>Scale up vaccination implementation and monitoring</li>
            <li>Strengthen interoperability with WAHIS, ARIS & OPSET</li>
            <li>Support countries on PPR-free pathways</li>
          </ol>
        </div>

        {/* Data Quality Status */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">DATA QUALITY STATUS</h3>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
              <span className="text-gray-600 dark:text-gray-400">Good (&ge;90%)</span>
              <span className="ml-auto font-bold text-gray-700 dark:text-gray-300">26 Countries</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
              <span className="text-gray-600 dark:text-gray-400">Fair (70–89%)</span>
              <span className="ml-auto font-bold text-gray-700 dark:text-gray-300">17 Countries</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
              <span className="text-gray-600 dark:text-gray-400">Poor (&lt;70%)</span>
              <span className="ml-auto font-bold text-gray-700 dark:text-gray-300">5 Countries</span>
            </div>
          </div>
          <div className="mt-2 rounded bg-gray-50 dark:bg-gray-700/50 p-2">
            <h4 className="text-[9px] font-bold text-gray-500 mb-1">COUNTRIES NEEDING ATTENTION</h4>
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
        <span>This dashboard presents indicative results based on data reported by Member States and partners. Figures are subject to validation.</span>
        <span>AU-IBAR PPR Programme Coordination Unit</span>
      </div>
    </div>
  );
}
