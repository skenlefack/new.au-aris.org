'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Globe, FileBarChart, AlertTriangle, ClipboardCheck,
  Syringe, MapPin, BarChart3, Activity,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  globe: Globe, 'file-bar-chart': FileBarChart, 'alert-triangle': AlertTriangle,
  'clipboard-check': ClipboardCheck, syringe: Syringe, 'map-pin': MapPin,
  'bar-chart': BarChart3, activity: Activity,
};

function useAnimatedCounter(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);
  useEffect(() => {
    if (target === prevTarget.current) return;
    prevTarget.current = target;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

interface KpiStripItem {
  label: string;
  value: number;
  icon?: string;
  color?: string;
}

interface KpiStripWidgetProps {
  items?: KpiStripItem[];
  config?: Record<string, unknown>;
}

function KpiItem({ item, index }: { item: KpiStripItem; index: number }) {
  const animated = useAnimatedCounter(item.value);
  const Icon = ICON_MAP[item.icon || 'activity'] || Activity;
  const color = item.color || '#3b82f6';

  return (
    <div
      className="flex flex-col items-center justify-center px-3 py-2 min-w-0"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color }} />
        <span className="text-lg font-bold text-white tabular-nums">{fmt(animated)}</span>
      </div>
      <span className="text-[9px] text-white/70 uppercase tracking-wide truncate max-w-full text-center leading-tight">
        {item.label}
      </span>
    </div>
  );
}

export function KpiStripWidget({ items, config }: KpiStripWidgetProps) {
  const gradientFrom = (config?.gradientFrom as string) || '#064e3b';
  const gradientTo = (config?.gradientTo as string) || '#047857';

  if (!items?.length) {
    return (
      <div className="flex h-full items-center justify-center p-2">
        <p className="text-sm text-gray-400">Configure KPI items</p>
      </div>
    );
  }

  return (
    <div
      className="flex items-stretch divide-x divide-white/20 rounded-lg overflow-hidden w-full h-full"
      style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
    >
      {items.map((item, i) => (
        <div key={i} className="flex-1 min-w-0">
          <KpiItem item={item} index={i} />
        </div>
      ))}
    </div>
  );
}
