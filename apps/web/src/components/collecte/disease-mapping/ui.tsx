'use client';

/**
 * Small, dependency-free visual building blocks for the Disease Mapping dashboard.
 * Colours follow the ARIS data-viz palette: fixed categorical order, a single-hue
 * sequential ramp for magnitude, and reserved status colours (always with a label).
 */
import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';

/* ── Palette ── */

const LIGHT = {
  series: ['#2a78d6', '#eb6834', '#1baf7a'],
  other: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
  ramp: ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'],
};
const DARK = {
  series: ['#3987e5', '#d95926', '#199e70'],
  other: '#898781',
  grid: '#2c2c2a',
  axis: '#383835',
  muted: '#898781',
  ramp: LIGHT.ramp,
};
export const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' } as const;
export const RISK_COLORS = { low: STATUS.good, moderate: STATUS.warning, high: STATUS.serious, veryHigh: STATUS.critical } as const;

export type VizPalette = typeof LIGHT;

/** Follows the app's `dark` class on <html>. */
export function useVizPalette(): VizPalette & { dark: boolean } {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains('dark'));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return { ...(dark ? DARK : LIGHT), dark };
}

/** Sequential ramp step for a 0..1 share; light steps keep dark text readable. */
export function rampColor(p: VizPalette, t: number): { bg: string; fg: string } {
  const clamped = Math.max(0, Math.min(1, t));
  const i = Math.round(clamped * (p.ramp.length - 1));
  return { bg: p.ramp[i], fg: i >= 7 ? '#ffffff' : '#0b0b0b' };
}

/* ── Formatting ── */

let numberLocale = 'en';
/** Called by the dashboard so numbers follow the user's language (43,252 vs 43 252). */
export function setNumberLocale(locale: string) { numberLocale = locale; }
export const fmtInt = (n: number) => Math.round(n).toLocaleString(numberLocale);
export const fmtPct = (n: number, digits = 0) =>
  `${n.toLocaleString(numberLocale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

/* ── Card ── */

export function Card({
  title, subtitle, info, actions, children, className = '', bodyClassName = 'p-4',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  info?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-xl border border-gray-200 bg-white text-gray-800 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
            {info && (
              <span className="group relative inline-flex">
                <Info className="h-3.5 w-3.5 cursor-help text-gray-400" aria-label={info} />
                <span role="tooltip" className="pointer-events-none absolute left-1/2 top-5 z-30 hidden w-72 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg group-hover:block dark:bg-gray-100 dark:text-gray-900">
                  {info}
                </span>
              </span>
            )}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className={`min-w-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* ── KPI tile ── */

export function Kpi({
  label, value, sub, icon: Icon, tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: 'neutral' | 'good' | 'warning' | 'critical';
}) {
  const toneDot = tone === 'neutral' ? null : tone === 'good' ? STATUS.good : tone === 'warning' ? STATUS.warning : STATUS.critical;
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-1.5 text-[11px] font-medium uppercase leading-tight tracking-wide text-gray-500 dark:text-gray-400">
        {Icon && <Icon className="mt-px h-3.5 w-3.5 shrink-0" />}
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{value}</span>
        {toneDot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: toneDot }} aria-hidden />}
      </div>
      {sub && <div className="text-xs leading-snug text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  );
}

/* ── Horizontal bar list ── */

export interface BarItem {
  key: string;
  label: string;
  value: number;
  /** Text after the value, e.g. "(42%)" */
  note?: string;
  color?: string;
  tooltip?: string;
}

export function BarList({
  items, color, max, onSelect, selected, valueFormat = fmtInt, empty = '—', labelWidth = 'w-36',
}: {
  items: BarItem[];
  color: string;
  max?: number;
  onSelect?: (key: string) => void;
  selected?: string;
  valueFormat?: (n: number) => string;
  empty?: string;
  labelWidth?: string;
}) {
  if (items.length === 0) return <p className="py-6 text-center text-xs italic text-gray-400">{empty}</p>;
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-1.5">
      {items.map((it) => {
        const active = selected === it.key;
        const Row = onSelect ? 'button' : 'div';
        return (
          <li key={it.key}>
            <Row
              type={onSelect ? 'button' : undefined}
              onClick={onSelect ? () => onSelect(it.key) : undefined}
              title={it.tooltip ?? `${it.label}: ${valueFormat(it.value)}${it.note ? ` ${it.note}` : ''}`}
              className={`group flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left ${onSelect ? 'hover:bg-gray-50 dark:hover:bg-gray-800/60' : ''} ${active ? 'bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:ring-blue-900' : ''}`}
            >
              <span className={`${labelWidth} shrink-0 truncate text-xs text-gray-700 dark:text-gray-300`}>{it.label}</span>
              <span className="relative h-4 flex-1 overflow-hidden rounded-r bg-gray-100 dark:bg-gray-800">
                <span
                  className="absolute inset-y-0 left-0 rounded-r transition-[width] duration-300"
                  style={{ width: `${Math.max(0.5, (it.value / top) * 100)}%`, backgroundColor: it.color ?? color }}
                />
              </span>
              <span className="w-20 shrink-0 text-right text-xs tabular-nums text-gray-900 dark:text-gray-100">
                {valueFormat(it.value)}
                {it.note && <span className="ml-1 text-gray-500 dark:text-gray-400">{it.note}</span>}
              </span>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}

/* ── 100% stacked bar with legend (share of a whole) ── */

export function ShareBar({ parts, total }: { parts: { key: string; label: string; value: number; color: string }[]; total?: number }) {
  const sum = total ?? parts.reduce((s, p) => s + p.value, 0);
  if (sum === 0) return <p className="text-xs italic text-gray-400">—</p>;
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded">
        {parts.filter((p) => p.value > 0).map((p) => (
          <span
            key={p.key}
            title={`${p.label}: ${fmtInt(p.value)} (${fmtPct((p.value / sum) * 100)})`}
            style={{ width: `${(p.value / sum) * 100}%`, backgroundColor: p.color }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} aria-hidden />
            {p.label}
            <span className="tabular-nums text-gray-900 dark:text-gray-100">{fmtPct((p.value / sum) * 100)}</span>
            <span className="tabular-nums text-gray-400">({fmtInt(p.value)})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Segmented control ── */

export function Segmented<T extends string>({ value, options, onChange, size = 'sm' }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'xs';
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md ${size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} font-medium transition-colors ${
            value === o.value
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-50'
              : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select({ value, onChange, options, label, className = '' }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-0 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-blue-900"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/* ── Risk level badge (status colour + text, never colour alone) ── */

export function RiskBadge({ level, label }: { level: keyof typeof RISK_COLORS; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK_COLORS[level] }} aria-hidden />
      {label}
    </span>
  );
}
