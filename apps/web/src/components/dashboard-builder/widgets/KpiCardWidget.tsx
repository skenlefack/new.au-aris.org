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
import { useAnimatedCounter } from './useAnimatedCounter';

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
  /** Multilingual labels: { fr, en, ar, pt } — takes priority over label */
  labels?: Record<string, string>;
  trend?: number;
  thresholds?: { green?: number; yellow?: number };
  prefix?: string;
  suffix?: string;
  icon?: string;
  color?: string;
}

function resolveLabel(label: string, labels?: Record<string, string>): string {
  if (!labels) return label;
  try {
    const raw = typeof window !== 'undefined' && localStorage.getItem('aris-locale');
    if (raw) {
      const locale = JSON.parse(raw)?.state?.locale ?? 'fr';
      return labels[locale] || labels.fr || labels.en || label;
    }
  } catch { /* ignore */ }
  return labels.fr || labels.en || label;
}

export function KpiCardWidget({
  value,
  label,
  labels,
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
  const displayLabel = resolveLabel(label, labels);
  const animatedValue = useAnimatedCounter(typeof value === 'number' ? value : 0);

  return (
    <div
      className="relative flex h-full items-center gap-3 px-4 py-3 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${accentColor}08 0%, ${accentColor}03 100%)`,
      }}
    >
      {/* Accent stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full"
        style={{ backgroundColor: accentColor }}
      />

      {/* Icon circle */}
      {Icon && (
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm"
          style={{
            backgroundColor: `${accentColor}12`,
            border: `1px solid ${accentColor}20`,
          }}
        >
          <Icon className="h-5 w-5" style={{ color: accentColor }} />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col justify-center min-w-0">
        <span
          className="text-2xl font-extrabold leading-tight tracking-tight"
          style={{ color: accentColor }}
        >
          {prefix}
          {typeof value === 'number' ? animatedValue.toLocaleString() : value}
          {suffix}
        </span>
        <p className="truncate text-[11px] font-medium leading-snug text-gray-500 dark:text-gray-400 mt-0.5">
          {displayLabel}
        </p>
        {trend != null && (
          <span className={cn('flex items-center gap-0.5 text-[10px] font-semibold mt-0.5', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
