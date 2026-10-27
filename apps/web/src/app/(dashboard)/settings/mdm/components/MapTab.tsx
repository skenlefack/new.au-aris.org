'use client';

import React from 'react';
import { MapPin, Smartphone, Battery, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMdmDevices } from '@/lib/api/mdm-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import { batteryColor, heartbeatColor, timeAgo } from './mdm-helpers';

export function MapTab() {
  const t = useTranslations('mdm');
  const { data: devicesData } = useMdmDevices({ limit: 100 });
  const devices = ((devicesData as any)?.data ?? []).filter(
    (d: any) => d.lastLocation || d.lastGpsLat,
  );

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <MapPin className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">{t('noLocations') ?? 'No locations reported'}</p>
        <p className="text-sm mt-1">
          Devices will appear here once they report GPS coordinates
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <MapPin className="h-4 w-4" />
        <span>
          {devices.length} {t('devicesOnMap') ?? 'devices with location'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {devices.map((d: any) => {
          const loc = d.lastLocation ?? {
            latitude: d.lastGpsLat,
            longitude: d.lastGpsLng,
          };
          return (
            <div
              key={d.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3"
            >
              {/* Device header */}
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-gray-400" />
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {d.deviceName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {d.userName || d.userEmail}
                  </p>
                </div>
              </div>

              {/* Location + heartbeat */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)}
                </span>
                <span
                  className={cn(
                    'flex items-center gap-1',
                    heartbeatColor(d.lastHeartbeatAt),
                  )}
                >
                  <Wifi className="h-3.5 w-3.5" />
                  {timeAgo(d.lastHeartbeatAt)}
                </span>
              </div>

              {/* Battery bar */}
              {d.batteryLevel != null && (
                <div className="flex items-center gap-2">
                  <Battery className="h-3.5 w-3.5 text-gray-400" />
                  <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', batteryColor(d.batteryLevel))}
                      style={{ width: `${d.batteryLevel}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{d.batteryLevel}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
