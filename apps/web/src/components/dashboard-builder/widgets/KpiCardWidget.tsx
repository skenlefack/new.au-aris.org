'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  Package,
  Truck,
  Layers,
  Send,
  FlaskConical,
  Microscope,
  FileCheck,
  Activity,
  BarChart3,
  Users,
  MapPin,
  Beaker,
  TestTubes,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, LucideIcon> = {
  globe: Globe,
  package: Package,
  truck: Truck,
  layers: Layers,
  send: Send,
  'flask-conical': FlaskConical,
  microscope: Microscope,
  'file-check': FileCheck,
  activity: Activity,
  'bar-chart': BarChart3,
  users: Users,
  'map-pin': MapPin,
  beaker: Beaker,
  'test-tubes': TestTubes,
};

interface KpiCardWidgetProps {
  value: string | number;
  label: string;
  trend?: number;
  thresholds?: { green?: number; yellow?: number };
  prefix?: string;
  suffix?: string;
  icon?: string;
  color?: string;
}

export function KpiCardWidget({
  value,
  label,
  trend,
  thresholds,
  prefix,
  suffix,
  icon,
  color,
}: KpiCardWidgetProps) {
  // Determine accent color
  let accentColor = color || '#1F4E79';
  if (thresholds && typeof value === 'number') {
    if (thresholds.green != null && value >= thresholds.green) {
      accentColor = '#16a34a';
    } else if (thresholds.yellow != null && value >= thresholds.yellow) {
      accentColor = '#ca8a04';
    } else {
      accentColor = '#dc2626';
    }
  }

  const TrendIcon =
    trend != null && trend > 0
      ? TrendingUp
      : trend != null && trend < 0
        ? TrendingDown
        : Minus;

  const trendColor =
    trend != null && trend > 0
      ? 'text-green-600'
      : trend != null && trend < 0
        ? 'text-red-600'
        : 'text-gray-400';

  const Icon = icon ? ICON_MAP[icon] : null;

  return (
    <div className="flex h-full items-center gap-4 p-4">
      {/* Icon circle */}
      {Icon && (
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accentColor}15` }}
        >
          <Icon className="h-6 w-6" style={{ color: accentColor }} />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col justify-center min-w-0">
        <span
          className="text-3xl font-bold leading-tight tracking-tight"
          style={{ color: accentColor }}
        >
          {prefix}
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix}
        </span>
        <p className="mt-0.5 truncate text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </p>
        {trend != null && (
          <span className={cn('mt-1 flex items-center gap-0.5 text-xs font-medium', trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
