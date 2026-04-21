'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Monitor, Smartphone, Search, ChevronLeft, ChevronRight, Clock, Shield,
  Filter, User, Activity, Globe, X, ChevronDown, ChevronUp, Wifi,
  LogIn, LogOut, Ban, Timer, MapPin, BarChart3, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useSessionLog, useSessionStats, useRevokeSession,
  type SessionLogEntry,
} from '@/lib/api/hooks';

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  ACTIVE: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30', icon: Wifi, label: 'Active' },
  EXPIRED: { color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', icon: Timer, label: 'Expired' },
  LOGGED_OUT: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', icon: LogOut, label: 'Logged Out' },
  REVOKED: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', icon: Ban, label: 'Revoked' },
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  EXPIRED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  LOGGED_OUT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  REVOKED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(mins: number | null): string {
  if (mins === null || mins < 0) return '-';
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function groupByDate(entries: SessionLogEntry[]): Record<string, SessionLogEntry[]> {
  const groups: Record<string, SessionLogEntry[]> = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  for (const e of entries) {
    const d = new Date(e.loginAt).toDateString();
    const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : new Date(e.loginAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    (groups[label] ??= []).push(e);
  }
  return groups;
}

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

/* ─── Main Page ─────────────────────────────────────────────────────────────── */

export default function SessionsPage() {
  const t = useTranslations('settings');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const limit = 20;

  const { data: sessionsData, isLoading } = useSessionLog({
    page, limit,
    status: statusFilter || undefined,
    deviceType: deviceTypeFilter || undefined,
    search: search || undefined,
  });

  const { data: statsData } = useSessionStats(days);
  const stats = statsData?.data;

  const entries = sessionsData?.data ?? [];
  const meta = sessionsData?.meta ?? { total: 0, page: 1, limit };
  const totalPages = Math.max(1, Math.ceil(meta.total / limit));
  const hasEntries = entries.length > 0;
  const hasActiveFilters = !!statusFilter || !!deviceTypeFilter || !!search;

  const dateGroups = useMemo(() => groupByDate(entries), [entries]);

  const clearFilters = useCallback(() => {
    setSearch(''); setStatusFilter(''); setDeviceTypeFilter(''); setPage(1);
  }, []);

  return (
    <div className="space-y-6 pb-20">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
          <Monitor className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('sessionsTitle') !== 'sessionsTitle' ? t('sessionsTitle') : 'Session Management'}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('sessionsSubtitle') !== 'sessionsSubtitle' ? t('sessionsSubtitle') : 'Monitor login activity, active sessions, and connection locations'}</p>
        </div>
      </div>

      {/* ── Time range selector ── */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Period:</span>
        {[7, 30, 90, 365].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              days === d ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800')}>
            {d === 365 ? '1 year' : `${d} days`}
          </button>
        ))}
      </div>

      {/* ── KPI Cards ── */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard icon={LogIn} label="Total Sessions" value={stats.totalSessions} color="blue" />
          <KpiCard icon={Wifi} label="Active Now" value={stats.activeSessions} color="green" pulse />
          <KpiCard icon={Globe} label="Countries" value={stats.uniqueCountries} color="amber" />
          <KpiCard icon={Clock} label="Avg Duration" value={`${formatDuration(stats.avgDurationMinutes)}`} color="indigo" />
          <KpiCard icon={BarChart3} label="Peak Hour" value={`${stats.peakHour}:00 UTC`} color="violet" />
        </div>
      )}

      {/* ── Charts ── */}
      {stats && stats.totalSessions > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Logins over time */}
          <ChartCard title="Login Activity" subtitle={`Last ${days} days`}>
            <div className="h-48">
              {stats.loginsByDay.length > 0 ? (
                <div className="flex items-end gap-[2px] h-full px-2 pb-1">
                  {stats.loginsByDay.map((d, i) => {
                    const max = Math.max(...stats.loginsByDay.map(x => x.count), 1);
                    const pct = (d.count / max) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div className="w-full rounded-t bg-emerald-500/80 dark:bg-emerald-400/60 transition-all hover:bg-emerald-600" style={{ height: `${Math.max(pct, 2)}%` }} />
                        <div className="absolute -top-8 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow z-10 whitespace-nowrap">
                          {d.date}: {d.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyChart />}
            </div>
          </ChartCard>

          {/* By country */}
          <ChartCard title="Top Countries" subtitle={`${stats.loginsByCountry.length} countries`}>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {stats.loginsByCountry.slice(0, 8).map((c, i) => {
                const max = stats.loginsByCountry[0]?.count ?? 1;
                const pct = (c.count / max) * 100;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm w-6 text-center">{countryFlag(c.countryCode)}</span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-20 truncate">{c.country}</span>
                    <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500/70 dark:bg-blue-400/50" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400 w-8 text-right">{c.count}</span>
                  </div>
                );
              })}
              {stats.loginsByCountry.length === 0 && <EmptyChart />}
            </div>
          </ChartCard>

          {/* By device type */}
          <ChartCard title="Device Types" subtitle="Web vs Mobile">
            <div className="flex items-center justify-center gap-8 h-48">
              {stats.loginsByDeviceType.map(d => {
                const total = stats.loginsByDeviceType.reduce((s, x) => s + x.count, 0) || 1;
                const pct = Math.round((d.count / total) * 100);
                const isWeb = d.deviceType === 'web';
                return (
                  <div key={d.deviceType} className="flex flex-col items-center gap-3">
                    <div className={cn('flex h-20 w-20 items-center justify-center rounded-2xl', isWeb ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-purple-50 dark:bg-purple-900/20')}>
                      {isWeb ? <Monitor className="h-8 w-8 text-blue-500" /> : <Smartphone className="h-8 w-8 text-purple-500" />}
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{pct}%</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{d.deviceType}</p>
                      <p className="text-[10px] text-gray-400">{d.count} sessions</p>
                    </div>
                  </div>
                );
              })}
              {stats.loginsByDeviceType.length === 0 && <EmptyChart />}
            </div>
          </ChartCard>

          {/* Hourly distribution */}
          <ChartCard title="Hourly Distribution" subtitle="UTC timezone">
            <div className="h-48">
              {stats.loginsByHour.some(h => h.count > 0) ? (
                <div className="flex items-end gap-[2px] h-full px-1 pb-1">
                  {stats.loginsByHour.map((h, i) => {
                    const max = Math.max(...stats.loginsByHour.map(x => x.count), 1);
                    const pct = (h.count / max) * 100;
                    const isPeak = h.hour === stats.peakHour;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div className={cn('w-full rounded-t transition-all', isPeak ? 'bg-amber-500' : 'bg-indigo-400/60 dark:bg-indigo-500/40 hover:bg-indigo-500')} style={{ height: `${Math.max(pct, 2)}%` }} />
                        <span className="text-[8px] text-gray-400 mt-0.5">{h.hour}</span>
                        <div className="absolute -top-8 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow z-10 whitespace-nowrap">
                          {h.hour}:00 — {h.count} logins
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyChart />}
            </div>
          </ChartCard>
        </div>
      )}

      {/* ── Filters ── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          <Filter className="h-3.5 w-3.5" />
          Search &amp; Filter
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Search by user, IP, device, location..."
                value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-300 dark:focus:border-emerald-700 transition-colors" />
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="LOGGED_OUT">Logged Out</option>
              <option value="REVOKED">Revoked</option>
            </select>
            <select value={deviceTypeFilter} onChange={e => { setDeviceTypeFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
              <option value="">All Devices</option>
              <option value="web">Web</option>
              <option value="mobile">Mobile</option>
            </select>
            {hasActiveFilters && (
              <button onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Session Timeline ── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          <Activity className="h-3.5 w-3.5" />
          Session History
          {meta.total > 0 && <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-semibold tabular-nums">{meta.total.toLocaleString()}</span>}
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </h2>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              <p className="text-sm text-gray-400">Loading sessions...</p>
            </div>
          )}
          {!isLoading && !hasEntries && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <Monitor className="h-7 w-7 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">No sessions found</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{hasActiveFilters ? 'Try adjusting your filters' : 'Login activity will appear here'}</p>
            </div>
          )}
          {!isLoading && hasEntries && (
            <div>
              {Object.entries(dateGroups).map(([dateLabel, groupEntries]) => (
                <div key={dateLabel}>
                  <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/90 dark:bg-gray-800/90 backdrop-blur-sm px-4 py-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{dateLabel}</span>
                    <span className="rounded-full bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 tabular-nums">{groupEntries.length}</span>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {groupEntries.map(entry => (
                      <SessionRow key={entry.id} entry={entry} expanded={expandedEntry === entry.id}
                        onToggle={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Pagination ── */}
      {meta.total > limit && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing {(page - 1) * limit + 1}-{Math.min(page * limit, meta.total)} of {meta.total}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page <= 1} className="rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors">First</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors">Last</button>
          </div>
        </div>
      )}

      {/* ── Top Users ── */}
      {stats && stats.topUsers.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            <Users className="h-3.5 w-3.5" />
            Most Active Users
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          </h2>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats.topUsers.map((u, i) => (
                <div key={u.userId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-500">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.email}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">{u.count} sessions</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── KPI Card ──────────────────────────────────────────────────────────────── */

function KpiCard({ icon: Icon, label, value, color, pulse }: {
  icon: React.ElementType; label: string; value: string | number; color: string; pulse?: boolean;
}) {
  const colors: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: 'border-blue-200 dark:border-blue-800', text: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-50 dark:bg-blue-900/30' },
    green: { bg: 'border-green-200 dark:border-green-800', text: 'text-green-600 dark:text-green-400', iconBg: 'bg-green-50 dark:bg-green-900/30' },
    amber: { bg: 'border-amber-200 dark:border-amber-800', text: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-50 dark:bg-amber-900/30' },
    indigo: { bg: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-50 dark:bg-indigo-900/30' },
    violet: { bg: 'border-violet-200 dark:border-violet-800', text: 'text-violet-600 dark:text-violet-400', iconBg: 'bg-violet-50 dark:bg-violet-900/30' },
  };
  const c = colors[color] ?? colors.blue;
  return (
    <div className={cn('rounded-xl border bg-white dark:bg-gray-900/50 p-3 transition-all', c.bg)}>
      <div className="flex items-center gap-2.5">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg relative', c.iconBg)}>
          <Icon className={cn('h-4 w-4', c.text)} />
          {pulse && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{value}</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Chart Card ────────────────────────────────────────────────────────────── */

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function EmptyChart() {
  return <div className="flex items-center justify-center h-full text-xs text-gray-400">No data available</div>;
}

/* ─── Session Row ───────────────────────────────────────────────────────────── */

function SessionRow({ entry, expanded, onToggle }: { entry: SessionLogEntry; expanded: boolean; onToggle: () => void }) {
  const revokeMut = useRevokeSession();
  const style = STATUS_STYLES[entry.status] ?? STATUS_STYLES.EXPIRED;
  const Icon = style.icon;
  const badge = STATUS_BADGE[entry.status] ?? STATUS_BADGE.EXPIRED;
  const isWeb = entry.deviceType === 'web';
  const location = [entry.city, entry.country].filter(Boolean).join(', ') || 'Unknown location';

  return (
    <div className="group">
      <div onClick={onToggle} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors">
        <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', style.bg)}>
          <Icon className={cn('h-4 w-4', style.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-900 dark:text-white leading-snug">
            <span className="font-semibold">{entry.user.email}</span>
            <span className="text-gray-400 mx-1">logged in from</span>
            <span className="font-medium">{isWeb ? <Monitor className="inline h-3.5 w-3.5 -mt-0.5 mr-0.5" /> : <Smartphone className="inline h-3.5 w-3.5 -mt-0.5 mr-0.5" />}{entry.deviceName}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
              <Clock className="h-3 w-3" />{timeAgo(entry.loginAt)}
            </span>
            {entry.country && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                <MapPin className="h-3 w-3" />{countryFlag(entry.countryCode)} {location}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
              <Timer className="h-3 w-3" />{formatDuration(entry.duration)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider', badge)}>{entry.status.replace('_', ' ')}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-300" /> : <ChevronDown className="h-4 w-4 text-gray-300" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 px-4 py-3 ml-12">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <DetailField label="IP Address" value={entry.ipAddress} mono />
            <DetailField label="Location" value={location} />
            <DetailField label="Country Code" value={entry.countryCode ?? '-'} />
            <DetailField label="Device Type" value={entry.deviceType} />
            <DetailField label="Login Time" value={formatDate(entry.loginAt)} />
            <DetailField label="Last Activity" value={formatDate(entry.lastActivityAt)} />
            <DetailField label="Logout Time" value={entry.logoutAt ? formatDate(entry.logoutAt) : '-'} />
            <DetailField label="Duration" value={formatDuration(entry.duration)} />
          </div>
          {entry.status === 'ACTIVE' && (
            <div className="mt-3 flex justify-end">
              <button onClick={(e) => { e.stopPropagation(); revokeMut.mutate(entry.id); }}
                disabled={revokeMut.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50">
                <Ban className="h-3.5 w-3.5" /> Revoke Session
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
      <p className={cn('mt-0.5 text-sm text-gray-700 dark:text-gray-300 truncate', mono && 'font-mono text-xs')}>{value || '-'}</p>
    </div>
  );
}
