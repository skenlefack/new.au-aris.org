'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, LayoutDashboard, Activity, DollarSign,
  Target, FileText, AlertTriangle, Users, Pencil, Plus,
  CheckCircle2, Clock, Pause, Ban, Loader2, Trash2,
  Calendar, ChevronDown, ChevronRight, Save, X, Search,
} from 'lucide-react';
import {
  useProgrammeDashboard, useProgramme,
  useActivities, useCreateActivity, useUpdateActivity,
  useBudgets, useBudgetSummary, useCreateBudget, useUpdateBudget,
  useIndicators, useCreateIndicator, useAddIndicatorValue,
  useReportingCycles, useCreateCycle, useSubmitReport, useUpdateCycle,
  useRisks, useCreateRisk, useUpdateRisk,
  useTeam, useAddTeamMember, useRemoveTeamMember,
} from '@/lib/api/programme-monitoring-hooks';
import { useSearchUsers } from '@/lib/api/dashboard-share-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { ExecutionDashboard } from '@/components/programme-monitoring/ExecutionDashboard';

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

function ln(name: any, locale: string): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  return name[locale] || name.en || '';
}

const STATUS_CFG: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string }> = {
  NOT_STARTED: { label: 'Not Started', icon: <Clock className="h-3 w-3" />, bg: 'bg-gray-100', text: 'text-gray-600' },
  PLANNED: { label: 'Planned', icon: <Clock className="h-3 w-3" />, bg: 'bg-blue-50', text: 'text-blue-600' },
  IN_PROGRESS: { label: 'In Progress', icon: <Activity className="h-3 w-3" />, bg: 'bg-blue-50', text: 'text-blue-700' },
  COMPLETED: { label: 'Completed', icon: <CheckCircle2 className="h-3 w-3" />, bg: 'bg-green-50', text: 'text-green-700' },
  DELAYED: { label: 'Delayed', icon: <AlertTriangle className="h-3 w-3" />, bg: 'bg-red-50', text: 'text-red-700' },
  ON_HOLD: { label: 'On Hold', icon: <Pause className="h-3 w-3" />, bg: 'bg-amber-50', text: 'text-amber-700' },
  CANCELLED: { label: 'Cancelled', icon: <Ban className="h-3 w-3" />, bg: 'bg-gray-100', text: 'text-gray-500' },
};

const RAG_COLORS: Record<string, string> = { GREEN: '#22c55e', AMBER: '#f59e0b', RED: '#ef4444', GREY: '#94a3b8' };

export default function ProgrammeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const { data: dashboardRes, isLoading: dashLoading } = useProgrammeDashboard(id);
  const dashboard = dashboardRes?.data ?? null;

  const { data: progRes } = useProgramme(id);
  const programme = progRes?.data ?? null;

  const programmeName = dashboard?.programme?.name
    ? ln(dashboard.programme.name, locale)
    : programme?.name ? ln(programme.name, locale) : 'Programme';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/programme-monitoring" className="rounded-lg border p-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{programmeName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {(dashboard?.programme?.code || programme?.code) && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                  {dashboard?.programme?.code || programme?.code}
                </span>
              )}
              {(dashboard?.programme?.status || programme?.status) && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  (dashboard?.programme?.status || programme?.status) === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {dashboard?.programme?.status || programme?.status}
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => router.push(`/programme-monitoring/${id}/edit`)} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <Pencil className="h-4 w-4" /> Edit Programme
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b dark:border-gray-800 pb-px">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition ${activeTab === tab.key ? 'border-b-2 border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && <ExecutionDashboard data={dashboard} loading={dashLoading} locale={locale} />}
      {activeTab === 'activities' && <ActivitiesTab programmeId={id} programme={programme} locale={locale} />}
      {activeTab === 'budget' && <BudgetTab programmeId={id} dashboard={dashboard} loading={dashLoading} locale={locale} />}
      {activeTab === 'indicators' && <IndicatorsTab programmeId={id} programme={programme} locale={locale} />}
      {activeTab === 'reporting' && <ReportingTab programmeId={id} locale={locale} />}
      {activeTab === 'risks' && <RisksTab programmeId={id} locale={locale} />}
      {activeTab === 'team' && <TeamTab programmeId={id} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ACTIVITIES TAB
// ══════════════════════════════════════════════════════════════════════════════

function ActivitiesTab({ programmeId, programme, locale }: { programmeId: string; programme: any; locale: string }) {
  const { data: res, isLoading } = useActivities({ programmeId });
  const activities = res?.data ?? [];
  const createMut = useCreateActivity();
  const updateMut = useUpdateActivity();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Get outputs for the dropdown
  const outputs = programme?.components?.flatMap((c: any) => (c.outputs ?? []).map((o: any) => ({ ...o, componentName: ln(c.name, locale) }))) ?? [];

  // New activity form state
  const [form, setForm] = useState({ outputId: '', code: '', nameEn: '', responsibleUnit: '', status: 'NOT_STARTED', priorityLevel: 'MEDIUM', plannedStartDate: '', plannedEndDate: '', completionPercent: 0 });

  function resetForm() {
    setForm({ outputId: outputs[0]?.id || '', code: '', nameEn: '', responsibleUnit: '', status: 'NOT_STARTED', priorityLevel: 'MEDIUM', plannedStartDate: '', plannedEndDate: '', completionPercent: 0 });
    setShowForm(false);
    setEditId(null);
  }

  async function handleSave() {
    if (editId) {
      await updateMut.mutateAsync({ id: editId, name: { en: form.nameEn }, responsibleUnit: form.responsibleUnit, status: form.status, priorityLevel: form.priorityLevel, completionPercent: form.completionPercent, plannedStartDate: form.plannedStartDate || undefined, plannedEndDate: form.plannedEndDate || undefined });
    } else {
      await createMut.mutateAsync({ outputId: form.outputId, code: form.code, name: { en: form.nameEn }, responsibleUnit: form.responsibleUnit, status: form.status, priorityLevel: form.priorityLevel, plannedStartDate: form.plannedStartDate, plannedEndDate: form.plannedEndDate });
    }
    resetForm();
  }

  function startEdit(act: any) {
    setForm({ outputId: act.outputId, code: act.code, nameEn: ln(act.name, 'en'), responsibleUnit: act.responsibleUnit || '', status: act.status, priorityLevel: act.priorityLevel || 'MEDIUM', plannedStartDate: act.plannedStartDate?.split('T')[0] || '', plannedEndDate: act.plannedEndDate?.split('T')[0] || '', completionPercent: act.completionPercent || 0 });
    setEditId(act.id);
    setShowForm(true);
  }

  const filtered = statusFilter ? activities.filter((a: any) => a.status === statusFilter) : activities;

  if (isLoading) return <div className="space-y-3 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-gray-200 dark:bg-gray-800" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setStatusFilter('')} className={`rounded-full px-3 py-1 text-xs font-medium transition ${!statusFilter ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>All ({activities.length})</button>
          {Object.entries(STATUS_CFG).map(([key, cfg]) => {
            const count = activities.filter((a: any) => a.status === key).length;
            if (!count) return null;
            return <button key={key} onClick={() => setStatusFilter(statusFilter === key ? '' : key)} className={`rounded-full px-3 py-1 text-xs font-medium transition ${statusFilter === key ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : `${cfg.bg} ${cfg.text}`}`}>{cfg.label} ({count})</button>;
          })}
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition">
          <Plus className="h-3.5 w-3.5" /> Add Activity
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-gray-900 dark:border-gray-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{editId ? 'Edit Activity' : 'New Activity'}</h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {!editId && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Output *</label>
                <select value={form.outputId} onChange={e => setForm({...form, outputId: e.target.value})} className={iCls()}>
                  <option value="">Select output...</option>
                  {outputs.map((o: any) => <option key={o.id} value={o.id}>{o.code} — {ln(o.name, locale)}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
              <input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="ACT-1.1.1" className={`${iCls()} font-mono`} disabled={!!editId} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Name (EN) *</label>
              <input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} placeholder="Activity name" className={iCls()} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Responsible Unit</label>
              <input value={form.responsibleUnit} onChange={e => setForm({...form, responsibleUnit: e.target.value})} placeholder="PAPS" className={iCls()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={iCls()}>
                {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <select value={form.priorityLevel} onChange={e => setForm({...form, priorityLevel: e.target.value})} className={iCls()}>
                <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input type="date" value={form.plannedStartDate} onChange={e => setForm({...form, plannedStartDate: e.target.value})} className={iCls()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input type="date" value={form.plannedEndDate} onChange={e => setForm({...form, plannedEndDate: e.target.value})} className={iCls()} />
            </div>
          </div>
          {editId && (
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-600 mb-1">Completion %</label>
              <input type="number" min={0} max={100} value={form.completionPercent} onChange={e => setForm({...form, completionPercent: Number(e.target.value)})} className={iCls()} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700">Cancel</button>
            <button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {(createMut.isPending || updateMut.isPending) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {editId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Activity List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-12 text-center dark:border-gray-700">
          <Activity className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No activities {statusFilter ? 'matching filter' : 'yet'}</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 w-8">RAG</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">Code</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">Activity</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Unit</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">Status</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">Progress</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 hidden lg:table-cell">Period</th>
                <th className="px-3 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {filtered.map((act: any) => {
                const cfg = STATUS_CFG[act.status] || STATUS_CFG.NOT_STARTED;
                return (
                  <tr key={act.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2.5"><span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: RAG_COLORS[act.ragStatus] || RAG_COLORS.GREY }} /></td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{act.code}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{ln(act.name, locale)}</span>
                      {act.output?.code && <span className="ml-1.5 text-[10px] text-gray-400">({act.output.code})</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 hidden md:table-cell">{act.responsibleUnit || '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>{cfg.icon}{cfg.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="h-1.5 w-12 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${act.completionPercent}%` }} /></div>
                        <span className="text-[11px] tabular-nums text-gray-600 w-7 text-right">{act.completionPercent}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-500 hidden lg:table-cell">
                      {act.plannedStartDate && <>{new Date(act.plannedStartDate).toLocaleDateString('en-GB', {day:'2-digit',month:'short'})} — {new Date(act.plannedEndDate).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'2-digit'})}</>}
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => startEdit(act)} className="rounded p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition"><Pencil className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  BUDGET TAB
// ══════════════════════════════════════════════════════════════════════════════

function BudgetTab({ programmeId, dashboard, loading, locale }: { programmeId: string; dashboard: any; loading: boolean; locale: string }) {
  const { data: budgetsRes } = useBudgets({ programmeId });
  const budgets = budgetsRes?.data ?? [];
  const updateMut = useUpdateBudget();
  const [editBudgetId, setEditBudgetId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  if (loading) return <div className="h-64 rounded-xl bg-gray-200 animate-pulse dark:bg-gray-800" />;
  if (!dashboard) return null;

  const { executionByOutput, kpis } = dashboard;
  const currency = dashboard.programme?.currency || 'EUR';

  async function saveExecution(budgetId: string) {
    await updateMut.mutateAsync({ id: budgetId, executedAmount: Number(editAmount) });
    setEditBudgetId(null);
  }

  return (
    <div className="space-y-4">
      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 dark:bg-gray-900 dark:border-gray-800">
          <p className="text-[11px] text-gray-500 uppercase">Approved</p>
          <p className="text-lg font-bold mt-1">{kpis.totalApproved.toLocaleString()} <span className="text-xs text-gray-400">{currency}</span></p>
        </div>
        <div className="rounded-xl border bg-white p-4 dark:bg-gray-900 dark:border-gray-800">
          <p className="text-[11px] text-gray-500 uppercase">Executed</p>
          <p className="text-lg font-bold mt-1 text-emerald-600">{kpis.totalExecuted.toLocaleString()} <span className="text-xs text-gray-400">{currency}</span></p>
        </div>
        <div className="rounded-xl border bg-white p-4 dark:bg-gray-900 dark:border-gray-800">
          <p className="text-[11px] text-gray-500 uppercase">Balance</p>
          <p className="text-lg font-bold mt-1 text-amber-600">{kpis.totalBalance.toLocaleString()} <span className="text-xs text-gray-400">{currency}</span></p>
        </div>
        <div className="rounded-xl border bg-white p-4 dark:bg-gray-900 dark:border-gray-800">
          <p className="text-[11px] text-gray-500 uppercase">Execution Rate</p>
          <p className="text-lg font-bold mt-1">{kpis.executionRate}%</p>
          <div className="h-2 w-full rounded-full bg-gray-100 mt-1.5 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${kpis.executionRate}%` }} /></div>
        </div>
      </div>

      {/* By Output */}
      <div className="rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">Execution By Output</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">#</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Output</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Approved</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Executed</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Balance</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">% Exec</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {executionByOutput?.map((o: any, i: number) => (
              <tr key={o.outputCode} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium">{o.outputCode} {ln(o.outputName, locale)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{o.approved.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">{o.executed.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-amber-600">{o.balance.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-2"><span>{o.percentExec}%</span><div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${o.percentExec}%` }} /></div></div></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="bg-gray-50 font-semibold dark:bg-gray-800"><td className="px-4 py-2.5" /><td className="px-4 py-2.5">Total</td><td className="px-4 py-2.5 text-right tabular-nums">{kpis.totalApproved.toLocaleString()}</td><td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">{kpis.totalExecuted.toLocaleString()}</td><td className="px-4 py-2.5 text-right tabular-nums">{kpis.totalBalance.toLocaleString()}</td><td className="px-4 py-2.5 text-right">{kpis.executionRate}%</td></tr></tfoot>
        </table>
      </div>

      {/* Individual budget lines */}
      {budgets.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-500 uppercase">Budget Lines — Click executed amount to update</h3>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b dark:border-gray-700"><th className="px-3 py-2 text-left text-xs text-gray-500">Activity</th><th className="px-3 py-2 text-left text-xs text-gray-500">Line</th><th className="px-3 py-2 text-right text-xs text-gray-500">Approved</th><th className="px-3 py-2 text-right text-xs text-gray-500">Executed</th><th className="px-3 py-2 text-right text-xs text-gray-500">Period</th></tr></thead>
            <tbody className="divide-y dark:divide-gray-800">
              {budgets.map((b: any) => (
                <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2 text-xs">{ln(b.activity?.name, locale) || b.activityId}</td>
                  <td className="px-3 py-2 text-xs font-mono text-gray-500">{b.budgetLineCode}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(b.approvedAmount).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    {editBudgetId === b.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-24 rounded border px-2 py-0.5 text-xs text-right dark:bg-gray-800 dark:border-gray-700" autoFocus />
                        <button onClick={() => saveExecution(b.id)} className="text-emerald-600 hover:text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setEditBudgetId(null)} className="text-gray-400"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditBudgetId(b.id); setEditAmount(String(Number(b.executedAmount))); }} className="tabular-nums text-emerald-600 hover:underline cursor-pointer">{Number(b.executedAmount).toLocaleString()}</button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-gray-400">{b.period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  INDICATORS TAB
// ══════════════════════════════════════════════════════════════════════════════

function IndicatorsTab({ programmeId, programme, locale }: { programmeId: string; programme: any; locale: string }) {
  const { data: res, isLoading } = useIndicators({ programmeId });
  const indicators = res?.data ?? [];
  const createMut = useCreateIndicator();
  const addValueMut = useAddIndicatorValue();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ outputId: '', code: '', nameEn: '', unit: '', targetValue: '', baselineValue: '' });
  const [valueForm, setValueForm] = useState<{ indicatorId: string; period: string; value: string } | null>(null);

  const outputs = programme?.components?.flatMap((c: any) => c.outputs ?? []) ?? [];

  async function handleCreate() {
    await createMut.mutateAsync({ outputId: form.outputId, code: form.code, name: { en: form.nameEn }, unit: form.unit, targetValue: Number(form.targetValue), baselineValue: Number(form.baselineValue) || 0 });
    setShowForm(false);
    setForm({ outputId: '', code: '', nameEn: '', unit: '', targetValue: '', baselineValue: '' });
  }

  async function handleAddValue() {
    if (!valueForm) return;
    await addValueMut.mutateAsync({ indicatorId: valueForm.indicatorId, period: valueForm.period, actualValue: Number(valueForm.value) });
    setValueForm(null);
  }

  if (isLoading) return <div className="h-48 rounded-xl bg-gray-200 animate-pulse dark:bg-gray-800" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">M&E Indicators ({indicators.length})</h3>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition"><Plus className="h-3.5 w-3.5" /> Add Indicator</button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-white p-5 dark:bg-gray-900 dark:border-gray-800 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Output *</label><select value={form.outputId} onChange={e => setForm({...form, outputId: e.target.value})} className={iCls()}><option value="">Select...</option>{outputs.map((o: any) => <option key={o.id} value={o.id}>{o.code} — {ln(o.name, locale)}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Code *</label><input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="IND-1.1.1" className={iCls()} /></div>
            <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} placeholder="Indicator name" className={iCls()} /></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Unit *</label><input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} placeholder="countries, %, labs" className={iCls()} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Baseline</label><input type="number" value={form.baselineValue} onChange={e => setForm({...form, baselineValue: e.target.value})} placeholder="0" className={iCls()} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Target *</label><input type="number" value={form.targetValue} onChange={e => setForm({...form, targetValue: e.target.value})} placeholder="25" className={iCls()} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-3 py-1.5 text-xs text-gray-600 dark:border-gray-700">Cancel</button>
            <button onClick={handleCreate} disabled={createMut.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{createMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Create</button>
          </div>
        </div>
      )}

      {indicators.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-12 text-center dark:border-gray-700">
          <Target className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No indicators defined yet</p>
          <p className="text-xs text-gray-400 mt-1">Add indicators to track progress against targets</p>
        </div>
      ) : (
        <div className="space-y-3">
          {indicators.map((ind: any) => {
            const baseline = Number(ind.baselineValue) || 0;
            const target = Number(ind.targetValue) || 1;
            const latest = ind.values?.[0];
            const actual = latest ? Number(latest.verifiedValue ?? latest.actualValue) : null;
            const progress = actual !== null ? Math.min(100, Math.round(((actual - baseline) / (target - baseline)) * 100)) : 0;

            return (
              <div key={ind.id} className="rounded-xl border bg-white p-4 dark:bg-gray-900 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-gray-400 mr-2">{ind.code}</span>
                    <span className="text-sm font-medium">{ln(ind.name, locale)}</span>
                    <span className="ml-2 text-xs text-gray-400">({ind.unit})</span>
                  </div>
                  <button onClick={() => setValueForm({ indicatorId: ind.id, period: '', value: '' })} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">+ Add Value</button>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="text-center"><p className="text-[10px] text-gray-400">Baseline</p><p className="text-sm font-bold">{baseline}</p></div>
                  <div className="flex-1">
                    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div>
                    <p className="text-[10px] text-gray-400 text-center mt-0.5">{progress}%</p>
                  </div>
                  <div className="text-center"><p className="text-[10px] text-gray-400">Actual</p><p className="text-sm font-bold text-emerald-600">{actual ?? '—'}</p></div>
                  <div className="text-center"><p className="text-[10px] text-gray-400">Target</p><p className="text-sm font-bold">{target}</p></div>
                </div>
                {valueForm?.indicatorId === ind.id && (
                  <div className="mt-3 flex items-end gap-2 border-t pt-3 dark:border-gray-700">
                    <div><label className="block text-xs text-gray-500 mb-1">Period</label><input value={valueForm!.period} onChange={e => setValueForm({...valueForm!, period: e.target.value})} placeholder="2026-Q4" className={`${iCls()} w-28`} /></div>
                    <div><label className="block text-xs text-gray-500 mb-1">Value</label><input type="number" value={valueForm!.value} onChange={e => setValueForm({...valueForm!, value: e.target.value})} className={`${iCls()} w-24`} /></div>
                    <button onClick={handleAddValue} disabled={addValueMut.isPending} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-700 disabled:opacity-50">{addValueMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}</button>
                    <button onClick={() => setValueForm(null)} className="rounded-lg border px-3 py-2 text-xs text-gray-500 dark:border-gray-700">Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  REPORTING TAB — User sees their assigned activities + submits reports
// ══════════════════════════════════════════════════════════════════════════════

function ReportingTab({ programmeId, locale }: { programmeId: string; locale: string }) {
  const currentUser = useAuthStore((s) => s.user);
  const { data: cyclesRes, isLoading: cyclesLoading } = useReportingCycles(programmeId);
  const cycles = cyclesRes?.data ?? [];
  const { data: activitiesRes } = useActivities({ programmeId });
  const allActivities = activitiesRes?.data ?? [];
  const createMut = useCreateCycle();
  const submitMut = useSubmitReport();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ cycleType: 'WEEKLY', periodLabel: '', periodStart: '', periodEnd: '', deadline: '' });

  // Auto-generate period label, dates and deadline when type changes
  function initCycleForm(cycleType: string) {
    const now = new Date();
    const year = now.getFullYear();
    let periodLabel = '', periodStart = '', periodEnd = '', deadline = '';

    if (cycleType === 'WEEKLY') {
      // ISO week number
      const jan1 = new Date(year, 0, 1);
      const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
      periodLabel = `${year}-W${String(week).padStart(2, '0')}`;
      const dayOfWeek = now.getDay();
      const monday = new Date(now); monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      periodStart = monday.toISOString().split('T')[0];
      periodEnd = sunday.toISOString().split('T')[0];
      friday.setHours(17, 0, 0);
      deadline = `${friday.toISOString().slice(0, 16)}`;
    } else if (cycleType === 'MONTHLY') {
      const month = String(now.getMonth() + 1).padStart(2, '0');
      periodLabel = `${year}-${month}`;
      periodStart = `${year}-${month}-01`;
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      periodEnd = `${year}-${month}-${lastDay}`;
      const deadlineDate = new Date(year, now.getMonth() + 1, 5, 17, 0);
      deadline = deadlineDate.toISOString().slice(0, 16);
    } else if (cycleType === 'QUARTERLY') {
      const quarter = Math.ceil((now.getMonth() + 1) / 3);
      periodLabel = `${year}-Q${quarter}`;
      const qStart = (quarter - 1) * 3;
      periodStart = `${year}-${String(qStart + 1).padStart(2, '0')}-01`;
      const qEndMonth = qStart + 3;
      const lastDay = new Date(year, qEndMonth, 0).getDate();
      periodEnd = `${year}-${String(qEndMonth).padStart(2, '0')}-${lastDay}`;
      const deadlineDate = new Date(year, qEndMonth, 15, 17, 0);
      deadline = deadlineDate.toISOString().slice(0, 16);
    } else {
      periodLabel = `${year}`;
      periodStart = `${year}-01-01`;
      periodEnd = `${year}-12-31`;
      deadline = `${year + 1}-01-31T17:00`;
    }

    setForm({ cycleType, periodLabel, periodStart, periodEnd, deadline });
  }
  const [reportingCycleId, setReportingCycleId] = useState<string | null>(null);
  const [reportItems, setReportItems] = useState<Record<string, { currentStatus: string; completionPercent: number; narrative: string; blockers: string }>>({});

  // My assigned activities (where responsibleUserId matches current user)
  const myActivities = allActivities.filter((a: any) => a.responsibleUserId === currentUser?.id);
  const activitiesToReport = myActivities.length > 0 ? myActivities : allActivities;

  async function handleCreateCycle() {
    await createMut.mutateAsync({ programmeId, ...form });
    setShowForm(false);
    setForm({ cycleType: 'WEEKLY', periodLabel: '', periodStart: '', periodEnd: '', deadline: '' });
  }

  function startReporting(cycleId: string) {
    setReportingCycleId(cycleId);
    const items: typeof reportItems = {};
    for (const act of activitiesToReport) {
      items[act.id] = { currentStatus: act.status, completionPercent: act.completionPercent, narrative: '', blockers: '' };
    }
    setReportItems(items);
  }

  async function handleSubmitReport() {
    if (!reportingCycleId) return;
    const items = Object.entries(reportItems).map(([activityId, data]) => ({
      activityId,
      previousStatus: allActivities.find((a: any) => a.id === activityId)?.status || 'NOT_STARTED',
      ...data,
    }));
    await submitMut.mutateAsync({ cycleId: reportingCycleId, items, overallNote: '' });
    setReportingCycleId(null);
  }

  const STATUS_BADGE: Record<string, string> = { OPEN: 'bg-blue-50 text-blue-700', SUBMITTED: 'bg-amber-50 text-amber-700', VALIDATED: 'bg-emerald-50 text-emerald-700', PUBLISHED: 'bg-purple-50 text-purple-700' };

  if (cyclesLoading) return <div className="h-48 rounded-xl bg-gray-200 animate-pulse dark:bg-gray-800" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reporting Cycles ({cycles.length})</h3>
          {myActivities.length > 0 && <p className="text-xs text-gray-400 mt-0.5">You have {myActivities.length} assigned activities to report on</p>}
        </div>
        <button onClick={() => { initCycleForm('WEEKLY'); setShowForm(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition"><Plus className="h-3.5 w-3.5" /> Open Cycle</button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-white p-5 dark:bg-gray-900 dark:border-gray-800 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label><select value={form.cycleType} onChange={e => initCycleForm(e.target.value)} className={iCls()}><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="ANNUAL">Annual</option></select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Label *</label><input value={form.periodLabel} onChange={e => setForm({...form, periodLabel: e.target.value})} placeholder="2026-W40" className={iCls()} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Start</label><input type="date" value={form.periodStart} onChange={e => setForm({...form, periodStart: e.target.value})} className={iCls()} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">End</label><input type="date" value={form.periodEnd} onChange={e => setForm({...form, periodEnd: e.target.value})} className={iCls()} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Deadline</label><input type="datetime-local" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} className={iCls()} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-3 py-1.5 text-xs text-gray-600 dark:border-gray-700">Cancel</button>
            <button onClick={handleCreateCycle} disabled={createMut.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50">{createMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Create</button>
          </div>
        </div>
      )}

      {/* Reporting form for a specific cycle */}
      {reportingCycleId && (
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/30 p-5 dark:bg-emerald-900/10 dark:border-emerald-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Submit Activity Report</h4>
            <button onClick={() => setReportingCycleId(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-xs text-gray-500">Update status and completion for each activity, add narrative and blockers.</p>

          <div className="space-y-3">
            {activitiesToReport.map((act: any) => {
              const item = reportItems[act.id];
              if (!item) return null;
              return (
                <div key={act.id} className="rounded-lg border bg-white p-4 dark:bg-gray-900 dark:border-gray-700 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">{act.code}</span>
                    <span className="text-sm font-medium">{ln(act.name, locale)}</span>
                    <span className="text-[10px] text-gray-400">({act.responsibleUnit || 'unassigned'})</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Status</label>
                      <select value={item.currentStatus} onChange={e => setReportItems({...reportItems, [act.id]: {...item, currentStatus: e.target.value}})} className={iCls()}>
                        {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Completion %</label>
                      <input type="number" min={0} max={100} value={item.completionPercent} onChange={e => setReportItems({...reportItems, [act.id]: {...item, completionPercent: Number(e.target.value)}})} className={iCls()} />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Progress narrative</label>
                      <input value={item.narrative} onChange={e => setReportItems({...reportItems, [act.id]: {...item, narrative: e.target.value}})} placeholder="What was done..." className={iCls()} />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Blockers / support needed</label>
                      <input value={item.blockers} onChange={e => setReportItems({...reportItems, [act.id]: {...item, blockers: e.target.value}})} placeholder="Any obstacles..." className={iCls()} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setReportingCycleId(null)} className="rounded-lg border px-4 py-2 text-xs text-gray-600 dark:border-gray-700">Cancel</button>
            <button onClick={handleSubmitReport} disabled={submitMut.isPending} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {submitMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Submit Report
            </button>
          </div>
        </div>
      )}

      {/* Cycles list */}
      {cycles.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-12 text-center dark:border-gray-700">
          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No reporting cycles yet</p>
          <p className="text-xs text-gray-400 mt-1">Open a cycle for team members to submit their activity reports</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map((c: any) => (
            <div key={c.id} className="rounded-xl border bg-white p-4 dark:bg-gray-900 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{c.periodLabel}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{c.cycleType}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{new Date(c.periodStart).toLocaleDateString()} — {new Date(c.periodEnd).toLocaleDateString()} | Deadline: {new Date(c.deadline).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{c._count?.reports ?? 0} report(s)</span>
                  {c.status === 'OPEN' && !reportingCycleId && (
                    <button onClick={() => startReporting(c.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400">
                      <FileText className="h-3 w-3" /> Report
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  RISKS TAB — with owner user selector
// ══════════════════════════════════════════════════════════════════════════════

function RisksTab({ programmeId, locale }: { programmeId: string; locale: string }) {
  const { data: res, isLoading } = useRisks(programmeId);
  const risks = res?.data ?? [];
  const createMut = useCreateRisk();
  const updateMut = useUpdateRisk();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', descEn: '', category: 'OPERATIONAL', likelihood: 'MEDIUM', impact: 'MEDIUM', ownerUserId: '' });
  const [ownerSearch, setOwnerSearch] = useState('');
  const { data: ownerResults } = useSearchUsers(ownerSearch);
  const ownerUsers = ownerResults?.data ?? [];

  async function handleCreate() {
    await createMut.mutateAsync({ programmeId, code: form.code, description: { en: form.descEn }, category: form.category, likelihood: form.likelihood, impact: form.impact, ownerUserId: form.ownerUserId || undefined });
    setShowForm(false);
    setForm({ code: '', descEn: '', category: 'OPERATIONAL', likelihood: 'MEDIUM', impact: 'MEDIUM', ownerUserId: '' });
    setOwnerSearch('');
  }

  if (isLoading) return <div className="h-48 rounded-xl bg-gray-200 animate-pulse dark:bg-gray-800" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Risk Register ({risks.length})</h3>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition"><Plus className="h-3.5 w-3.5" /> Add Risk</button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-white p-5 dark:bg-gray-900 dark:border-gray-800 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Code *</label><input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="RISK-001" className={iCls()} /></div>
            <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Description *</label><input value={form.descEn} onChange={e => setForm({...form, descEn: e.target.value})} placeholder="Risk description" className={iCls()} /></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Category</label><select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className={iCls()}><option value="FINANCIAL">Financial</option><option value="TECHNICAL">Technical</option><option value="OPERATIONAL">Operational</option><option value="POLITICAL">Political</option><option value="SECURITY">Security</option></select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Likelihood</label><select value={form.likelihood} onChange={e => setForm({...form, likelihood: e.target.value})} className={iCls()}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="VERY_HIGH">Very High</option></select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Impact</label><select value={form.impact} onChange={e => setForm({...form, impact: e.target.value})} className={iCls()}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Owner</label>
              <UserSearchSelect
                value={form.ownerUserId}
                onChange={(userId) => setForm({...form, ownerUserId: userId})}
                placeholder="Search owner..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-3 py-1.5 text-xs text-gray-600 dark:border-gray-700">Cancel</button>
            <button onClick={handleCreate} disabled={createMut.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50">{createMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Create</button>
          </div>
        </div>
      )}

      {risks.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-12 text-center dark:border-gray-700"><AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" /><p className="text-sm text-gray-500">No risks registered yet</p></div>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700"><th className="px-3 py-2 text-center text-xs text-gray-500 w-14">Score</th><th className="px-3 py-2 text-left text-xs text-gray-500">Code</th><th className="px-3 py-2 text-left text-xs text-gray-500">Description</th><th className="px-3 py-2 text-center text-xs text-gray-500">Category</th><th className="px-3 py-2 text-center text-xs text-gray-500">L x I</th><th className="px-3 py-2 text-center text-xs text-gray-500">Status</th><th className="px-3 py-2 w-20" /></tr></thead>
            <tbody className="divide-y dark:divide-gray-800">
              {risks.map((r: any) => {
                const scoreColor = r.riskScore >= 9 ? 'text-red-700 bg-red-50' : r.riskScore >= 4 ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50';
                const statusColor = r.status === 'OPEN' ? 'bg-blue-50 text-blue-700' : r.status === 'MITIGATED' ? 'bg-emerald-50 text-emerald-700' : r.status === 'MATERIALIZED' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600';
                return (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2.5 text-center"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${scoreColor}`}>{r.riskScore}</span></td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{r.code}</td>
                    <td className="px-3 py-2.5 text-sm">{ln(r.description, locale)}</td>
                    <td className="px-3 py-2.5 text-center"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800">{r.category}</span></td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-500">{r.likelihood} x {r.impact}</td>
                    <td className="px-3 py-2.5 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>{r.status}</span></td>
                    <td className="px-3 py-2.5">
                      {r.status === 'OPEN' && <button onClick={() => updateMut.mutateAsync({ id: r.id, status: 'MITIGATED' })} className="text-[10px] text-emerald-600 hover:underline">Mitigate</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  TEAM TAB — User search selector + role + activity assignment
// ══════════════════════════════════════════════════════════════════════════════

function TeamTab({ programmeId }: { programmeId: string }) {
  const { data: res, isLoading } = useTeam(programmeId);
  const team = res?.data ?? [];
  const { data: activitiesRes } = useActivities({ programmeId });
  const allActivities = activitiesRes?.data ?? [];
  const addMut = useAddTeamMember();
  const removeMut = useRemoveTeamMember();
  const updateActivityMut = useUpdateActivity();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: '', role: 'ACTIVITY_OWNER', activityIds: [] as string[] });
  const [assigningMember, setAssigningMember] = useState<string | null>(null);
  const [assignActivityIds, setAssignActivityIds] = useState<string[]>([]);

  const ROLES: Record<string, string> = {
    PROGRAMME_DIRECTOR: 'Programme Director', PROGRAMME_COORDINATOR: 'Programme Coordinator',
    REGIONAL_COORDINATOR: 'Regional Coordinator', ACTIVITY_OWNER: 'Activity Owner',
    M_AND_E_OFFICER: 'M&E Officer', FINANCE_OFFICER: 'Finance Officer', VIEWER: 'Viewer',
  };

  const ROLE_COLORS: Record<string, string> = {
    PROGRAMME_DIRECTOR: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    PROGRAMME_COORDINATOR: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    REGIONAL_COORDINATOR: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    ACTIVITY_OWNER: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    M_AND_E_OFFICER: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    FINANCE_OFFICER: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    VIEWER: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  async function handleAdd() {
    if (!form.userId) return;
    await addMut.mutateAsync({ programmeId, userId: form.userId, role: form.role });
    // Assign selected activities to this user
    for (const actId of form.activityIds) {
      await updateActivityMut.mutateAsync({ id: actId, responsibleUserId: form.userId });
    }
    setShowForm(false);
    setForm({ userId: '', role: 'ACTIVITY_OWNER', activityIds: [] });
  }

  async function handleAssignActivities(userId: string) {
    for (const actId of assignActivityIds) {
      await updateActivityMut.mutateAsync({ id: actId, responsibleUserId: userId });
    }
    setAssigningMember(null);
    setAssignActivityIds([]);
  }

  // Count activities assigned to each user
  function getAssignedCount(userId: string): number {
    return allActivities.filter((a: any) => a.responsibleUserId === userId).length;
  }

  if (isLoading) return <div className="h-48 rounded-xl bg-gray-200 animate-pulse dark:bg-gray-800" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Team Members ({team.length})</h3>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition"><Plus className="h-3.5 w-3.5" /> Add Member</button>
      </div>

      {/* Add member form with user search */}
      {showForm && (
        <div className="rounded-xl border bg-white p-5 dark:bg-gray-900 dark:border-gray-800 space-y-4">
          <h4 className="text-sm font-semibold">Add Team Member</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">User *</label>
              <UserSearchSelect
                value={form.userId}
                onChange={(userId) => setForm({...form, userId})}
                placeholder="Search by name or email..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className={iCls()}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Activity assignment */}
          {form.userId && allActivities.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Assign Activities (optional)</label>
              <div className="max-h-40 overflow-y-auto rounded-lg border p-2 space-y-1 dark:border-gray-700">
                {allActivities.map((act: any) => (
                  <label key={act.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.activityIds.includes(act.id)}
                      onChange={e => {
                        const ids = e.target.checked ? [...form.activityIds, act.id] : form.activityIds.filter(id => id !== act.id);
                        setForm({...form, activityIds: ids});
                      }}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-mono text-gray-400">{act.code}</span>
                    <span className="text-xs">{ln(act.name, 'en')}</span>
                  </label>
                ))}
              </div>
              {form.activityIds.length > 0 && <p className="text-[11px] text-emerald-600 mt-1">{form.activityIds.length} activities selected</p>}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setForm({ userId: '', role: 'ACTIVITY_OWNER', activityIds: [] }); }} className="rounded-lg border px-3 py-1.5 text-xs text-gray-600 dark:border-gray-700">Cancel</button>
            <button onClick={handleAdd} disabled={addMut.isPending || !form.userId} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50">{addMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Add Member</button>
          </div>
        </div>
      )}

      {/* Team list */}
      {team.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-12 text-center dark:border-gray-700"><Users className="h-10 w-10 text-gray-300 mx-auto mb-3" /><p className="text-sm text-gray-500">No team members yet</p><p className="text-xs text-gray-400 mt-1">Add members and assign them activities</p></div>
      ) : (
        <div className="space-y-3">
          {team.map((m: any) => {
            const assignedCount = getAssignedCount(m.userId);
            const assignedActivities = allActivities.filter((a: any) => a.responsibleUserId === m.userId);
            const isAssigning = assigningMember === m.userId;

            return (
              <div key={m.id} className="rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-sm font-bold dark:bg-emerald-900/40 dark:text-emerald-400">
                      {(m.userId || '??').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{m.userId}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[m.role] || ROLE_COLORS.VIEWER}`}>{ROLES[m.role] || m.role}</span>
                        <span className="text-[10px] text-gray-400">{assignedCount} activit{assignedCount !== 1 ? 'ies' : 'y'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setAssigningMember(isAssigning ? null : m.userId); setAssignActivityIds(assignedActivities.map((a: any) => a.id)); }} className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${isAssigning ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400'}`}>
                      <Activity className="h-3 w-3 inline mr-1" />Assign Activities
                    </button>
                    <button onClick={() => removeMut.mutateAsync({ programmeId, userId: m.userId })} className="rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition dark:hover:bg-red-900/20">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Assigned activities list + assignment panel */}
                {isAssigning && (
                  <div className="border-t bg-gray-50/50 p-4 dark:bg-gray-800/30 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-600 mb-2">Select activities to assign to this member:</p>
                    <div className="max-h-48 overflow-y-auto rounded-lg border bg-white p-2 space-y-1 dark:bg-gray-900 dark:border-gray-700">
                      {allActivities.map((act: any) => (
                        <label key={act.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={assignActivityIds.includes(act.id)}
                            onChange={e => {
                              const ids = e.target.checked ? [...assignActivityIds, act.id] : assignActivityIds.filter(id => id !== act.id);
                              setAssignActivityIds(ids);
                            }}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-xs font-mono text-gray-400">{act.code}</span>
                          <span className="text-xs flex-1">{ln(act.name, 'en')}</span>
                          {act.responsibleUserId && act.responsibleUserId !== m.userId && (
                            <span className="text-[10px] text-amber-500">assigned to other</span>
                          )}
                        </label>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <button onClick={() => setAssigningMember(null)} className="rounded-lg border px-3 py-1.5 text-xs text-gray-600 dark:border-gray-700">Cancel</button>
                      <button onClick={() => handleAssignActivities(m.userId)} disabled={updateActivityMut.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                        {updateActivityMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Save Assignments ({assignActivityIds.length})
                      </button>
                    </div>
                  </div>
                )}

                {/* Show assigned activities when not in edit mode */}
                {!isAssigning && assignedActivities.length > 0 && (
                  <div className="border-t px-4 py-2 dark:border-gray-700">
                    <div className="flex flex-wrap gap-1.5">
                      {assignedActivities.map((act: any) => (
                        <span key={act.id} className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          {act.code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  USER SEARCH SELECT — Reusable dropdown with search
// ══════════════════════════════════════════════════════════════════════════════

function UserSearchSelect({ value, onChange, placeholder }: { value: string; onChange: (userId: string) => void; placeholder?: string }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const { data: results } = useSearchUsers(query);
  const users = results?.data ?? [];
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          value={open ? query : selectedLabel || query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || 'Search user...'}
          className={`${iCls()} pl-9`}
        />
      </div>

      {open && query.length >= 2 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-48 overflow-y-auto dark:bg-gray-900 dark:border-gray-700">
          {users.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">No users found</div>
          ) : (
            users.map((u: any) => (
              <button
                key={u.id}
                onClick={() => {
                  onChange(u.id);
                  setSelectedLabel(`${u.firstName} ${u.lastName} (${u.email})`);
                  setQuery('');
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2 ${value === u.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
              >
                <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300 shrink-0">
                  {(u.firstName?.[0] || '?')}{(u.lastName?.[0] || '')}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.firstName} {u.lastName}</p>
                  <p className="text-[11px] text-gray-400 truncate">{u.email} — {u.role}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared input class ──
function iCls(): string {
  return 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white';
}
