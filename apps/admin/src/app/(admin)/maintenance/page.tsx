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
import {
  useMaintenanceStatus,
  useToggleMaintenance,
  useScheduleMaintenance,
  useDeleteMaintenanceWindow,
} from '@/lib/api/hooks';

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
          <h1 className="text-2xl font-bold text-admin-heading">
            Maintenance Mode
          </h1>
          <p className="text-sm text-admin-muted mt-1">
            Control system-wide maintenance mode and schedule maintenance windows
          </p>
        </div>
        <div className="admin-card p-6">
          <div className="space-y-4">
            <div className="h-8 bg-admin-surface rounded animate-pulse w-1/3" />
            <div className="h-4 bg-admin-surface rounded animate-pulse w-2/3" />
            <div className="h-10 bg-admin-surface rounded animate-pulse w-48" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-admin-heading">
          Maintenance Mode
        </h1>
        <p className="text-sm text-admin-muted mt-1">
          Control system-wide maintenance mode and schedule maintenance windows
        </p>
      </div>

      {/* ── Current Status Card ── */}
      <div className="admin-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-xl ${
                isActive ? 'bg-status-down/10' : 'bg-status-healthy/10'
              }`}
            >
              {isActive ? (
                <ShieldAlert className="w-8 h-8 text-status-down" />
              ) : (
                <CheckCircle className="w-8 h-8 text-status-healthy" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-admin-heading">
                  Current Status
                </h2>
                {isActive ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-down opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-down" />
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-status-down/10 text-status-down">
                      ACTIVE
                    </span>
                  </span>
                ) : (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-status-healthy/10 text-status-healthy">
                    NORMAL OPERATIONS
                  </span>
                )}
              </div>
              {isActive && status && (
                <div className="mt-2 space-y-1">
                  {status.message && (
                    <p className="text-sm text-admin-text">{status.message}</p>
                  )}
                  <div className="flex items-center gap-4">
                    {status.startedAt && (
                      <p className="text-xs text-admin-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Started: {new Date(status.startedAt).toLocaleString()}
                      </p>
                    )}
                    {status.scheduledEnd && (
                      <p className="text-xs text-admin-muted flex items-center gap-1">
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
            className={`flex items-center gap-2 disabled:opacity-50 ${
              isActive ? 'admin-btn-primary' : 'admin-btn-danger'
            }`}
          >
            <Power className="w-4 h-4" />
            {isActive
              ? 'Disable Maintenance Mode'
              : 'Enable Maintenance Mode'}
          </button>
        </div>

        {/* Enable form */}
        {showEnableForm && !isActive && (
          <div className="mt-6 border-t border-admin-border pt-6 space-y-4">
            <h3 className="text-lg font-semibold text-admin-heading">
              Enable Maintenance Mode
            </h3>
            <div>
              <label className="block text-xs font-medium text-admin-muted mb-1">
                Maintenance Message
              </label>
              <textarea
                value={enableMessage}
                onChange={(e) => setEnableMessage(e.target.value)}
                className="admin-input w-full"
                rows={3}
                placeholder="System is undergoing scheduled maintenance..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-admin-muted mb-1">
                Scheduled End (optional)
              </label>
              <input
                type="datetime-local"
                value={enableScheduledEnd}
                onChange={(e) => setEnableScheduledEnd(e.target.value)}
                className="admin-input w-full"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleEnableSubmit}
                disabled={toggleMutation.isPending}
                className="admin-btn-danger flex items-center gap-2 disabled:opacity-50"
              >
                <Power className="w-4 h-4" />
                Confirm Enable
              </button>
              <button
                onClick={() => setShowEnableForm(false)}
                className="admin-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Impact Notice (when active) ── */}
      {isActive && (
        <div className="admin-card p-4 border-l-4 border-status-degraded">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-status-degraded/10">
              <AlertTriangle className="w-5 h-5 text-status-degraded" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-status-degraded">
                Service Impact
              </h3>
              <p className="text-sm text-admin-text mt-1">
                All services will return 503 Service Unavailable to non-admin
                users.
              </p>
              {durationSinceStarted() && (
                <p className="text-xs text-admin-muted mt-2 flex items-center gap-1">
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
          <h2 className="text-lg font-semibold text-admin-heading">
            Scheduled Maintenance Windows
          </h2>
          <button
            onClick={() => setShowScheduleForm(!showScheduleForm)}
            className="admin-btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Schedule Window
          </button>
        </div>

        {/* Schedule form */}
        {showScheduleForm && (
          <div className="admin-card p-6 space-y-4">
            <h3 className="text-lg font-semibold text-admin-heading">
              New Maintenance Window
            </h3>
            <div>
              <label className="block text-xs font-medium text-admin-muted mb-1">
                Reason
              </label>
              <textarea
                value={scheduleReason}
                onChange={(e) => setScheduleReason(e.target.value)}
                className="admin-input w-full"
                rows={2}
                placeholder="Database migration, infrastructure upgrade..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-admin-muted mb-1">
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                  className="admin-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-admin-muted mb-1">
                  End Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                  className="admin-input w-full"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleScheduleSubmit}
                disabled={scheduleMutation.isPending || !scheduleReason || !scheduleStart || !scheduleEnd}
                className="admin-btn-primary flex items-center gap-2 disabled:opacity-50"
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
                className="admin-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Scheduled windows table */}
        <div className="admin-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-admin-border">
                <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                  Reason
                </th>
                <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                  Start
                </th>
                <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                  End
                </th>
                <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                  Created By
                </th>
                <th className="text-right text-xs font-medium text-admin-muted px-4 py-3">
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
                      className="border-b border-admin-border/50 hover:bg-admin-hover transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-admin-text">
                            {window.reason}
                          </span>
                          {isOngoing && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-status-degraded/10 text-status-degraded">
                              Ongoing
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary-900/30 text-primary-400">
                              Upcoming
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-admin-muted">
                        {new Date(window.startAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-admin-muted">
                        {new Date(window.endAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-admin-muted">
                        {window.createdBy}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteWindow(window.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded hover:bg-status-down/10 transition-colors disabled:opacity-50"
                          title="Delete scheduled window"
                        >
                          <Trash2 className="w-4 h-4 text-admin-muted hover:text-status-down" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-admin-muted"
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
  );
}
