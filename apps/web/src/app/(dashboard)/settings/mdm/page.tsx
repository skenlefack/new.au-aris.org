'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Smartphone, Battery, Wifi, Signal, HardDrive, RefreshCw, Send, Trash2,
  Power, Clock, Plus, Upload, Shield, ChevronDown, X, Package,
  AlertTriangle, Check, WifiOff, BatteryWarning, MonitorSmartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SettingsBackButton } from '@/components/settings/SettingsBackButton';
import { SuperAdminGuard } from '@/components/settings/SuperAdminGuard';
import {
  useMdmDevices, useMdmDevice, useSendMdmCommand,
  useMdmReleases, useCreateMdmRelease, useUpdateMdmRelease, useDeleteMdmRelease,
  type MdmDevice, type MdmRelease, type MdmCommand,
} from '@/lib/api/mdm-hooks';

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
                ['User', d.userEmail ?? '-'],
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

  const handleCommand = useCallback((deviceId: string, type: string) => {
    if (type === 'SEND_MESSAGE') {
      setMessageCmd(deviceId);
      return;
    }
    if (type === 'WIPE_DATA') {
      setConfirmCmd({ deviceId, type });
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
              <th className="px-4 py-2.5 text-left">Device</th>
              <th className="px-3 py-2.5 text-left">User</th>
              <th className="px-3 py-2.5 text-left">Version</th>
              <th className="px-3 py-2.5 text-left">Battery</th>
              <th className="px-3 py-2.5 text-left">Storage</th>
              <th className="px-3 py-2.5 text-left">Network</th>
              <th className="px-3 py-2.5 text-left">Heartbeat</th>
              <th className="px-3 py-2.5 text-center">Sync</th>
              <th className="px-3 py-2.5 text-right">Actions</th>
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

              return (
                <tr
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-800 dark:text-gray-200">{d.deviceName || 'Unknown'}</p>
                    <p className="text-[10px] text-gray-400">{d.deviceModel ?? ''}</p>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 max-w-[140px] truncate">{d.userEmail ?? '-'}</td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{d.appVersion ?? '-'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-14 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className={cn('h-full rounded-full', batteryColor(d.batteryLevel))} style={{ width: `${d.batteryLevel ?? 0}%` }} />
                      </div>
                      <span className="text-gray-500">{d.batteryLevel != null ? `${d.batteryLevel}%` : '-'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">
                    {d.storageTotalMb ? `${formatBytes((d.storageTotalMb ?? 0) - (d.storageFreeMb ?? 0))} / ${formatBytes(d.storageTotalMb)}` : '-'}
                  </td>
                  <td className="px-3 py-2.5">{netIcon}</td>
                  <td className={cn('px-3 py-2.5 font-medium', heartbeatColor(d.lastHeartbeatAt))}>
                    {timeAgo(d.lastHeartbeatAt)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {d.pendingSyncCount != null && d.pendingSyncCount > 0 ? (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                        {d.pendingSyncCount}
                      </span>
                    ) : (
                      <Check className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <CommandDropdown device={d} onCommand={(type) => handleCommand(d.id, type)} />
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

type Tab = 'devices' | 'releases';

export default function MdmSettingsPage() {
  const [tab, setTab] = useState<Tab>('devices');

  return (
    <SuperAdminGuard>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <SettingsBackButton />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <MonitorSmartphone className="h-6 w-6 text-blue-600" />
            Mobile Device Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor enrolled devices, send remote commands, and manage OTA updates.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          {([
            { key: 'devices' as Tab, label: 'Devices', icon: <Smartphone className="h-3.5 w-3.5" /> },
            { key: 'releases' as Tab, label: 'OTA Updates', icon: <Package className="h-3.5 w-3.5" /> },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                tab === t.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'devices' && <DevicesTab />}
        {tab === 'releases' && <ReleasesTab />}
      </div>
    </SuperAdminGuard>
  );
}
