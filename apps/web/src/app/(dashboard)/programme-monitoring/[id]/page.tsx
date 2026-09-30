'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, LayoutDashboard, Activity, DollarSign,
  Target, FileText, AlertTriangle, Users, Pencil, Plus,
  CheckCircle2, Clock, Pause, Ban, Loader2, Trash2,
  Calendar, ChevronDown, ChevronRight, Save, X,
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
//  REPORTING TAB
// ══════════════════════════════════════════════════════════════════════════════

function ReportingTab({ programmeId, locale }: { programmeId: string; locale: string }) {
  const { data: res, isLoading } = useReportingCycles(programmeId);
  const cycles = res?.data ?? [];
  const createMut = useCreateCycle();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ cycleType: 'WEEKLY', periodLabel: '', periodStart: '', periodEnd: '', deadline: '' });

  async function handleCreate() {
    await createMut.mutateAsync({ programmeId, ...form });
    setShowForm(false);
    setForm({ cycleType: 'WEEKLY', periodLabel: '', periodStart: '', periodEnd: '', deadline: '' });
  }

  if (isLoading) return <div className="h-48 rounded-xl bg-gray-200 animate-pulse dark:bg-gray-800" />;

  const STATUS_BADGE: Record<string, string> = { OPEN: 'bg-blue-50 text-blue-700', SUBMITTED: 'bg-amber-50 text-amber-700', VALIDATED: 'bg-emerald-50 text-emerald-700', PUBLISHED: 'bg-purple-50 text-purple-700' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reporting Cycles ({cycles.length})</h3>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition"><Plus className="h-3.5 w-3.5" /> Open Cycle</button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-white p-5 dark:bg-gray-900 dark:border-gray-800 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label><select value={form.cycleType} onChange={e => setForm({...form, cycleType: e.target.value})} className={iCls()}><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="ANNUAL">Annual</option></select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Label *</label><input value={form.periodLabel} onChange={e => setForm({...form, periodLabel: e.target.value})} placeholder="2026-W40" className={iCls()} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Start</label><input type="date" value={form.periodStart} onChange={e => setForm({...form, periodStart: e.target.value})} className={iCls()} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">End</label><input type="date" value={form.periodEnd} onChange={e => setForm({...form, periodEnd: e.target.value})} className={iCls()} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Deadline</label><input type="datetime-local" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} className={iCls()} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-3 py-1.5 text-xs text-gray-600 dark:border-gray-700">Cancel</button>
            <button onClick={handleCreate} disabled={createMut.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50">{createMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Create</button>
          </div>
        </div>
      )}

      {cycles.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-12 text-center dark:border-gray-700">
          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No reporting cycles yet</p>
          <p className="text-xs text-gray-400 mt-1">Open a cycle for team members to submit their activity reports</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map((c: any) => (
            <div key={c.id} className="rounded-xl border bg-white p-4 dark:bg-gray-900 dark:border-gray-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{c.periodLabel}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{c.cycleType}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{new Date(c.periodStart).toLocaleDateString()} — {new Date(c.periodEnd).toLocaleDateString()} | Deadline: {new Date(c.deadline).toLocaleString()}</p>
              </div>
              <div className="text-xs text-gray-400">{c._count?.reports ?? 0} report(s)</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  RISKS TAB
// ══════════════════════════════════════════════════════════════════════════════

function RisksTab({ programmeId, locale }: { programmeId: string; locale: string }) {
  const { data: res, isLoading } = useRisks(programmeId);
  const risks = res?.data ?? [];
  const createMut = useCreateRisk();
  const updateMut = useUpdateRisk();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', descEn: '', category: 'OPERATIONAL', likelihood: 'MEDIUM', impact: 'MEDIUM' });

  async function handleCreate() {
    await createMut.mutateAsync({ programmeId, code: form.code, description: { en: form.descEn }, category: form.category, likelihood: form.likelihood, impact: form.impact });
    setShowForm(false);
    setForm({ code: '', descEn: '', category: 'OPERATIONAL', likelihood: 'MEDIUM', impact: 'MEDIUM' });
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Code *</label><input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="RISK-001" className={iCls()} /></div>
            <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Description *</label><input value={form.descEn} onChange={e => setForm({...form, descEn: e.target.value})} placeholder="Risk description" className={iCls()} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Likelihood</label><select value={form.likelihood} onChange={e => setForm({...form, likelihood: e.target.value})} className={iCls()}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="VERY_HIGH">Very High</option></select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Impact</label><select value={form.impact} onChange={e => setForm({...form, impact: e.target.value})} className={iCls()}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Category</label><select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className={`${iCls()} w-48`}><option value="FINANCIAL">Financial</option><option value="TECHNICAL">Technical</option><option value="OPERATIONAL">Operational</option><option value="POLITICAL">Political</option><option value="SECURITY">Security</option></select></div>
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
            <thead><tr className="border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700"><th className="px-3 py-2 text-center text-xs text-gray-500 w-14">Score</th><th className="px-3 py-2 text-left text-xs text-gray-500">Code</th><th className="px-3 py-2 text-left text-xs text-gray-500">Description</th><th className="px-3 py-2 text-center text-xs text-gray-500">Category</th><th className="px-3 py-2 text-center text-xs text-gray-500">L x I</th><th className="px-3 py-2 text-center text-xs text-gray-500">Status</th><th className="px-3 py-2 w-16" /></tr></thead>
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
//  TEAM TAB
// ══════════════════════════════════════════════════════════════════════════════

function TeamTab({ programmeId }: { programmeId: string }) {
  const { data: res, isLoading } = useTeam(programmeId);
  const team = res?.data ?? [];
  const addMut = useAddTeamMember();
  const removeMut = useRemoveTeamMember();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: '', role: 'ACTIVITY_OWNER' });

  const ROLES: Record<string, string> = {
    PROGRAMME_DIRECTOR: 'Programme Director', PROGRAMME_COORDINATOR: 'Programme Coordinator',
    REGIONAL_COORDINATOR: 'Regional Coordinator', ACTIVITY_OWNER: 'Activity Owner',
    M_AND_E_OFFICER: 'M&E Officer', FINANCE_OFFICER: 'Finance Officer', VIEWER: 'Viewer',
  };

  async function handleAdd() {
    await addMut.mutateAsync({ programmeId, userId: form.userId, role: form.role });
    setShowForm(false);
    setForm({ userId: '', role: 'ACTIVITY_OWNER' });
  }

  if (isLoading) return <div className="h-48 rounded-xl bg-gray-200 animate-pulse dark:bg-gray-800" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Team Members ({team.length})</h3>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition"><Plus className="h-3.5 w-3.5" /> Add Member</button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-white p-5 dark:bg-gray-900 dark:border-gray-800 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">User ID *</label><input value={form.userId} onChange={e => setForm({...form, userId: e.target.value})} placeholder="User UUID" className={iCls()} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Role *</label><select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className={iCls()}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-3 py-1.5 text-xs text-gray-600 dark:border-gray-700">Cancel</button>
            <button onClick={handleAdd} disabled={addMut.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50">{addMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Add</button>
          </div>
        </div>
      )}

      {team.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-12 text-center dark:border-gray-700"><Users className="h-10 w-10 text-gray-300 mx-auto mb-3" /><p className="text-sm text-gray-500">No team members yet</p></div>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800 divide-y dark:divide-gray-800">
          {team.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold dark:bg-emerald-900/40 dark:text-emerald-400">
                  {(m.userId || '??').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{m.userId}</p>
                  <p className="text-xs text-gray-500">{ROLES[m.role] || m.role}</p>
                </div>
              </div>
              <button onClick={() => removeMut.mutateAsync({ programmeId, userId: m.userId })} className="rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition dark:hover:bg-red-900/20">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared input class ──
function iCls(): string {
  return 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white';
}
