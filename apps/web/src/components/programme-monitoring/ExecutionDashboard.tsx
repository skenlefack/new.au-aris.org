'use client';

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Activity, CheckCircle2,
  Clock, AlertTriangle, Ban,
} from 'lucide-react';

// ── Types ──

interface DashboardData {
  programme: {
    id: string;
    code: string;
    name: Record<string, string>;
    currency: string;
    totalBudget: number;
    status: string;
  };
  kpis: {
    totalApproved: number;
    totalExecuted: number;
    totalCommitted: number;
    totalBalance: number;
    executionRate: number;
    totalActivities: number;
    avgCompletion: number;
  };
  executionByOutput: Array<{
    outputCode: string;
    outputName: Record<string, string>;
    approved: number;
    executed: number;
    balance: number;
    percentExec: number;
  }>;
  statusMix: {
    counts: Record<string, number>;
    total: number;
    percentages: Record<string, number>;
  };
  ragSummary: { GREEN: number; AMBER: number; RED: number; GREY: number };
}

interface Props {
  data: DashboardData | null;
  loading: boolean;
  locale: string;
}

// ── Helpers ──

function fmt(n: number, currency = 'EUR'): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${currency}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K ${currency}`;
  return `${n.toLocaleString()} ${currency}`;
}

function localName(name: Record<string, string> | string, locale: string): string {
  if (typeof name === 'string') return name;
  return name?.[locale] || name?.en || '';
}

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: '#94a3b8',
  PLANNED: '#60a5fa',
  IN_PROGRESS: '#3b82f6',
  COMPLETED: '#22c55e',
  DELAYED: '#ef4444',
  CANCELLED: '#6b7280',
  ON_HOLD: '#f59e0b',
};

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not Initiated',
  PLANNED: 'Planned',
  IN_PROGRESS: 'Ongoing',
  COMPLETED: 'Completed',
  DELAYED: 'Delayed',
  CANCELLED: 'Cancelled',
  ON_HOLD: 'On Hold',
};

const RAG_COLORS = { GREEN: '#22c55e', AMBER: '#f59e0b', RED: '#ef4444', GREY: '#94a3b8' };

// ── Component ──

export function ExecutionDashboard({ data, loading, locale }: Props) {
  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  const { kpis, executionByOutput, statusMix, ragSummary, programme } = data;
  const currency = programme.currency;

  // Status pie chart data
  const pieData = Object.entries(statusMix.counts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: STATUS_LABELS[key] || key,
      value,
      color: STATUS_COLORS[key] || '#94a3b8',
      pct: statusMix.percentages[key],
    }));

  // Bar chart data
  const barData = executionByOutput.map((o) => ({
    name: localName(o.outputName, locale),
    code: o.outputCode,
    Approved: o.approved,
    Executed: o.executed,
  }));

  return (
    <div className="space-y-6">
      {/* ── Header Banner ── */}
      <div className="rounded-xl bg-gradient-to-r from-green-600 to-green-700 p-6 text-white shadow-lg">
        <h1 className="text-xl font-bold tracking-tight">
          {localName(programme.name, locale)}
        </h1>
        <p className="mt-1 text-green-100 text-sm">
          Fast-Track Execution Dashboard
        </p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Approved"
          value={fmt(kpis.totalApproved, currency)}
          icon={<DollarSign className="h-5 w-5" />}
          color="blue"
        />
        <KpiCard
          label="Executed"
          value={fmt(kpis.totalExecuted, currency)}
          subValue={`${kpis.executionRate}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          color="green"
        />
        <KpiCard
          label="Balance"
          value={fmt(kpis.totalBalance, currency)}
          subValue={`${100 - kpis.executionRate}%`}
          icon={<TrendingDown className="h-5 w-5" />}
          color="amber"
        />
        <KpiCard
          label="Avg. Completion"
          value={`${kpis.avgCompletion}%`}
          subValue={`${kpis.totalActivities} activities`}
          icon={<Activity className="h-5 w-5" />}
          color="purple"
        />
      </div>

      {/* ── RAG Summary ── */}
      <div className="grid grid-cols-4 gap-3">
        <RagCard label="On Track" count={ragSummary.GREEN} color="#22c55e" icon={<CheckCircle2 className="h-4 w-4" />} />
        <RagCard label="At Risk" count={ragSummary.AMBER} color="#f59e0b" icon={<AlertTriangle className="h-4 w-4" />} />
        <RagCard label="Critical" count={ragSummary.RED} color="#ef4444" icon={<Ban className="h-4 w-4" />} />
        <RagCard label="Not Started" count={ragSummary.GREY} color="#94a3b8" icon={<Clock className="h-4 w-4" />} />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Bar Chart — Execution by Output */}
        <div className="col-span-2 rounded-xl border bg-white p-5 shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Execution By Output
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="code"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v}
              />
              <Tooltip
                formatter={(value: number) => fmt(value, currency)}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Bar dataKey="Executed" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Approved" fill="#bbf7d0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart — Status Mix */}
        <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Status Mix
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [`${value} (${((value / statusMix.total) * 100).toFixed(1)}%)`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-gray-600 dark:text-gray-400">{entry.name}</span>
                </div>
                <span className="font-medium">{entry.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Execution Table ── */}
      <div className="rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800">
        <div className="border-b bg-green-600 px-5 py-3 rounded-t-xl">
          <h3 className="text-sm font-semibold text-white">Execution By Output</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-800">
                <th className="px-4 py-2.5 text-left font-medium text-gray-500">#</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-500">Output</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-500">Approved ({currency})</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-500">Executed ({currency})</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-500">Balance ({currency})</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-500">% Exec</th>
              </tr>
            </thead>
            <tbody>
              {executionByOutput.map((o, i) => (
                <tr key={o.outputCode} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}.</td>
                  <td className="px-4 py-2.5 font-medium">
                    {o.outputCode} {localName(o.outputName, locale)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{o.approved.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{o.executed.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{o.balance.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-medium">{o.percentExec}%</span>
                      <div className="h-2 w-20 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{ width: `${Math.min(o.percentExec, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold dark:bg-gray-800">
                <td className="px-4 py-2.5" />
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{kpis.totalApproved.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{kpis.totalExecuted.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{kpis.totalBalance.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right">{kpis.executionRate}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function KpiCard({ label, value, subValue, icon, color }: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  color: string;
}) {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/30',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30',
  };

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-gray-900 dark:border-gray-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <span className={`rounded-lg p-2 ${bgMap[color]}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {subValue && (
        <p className="mt-0.5 text-sm text-gray-500">{subValue}</p>
      )}
    </div>
  );
}

function RagCard({ label, count, color, icon }: {
  label: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-center gap-1.5" style={{ color }}>
        {icon}
        <span className="text-lg font-bold">{count}</span>
      </div>
      <span className="text-[11px] text-gray-500">{label}</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 rounded-xl bg-gray-200 dark:bg-gray-800" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-200 dark:bg-gray-800" />)}
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-lg bg-gray-200 dark:bg-gray-800" />)}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 h-80 rounded-xl bg-gray-200 dark:bg-gray-800" />
        <div className="h-80 rounded-xl bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="h-64 rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}
