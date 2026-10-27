'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Smartphone, Battery, Wifi, Signal, HardDrive, RefreshCw, Send, Trash2,
  Power, Clock, Plus, Upload, Shield, ChevronDown, X, Package,
  AlertTriangle, Check, WifiOff, BatteryWarning, MonitorSmartphone,
  CheckCircle2, Loader2, Timer, ArrowUpCircle, Gauge, Activity, XCircle,
  Bell, MapPin, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SettingsBackButton } from '@/components/settings/SettingsBackButton';
import { SuperAdminGuard } from '@/components/settings/SuperAdminGuard';
import {
  useMdmDevices, useMdmDevice, useSendMdmCommand,
  useMdmReleases, useCreateMdmRelease, useUpdateMdmRelease, useDeleteMdmRelease,
  type MdmDevice, type MdmDeviceDetail, type MdmRelease, type MdmCommand,
} from '@/lib/api/mdm-hooks';
import { apiClient } from '@/lib/api/client';
import { useTranslations } from '@/lib/i18n/translations';
import { OverviewTab } from './components/OverviewTab';
import { AlertsTab } from './components/AlertsTab';
import { PoliciesTab } from './components/PoliciesTab';
import { MapTab } from './components/MapTab';
import { AnalyticsTab } from './components/AnalyticsTab';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function timeAgo(ts?: string | null): string {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function heartbeatColor(ts?: string | null): string {
  if (!ts) return 'text-gray-400';
  const mins = (Date.now() - new Date(ts).getTime()) / 60_000;
  if (mins < 5) return 'text-emerald-500';
  if (mins < 30) return 'text-amber-500';
  return 'text-red-500';
}

function batteryColor(level?: number | null): string {
  if (level == null) return 'bg-gray-300';
  if (level > 50) return 'bg-emerald-500';
  if (level >= 20) return 'bg-amber-500';
  return 'bg-red-500';
}

function formatBytes(mb?: number | null): string {
  if (mb == null) return '-';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function commandStatusBadge(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-400' },
    DELIVERED: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400' },
    EXECUTED: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400' },
    FAILED: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400' },
  };
  const c = map[status] ?? map.PENDING;
  return (
    <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium', c.bg, c.text)}>
      {status}
    </span>
  );
}

/* ─── KPI Card ───────────────────────────────────────────────────────────── */

function KpiCard({ label, value, icon, color }: {
  label: string; value: number | string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', color)}>
          {icon}
        </div>
        <div>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Confirm Dialog ─────────────────────────────────────────────────────── */

function ConfirmDialog({ open, title, message, onConfirm, onCancel }: {
  open: boolean; title: string; message: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-lg">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Input Dialog ───────────────────────────────────────────────────────── */

function InputDialog({ open, title, placeholder, onSubmit, onCancel }: {
  open: boolean; title: string; placeholder: string;
  onSubmit: (val: string) => void; onCancel: () => void;
}) {
  const [val, setVal] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-lg">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          className="mt-3 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => { setVal(''); onCancel(); }} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button onClick={() => { onSubmit(val); setVal(''); }} className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={!val.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Command Dropdown ───────────────────────────────────────────────────── */

function CommandDropdown({ device, onCommand }: {
  device: MdmDevice;
  onCommand: (type: string, payload?: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const items = [
    { type: 'FORCE_LOGOUT', label: 'Force Logout', icon: <Power className="h-3 w-3" /> },
    { type: 'FORCE_SYNC', label: 'Force Sync', icon: <RefreshCw className="h-3 w-3" /> },
    { type: 'SEND_MESSAGE', label: 'Send Message', icon: <Send className="h-3 w-3" /> },
    { type: 'FORCE_UPDATE', label: 'Force Update', icon: <Upload className="h-3 w-3" /> },
    { type: 'WIPE_DATA', label: 'Wipe Data', icon: <Trash2 className="h-3 w-3 text-red-500" />, danger: true },
  ];

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1">
            {items.map((item) => (
              <button
                key={item.type}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onCommand(item.type);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800',
                  item.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300',
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Sync / Update Helpers ──────────────────────────────────────────────── */

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem.toString().padStart(2, '0')}s`;
}

interface DeviceSyncState {
  status: 'sending' | 'command_sent' | 'waiting' | 'delivered' | 'syncing' | 'synced' | 'confirmed' | 'failed' | 'timeout';
  progress: number;
  itemsSynced: number;
  totalItems: number;
  speed: number; // items/s
  error?: string;
}

interface DeviceUpdateState {
  status: 'sending' | 'command_sent' | 'waiting' | 'downloading' | 'installing' | 'updated' | 'confirmed' | 'failed' | 'timeout';
  progress: number;
  speed: number; // bytes/s estimate
  error?: string;
}

/* ─── Sync Progress Modal ───────────────────────────────────────────────── */

function SyncProgressModal({ deviceIds, devices, onClose }: {
  deviceIds: string[];
  devices: MdmDevice[];
  onClose: () => void;
}) {
  const sendCommand = useSendMdmCommand();
  const [states, setStates] = useState<Record<string, DeviceSyncState>>({});
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<'sending' | 'polling' | 'confirming' | 'done'>('sending');
  const startTimeRef = useRef(Date.now());
  const prevPendingRef = useRef<Record<string, { count: number; time: number }>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());

  const stopTimers = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Initialize and send commands
  useEffect(() => {
    const initial: Record<string, DeviceSyncState> = {};
    for (const id of deviceIds) {
      const dev = devices.find((d) => d.id === id);
      const pending = dev?.pendingSyncItems ?? dev?.pendingSyncCount ?? 0;
      initial[id] = { status: 'sending', progress: 0, itemsSynced: 0, totalItems: pending, speed: 0 };
      prevPendingRef.current[id] = { count: pending, time: Date.now() };
    }
    setStates(initial);

    // Send FORCE_SYNC to each device sequentially
    const sendAll = async () => {
      for (const id of deviceIds) {
        try {
          await sendCommand.mutateAsync({ deviceId: id, type: 'FORCE_SYNC' });
          setStates((prev) => ({ ...prev, [id]: { ...prev[id], status: 'command_sent' } }));
        } catch {
          setStates((prev) => ({ ...prev, [id]: { ...prev[id], status: 'failed', error: 'Command send failed' } }));
        }
      }
      setPhase('polling');
    };
    sendAll();

    // Elapsed timer
    timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 1000);

    // Poll device details every 5s (realistic interval)
    intervalRef.current = setInterval(async () => {
      const now = Date.now();
      if (now - startTimeRef.current > 120_000) {
        // Timeout after 2 minutes
        setStates((prev) => {
          const next = { ...prev };
          for (const id of deviceIds) {
            if (next[id] && !['synced', 'confirmed', 'failed'].includes(next[id].status)) {
              next[id] = { ...next[id], status: 'timeout' };
            }
          }
          return next;
        });
        setPhase('confirming');
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        return;
      }

      for (const id of deviceIds) {
        try {
          const resp = await apiClient.get(`/credential/mdm/devices/${id}`) as { data: MdmDeviceDetail };
          const detail = resp.data;
          const currentPending = detail.pendingSyncItems ?? detail.pendingSyncCount ?? 0;
          const prevEntry = prevPendingRef.current[id];
          // Check command status from latest commands
          const latestCmd = detail.commands?.find((c: MdmCommand) => c.type === 'FORCE_SYNC');
          const cmdStatus = latestCmd?.status ?? 'PENDING';

          setStates((prev) => {
            const s = prev[id];
            if (!s || ['synced', 'confirmed', 'failed'].includes(s.status)) return prev;

            const totalItems = s.totalItems || prevEntry?.count || 1;
            const synced = Math.max(0, totalItems - currentPending);
            const progress = totalItems > 0 ? Math.min(100, Math.round((synced / totalItems) * 100)) : 0;

            // Speed: items/s based on actual decrease
            let speed = s.speed;
            if (prevEntry && prevEntry.count > currentPending) {
              const timeDelta = (now - prevEntry.time) / 1000;
              if (timeDelta > 0) speed = Math.round((prevEntry.count - currentPending) / timeDelta);
            }

            // Determine status from real data
            let newStatus = s.status;
            if (cmdStatus === 'EXECUTED' && currentPending === 0) {
              newStatus = 'synced'; // Real confirmation from device
            } else if (cmdStatus === 'EXECUTED') {
              newStatus = 'syncing';
            } else if (cmdStatus === 'DELIVERED') {
              newStatus = 'delivered';
            } else if (cmdStatus === 'FAILED') {
              newStatus = 'failed';
            } else if (s.status === 'command_sent') {
              newStatus = 'waiting'; // Waiting for device to pick up command
            }

            return { ...prev, [id]: { ...s, status: newStatus, progress: newStatus === 'synced' ? 100 : progress, itemsSynced: synced, speed } };
          });

          prevPendingRef.current[id] = { count: currentPending, time: now };
        } catch {
          // Network error — will retry next cycle
        }
      }

      // Check if all devices reached a terminal state
      setStates((prev) => {
        const allTerminal = deviceIds.every((id) => {
          const s = prev[id]?.status;
          return s && ['synced', 'confirmed', 'failed', 'timeout'].includes(s);
        });
        if (allTerminal && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setPhase('confirming');
        }
        return prev;
      });
    }, 5000);

    return stopTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop elapsed timer when we enter confirming or done phase
  useEffect(() => {
    if ((phase === 'confirming' || phase === 'done') && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [phase]);

  const handleConfirm = (deviceId: string) => {
    setConfirmed((prev) => new Set([...prev, deviceId]));
    setStates((prev) => ({ ...prev, [deviceId]: { ...prev[deviceId], status: 'confirmed' } }));
  };
  const handleReject = (deviceId: string) => {
    setStates((prev) => ({ ...prev, [deviceId]: { ...prev[deviceId], status: 'failed', error: 'Rejected by admin' } }));
  };

  // Auto-advance to done when all confirmed/rejected
  useEffect(() => {
    if (phase !== 'confirming') return;
    const allDone = deviceIds.every((id) => ['confirmed', 'failed', 'timeout'].includes(states[id]?.status ?? ''));
    if (allDone) setPhase('done');
  }, [states, phase, deviceIds]);

  const deviceMap = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const succeeded = deviceIds.filter((id) => states[id]?.status === 'confirmed').length;
  const syncedNoConfirm = deviceIds.filter((id) => states[id]?.status === 'synced').length;
  const failed = deviceIds.filter((id) => states[id]?.status === 'failed' || states[id]?.status === 'timeout').length;
  const totalItemsSynced = deviceIds.reduce((sum, id) => sum + (states[id]?.itemsSynced ?? 0), 0);
  const avgSpeed = deviceIds.reduce((sum, id) => sum + (states[id]?.speed ?? 0), 0) / Math.max(1, deviceIds.length);

  const statusLabel = (s: DeviceSyncState) => {
    switch (s.status) {
      case 'sending': return 'Sending command...';
      case 'command_sent': return 'Command sent — waiting for device';
      case 'waiting': return 'Waiting for device to start...';
      case 'delivered': return 'Command received by device';
      case 'syncing': return 'Synchronizing data...';
      case 'synced': return 'Sync complete — awaiting confirmation';
      case 'confirmed': return 'Confirmed by admin';
      case 'timeout': return 'Timed out — device may still be syncing';
      case 'failed': return s.error || 'Failed';
      default: return s.status;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
              <RefreshCw className={cn('h-4 w-4 text-blue-600', phase === 'polling' && 'animate-spin')} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Synchronization</h3>
              <p className="text-[11px] text-gray-400">
                {deviceIds.length} device{deviceIds.length > 1 ? 's' : ''} — {formatDuration(elapsed)}
                {phase === 'confirming' && ' — awaiting confirmation'}
              </p>
            </div>
          </div>
          {phase === 'done' && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Phase indicator */}
        <div className="px-6 py-2 flex items-center gap-3 border-b border-gray-50 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/10">
          {['sending', 'polling', 'confirming', 'done'].map((p, i) => (
            <div key={p} className="flex items-center gap-1.5">
              {i > 0 && <div className="w-6 h-px bg-gray-200 dark:bg-gray-700" />}
              <div className={cn('h-2 w-2 rounded-full', phase === p || (['sending', 'polling', 'confirming', 'done'].indexOf(phase) > i) ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600')} />
              <span className={cn('text-[10px] font-medium', phase === p ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400')}>
                {p === 'sending' ? 'Send' : p === 'polling' ? 'Sync' : p === 'confirming' ? 'Confirm' : 'Report'}
              </span>
            </div>
          ))}
        </div>

        {/* Device list */}
        <div className="max-h-[340px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/50">
          {deviceIds.map((id) => {
            const dev = deviceMap.get(id);
            const s = states[id];
            if (!s) return null;
            const icon = s.status === 'confirmed' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              : s.status === 'synced' ? <Clock className="h-4 w-4 text-amber-500" />
              : s.status === 'failed' || s.status === 'timeout' ? <XCircle className="h-4 w-4 text-red-500" />
              : <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;

            return (
              <div key={id} className="flex items-center gap-3 px-6 py-3">
                {icon}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{dev?.deviceName || 'Device'}</p>
                    <span className="text-[10px] text-gray-400 shrink-0 ml-2">{s.itemsSynced}/{s.totalItems} items</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all duration-700', s.status === 'confirmed' ? 'bg-emerald-500' : s.status === 'synced' ? 'bg-amber-400' : s.status === 'failed' || s.status === 'timeout' ? 'bg-red-400' : 'bg-blue-500')} style={{ width: `${s.progress}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{s.progress}%</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[10px] text-gray-400">{statusLabel(s)}</p>
                    {s.speed > 0 && ['syncing', 'delivered'].includes(s.status) && (
                      <p className="text-[10px] text-gray-400">~{s.speed} items/s</p>
                    )}
                  </div>
                </div>
                {/* Confirm/Reject buttons — only when synced, awaiting admin confirmation */}
                {s.status === 'synced' && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleConfirm(id)} title="Confirm sync OK" className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-emerald-600">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleReject(id)} title="Mark as failed" className="p-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 hover:bg-red-100 text-red-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Confirm All bar (when some are awaiting confirmation) */}
        {phase === 'confirming' && syncedNoConfirm > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-2.5 flex items-center justify-between bg-amber-50/50 dark:bg-amber-900/10">
            <p className="text-xs text-amber-700 dark:text-amber-400">{syncedNoConfirm} device{syncedNoConfirm > 1 ? 's' : ''} awaiting your confirmation</p>
            <button onClick={() => { deviceIds.forEach((id) => { if (states[id]?.status === 'synced') handleConfirm(id); }); }} className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
              Confirm All
            </button>
          </div>
        )}

        {/* Final Report */}
        {phase === 'done' && (
          <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              {failed === 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{failed === 0 ? 'Synchronization Confirmed' : 'Synchronization Report'}</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                ['Devices', `${succeeded}/${deviceIds.length} confirmed`],
                ['Items synced', `${totalItemsSynced}`],
                ['Duration', formatDuration(elapsed)],
                ['Avg speed', `~${Math.round(avgSpeed)} items/s`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-3 py-2">
                  <p className="text-[10px] text-gray-400">{label}</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Update Progress Modal ─────────────────────────────────────────────── */

function UpdateProgressModal({ deviceIds, devices, onClose }: {
  deviceIds: string[];
  devices: MdmDevice[];
  onClose: () => void;
}) {
  const { data: releasesData } = useMdmReleases();
  const releases = releasesData?.data ?? [];
  const sendCommand = useSendMdmCommand();

  const [step, setStep] = useState<'pick' | 'progress'>('pick');
  const [selectedRelease, setSelectedRelease] = useState<MdmRelease | null>(null);
  const [states, setStates] = useState<Record<string, DeviceUpdateState>>({});
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<'sending' | 'polling' | 'confirming' | 'done'>('sending');
  const startTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());

  const deviceMap = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);

  const startUpdate = useCallback((release: MdmRelease) => {
    setSelectedRelease(release);
    setStep('progress');
    startTimeRef.current = Date.now();
    setPhase('sending');

    const initial: Record<string, DeviceUpdateState> = {};
    for (const id of deviceIds) {
      initial[id] = { status: 'sending', progress: 0, speed: 0 };
    }
    setStates(initial);

    const sendAll = async () => {
      for (const id of deviceIds) {
        try {
          await sendCommand.mutateAsync({
            deviceId: id,
            type: 'FORCE_UPDATE',
            payload: { versionName: release.versionName, versionCode: release.versionCode, fileUrl: release.fileUrl ?? '', fileSize: release.fileSize ?? 0 },
          });
          setStates((prev) => ({ ...prev, [id]: { ...prev[id], status: 'command_sent' } }));
        } catch {
          setStates((prev) => ({ ...prev, [id]: { ...prev[id], status: 'failed', error: 'Command send failed' } }));
        }
      }
      setPhase('polling');
    };
    sendAll();

    timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 1000);

    // Poll every 8s (updates take time)
    intervalRef.current = setInterval(async () => {
      const now = Date.now();
      if (now - startTimeRef.current > 300_000) {
        setStates((prev) => {
          const next = { ...prev };
          for (const id of deviceIds) {
            if (next[id] && !['updated', 'confirmed', 'failed'].includes(next[id].status)) {
              next[id] = { ...next[id], status: 'timeout' };
            }
          }
          return next;
        });
        setPhase('confirming');
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        return;
      }

      for (const id of deviceIds) {
        try {
          const resp = await apiClient.get(`/credential/mdm/devices/${id}`) as { data: MdmDeviceDetail };
          const detail = resp.data;
          const latestCmd = detail.commands?.find((c: MdmCommand) => c.type === 'FORCE_UPDATE');
          const cmdStatus = latestCmd?.status ?? 'PENDING';
          const isUpdated = detail.appVersion === release.versionName || (detail.appVersionCode != null && detail.appVersionCode >= release.versionCode);
          const elapsedSecs = (now - startTimeRef.current) / 1000;
          const speed = release.fileSize ? Math.round(release.fileSize / Math.max(1, elapsedSecs)) : 0;

          setStates((prev) => {
            const s = prev[id];
            if (!s || ['updated', 'confirmed', 'failed'].includes(s.status)) return prev;

            if (isUpdated) return { ...prev, [id]: { ...s, status: 'updated', progress: 100, speed } };

            let newStatus = s.status;
            let progress = s.progress;
            if (cmdStatus === 'EXECUTED') { newStatus = 'installing'; progress = Math.min(85, progress + 5); }
            else if (cmdStatus === 'DELIVERED') { newStatus = 'downloading'; progress = Math.min(60, Math.round(elapsedSecs / 2)); }
            else if (cmdStatus === 'FAILED') { newStatus = 'failed'; }
            else if (s.status === 'command_sent') { newStatus = 'waiting'; progress = 5; }

            return { ...prev, [id]: { ...s, status: newStatus, progress, speed } };
          });
        } catch { /* retry */ }
      }

      setStates((prev) => {
        const allTerminal = deviceIds.every((id) => ['updated', 'confirmed', 'failed', 'timeout'].includes(prev[id]?.status ?? ''));
        if (allTerminal && intervalRef.current) {
          clearInterval(intervalRef.current); intervalRef.current = null;
          setPhase('confirming');
        }
        return prev;
      });
    }, 8000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceIds]);

  useEffect(() => {
    if ((phase === 'confirming' || phase === 'done') && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, [phase]);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handleConfirm = (id: string) => {
    setConfirmed((prev) => new Set([...prev, id]));
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], status: 'confirmed' } }));
  };
  const handleReject = (id: string) => {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], status: 'failed', error: 'Rejected by admin' } }));
  };

  useEffect(() => {
    if (phase !== 'confirming') return;
    const allDone = deviceIds.every((id) => ['confirmed', 'failed', 'timeout'].includes(states[id]?.status ?? ''));
    if (allDone) setPhase('done');
  }, [states, phase, deviceIds]);

  const succeeded = deviceIds.filter((id) => states[id]?.status === 'confirmed').length;
  const updatedNoConfirm = deviceIds.filter((id) => states[id]?.status === 'updated').length;
  const failed = deviceIds.filter((id) => states[id]?.status === 'failed' || states[id]?.status === 'timeout').length;

  const updateStatusLabel = (s: DeviceUpdateState) => {
    switch (s.status) {
      case 'sending': return 'Sending command...';
      case 'command_sent': return 'Command sent — waiting for device';
      case 'waiting': return 'Waiting for device...';
      case 'downloading': return 'Device downloading APK...';
      case 'installing': return 'Installing update...';
      case 'updated': return 'Update installed — awaiting confirmation';
      case 'confirmed': return 'Confirmed by admin';
      case 'timeout': return 'Timed out — check device manually';
      case 'failed': return s.error || 'Failed';
      default: return s.status;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
              <ArrowUpCircle className={cn('h-4 w-4 text-emerald-600', step === 'progress' && phase === 'polling' && 'animate-pulse')} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Force Update</h3>
              <p className="text-[11px] text-gray-400">
                {step === 'pick'
                  ? `Select a release for ${deviceIds.length} device${deviceIds.length > 1 ? 's' : ''}`
                  : `${deviceIds.length} device${deviceIds.length > 1 ? 's' : ''} — ${formatDuration(elapsed)}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step 1: Release Picker */}
        {step === 'pick' && (
          <div className="px-6 py-4 space-y-3 max-h-[400px] overflow-y-auto">
            {releases.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center">No releases available. Create one in the OTA Updates tab.</p>
            ) : (
              releases.map((r) => (
                <button
                  key={r.id}
                  onClick={() => startUpdate(r)}
                  className={cn(
                    'w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors hover:border-emerald-300 dark:hover:border-emerald-600',
                    'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                      <Package className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{r.versionName}</p>
                      <p className="text-[10px] text-gray-400">
                        Code {r.versionCode} {r.fileSize ? `— ${formatBytes(r.fileSize / (1024 * 1024))}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.isRequired && (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                        Required
                      </span>
                    )}
                    <ArrowUpCircle className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Step 2: Progress */}
        {step === 'progress' && (
          <>
            {/* Phase indicator */}
            <div className="px-6 py-2 flex items-center gap-3 border-b border-gray-50 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/10">
              {['sending', 'polling', 'confirming', 'done'].map((p, i) => (
                <div key={p} className="flex items-center gap-1.5">
                  {i > 0 && <div className="w-6 h-px bg-gray-200 dark:bg-gray-700" />}
                  <div className={cn('h-2 w-2 rounded-full', phase === p || (['sending', 'polling', 'confirming', 'done'].indexOf(phase) > i) ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600')} />
                  <span className={cn('text-[10px] font-medium', phase === p ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400')}>
                    {p === 'sending' ? 'Send' : p === 'polling' ? 'Update' : p === 'confirming' ? 'Confirm' : 'Report'}
                  </span>
                </div>
              ))}
            </div>

            <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/50">
              {deviceIds.map((id) => {
                const dev = deviceMap.get(id);
                const s = states[id];
                if (!s) return null;
                const icon = s.status === 'confirmed' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  : s.status === 'updated' ? <Clock className="h-4 w-4 text-amber-500" />
                  : s.status === 'failed' || s.status === 'timeout' ? <XCircle className="h-4 w-4 text-red-500" />
                  : <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />;

                return (
                  <div key={id} className="flex items-center gap-3 px-6 py-3">
                    {icon}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{dev?.deviceName || 'Device'}</p>
                        <span className="text-[10px] text-gray-400 shrink-0 ml-2">{dev?.appVersion ?? '?'} → {selectedRelease?.versionName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all duration-700', s.status === 'confirmed' ? 'bg-emerald-500' : s.status === 'updated' ? 'bg-amber-400' : s.status === 'failed' || s.status === 'timeout' ? 'bg-red-400' : 'bg-emerald-500')} style={{ width: `${s.progress}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{s.progress}%</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[10px] text-gray-400">{updateStatusLabel(s)}</p>
                        {s.speed > 0 && ['downloading', 'installing'].includes(s.status) && (
                          <p className="text-[10px] text-gray-400">~{formatBytes(s.speed / (1024 * 1024))}/s</p>
                        )}
                      </div>
                    </div>
                    {/* Confirm/Reject buttons */}
                    {s.status === 'updated' && (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => handleConfirm(id)} title="Confirm update OK" className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-emerald-600">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleReject(id)} title="Mark as failed" className="p-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 hover:bg-red-100 text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Confirm All bar */}
            {phase === 'confirming' && updatedNoConfirm > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-2.5 flex items-center justify-between bg-amber-50/50 dark:bg-amber-900/10">
                <p className="text-xs text-amber-700 dark:text-amber-400">{updatedNoConfirm} device{updatedNoConfirm > 1 ? 's' : ''} awaiting your confirmation</p>
                <button onClick={() => { deviceIds.forEach((id) => { if (states[id]?.status === 'updated') handleConfirm(id); }); }} className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                  Confirm All
                </button>
              </div>
            )}

            {/* Final Report */}
            {phase === 'done' && (
              <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  {failed === 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{failed === 0 ? 'Update Confirmed' : 'Update Report'}</h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {[
                    ['Devices', `${succeeded}/${deviceIds.length} confirmed`],
                    ['Failed', `${failed}`],
                    ['Duration', formatDuration(elapsed)],
                    ['Version', selectedRelease?.versionName ?? '-'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-3 py-2">
                      <p className="text-[10px] text-gray-400">{label}</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Close</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Device Detail Drawer ───────────────────────────────────────────────── */

function DeviceDrawer({ deviceId, onClose }: { deviceId: string; onClose: () => void }) {
  const { data } = useMdmDevice(deviceId);
  const d = data?.data;

  if (!d) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl flex items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-5 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            {d.deviceName || 'Device'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Device Info */}
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Device Info</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['Model', d.deviceModel ?? '-'],
                ['OS', d.osVersion ?? '-'],
                ['App Version', d.appVersion ?? '-'],
                ['Resolution', d.screenResolution ?? '-'],
                ['RAM', d.ramMb ? `${d.ramMb} MB` : '-'],
                ['Storage', d.storageTotalMb ? `${formatBytes(d.storageTotalMb - (d.storageFreeMb ?? 0))} / ${formatBytes(d.storageTotalMb)}` : '-'],
                ['Battery', d.batteryLevel != null ? `${d.batteryLevel}%${d.isCharging ? ' (charging)' : ''}` : '-'],
                ['Network', d.networkType ?? '-'],
                ['Enrolled', d.enrolledAt ? new Date(d.enrolledAt).toLocaleDateString() : '-'],
                ['User', d.userName || d.userEmail || '-'],
                ['Email', d.userEmail ?? '-'],
                ['Role', d.userRole?.replace(/_/g, ' ') ?? '-'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                  <p className="text-[10px] text-gray-400">{label}</p>
                  <p className="text-gray-700 dark:text-gray-300 font-medium truncate">{value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Battery History (last heartbeats as colored dots) */}
          {d.heartbeats && d.heartbeats.length > 0 && (
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Battery History (24h)</h4>
              <div className="flex items-end gap-0.5 h-8">
                {d.heartbeats.slice(-48).map((hb, i) => (
                  <div
                    key={hb.id || i}
                    className={cn('w-1.5 rounded-sm', batteryColor(hb.batteryLevel))}
                    style={{ height: `${Math.max(hb.batteryLevel ?? 0, 4)}%` }}
                    title={`${hb.batteryLevel}% at ${new Date(hb.timestamp).toLocaleTimeString()}`}
                  />
                ))}
              </div>
            </section>
          )}

          {/* GPS */}
          {(d.lastGpsLat != null && d.lastGpsLng != null) && (
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Location</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                {d.lastGpsLat.toFixed(5)}, {d.lastGpsLng.toFixed(5)}
              </p>
            </section>
          )}

          {/* Recent Commands */}
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Recent Commands</h4>
            {(!d.commands || d.commands.length === 0) ? (
              <p className="text-xs text-gray-400">No commands sent yet.</p>
            ) : (
              <div className="space-y-1.5">
                {d.commands.slice(0, 10).map((cmd: MdmCommand) => (
                  <div key={cmd.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{cmd.type.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-gray-400">{timeAgo(cmd.issuedAt)}</p>
                    </div>
                    {commandStatusBadge(cmd.status)}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

/* ─── Devices Tab ────────────────────────────────────────────────────────── */

function DevicesTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmCmd, setConfirmCmd] = useState<{ deviceId: string; type: string } | null>(null);
  const [messageCmd, setMessageCmd] = useState<string | null>(null);

  // Multi-selection state
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  // For single-device modals triggered from command dropdown / action buttons
  const [singleSyncDeviceId, setSingleSyncDeviceId] = useState<string | null>(null);
  const [singleUpdateDeviceId, setSingleUpdateDeviceId] = useState<string | null>(null);

  const { data, isLoading } = useMdmDevices({ page, limit: 20, status: statusFilter || undefined, search: search || undefined });
  const sendCommand = useSendMdmCommand();

  const devices = data?.data ?? [];
  const meta = data?.meta;

  // KPI calculations
  const kpis = useMemo(() => {
    const total = meta?.total ?? devices.length;
    let online = 0, offline = 0, lowBattery = 0;
    for (const d of devices) {
      if (d.lastHeartbeatAt) {
        const mins = (Date.now() - new Date(d.lastHeartbeatAt).getTime()) / 60_000;
        if (mins < 5) online++;
        else if (mins > 30) offline++;
      } else {
        offline++;
      }
      if (d.batteryLevel != null && d.batteryLevel < 20) lowBattery++;
    }
    return { total, online, offline, lowBattery };
  }, [devices, meta]);

  // Toggle single device selection
  const toggleDevice = useCallback((id: string) => {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Toggle all devices on current page
  const toggleAll = useCallback(() => {
    setSelectedDeviceIds((prev) => {
      if (prev.size === devices.length && devices.every((d) => prev.has(d.id))) {
        return new Set();
      }
      return new Set(devices.map((d) => d.id));
    });
  }, [devices]);

  const allSelected = devices.length > 0 && devices.every((d) => selectedDeviceIds.has(d.id));

  const handleCommand = useCallback((deviceId: string, type: string) => {
    if (type === 'SEND_MESSAGE') {
      setMessageCmd(deviceId);
      return;
    }
    if (type === 'WIPE_DATA') {
      setConfirmCmd({ deviceId, type });
      return;
    }
    if (type === 'FORCE_SYNC') {
      setSingleSyncDeviceId(deviceId);
      return;
    }
    if (type === 'FORCE_UPDATE') {
      setSingleUpdateDeviceId(deviceId);
      return;
    }
    sendCommand.mutate({ deviceId, type });
  }, [sendCommand]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Devices" value={kpis.total} icon={<Smartphone className="h-4 w-4 text-blue-600" />} color="bg-blue-50 dark:bg-blue-500/10" />
        <KpiCard label="Online" value={kpis.online} icon={<Wifi className="h-4 w-4 text-emerald-600" />} color="bg-emerald-50 dark:bg-emerald-500/10" />
        <KpiCard label="Offline" value={kpis.offline} icon={<WifiOff className="h-4 w-4 text-red-500" />} color="bg-red-50 dark:bg-red-500/10" />
        <KpiCard label="Low Battery" value={kpis.lowBattery} icon={<BatteryWarning className="h-4 w-4 text-amber-600" />} color="bg-amber-50 dark:bg-amber-500/10" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search devices or users..."
          className="flex-1 min-w-[200px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 outline-none"
        >
          <option value="">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              <th className="w-8 px-2 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-gray-300 dark:border-gray-600 h-3.5 w-3.5 cursor-pointer accent-blue-600"
                />
              </th>
              <th className="px-3 py-2.5 text-left">Device</th>
              <th className="px-2 py-2.5 text-left">User</th>
              <th className="px-2 py-2.5 text-center">Version</th>
              <th className="px-2 py-2.5 text-center">Battery</th>
              <th className="px-2 py-2.5 text-center">Network</th>
              <th className="px-2 py-2.5 text-center">Heartbeat</th>
              <th className="px-2 py-2.5 text-center">Sync</th>
              <th className="px-2 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="py-12 text-center text-gray-400"><RefreshCw className="h-4 w-4 animate-spin inline mr-2" />Loading...</td></tr>
            )}
            {!isLoading && devices.length === 0 && (
              <tr><td colSpan={9} className="py-12 text-center text-gray-400">No devices enrolled yet.</td></tr>
            )}
            {devices.map((d) => {
              const netIcon = d.networkType === 'wifi'
                ? <Wifi className="h-3.5 w-3.5 text-blue-500" />
                : d.networkType === 'mobile' || d.networkType === 'cellular'
                  ? <Signal className="h-3.5 w-3.5 text-green-500" />
                  : <WifiOff className="h-3.5 w-3.5 text-gray-400" />;
              const hbColor = heartbeatColor(d.lastHeartbeatAt);

              return (
                <tr
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                >
                  {/* Checkbox */}
                  <td className="w-8 px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedDeviceIds.has(d.id)}
                      onChange={() => toggleDevice(d.id)}
                      className="rounded border-gray-300 dark:border-gray-600 h-3.5 w-3.5 cursor-pointer accent-blue-600"
                    />
                  </td>
                  {/* Device + Model */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', hbColor === 'text-emerald-500' ? 'bg-emerald-50 dark:bg-emerald-500/10' : hbColor === 'text-amber-500' ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-gray-100 dark:bg-gray-800')}>
                        <Smartphone className={cn('h-3.5 w-3.5', hbColor)} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{d.deviceName || 'Unknown'}</p>
                        <p className="text-[10px] text-gray-400 truncate">{d.manufacturer ? `${d.manufacturer} ` : ''}{d.deviceModel ?? ''}</p>
                      </div>
                    </div>
                  </td>
                  {/* User */}
                  <td className="px-2 py-2 max-w-[160px]">
                    {d.userName ? (
                      <div className="min-w-0">
                        <p className="text-gray-700 dark:text-gray-300 font-medium truncate text-[11px]">{d.userName}</p>
                        <p className="text-[10px] text-gray-400 truncate">{d.userEmail ?? ''}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400 truncate text-[11px]">{d.userEmail ?? '-'}</span>
                    )}
                  </td>
                  {/* Version */}
                  <td className="px-2 py-2 text-center">
                    <span className="inline-flex rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:text-gray-400">{d.appVersion ?? '-'}</span>
                  </td>
                  {/* Battery */}
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-10 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className={cn('h-full rounded-full', batteryColor(d.batteryLevel))} style={{ width: `${d.batteryLevel ?? 0}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-500 w-7 text-right">{d.batteryLevel != null ? `${d.batteryLevel}%` : '-'}</span>
                    </div>
                  </td>
                  {/* Network */}
                  <td className="px-2 py-2 text-center">{netIcon}</td>
                  {/* Heartbeat */}
                  <td className={cn('px-2 py-2 text-center font-medium', hbColor)}>
                    {timeAgo(d.lastHeartbeatAt)}
                  </td>
                  {/* Sync */}
                  <td className="px-2 py-2 text-center">
                    {d.pendingSyncCount != null && d.pendingSyncCount > 0 ? (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                        {d.pendingSyncCount}
                      </span>
                    ) : (
                      <Check className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                    )}
                  </td>
                  {/* Actions — inline buttons */}
                  <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        onClick={() => handleCommand(d.id, 'FORCE_SYNC')}
                        title="Force Sync"
                        className="p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-500"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleCommand(d.id, 'SEND_MESSAGE')}
                        title="Send Message"
                        className="p-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-indigo-500"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleCommand(d.id, 'FORCE_LOGOUT')}
                        title="Force Logout"
                        className="p-1 rounded-md hover:bg-amber-50 dark:hover:bg-amber-500/10 text-amber-500"
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleCommand(d.id, 'FORCE_UPDATE')}
                        title="Force Update"
                        className="p-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-500"
                      >
                        <Upload className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleCommand(d.id, 'WIPE_DATA')}
                        title="Wipe Data"
                        className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.total > 20 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Page {meta.page} of {Math.ceil(meta.total / (meta.limit || 20))}</span>
          <div className="flex gap-1.5">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
              Prev
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(meta.total / (meta.limit || 20))} className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}

      {/* Device Drawer */}
      {selectedId && <DeviceDrawer deviceId={selectedId} onClose={() => setSelectedId(null)} />}

      {/* Confirm Wipe Dialog */}
      <ConfirmDialog
        open={!!confirmCmd}
        title="Confirm Wipe Data"
        message="This will permanently erase all data on the device. This action cannot be undone."
        onConfirm={() => {
          if (confirmCmd) sendCommand.mutate({ deviceId: confirmCmd.deviceId, type: confirmCmd.type });
          setConfirmCmd(null);
        }}
        onCancel={() => setConfirmCmd(null)}
      />

      {/* Send Message Dialog */}
      <InputDialog
        open={!!messageCmd}
        title="Send Message to Device"
        placeholder="Type your message..."
        onSubmit={(msg) => {
          if (messageCmd) sendCommand.mutate({ deviceId: messageCmd, type: 'SEND_MESSAGE', payload: { message: msg } });
          setMessageCmd(null);
        }}
        onCancel={() => setMessageCmd(null)}
      />

      {/* Floating Bulk Action Bar */}
      {selectedDeviceIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-3 shadow-2xl">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {selectedDeviceIds.size} device{selectedDeviceIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
          <button
            onClick={() => setShowSyncModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync All
          </button>
          <button
            onClick={() => setShowUpdateModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            <ArrowUpCircle className="h-3.5 w-3.5" />
            Update All
          </button>
          <button
            onClick={() => setSelectedDeviceIds(new Set())}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
            title="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Bulk Sync Modal */}
      {showSyncModal && (
        <SyncProgressModal
          deviceIds={Array.from(selectedDeviceIds)}
          devices={devices}
          onClose={() => { setShowSyncModal(false); setSelectedDeviceIds(new Set()); }}
        />
      )}

      {/* Bulk Update Modal */}
      {showUpdateModal && (
        <UpdateProgressModal
          deviceIds={Array.from(selectedDeviceIds)}
          devices={devices}
          onClose={() => { setShowUpdateModal(false); setSelectedDeviceIds(new Set()); }}
        />
      )}

      {/* Single-device Sync Modal */}
      {singleSyncDeviceId && (
        <SyncProgressModal
          deviceIds={[singleSyncDeviceId]}
          devices={devices}
          onClose={() => setSingleSyncDeviceId(null)}
        />
      )}

      {/* Single-device Update Modal */}
      {singleUpdateDeviceId && (
        <UpdateProgressModal
          deviceIds={[singleUpdateDeviceId]}
          devices={devices}
          onClose={() => setSingleUpdateDeviceId(null)}
        />
      )}
    </div>
  );
}

/* ─── Releases Tab ───────────────────────────────────────────────────────── */

function ReleasesTab() {
  const { data, isLoading } = useMdmReleases();
  const createRelease = useCreateMdmRelease();
  const updateRelease = useUpdateMdmRelease();
  const deleteRelease = useDeleteMdmRelease();

  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    versionName: '', versionCode: 0, fileUrl: '',
    releaseNotes: '', isRequired: false, fileSize: 0, sha256: '',
  });

  const releases: MdmRelease[] = data?.data ?? [];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, fileSize: file.size, fileUrl: file.name }));
    // Compute SHA256 client-side
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      setForm((f) => ({ ...f, sha256: hex }));
    } catch {
      // crypto.subtle may not be available in non-secure contexts
    }
  };

  const handleSubmit = () => {
    createRelease.mutate({
      versionName: form.versionName,
      versionCode: form.versionCode,
      fileUrl: form.fileUrl || undefined,
      fileSize: form.fileSize || undefined,
      sha256: form.sha256 || undefined,
      releaseNotes: form.releaseNotes || undefined,
      isRequired: form.isRequired,
      isActive: false,
    }, {
      onSuccess: () => {
        setShowForm(false);
        setForm({ versionName: '', versionCode: 0, fileUrl: '', releaseNotes: '', isRequired: false, fileSize: 0, sha256: '' });
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Manage OTA update releases for the mobile app.</p>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Release
        </button>
      </div>

      {/* New Release Form */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">New Release</h4>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Version Name</label>
              <input value={form.versionName} onChange={(e) => setForm((f) => ({ ...f, versionName: e.target.value }))} placeholder="e.g. 1.4.0" className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Version Code</label>
              <input type="number" value={form.versionCode || ''} onChange={(e) => setForm((f) => ({ ...f, versionCode: parseInt(e.target.value) || 0 }))} placeholder="e.g. 9" className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase">APK File</label>
            <input type="file" accept=".apk" onChange={handleFileChange} className="mt-1 w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 dark:file:bg-blue-900/30 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-blue-600 dark:file:text-blue-400 hover:file:bg-blue-100" />
          </div>
          {form.fileSize > 0 && (
            <div className="flex gap-4 text-[10px] text-gray-500">
              <span>Size: {formatBytes(form.fileSize / (1024 * 1024))}</span>
              {form.sha256 && <span className="font-mono truncate max-w-[300px]">SHA256: {form.sha256.slice(0, 16)}...</span>}
            </div>
          )}
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase">Release Notes</label>
            <textarea value={form.releaseNotes} onChange={(e) => setForm((f) => ({ ...f, releaseNotes: e.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="What changed in this release..." />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="required" checked={form.isRequired} onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))} className="rounded border-gray-300" />
            <label htmlFor="required" className="text-xs text-gray-600 dark:text-gray-400">Required update (force install)</label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!form.versionName || !form.versionCode || createRelease.isPending}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {createRelease.isPending ? 'Creating...' : 'Create Release'}
            </button>
          </div>
        </div>
      )}

      {/* Releases Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              <th className="px-4 py-2.5 text-left">Version</th>
              <th className="px-3 py-2.5 text-left">Code</th>
              <th className="px-3 py-2.5 text-left">Size</th>
              <th className="px-3 py-2.5 text-left">Notes</th>
              <th className="px-3 py-2.5 text-center">Required</th>
              <th className="px-3 py-2.5 text-center">Active</th>
              <th className="px-3 py-2.5 text-left">Date</th>
              <th className="px-3 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="py-12 text-center text-gray-400"><RefreshCw className="h-4 w-4 animate-spin inline mr-2" />Loading...</td></tr>
            )}
            {!isLoading && releases.length === 0 && (
              <tr><td colSpan={8} className="py-12 text-center text-gray-400">No releases yet.</td></tr>
            )}
            {releases.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{r.versionName}</td>
                <td className="px-3 py-2.5 text-gray-500">{r.versionCode}</td>
                <td className="px-3 py-2.5 text-gray-500">{r.fileSize ? formatBytes(r.fileSize / (1024 * 1024)) : '-'}</td>
                <td className="px-3 py-2.5 text-gray-500 max-w-[200px] truncate">{r.releaseNotes || '-'}</td>
                <td className="px-3 py-2.5 text-center">
                  {r.isRequired ? (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">Required</span>
                  ) : (
                    <span className="text-gray-400">Optional</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <button
                    onClick={() => updateRelease.mutate({ id: r.id, isActive: !r.isActive })}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                      r.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
                    )}
                  >
                    <span className={cn(
                      'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform',
                      r.isActive ? 'translate-x-4' : 'translate-x-0.5',
                    )} />
                  </button>
                </td>
                <td className="px-3 py-2.5 text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    onClick={() => setDeleteId(r.id)}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600"
                    title="Delete release"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete Release"
        message="Are you sure you want to delete this release? Devices that have not yet updated will no longer see it."
        onConfirm={() => {
          if (deleteId) deleteRelease.mutate(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

type Tab = 'overview' | 'devices' | 'alerts' | 'policies' | 'releases' | 'map' | 'analytics';

const TABS: readonly { key: Tab; icon: React.ElementType; labelKey: string }[] = [
  { key: 'overview', icon: Activity, labelKey: 'tabOverview' },
  { key: 'devices', icon: Smartphone, labelKey: 'tabDevices' },
  { key: 'alerts', icon: Bell, labelKey: 'tabAlerts' },
  { key: 'policies', icon: Shield, labelKey: 'tabPolicies' },
  { key: 'releases', icon: Package, labelKey: 'tabReleases' },
  { key: 'map', icon: MapPin, labelKey: 'tabMap' },
  { key: 'analytics', icon: BarChart3, labelKey: 'tabAnalytics' },
];

export default function MdmSettingsPage() {
  const t = useTranslations('mdm');
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <SuperAdminGuard>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <SettingsBackButton />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <MonitorSmartphone className="h-6 w-6 text-blue-600" />
            {t('mdmTitle')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('mdmDescription')}
          </p>
        </div>

        {/* Tabs */}
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 min-w-max">
            {TABS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                    tab === item.key
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(item.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {tab === 'overview' && <OverviewTab />}
        {tab === 'devices' && <DevicesTab />}
        {tab === 'alerts' && <AlertsTab />}
        {tab === 'policies' && <PoliciesTab />}
        {tab === 'releases' && <ReleasesTab />}
        {tab === 'map' && <MapTab />}
        {tab === 'analytics' && <AnalyticsTab />}
      </div>
    </SuperAdminGuard>
  );
}
