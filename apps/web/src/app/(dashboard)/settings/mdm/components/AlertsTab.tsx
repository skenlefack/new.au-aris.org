'use client';

import React, { useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMdmAlerts, useResolveMdmAlert } from '@/lib/api/mdm-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import { timeAgo } from './mdm-helpers';

export function AlertsTab() {
  const t = useTranslations('mdm');
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [page, setPage] = useState(1);

  const { data: alertsData } = useMdmAlerts({
    page,
    limit: 20,
    type: typeFilter || undefined,
    severity: severityFilter || undefined,
    isResolved: showResolved ? undefined : 'false',
  });
  const resolve = useResolveMdmAlert();

  const alerts = (alertsData as any)?.data ?? [];
  const meta = (alertsData as any)?.meta;

  const severityBadge = (severity: string) => {
    const map: Record<string, string> = {
      CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
      WARNING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
      INFO: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    };
    return map[severity] ?? 'bg-gray-100 text-gray-700';
  };

  const typeBadge = (type: string) => {
    const map: Record<string, string> = {
      LOW_BATTERY: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
      STORAGE_CRITICAL: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
      SYNC_STALE: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
      COMMAND_FAILED: 'bg-gray-50 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400',
      DEVICE_OFFLINE: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
    };
    return map[type] ?? 'bg-gray-50 text-gray-700';
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        >
          <option value="">{t('alertType')}: All</option>
          <option value="LOW_BATTERY">LOW_BATTERY</option>
          <option value="STORAGE_CRITICAL">STORAGE_CRITICAL</option>
          <option value="SYNC_STALE">SYNC_STALE</option>
          <option value="COMMAND_FAILED">COMMAND_FAILED</option>
          <option value="DEVICE_OFFLINE">DEVICE_OFFLINE</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        >
          <option value="">{t('alertSeverity')}: All</option>
          <option value="CRITICAL">{t('critical')}</option>
          <option value="WARNING">{t('warning')}</option>
          <option value="INFO">{t('info')}</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => { setShowResolved(e.target.checked); setPage(1); }}
            className="rounded"
          />
          {t('showResolved')}
        </label>
      </div>

      {/* Table */}
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Bell className="h-10 w-10 mb-3" />
          <p>{t('noAlerts')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('alertDevice')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('alertType')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('alertSeverity')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('alertMessage')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('alertCreatedAt')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {alerts.map((alert: any) => (
                <tr key={alert.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-medium">{alert.device?.deviceName ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', typeBadge(alert.type))}>
                      {alert.type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', severityBadge(alert.severity))}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{alert.message}</td>
                  <td className="px-4 py-3 text-gray-500">{timeAgo(alert.createdAt)}</td>
                  <td className="px-4 py-3">
                    {!alert.isResolved ? (
                      <button
                        onClick={() => resolve.mutate({ alertId: alert.id })}
                        className="rounded-lg px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />
                        {t('resolveAlert')}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">{t('resolved')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total > meta.limit && (
        <div className="flex items-center justify-between px-2">
          <span className="text-sm text-gray-500">{meta.total} alerts</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page * meta.limit >= meta.total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
