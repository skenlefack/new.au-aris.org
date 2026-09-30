'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase, Plus, Search, LayoutGrid, List, ChevronRight,
  ChevronLeft, ChevronsLeft, ChevronsRight,
  DollarSign, Activity, Calendar, Users, TrendingUp,
  Clock, CheckCircle2, PauseCircle, XCircle, AlertTriangle,
  Building2, Flag, ArrowUpRight, BarChart3,
} from 'lucide-react';
import { useProgrammes } from '@/lib/api/programme-monitoring-hooks';
import { useLocaleStore } from '@/lib/stores/locale-store';

// ── Helpers ──

function localName(name: Record<string, string> | string | undefined, locale: string): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  return name[locale] || name.en || '';
}

function fmt(n: number, currency?: string): string {
  const suffix = currency ? ` ${currency}` : '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M${suffix}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K${suffix}`;
  return `${n.toLocaleString()}${suffix}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysRemaining(endDate: string): { days: number; label: string; color: string } {
  const end = new Date(endDate);
  const now = new Date();
  const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { days: Math.abs(days), label: `${Math.abs(days)}d overdue`, color: 'text-red-600' };
  if (days < 30) return { days, label: `${days}d left`, color: 'text-amber-600' };
  if (days < 90) return { days, label: `${days}d left`, color: 'text-blue-600' };
  return { days, label: `${days}d left`, color: 'text-gray-500' };
}

function computeStats(prog: any) {
  const components = prog.components ?? [];
  let activityCount = 0;
  let completedCount = 0;
  let delayedCount = 0;
  let totalCompletion = 0;
  let totalApproved = 0;
  let totalExecuted = 0;

  for (const comp of components) {
    for (const output of comp.outputs ?? []) {
      for (const act of output.activities ?? []) {
        activityCount++;
        totalCompletion += act.completionPercent ?? 0;
        if (act.status === 'COMPLETED') completedCount++;
        if (act.status === 'DELAYED') delayedCount++;
      }
    }
  }

  totalApproved = Number(prog.totalBudget) || 0;

  const avgCompletion = activityCount > 0 ? Math.round(totalCompletion / activityCount) : 0;
  const outputCount = components.reduce((s: number, c: any) => s + (c.outputs?.length ?? 0), 0);

  return { activityCount, completedCount, delayedCount, avgCompletion, outputCount, componentCount: components.length, totalApproved, totalExecuted };
}

// ── Status config ──

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string; dot: string }> = {
  DESIGN: { label: 'Design', icon: <Clock className="h-3 w-3" />, bg: 'bg-slate-50 dark:bg-slate-900/40', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
  ACTIVE: { label: 'Active', icon: <CheckCircle2 className="h-3 w-3" />, bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  SUSPENDED: { label: 'Suspended', icon: <PauseCircle className="h-3 w-3" />, bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  CLOSED: { label: 'Closed', icon: <XCircle className="h-3 w-3" />, bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
};

const LEVEL_LABELS: Record<string, string> = {
  CONTINENTAL: 'Continental',
  REGIONAL: 'Regional',
  NATIONAL: 'National',
};

const PAGE_SIZES = [6, 12, 24];

// ── Main Component ──

export default function ProgrammeMonitoringPage() {
  const locale = useLocaleStore((s) => s.locale);
  const router = useRouter();

  // State
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const { data: res, isLoading } = useProgrammes();
  const allProgrammes = res?.data ?? [];

  // Filter + search
  const filtered = useMemo(() => {
    return allProgrammes.filter((prog: any) => {
      if (statusFilter && prog.status !== statusFilter) return false;
      if (levelFilter && prog.level !== levelFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = localName(prog.name, locale).toLowerCase();
        const code = (prog.code || '').toLowerCase();
        const donor = (prog.donorName || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !donor.includes(q)) return false;
      }
      return true;
    });
  }, [allProgrammes, statusFilter, levelFilter, search, locale]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePageValue = Math.min(page, totalPages);
  const paged = filtered.slice((safePageValue - 1) * pageSize, safePageValue * pageSize);

  // Stats for header
  const totalBudget = allProgrammes.reduce((s: number, p: any) => s + (Number(p.totalBudget) || 0), 0);
  const activeCount = allProgrammes.filter((p: any) => p.status === 'ACTIVE').length;
  const totalActivities = allProgrammes.reduce((s: number, p: any) => {
    return s + (p.components ?? []).reduce((sc: number, c: any) =>
      sc + (c.outputs ?? []).reduce((so: number, o: any) => so + (o.activities?.length ?? 0), 0), 0);
  }, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/40">
              <Briefcase className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            Programme Monitoring
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            M&E, Activity Tracking, Budget Execution & Reporting
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 transition">
          <Plus className="h-4 w-4" />
          New Programme
        </button>
      </div>

      {/* ── Stats banner ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Briefcase className="h-4 w-4" />} label="Total Programmes" value={String(allProgrammes.length)} color="blue" />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Active" value={String(activeCount)} color="green" />
        <StatCard icon={<Activity className="h-4 w-4" />} label="Activities" value={String(totalActivities)} color="purple" />
        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Total Budget" value={fmt(totalBudget, 'EUR')} color="amber" />
      </div>

      {/* ── Toolbar: Search + Filters + View toggle ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search programmes..."
              className="w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border bg-white px-3 py-2 text-sm outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-white"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>

          {/* Level filter */}
          <select
            value={levelFilter}
            onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
            className="rounded-lg border bg-white px-3 py-2 text-sm outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-white"
          >
            <option value="">All levels</option>
            {Object.entries(LEVEL_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* View toggle + page size */}
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="rounded-lg border bg-white px-2 py-2 text-xs outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-white"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
          </select>
          <div className="flex rounded-lg border dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 transition ${viewMode === 'card' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition ${viewMode === 'list' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <SkeletonView mode={viewMode} count={pageSize} />
      ) : filtered.length === 0 ? (
        <EmptyState hasFilter={!!search || !!statusFilter || !!levelFilter} onClear={() => { setSearch(''); setStatusFilter(''); setLevelFilter(''); }} />
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paged.map((prog: any) => (
            <ProgrammeCard key={prog.id} prog={prog} locale={locale} onClick={() => router.push(`/programme-monitoring/${prog.id}`)} />
          ))}
        </div>
      ) : (
        <ProgrammeListView programmes={paged} locale={locale} onSelect={(id) => router.push(`/programme-monitoring/${id}`)} />
      )}

      {/* ── Pagination ── */}
      {filtered.length > pageSize && (
        <Pagination
          page={safePageValue}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Sub-Components
// ══════════════════════════════════════════════════════════════════════════════

// ── Stat Card ──

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return (
    <div className="rounded-xl border bg-white p-4 dark:bg-gray-900 dark:border-gray-800">
      <div className="flex items-center gap-3">
        <span className={`rounded-lg p-2 ${colorMap[color]}`}>{icon}</span>
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ── Programme Card ──

function ProgrammeCard({ prog, locale, onClick }: { prog: any; locale: string; onClick: () => void }) {
  const stats = computeStats(prog);
  const status = STATUS_CONFIG[prog.status] ?? STATUS_CONFIG.DESIGN;
  const remaining = daysRemaining(prog.endDate);
  const progressColor = stats.avgCompletion >= 75 ? 'bg-emerald-500' : stats.avgCompletion >= 40 ? 'bg-blue-500' : stats.avgCompletion >= 20 ? 'bg-amber-500' : 'bg-gray-300';

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col rounded-xl border bg-white shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer dark:bg-gray-900 dark:border-gray-800 overflow-hidden"
    >
      {/* Status stripe */}
      <div className={`h-1 w-full ${status.dot}`} />

      <div className="flex flex-1 flex-col p-5">
        {/* Top row: code + status + level */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              {prog.code}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.bg} ${status.text}`}>
              {status.icon}
              {status.label}
            </span>
          </div>
          <ArrowUpRight className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 group-hover:text-emerald-500 transition-all" />
        </div>

        {/* Title + donor */}
        <h3 className="mt-3 text-sm font-semibold leading-snug text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition line-clamp-2">
          {localName(prog.name, locale)}
        </h3>

        {prog.donorName && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Building2 className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">{prog.donorName}</span>
          </div>
        )}

        {/* Period + remaining */}
        <div className="mt-2 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-gray-400" />
            <span className="text-[11px] text-gray-500">{fmtDate(prog.startDate)} - {fmtDate(prog.endDate)}</span>
          </div>
          <span className={`text-[11px] font-medium ${remaining.color}`}>{remaining.label}</span>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">Overall Completion</span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{stats.avgCompletion}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${progressColor} transition-all duration-500`}
              style={{ width: `${stats.avgCompletion}%` }}
            />
          </div>
        </div>

        {/* Budget */}
        <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Budget</span>
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{fmt(Number(prog.totalBudget), prog.currency)}</span>
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <MiniStat icon={<BarChart3 className="h-3 w-3" />} value={stats.componentCount} label="Comp." />
          <MiniStat icon={<Flag className="h-3 w-3" />} value={stats.outputCount} label="Outputs" />
          <MiniStat icon={<Activity className="h-3 w-3" />} value={stats.activityCount} label="Activities" />
          <MiniStat
            icon={stats.delayedCount > 0 ? <AlertTriangle className="h-3 w-3 text-red-500" /> : <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
            value={stats.delayedCount > 0 ? stats.delayedCount : stats.completedCount}
            label={stats.delayedCount > 0 ? 'Delayed' : 'Done'}
            highlight={stats.delayedCount > 0 ? 'red' : undefined}
          />
        </div>

        {/* Level badge */}
        {prog.level && (
          <div className="mt-3 flex items-center gap-1.5">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {LEVEL_LABELS[prog.level] || prog.level}
            </span>
            {prog.reportingFrequency && (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                {prog.reportingFrequency.charAt(0) + prog.reportingFrequency.slice(1).toLowerCase()} reporting
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ icon, value, label, highlight }: { icon: React.ReactNode; value: number; label: string; highlight?: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center text-gray-400">{icon}</div>
      <p className={`text-xs font-bold mt-0.5 ${highlight === 'red' ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>{value}</p>
      <p className="text-[9px] text-gray-400 leading-tight">{label}</p>
    </div>
  );
}

// ── List View ──

function ProgrammeListView({ programmes, locale, onSelect }: { programmes: any[]; locale: string; onSelect: (id: string) => void }) {
  return (
    <div className="rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Programme</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Donor</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Budget</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Activities</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">Progress</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden xl:table-cell">Period</th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y dark:divide-gray-800">
          {programmes.map((prog: any) => {
            const stats = computeStats(prog);
            const status = STATUS_CONFIG[prog.status] ?? STATUS_CONFIG.DESIGN;
            const remaining = daysRemaining(prog.endDate);

            return (
              <tr
                key={prog.id}
                onClick={() => onSelect(prog.id)}
                className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition"
              >
                {/* Programme */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${status.bg}`}>
                      <Briefcase className={`h-4 w-4 ${status.text}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-emerald-600">{prog.code}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[280px] group-hover:text-emerald-600 transition">
                        {localName(prog.name, locale)}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Status */}
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.bg} ${status.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </td>

                {/* Donor */}
                <td className="px-4 py-3.5 hidden md:table-cell">
                  <span className="text-xs text-gray-500">{prog.donorName || '-'}</span>
                </td>

                {/* Budget */}
                <td className="px-4 py-3.5 text-right">
                  <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                    {fmt(Number(prog.totalBudget))}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-1">{prog.currency}</span>
                </td>

                {/* Activities */}
                <td className="px-4 py-3.5 text-center hidden lg:table-cell">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-sm font-medium">{stats.activityCount}</span>
                    {stats.delayedCount > 0 && (
                      <span className="rounded bg-red-50 px-1 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-900/30">
                        {stats.delayedCount} delayed
                      </span>
                    )}
                  </div>
                </td>

                {/* Progress */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2 justify-center">
                    <div className="h-1.5 w-16 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${stats.avgCompletion}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-8 text-right tabular-nums">{stats.avgCompletion}%</span>
                  </div>
                </td>

                {/* Period */}
                <td className="px-4 py-3.5 hidden xl:table-cell">
                  <div className="text-xs text-gray-500">
                    {fmtDate(prog.startDate)} - {fmtDate(prog.endDate)}
                  </div>
                  <span className={`text-[10px] font-medium ${remaining.color}`}>{remaining.label}</span>
                </td>

                {/* Arrow */}
                <td className="px-4 py-3.5">
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-500 transition" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Pagination ──

function Pagination({ page, totalPages, totalItems, pageSize, onPageChange }: {
  page: number; totalPages: number; totalItems: number; pageSize: number; onPageChange: (p: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-gray-500">
        Showing <span className="font-medium text-gray-700 dark:text-gray-300">{from}-{to}</span> of{' '}
        <span className="font-medium text-gray-700 dark:text-gray-300">{totalItems}</span> programmes
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="rounded-lg border p-1.5 text-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed dark:border-gray-700 dark:hover:bg-gray-800 transition"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border p-1.5 text-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed dark:border-gray-700 dark:hover:bg-gray-800 transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (page <= 3) {
            pageNum = i + 1;
          } else if (page >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = page - 2 + i;
          }

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`h-8 w-8 rounded-lg text-xs font-medium transition ${
                page === pageNum
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'border text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border p-1.5 text-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed dark:border-gray-700 dark:hover:bg-gray-800 transition"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="rounded-lg border p-1.5 text-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed dark:border-gray-700 dark:hover:bg-gray-800 transition"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Empty State ──

function EmptyState({ hasFilter, onClear }: { hasFilter: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-16 text-center dark:border-gray-700">
      <div className="rounded-full bg-gray-100 p-4 dark:bg-gray-800">
        <Briefcase className="h-10 w-10 text-gray-300 dark:text-gray-600" />
      </div>
      <h3 className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">
        {hasFilter ? 'No programmes match your filters' : 'No programmes yet'}
      </h3>
      <p className="text-sm text-gray-500 mt-1 max-w-sm">
        {hasFilter
          ? 'Try adjusting your search or filter criteria'
          : 'Create your first programme to start tracking activities and budgets'
        }
      </p>
      {hasFilter && (
        <button onClick={onClear} className="mt-4 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition">
          Clear all filters
        </button>
      )}
    </div>
  );
}

// ── Skeleton ──

function SkeletonView({ mode, count }: { mode: 'card' | 'list'; count: number }) {
  if (mode === 'list') {
    return (
      <div className="rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden animate-pulse">
        <div className="h-12 bg-gray-50 dark:bg-gray-800" />
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t px-4 py-4 dark:border-gray-800">
            <div className="h-9 w-9 rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-48 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
            <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 animate-pulse">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
          <div className="h-1 bg-gray-200 dark:bg-gray-700" />
          <div className="p-5 space-y-3">
            <div className="flex gap-2">
              <div className="h-5 w-16 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-5 w-14 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>
            <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 mt-4" />
            <div className="h-10 w-full rounded-lg bg-gray-100 dark:bg-gray-800" />
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((j) => <div key={j} className="h-10 rounded bg-gray-100 dark:bg-gray-800" />)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
