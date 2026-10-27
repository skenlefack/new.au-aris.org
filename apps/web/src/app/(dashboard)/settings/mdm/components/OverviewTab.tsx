'use client';

import React, { useMemo } from 'react';
import {
  Smartphone, Wifi, WifiOff, BatteryWarning, AlertTriangle, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMdmDevices, useMdmAlerts } from '@/lib/api/mdm-hooks';
import { useTranslations } from '@/lib/i18n/translations';

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

export function OverviewTab() {
  const t = useTranslations('mdm');
  const { data: devicesData } = useMdmDevices({ page: 1, limit: 500 });
  const { data: alertsData } = useMdmAlerts({ page: 1, limit: 1, isResolved: 'false' });

  const devices = devicesData?.data ?? [];
  const activeAlerts = (alertsData as any)?.meta?.total ?? 0;

  const stats = useMemo(() => {
    let online = 0;
    let offline = 0;
    let lowBattery = 0;
    let compliant = 0;

    for (const d of devices) {
      if (d.lastHeartbeatAt) {
        const mins = (Date.now() - new Date(d.lastHeartbeatAt).getTime()) / 60_000;
        if (mins < 5) online++;
        else if (mins > 30) offline++;
      } else {
        offline++;
      }
      if (d.batteryLevel != null && d.batteryLevel < 20) lowBattery++;
      if ((d as any).complianceStatus === 'COMPLIANT') compliant++;
    }

    return { total: devices.length, online, offline, lowBattery, compliant };
  }, [devices]);

  // SVG donut data
  const donutSegments = useMemo(() => {
    const total = stats.total || 1;
    const segments = [
      { label: t('online'), value: stats.online, color: '#10b981' },
      { label: t('offline'), value: stats.offline, color: '#ef4444' },
      { label: t('idle'), value: Math.max(0, total - stats.online - stats.offline), color: '#f59e0b' },
    ];
    let offset = 0;
    return segments.map((s) => {
      const pct = (s.value / total) * 100;
      const item = { ...s, pct, offset };
      offset += pct;
      return item;
    });
  }, [stats, t]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          label={t('totalDevices')}
          value={stats.total}
          icon={<Smartphone className="h-4 w-4 text-blue-600" />}
          color="bg-blue-50 dark:bg-blue-500/10"
        />
        <KpiCard
          label={t('online')}
          value={stats.online}
          icon={<Wifi className="h-4 w-4 text-emerald-600" />}
          color="bg-emerald-50 dark:bg-emerald-500/10"
        />
        <KpiCard
          label={t('offline')}
          value={stats.offline}
          icon={<WifiOff className="h-4 w-4 text-red-500" />}
          color="bg-red-50 dark:bg-red-500/10"
        />
        <KpiCard
          label={t('lowBattery')}
          value={stats.lowBattery}
          icon={<BatteryWarning className="h-4 w-4 text-amber-600" />}
          color="bg-amber-50 dark:bg-amber-500/10"
        />
        <KpiCard
          label={t('activeAlerts')}
          value={activeAlerts}
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
          color="bg-red-50 dark:bg-red-500/10"
        />
        <KpiCard
          label={t('compliant')}
          value={stats.compliant}
          icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
          color="bg-emerald-50 dark:bg-emerald-500/10"
        />
      </div>

      {/* Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-5">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('deviceStatus')}</h3>
          <div className="flex items-center justify-center gap-8">
            <svg viewBox="0 0 36 36" className="h-32 w-32">
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e5e7eb" strokeWidth="3" className="dark:stroke-gray-700" />
              {donutSegments.map((seg) =>
                seg.pct > 0 ? (
                  <circle
                    key={seg.label}
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="3"
                    strokeDasharray={`${seg.pct} ${100 - seg.pct}`}
                    strokeDashoffset={`${-seg.offset}`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                ) : null,
              )}
              <text x="18" y="17" textAnchor="middle" className="fill-gray-800 dark:fill-white text-[6px] font-semibold">
                {stats.total}
              </text>
              <text x="18" y="22" textAnchor="middle" className="fill-gray-400 text-[3px]">
                devices
              </text>
            </svg>
            <div className="space-y-2">
              {donutSegments.map((seg) => (
                <div key={seg.label} className="flex items-center gap-2 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                  <span className="text-gray-600 dark:text-gray-400">{seg.label}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 ml-auto">{seg.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick stats summary */}
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-5">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('fleetSummary')}</h3>
          <div className="space-y-3">
            {[
              { label: t('onlineRate'), value: stats.total > 0 ? `${Math.round((stats.online / stats.total) * 100)}%` : '0%', bar: stats.total > 0 ? (stats.online / stats.total) * 100 : 0, color: 'bg-emerald-500' },
              { label: t('lowBatteryRate'), value: stats.total > 0 ? `${Math.round((stats.lowBattery / stats.total) * 100)}%` : '0%', bar: stats.total > 0 ? (stats.lowBattery / stats.total) * 100 : 0, color: 'bg-amber-500' },
              { label: t('complianceRate'), value: stats.total > 0 ? `${Math.round((stats.compliant / stats.total) * 100)}%` : '0%', bar: stats.total > 0 ? (stats.compliant / stats.total) * 100 : 0, color: 'bg-blue-500' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600 dark:text-gray-400">{item.label}</span>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{item.value}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-500', item.color)} style={{ width: `${item.bar}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
