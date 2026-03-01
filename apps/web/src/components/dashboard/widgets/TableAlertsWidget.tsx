'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import { cn } from '@/lib/utils';
import type { AlertData } from '../demo-data';

interface TableAlertsWidgetProps {
  title: string;
  subtitle?: string;
  alerts: AlertData[];
  demo?: boolean;
}

const SEVERITY_CONFIG = {
  critical: { icon: AlertTriangle, bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500', border: 'border-red-200 dark:border-red-800' },
  warning: { icon: AlertCircle, bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', border: 'border-amber-200 dark:border-amber-800' },
  info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500', border: 'border-blue-200 dark:border-blue-800' },
};

export function TableAlertsWidget({ title, subtitle, alerts, demo }: TableAlertsWidgetProps) {
  return (
    <WidgetWrapper title={title} subtitle={subtitle} demo={demo} noPadding>
      <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-[400px] overflow-y-auto">
        {alerts.map((alert) => {
          const cfg = SEVERITY_CONFIG[alert.severity];
          const Icon = cfg.icon;
          return (
            <div key={alert.id} className={cn('flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30')}>
              <div className={cn('mt-0.5 flex-shrink-0 rounded-full p-1', cfg.bg)}>
                <Icon className={cn('h-3.5 w-3.5', cfg.text)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('inline-block h-2 w-2 rounded-full flex-shrink-0', cfg.dot)} />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{alert.disease}</span>
                  <span className="text-[10px] text-gray-400">—</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{alert.country}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">{alert.message}</p>
                <p className="mt-1 text-[10px] text-gray-400">{new Date(alert.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            </div>
          );
        })}
        {alerts.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-gray-400">No active alerts</div>
        )}
      </div>
    </WidgetWrapper>
  );
}
