'use client';

import React, { useState, useMemo } from 'react';
import {
  RefreshCw, Smartphone, Clock, AlertTriangle, CheckCircle2,
  XCircle, ChevronLeft, ChevronRight, Wifi, WifiOff,
  Activity, ArrowUpDown, User, HardDrive, Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useTenantId } from '@/lib/api/hooks';

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface SyncLogEntry {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  deviceId: string;
  deviceName?: string;
  syncedAt: string;
  submissionCount: number;
  acceptedCount: number;
  rejectedCount: number;
  conflictCount: number;
  durationMs: number;
  status?: string;
}

interface SyncStatusSummary {
  totalSyncsToday: number;
  activeDevices: number;
  pendingSubmissions: number;
  conflictRate: number;
}

interface DeviceStatus {
  deviceId: string;
  deviceName?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  lastSyncAt: string;
  pendingCount: number;
  status: 'ONLINE' | 'IDLE' | 'OFFLINE';
}

interface ConflictEntry {
  id: string;
  submissionId: string;
  campaignName?: string;
  offlineDate: string;
  conflictReason: string;
  deviceId: string;
  userEmail?: string;
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${min}m ${s}s` : `${min}m`;
}

function syncQuality(accepted: number, total: number): 'success' | 'partial' | 'failure' {
  if (total === 0) return 'success';
  const rate = accepted / total;
  if (rate >= 1) return 'success';
  if (rate >= 0.5) return 'partial';
  return 'failure';
}

const QUALITY_STYLES = {
  success: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  partial: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  failure: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const DEVICE_STATUS_STYLES = {
  ONLINE: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30', label: 'Online' },
  IDLE: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', label: 'Idle' },
  OFFLINE: { color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', label: 'Offline' },
};

/* ─── Hooks ────────────────────────────────────────────────────────────────── */

function useSyncStatus() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['sync', 'status', tenantId],
    queryFn: async () => {
      try {
        return await apiClient.get<{ data: SyncStatusSummary }>('/collecte/sync/status');
      } catch {
        return { data: { totalSyncsToday: 0, activeDevices: 0, pendingSubmissions: 0, conflictRate: 0 } };
      }
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

function useSyncLogs(page: number, limit: number) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['sync', 'logs', tenantId, page, limit],
    queryFn: async () => {
      try {
        return await apiClient.get<{ data: SyncLogEntry[]; meta: { total: number; page: number; limit: number } }>(
          '/collecte/sync/logs', { page: String(page), limit: String(limit) }
        );
      } catch {
        return { data: [], meta: { total: 0, page: 1, limit } };
      }
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

function useDeviceStatuses() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['sync', 'devices', tenantId],
    queryFn: async () => {
      try {
        return await apiClient.get<{ data: DeviceStatus[] }>('/collecte/sync/devices');
      } catch {
        return { data: [] };
      }
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

function useSyncConflicts() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['sync', 'conflicts', tenantId],
    queryFn: async () => {
      try {
        return await apiClient.get<{ data: ConflictEntry[] }>('/collecte/sync/conflicts');
      } catch {
        return { data: [] };
      }
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

/* ─── Main Page ────────────────────────────────────────────────────────────── */

export default function SyncMonitoringPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: statusData, isLoading: statusLoading } = useSyncStatus();
  const { data: logsData, isLoading: logsLoading } = useSyncLogs(page, limit);
  const { data: devicesData, isLoading: devicesLoading } = useDeviceStatuses();
  const { data: conflictsData, isLoading: conflictsLoading } = useSyncConflicts();

  const status = statusData?.data;
  const logs = logsData?.data ?? [];
  const meta = logsData?.meta ?? { total: 0, page: 1, limit };
  const totalPages = Math.max(1, Math.ceil(meta.total / limit));
  const devices = devicesData?.data ?? [];
  const conflicts = conflictsData?.data ?? [];

  // Group devices by user
  const devicesByUser = useMemo(() => {
    const map: Record<string, DeviceStatus[]> = {};
    for (const d of devices) {
      const key = d.userEmail ?? d.userId;
      (map[key] ??= []).push(d);
    }
    return map;
  }, [devices]);

  return (
    <div className="space-y-6 pb-20">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-sm">
          <RefreshCw className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sync Monitoring</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Real-time sync status, device activity, and conflict management</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Auto-refresh 30s
        </div>
      </div>

      {/* ── Section 1: KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statusLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <KpiCard icon={Activity} label="Syncs Today" value={status?.totalSyncsToday ?? 0} color="blue" />
            <KpiCard icon={Smartphone} label="Active Devices" value={status?.activeDevices ?? 0} color="green" pulse />
            <KpiCard icon={Clock} label="Pending Submissions" value={status?.pendingSubmissions ?? 0} color="amber" />
            <KpiCard icon={AlertTriangle} label="Conflict Rate" value={`${(status?.conflictRate ?? 0).toFixed(1)}%`} color="red" />
          </>
        )}
      </div>

      {/* ── Section 2: Recent Sync Activity ── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          <ArrowUpDown className="h-3.5 w-3.5" />
          Recent Sync Activity
          {meta.total > 0 && <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-semibold tabular-nums">{meta.total}</span>}
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </h2>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {logsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              <p className="text-sm text-gray-400">Loading sync logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <RefreshCw className="h-7 w-7 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">No sync activity yet</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sync logs will appear here when devices sync</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">User</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Device</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Time</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Submitted</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Accepted</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Rejected</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Conflicts</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {logs.map(log => {
                    const quality = syncQuality(log.acceptedCount, log.submissionCount);
                    return (
                      <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                              <User className="h-3.5 w-3.5 text-gray-500" />
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white truncate max-w-[140px]">
                              {log.userName ?? log.userEmail ?? log.userId.slice(0, 8)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Smartphone className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-gray-600 dark:text-gray-300 truncate max-w-[100px]">
                              {log.deviceName ?? log.deviceId.slice(0, 8)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{timeAgo(log.syncedAt)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="font-semibold text-gray-900 dark:text-white">{log.submissionCount}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', QUALITY_STYLES[quality])}>
                            <CheckCircle2 className="h-3 w-3" />{log.acceptedCount}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {log.rejectedCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              <XCircle className="h-3 w-3" />{log.rejectedCount}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {log.conflictCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              <AlertTriangle className="h-3 w-3" />{log.conflictCount}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Timer className="h-3 w-3" />{formatDuration(log.durationMs)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {meta.total > limit && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {(page - 1) * limit + 1}-{Math.min(page * limit, meta.total)} of {meta.total}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Section 3: Device Status Grid ── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          <HardDrive className="h-3.5 w-3.5" />
          Device Status
          {devices.length > 0 && <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-semibold tabular-nums">{devices.length}</span>}
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </h2>

        {devicesLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : devices.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center py-12 gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <Smartphone className="h-7 w-7 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">No devices registered</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Devices will appear after their first sync</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(devicesByUser).map(([userKey, userDevices]) => (
              <div key={userKey} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50 px-4 py-2">
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{userKey}</span>
                  <span className="rounded-full bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 tabular-nums">{userDevices.length} device{userDevices.length > 1 ? 's' : ''}</span>
                </div>
                <div className="grid grid-cols-1 gap-px bg-gray-100 dark:bg-gray-800 sm:grid-cols-2 lg:grid-cols-3">
                  {userDevices.map(device => {
                    const ds = DEVICE_STATUS_STYLES[device.status] ?? DEVICE_STATUS_STYLES.OFFLINE;
                    return (
                      <div key={device.deviceId} className="bg-white dark:bg-gray-900/50 p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', ds.bg)}>
                              {device.status === 'OFFLINE' ? <WifiOff className={cn('h-4 w-4', ds.color)} /> : <Wifi className={cn('h-4 w-4', ds.color)} />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                                {device.deviceName ?? device.deviceId.slice(0, 12)}
                              </p>
                              <p className="text-[10px] text-gray-400">{device.deviceId.slice(0, 8)}...</p>
                            </div>
                          </div>
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', ds.bg, ds.color)}>
                            {ds.label}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(device.lastSyncAt)}</span>
                          {device.pendingCount > 0 && (
                            <span className="rounded-full bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                              {device.pendingCount} pending
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 4: Conflicts Pending ── */}
      {(conflictsLoading || conflicts.length > 0) && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Conflicts Pending Resolution
            {conflicts.length > 0 && <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 tabular-nums">{conflicts.length}</span>}
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          </h2>

          {conflictsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <p className="text-sm text-gray-400">Loading conflicts...</p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 overflow-hidden">
              <div className="divide-y divide-amber-100 dark:divide-amber-900/30">
                {conflicts.map(conflict => (
                  <div key={conflict.id} className="flex items-start gap-3 px-4 py-3 bg-amber-50/30 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {conflict.submissionId.slice(0, 8)}...
                        </p>
                        {conflict.campaignName && (
                          <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400">
                            {conflict.campaignName}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {conflict.conflictReason}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(conflict.offlineDate)}</span>
                        {conflict.userEmail && <span className="flex items-center gap-1"><User className="h-3 w-3" />{conflict.userEmail}</span>}
                        <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" />{conflict.deviceId.slice(0, 8)}</span>
                      </div>
                    </div>
                    <button className="shrink-0 rounded-lg bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors">
                      Resolve
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ─── KPI Card ─────────────────────────────────────────────────────────────── */

function KpiCard({ icon: Icon, label, value, color, pulse }: {
  icon: React.ElementType; label: string; value: string | number; color: string; pulse?: boolean;
}) {
  const colors: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: 'border-blue-200 dark:border-blue-800', text: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-50 dark:bg-blue-900/30' },
    green: { bg: 'border-green-200 dark:border-green-800', text: 'text-green-600 dark:text-green-400', iconBg: 'bg-green-50 dark:bg-green-900/30' },
    amber: { bg: 'border-amber-200 dark:border-amber-800', text: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-50 dark:bg-amber-900/30' },
    red: { bg: 'border-red-200 dark:border-red-800', text: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-50 dark:bg-red-900/30' },
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

/* ─── Skeleton ─────────────────────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 animate-pulse">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-1.5">
          <div className="h-4 w-12 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-2.5 w-20 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    </div>
  );
}
