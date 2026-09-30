'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, LayoutDashboard, Activity, DollarSign,
  Target, FileText, AlertTriangle, Users, BarChart3, Pencil,
} from 'lucide-react';
import { useProgrammeDashboard, useActivities, useRisks, useTeam } from '@/lib/api/programme-monitoring-hooks';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { ExecutionDashboard } from '@/components/programme-monitoring/ExecutionDashboard';
import { ActivitiesTable } from '@/components/programme-monitoring/ActivitiesTable';

type Tab = 'dashboard' | 'activities' | 'budget' | 'indicators' | 'reporting' | 'risks' | 'team';

const TABS: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'activities', label: 'Activities', icon: <Activity className="h-4 w-4" /> },
  { key: 'budget', label: 'Budget', icon: <DollarSign className="h-4 w-4" /> },
  { key: 'indicators', label: 'Indicators', icon: <Target className="h-4 w-4" /> },
  { key: 'reporting', label: 'Reporting', icon: <FileText className="h-4 w-4" /> },
  { key: 'risks', label: 'Risks', icon: <AlertTriangle className="h-4 w-4" /> },
  { key: 'team', label: 'Team', icon: <Users className="h-4 w-4" /> },
];

function localName(name: Record<string, string> | string | undefined, locale: string): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  return name[locale] || name.en || '';
}

export default function ProgrammeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const { data: dashboardRes, isLoading: dashLoading } = useProgrammeDashboard(id);
  const dashboard = dashboardRes?.data ?? null;

  const { data: activitiesRes, isLoading: actLoading } = useActivities(
    activeTab === 'activities' ? { programmeId: id } : undefined,
  );
  const activities = activitiesRes?.data ?? [];

  const { data: risksRes } = useRisks(activeTab === 'risks' ? id : undefined);
  const risks = risksRes?.data ?? [];

  const { data: teamRes } = useTeam(activeTab === 'team' ? id : undefined);
  const team = teamRes?.data ?? [];

  const programmeName = dashboard?.programme?.name
    ? localName(dashboard.programme.name, locale)
    : 'Programme';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/programme-monitoring"
            className="rounded-lg border p-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {programmeName}
            </h1>
            {dashboard?.programme?.code && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                  {dashboard.programme.code}
                </span>
                {dashboard.programme.status && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    dashboard.programme.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30' :
                    dashboard.programme.status === 'DESIGN' ? 'bg-slate-100 text-slate-600' :
                    dashboard.programme.status === 'SUSPENDED' ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-600'
                  }`}>
                    {dashboard.programme.status}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => router.push(`/programme-monitoring/${id}/edit`)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Pencil className="h-4 w-4" />
          Edit Programme
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b dark:border-gray-800 pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'border-b-2 border-green-600 text-green-700 dark:text-green-400'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <ExecutionDashboard data={dashboard} loading={dashLoading} locale={locale} />
      )}

      {activeTab === 'activities' && (
        <ActivitiesTable activities={activities} loading={actLoading} locale={locale} />
      )}

      {activeTab === 'budget' && (
        <BudgetTab dashboard={dashboard} loading={dashLoading} locale={locale} />
      )}

      {activeTab === 'indicators' && (
        <IndicatorsTab programmeId={id} locale={locale} />
      )}

      {activeTab === 'reporting' && (
        <ReportingTab programmeId={id} locale={locale} />
      )}

      {activeTab === 'risks' && (
        <RisksTab risks={risks} locale={locale} />
      )}

      {activeTab === 'team' && (
        <TeamTab team={team} />
      )}
    </div>
  );
}

// ── Budget Tab ──

function BudgetTab({ dashboard, loading, locale }: { dashboard: any; loading: boolean; locale: string }) {
  if (loading) return <div className="h-64 rounded-xl bg-gray-200 animate-pulse dark:bg-gray-800" />;
  if (!dashboard) return null;

  const { executionByOutput, kpis } = dashboard;
  const currency = dashboard.programme?.currency || 'EUR';

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-4 dark:bg-gray-900 dark:border-gray-800">
          <p className="text-xs text-gray-500 uppercase">Total Approved</p>
          <p className="text-xl font-bold mt-1">{kpis.totalApproved.toLocaleString()} {currency}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 dark:bg-gray-900 dark:border-gray-800">
          <p className="text-xs text-gray-500 uppercase">Total Executed</p>
          <p className="text-xl font-bold mt-1 text-green-600">{kpis.totalExecuted.toLocaleString()} {currency}</p>
          <p className="text-sm text-gray-500">{kpis.executionRate}%</p>
        </div>
        <div className="rounded-xl border bg-white p-4 dark:bg-gray-900 dark:border-gray-800">
          <p className="text-xs text-gray-500 uppercase">Balance</p>
          <p className="text-xl font-bold mt-1 text-amber-600">{kpis.totalBalance.toLocaleString()} {currency}</p>
        </div>
      </div>

      {/* Detailed table */}
      <div className="rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Output</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Approved</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Committed</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Executed</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Balance</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">% Exec</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {executionByOutput?.map((o: any) => (
              <tr key={o.outputCode} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <span className="font-medium">{o.outputCode}</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">{localName(o.outputName, locale)}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{o.approved.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500">—</td>
                <td className="px-4 py-3 text-right tabular-nums text-green-600">{o.executed.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums text-amber-600">{o.balance.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span>{o.percentExec}%</span>
                    <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-green-500" style={{ width: `${o.percentExec}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Indicators Tab ──

function IndicatorsTab({ programmeId, locale }: { programmeId: string; locale: string }) {
  const { data: res, isLoading } = useActivities({ programmeId }); // placeholder
  void res;

  if (isLoading) return <div className="h-48 rounded-xl bg-gray-200 animate-pulse dark:bg-gray-800" />;

  return (
    <div className="rounded-xl border bg-white p-6 dark:bg-gray-900 dark:border-gray-800">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Target className="h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">M&E Indicators</h3>
        <p className="text-sm text-gray-500 mt-1">Track baseline → target → actual for each output indicator</p>
        <p className="text-xs text-gray-400 mt-3">Coming soon — connect to /api/v1/programme-monitoring/indicators</p>
      </div>
    </div>
  );
}

// ── Reporting Tab ──

function ReportingTab({ programmeId, locale }: { programmeId: string; locale: string }) {
  void programmeId;
  void locale;

  return (
    <div className="rounded-xl border bg-white p-6 dark:bg-gray-900 dark:border-gray-800">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <FileText className="h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">Reporting Cycles</h3>
        <p className="text-sm text-gray-500 mt-1">Weekly/monthly activity reporting with validation workflow</p>
        <p className="text-xs text-gray-400 mt-3">Coming soon — connect to /api/v1/programme-monitoring/cycles</p>
      </div>
    </div>
  );
}

// ── Risks Tab ──

function RisksTab({ risks, locale }: { risks: any[]; locale: string }) {
  const LIKELIHOOD_ORDER = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW'];
  const IMPACT_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  if (!risks.length) {
    return (
      <div className="rounded-xl border bg-white p-6 dark:bg-gray-900 dark:border-gray-800 text-center py-8">
        <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-700">Risk Register</h3>
        <p className="text-sm text-gray-500">No risks registered yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Risk Register</h3>
      <div className="divide-y rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800">
        {risks.map((risk: any) => {
          const scoreColor = risk.riskScore >= 9 ? 'text-red-600 bg-red-50' : risk.riskScore >= 4 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50';
          return (
            <div key={risk.id} className="flex items-center gap-4 px-4 py-3">
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${scoreColor}`}>
                {risk.riskScore}
              </span>
              <div className="flex-1">
                <span className="text-xs font-mono text-gray-400 mr-2">{risk.code}</span>
                <span className="text-sm">{localName(risk.description, locale)}</span>
              </div>
              <span className="text-xs text-gray-500">{risk.likelihood} × {risk.impact}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                risk.status === 'OPEN' ? 'bg-blue-50 text-blue-600' :
                risk.status === 'MITIGATED' ? 'bg-green-50 text-green-600' :
                risk.status === 'MATERIALIZED' ? 'bg-red-50 text-red-600' :
                'bg-gray-100 text-gray-500'
              }`}>
                {risk.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Team Tab ──

function TeamTab({ team }: { team: any[] }) {
  const ROLE_LABELS: Record<string, string> = {
    PROGRAMME_DIRECTOR: 'Programme Director',
    PROGRAMME_COORDINATOR: 'Programme Coordinator',
    REGIONAL_COORDINATOR: 'Regional Coordinator',
    ACTIVITY_OWNER: 'Activity Owner',
    M_AND_E_OFFICER: 'M&E Officer',
    FINANCE_OFFICER: 'Finance Officer',
    VIEWER: 'Viewer',
  };

  if (!team.length) {
    return (
      <div className="rounded-xl border bg-white p-6 dark:bg-gray-900 dark:border-gray-800 text-center py-8">
        <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-700">Team</h3>
        <p className="text-sm text-gray-500">No team members assigned yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Team Members</h3>
      <div className="divide-y rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800">
        {team.map((m: any) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-sm font-bold">
                {m.userId?.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm">{m.userId}</span>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {ROLE_LABELS[m.role] || m.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
