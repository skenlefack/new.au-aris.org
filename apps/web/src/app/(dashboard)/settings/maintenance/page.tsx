'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Power,
  Plus,
  Trash2,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { SettingsBackButton } from '@/components/settings/SettingsBackButton';
import { SuperAdminGuard } from '@/components/settings/SuperAdminGuard';

// ── Types ──

interface MaintenanceWindow {
  id: string;
  reason: string;
  startAt: string;
  endAt: string;
  createdBy: string;
}

interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  startedAt: string | null;
  scheduledEnd: string | null;
  scheduledWindows: MaintenanceWindow[];
}

// ── Inline Hooks ──

function useMaintenanceStatus() {
  return useQuery<MaintenanceStatus>({
    queryKey: ['settings', 'maintenance'],
    queryFn: () => apiClient.get('/admin/maintenance'),
    refetchInterval: 30_000,
  });
}

function useToggleMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { enabled: boolean; message?: string; scheduledEnd?: string }) =>
      apiClient.post<MaintenanceStatus>('/admin/maintenance/toggle', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'maintenance'] }),
  });
}

function useScheduleMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { reason: string; startAt: string; endAt: string }) =>
      apiClient.post<MaintenanceWindow>('/admin/maintenance/schedule', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'maintenance'] }),
  });
}

function useDeleteMaintenanceWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/maintenance/schedule/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'maintenance'] }),
  });
}

// ── Main Page ──

export default function MaintenancePage() {
  const { data: status, isLoading } = useMaintenanceStatus();
  const toggleMutation = useToggleMaintenance();
  const scheduleMutation = useScheduleMaintenance();
  const deleteMutation = useDeleteMaintenanceWindow();

  const [showEnableForm, setShowEnableForm] = useState(false);
  const [enableMessage, setEnableMessage] = useState('');
  const [enableScheduledEnd, setEnableScheduledEnd] = useState('');

  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleReason, setScheduleReason] = useState('');
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');

  const isActive = status?.enabled ?? false;

  const handleToggleMaintenance = () => {
    if (isActive) {
      // Disable immediately
      toggleMutation.mutate({ enabled: false });
      setShowEnableForm(false);
    } else {
      // Show enable form
      setShowEnableForm(true);
    }
  };

  const handleEnableSubmit = () => {
    toggleMutation.mutate(
      {
        enabled: true,
        message: enableMessage || undefined,
        scheduledEnd: enableScheduledEnd || undefined,
      },
      {
        onSuccess: () => {
          setShowEnableForm(false);
          setEnableMessage('');
          setEnableScheduledEnd('');
        },
      },
    );
  };

  const handleScheduleSubmit = () => {
    if (!scheduleReason || !scheduleStart || !scheduleEnd) return;
    scheduleMutation.mutate(
      {
        reason: scheduleReason,
        startAt: new Date(scheduleStart).toISOString(),
        endAt: new Date(scheduleEnd).toISOString(),
      },
      {
        onSuccess: () => {
          setShowScheduleForm(false);
          setScheduleReason('');
          setScheduleStart('');
          setScheduleEnd('');
        },
      },
    );
  };

  const handleDeleteWindow = (id: string) => {
    deleteMutation.mutate(id);
  };

  const durationSinceStarted = () => {
    if (!status?.startedAt) return null;
    const start = new Date(status.startedAt).getTime();
    const now = Date.now();
    const diffMs = now - start;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Maintenance Mode
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Control system-wide maintenance mode and schedule maintenance windows
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
          <div className="space-y-4">
            <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-1/3" />
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-2/3" />
            <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-48" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <SuperAdminGuard>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Maintenance Mode
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Control system-wide maintenance mode and schedule maintenance windows
          </p>
        </div>
        <SettingsBackButton />
      </div>

      {/* ── Current Status Card ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'p-3 rounded-xl',
                isActive ? 'bg-red-500/10' : 'bg-green-500/10',
              )}
            >
              {isActive ? (
                <ShieldAlert className="w-8 h-8 text-red-600 dark:text-red-400" />
              ) : (
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Current Status
                </h2>
                {isActive ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400">
                      ACTIVE
                    </span>
                  </span>
                ) : (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                    NORMAL OPERATIONS
                  </span>
                )}
              </div>
              {isActive && status && (
                <div className="mt-2 space-y-1">
                  {status.message && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">{status.message}</p>
                  )}
                  <div className="flex items-center gap-4">
                    {status.startedAt && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Started: {new Date(status.startedAt).toLocaleString()}
                      </p>
                    )}
                    {status.scheduledEnd && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Scheduled End:{' '}
                        {new Date(status.scheduledEnd).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleToggleMaintenance}
            disabled={toggleMutation.isPending}
            className={cn(
              'flex items-center gap-2 disabled:opacity-50',
              isActive
                ? 'px-4 py-2 text-sm font-medium rounded-lg bg-aris-primary-600 text-white hover:bg-aris-primary-700 transition-colors'
                : 'px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors',
            )}
          >
            <Power className="w-4 h-4" />
            {isActive
              ? 'Disable Maintenance Mode'
              : 'Enable Maintenance Mode'}
          </button>
        </div>

        {/* Enable form */}
        {showEnableForm && !isActive && (
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Enable Maintenance Mode
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Maintenance Message
              </label>
              <textarea
                value={enableMessage}
                onChange={(e) => setEnableMessage(e.target.value)}
                className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
                rows={3}
                placeholder="System is undergoing scheduled maintenance..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Scheduled End (optional)
              </label>
              <input
                type="datetime-local"
                value={enableScheduledEnd}
                onChange={(e) => setEnableScheduledEnd(e.target.value)}
                className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleEnableSubmit}
                disabled={toggleMutation.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Power className="w-4 h-4" />
                Confirm Enable
              </button>
              <button
                onClick={() => setShowEnableForm(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Impact Notice (when active) ── */}
      {isActive && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 border-l-4 border-l-amber-500">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                Service Impact
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                All services will return 503 Service Unavailable to non-admin
                users.
              </p>
              {durationSinceStarted() && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Duration: {durationSinceStarted()} since maintenance started
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Scheduled Maintenance Windows ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Scheduled Maintenance Windows
          </h2>
          <button
            onClick={() => setShowScheduleForm(!showScheduleForm)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-aris-primary-600 text-white hover:bg-aris-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Schedule Window
          </button>
        </div>

        {/* Schedule form */}
        {showScheduleForm && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              New Maintenance Window
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Reason
              </label>
              <textarea
                value={scheduleReason}
                onChange={(e) => setScheduleReason(e.target.value)}
                className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
                rows={2}
                placeholder="Database migration, infrastructure upgrade..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                  className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  End Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                  className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleScheduleSubmit}
                disabled={scheduleMutation.isPending || !scheduleReason || !scheduleStart || !scheduleEnd}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-aris-primary-600 text-white hover:bg-aris-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Schedule
              </button>
              <button
                onClick={() => {
                  setShowScheduleForm(false);
                  setScheduleReason('');
                  setScheduleStart('');
                  setScheduleEnd('');
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Scheduled windows table */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                  Reason
                </th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                  Start
                </th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                  End
                </th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                  Created By
                </th>
                <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {status?.scheduledWindows && status.scheduledWindows.length > 0 ? (
                status.scheduledWindows.map((window) => {
                  const isUpcoming = new Date(window.startAt).getTime() > Date.now();
                  const isOngoing =
                    new Date(window.startAt).getTime() <= Date.now() &&
                    new Date(window.endAt).getTime() > Date.now();
                  return (
                    <tr
                      key={window.id}
                      className="border-b border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {window.reason}
                          </span>
                          {isOngoing && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              Ongoing
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-aris-primary-50 dark:bg-aris-primary-900/30 text-aris-primary-600 dark:text-aris-primary-400">
                              Upcoming
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(window.startAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(window.endAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
                        {window.createdBy}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteWindow(window.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          title="Delete scheduled window"
                        >
                          <Trash2 className="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    No scheduled maintenance windows
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </SuperAdminGuard>
  );
}
