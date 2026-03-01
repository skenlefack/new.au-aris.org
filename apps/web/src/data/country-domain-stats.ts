// ─── Public domain statistics per country ──────────────────────────────────
// Deterministic pseudo-random stats based on country population & code.
// These are illustrative figures for the landing page display.

import {
  Bug,
  Syringe,
  Wheat,
  Fish,
  Leaf,
  Globe2,
  ShieldCheck,
  ClipboardCheck,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type TrendDir = 'up' | 'down' | 'stable';
export type StatusLevel = 'good' | 'warning' | 'alert';

export interface DomainHighlight {
  domain: string;
  icon: LucideIcon;
  color: string;
  value: string;
  subtitle: string;
  trend: TrendDir;
  trendValue: string;
}

export interface DomainGauge {
  domain: string;
  icon: LucideIcon;
  color: string;
  score: number;       // 0–100
  status: StatusLevel;
  statusLabel: string;
  detail: string;
}

// Simple hash to get a repeatable number from a country code
function hash(code: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < code.length; i++) {
    h = ((h << 5) - h + code.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pct(code: string, seed: number, min: number, max: number): number {
  return min + (hash(code, seed) % (max - min + 1));
}

function num(code: string, seed: number, base: number, pop: number): number {
  const factor = 0.6 + (hash(code, seed) % 80) / 100;
  return Math.max(1, Math.round(base * pop * factor));
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function trend(code: string, seed: number): { dir: TrendDir; val: string } {
  const h = hash(code, seed);
  const v = (h % 24) + 1;
  const dirs: TrendDir[] = ['up', 'up', 'up', 'down', 'stable'];
  return { dir: dirs[h % dirs.length], val: `${v}%` };
}

function status(score: number): { status: StatusLevel; statusLabel: string } {
  if (score >= 75) return { status: 'good', statusLabel: 'Good' };
  if (score >= 50) return { status: 'warning', statusLabel: 'Moderate' };
  return { status: 'alert', statusLabel: 'Needs attention' };
}

export function getHighlights(code: string, pop: number): DomainHighlight[] {
  const p = Math.max(pop, 0.5);
  const t1 = trend(code, 20);
  const t2 = trend(code, 21);
  const t3 = trend(code, 22);

  return [
    {
      domain: 'Active Outbreaks',
      icon: Bug,
      color: '#C62828',
      value: String(num(code, 1, 0.08, p)),
      subtitle: 'Under surveillance this quarter',
      trend: t1.dir,
      trendValue: t1.val,
    },
    {
      domain: 'Livestock Census',
      icon: Wheat,
      color: '#E65100',
      value: fmt(num(code, 3, 420, p)),
      subtitle: 'Heads registered nationally',
      trend: t2.dir,
      trendValue: t2.val,
    },
    {
      domain: 'Trade Volume',
      icon: Globe2,
      color: '#6A1B9A',
      value: `$${fmt(num(code, 6, 85, p))}`,
      subtitle: 'Live animal & product exports (annual)',
      trend: t3.dir,
      trendValue: t3.val,
    },
  ];
}

export function getGauges(code: string, pop: number): DomainGauge[] {
  const p = Math.max(pop, 0.5);

  const vacc = pct(code, 10, 38, 92);
  const fish = pct(code, 11, 30, 88);
  const wild = pct(code, 12, 40, 95);
  const gov  = pct(code, 13, 45, 96);
  const qual = pct(code, 14, 55, 98);
  const ana  = pct(code, 15, 42, 90);

  return [
    {
      domain: 'Vaccination Coverage',
      icon: Syringe,
      color: '#1565C0',
      score: vacc,
      ...status(vacc),
      detail: `${fmt(num(code, 30, 180, p))} doses administered`,
    },
    {
      domain: 'Fisheries & Aquaculture',
      icon: Fish,
      color: '#00838F',
      score: fish,
      ...status(fish),
      detail: `${fmt(num(code, 31, 12, p))} T annual catch`,
    },
    {
      domain: 'Wildlife Conservation',
      icon: Leaf,
      color: '#2E7D32',
      score: wild,
      ...status(wild),
      detail: `${num(code, 32, 0.15, p)} protected areas`,
    },
    {
      domain: 'Veterinary Governance',
      icon: ShieldCheck,
      color: '#37474F',
      score: gov,
      ...status(gov),
      detail: `PVS evaluation — ${pct(code, 33, 2, 5)} critical competencies`,
    },
    {
      domain: 'Data Quality',
      icon: ClipboardCheck,
      color: '#F57F17',
      score: qual,
      ...status(qual),
      detail: `${pct(code, 34, 5, 8)}/8 quality gates passing`,
    },
    {
      domain: 'Analytics Readiness',
      icon: TrendingUp,
      color: '#1B5E20',
      score: ana,
      ...status(ana),
      detail: `${num(code, 35, 0.3, p)} KPI reports published`,
    },
  ];
}
