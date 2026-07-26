'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, CheckCircle, Clock, Calendar, BarChart3 } from 'lucide-react';

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
              <h1 className="text-lg font-extrabold text-[#2E7D32]">PPR Programme Performance Dashboard</h1>
              <p className="text-[11px] text-[#4CAF50]">AU-IBAR | Continental Delivery Platform for PPR Eradication</p>
              <span className="mt-1 inline-block rounded-full border border-[#4CAF50]/30 px-3 py-0.5 text-[10px] text-[#2E7D32]">
                Programme period: 2024–2026
              </span>
            </div>
          </div>
          {/* KPI Summary badges */}
          <div className="flex gap-2">
            <div className="flex flex-col items-center rounded-lg bg-[#DC2626] px-4 py-2 text-white">
              <span className="text-xl font-extrabold">3</span>
              <span className="text-[9px] font-medium">Impact</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-[#F59E0B] px-4 py-2 text-white">
              <span className="text-xl font-extrabold">5</span>
              <span className="text-[9px] font-medium">Outcome</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-[#059669] px-4 py-2 text-white">
              <span className="text-xl font-extrabold">12</span>
              <span className="text-[9px] font-medium">Output</span>
            </div>
          </div>
        </div>
        {/* Status legend */}
        <div className="mt-3 flex gap-4">
          <StatusDot color="#22c55e" label="On track" />
          <StatusDot color="#3b82f6" label="In progress" />
          <StatusDot color="#ef4444" label="Data gap" />
        </div>
      </div>

      {/* ── IMPACT LEVEL ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded-full border-2 border-[#DC2626] px-3 py-0.5 text-[11px] font-bold text-[#DC2626]">
            IMPACT LEVEL
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <IndicatorCard code="IMP-01" title="Average PPR disease prevalence rate" color="#DC2626" borderColor="#DC2626" />
          <IndicatorCard code="IMP-02" title="Countries declared PPR disease-free by WOAH" color="#DC2626" borderColor="#DC2626" />
          <IndicatorCard code="IMP-03" title="Countries maintaining PPR-free status" color="#DC2626" borderColor="#DC2626" />
        </div>
      </div>

      {/* ── OUTCOME LEVEL ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded-full border-2 border-[#F59E0B] px-3 py-0.5 text-[11px] font-bold text-[#F59E0B]">
            OUTCOME LEVEL
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <IndicatorCard code="OUT-01" title="Functional continental and regional PPR coordination and governance system established" color="#F59E0B" borderColor="#F59E0B" />
          <IndicatorCard code="OUT-02" title="Implementable PPR eradication strategy, action framework and resource mobilization package adopted" color="#F59E0B" borderColor="#F59E0B" />
          <IndicatorCard code="OUT-03" title="Countries ready to implement the PPR eradication programme" color="#F59E0B" borderColor="#F59E0B" />
          <IndicatorCard code="OUT-04" title="Countries with strengthened PPR surveillance, data and disease-free status evidence systems" color="#F59E0B" borderColor="#F59E0B" />
          <IndicatorCard code="OUT-05" title="Harmonized PPR vaccination, vaccine quality assurance and delivery system adopted and ready for implementation" color="#F59E0B" borderColor="#F59E0B" />
        </div>
      </div>

      {/* ── OUTPUT LEVEL ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded-full border-2 border-[#059669] px-3 py-0.5 text-[11px] font-bold text-[#059669]">
            OUTPUT LEVEL
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-6">
          {/* 5 output groups */}
          <div className="lg:col-span-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <OutputGroup number={1} title="Coordination & Governance" color="#1F4E79">
              <OutputItem code="OP1.1" title="Operational PPR stakeholder platforms and regional animal health networks supported" />
              <OutputItem code="OP1.2" title="AU-IBAR/PAPS and regional coordination capacity operational" />
              <OutputItem code="OP1.3" title="State and non-state institutions supported for PPR coordination and implementation" />
            </OutputGroup>

            <OutputGroup number={2} title="Capacity & Laboratories" color="#0891B2">
              <OutputItem code="OP2.1" title="African experts capacitated on PPR control and eradication" />
              <OutputItem code="OP2.2" title="Regional and national laboratories with adequate diagnostic capacity" />
            </OutputGroup>

            <OutputGroup number={3} title="Data, Mapping & Readiness Support" color="#059669">
              <OutputItem code="OP3.1" title="PPR distribution, animal mobility and episystems mapped" />
              <OutputItem code="OP3.2" title="Countries supported to collect, collate and use PPR data" />
            </OutputGroup>

            <OutputGroup number={4} title="Vaccination & Quality Assurance" color="#D97706">
              <OutputItem code="OP4.1" title="Harmonized PPR vaccination strategy and technical guidelines developed" />
              <OutputItem code="OP4.2" title="Vaccine quality-control protocol and inter-laboratory testing arrangements operationalized" />
              <OutputItem code="OP4.3" title="AU-PANVAC vaccine quality assurance capacity package delivered" />
            </OutputGroup>

            <OutputGroup number={5} title="Supply, Partnerships & Private Sector" color="#7C3AED">
              <OutputItem code="OP5.1" title="Vaccine supply and delivery partnerships established" />
              <OutputItem code="OP5.2" title="Functional regional private-sector driven platforms established" />
            </OutputGroup>
          </div>

          {/* Framework at a glance sidebar */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-[#1F4E79]/20 bg-[#1F4E79]/5 p-4 space-y-3 sticky top-4">
              <h3 className="text-sm font-bold text-[#1F4E79]">Framework at a glance</h3>
              <div className="space-y-2">
                {[
                  { icon: Target, label: '20 core indicators' },
                  { icon: Target, label: '3 impact indicators', color: '#DC2626' },
                  { icon: TrendingUp, label: '5 outcome indicators', color: '#F59E0B' },
                  { icon: CheckCircle, label: '12 output indicators', color: '#059669' },
                  { icon: Calendar, label: 'Programme period: 2024–2026' },
                  { icon: Clock, label: 'Target date: October 2026' },
                  { icon: BarChart3, label: 'Supports monitoring, coordination and decision-making' },
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
