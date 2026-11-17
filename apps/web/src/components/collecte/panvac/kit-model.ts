/**
 * PANVAC kit requests — display helpers and dashboard aggregation (pure, no React).
 * Per-request metrics (stage, delays, gaps) come from the server; this file only filters and sums.
 */
import { COUNTRIES } from '@/data/countries-config';
import { RECS } from '@/data/recs-config';
import type { KitRequest, KitShipment, KitStage } from '@/lib/api/workflow-hooks';

export const STAGES: KitStage[] = [
  'PENDING_DECISION', 'AWAITING_SHIPMENT', 'PARTIALLY_SHIPPED', 'IN_TRANSIT', 'RECEIVED', 'REJECTED', 'CANCELLED', 'HISTORICAL',
];

/** Stage colour: blue = in progress at PANVAC, amber = waiting for the country, green = done, red = refused, grey = closed/history. */
export const STAGE_COLOR: Record<KitStage, string> = {
  PENDING_DECISION: '#2a78d6',
  AWAITING_SHIPMENT: '#6da7ec',
  PARTIALLY_SHIPPED: '#eb6834',
  IN_TRANSIT: '#fab219',
  RECEIVED: '#0ca30c',
  REJECTED: '#d03b3b',
  CANCELLED: '#a8a7a0',
  HISTORICAL: '#898781',
};

export const PRODUCTS = ['hppr_belisa', 'ppr_vaccine', 'other'] as const;

export function countryName(code: string, locale: string): string {
  const c = COUNTRIES[code];
  if (!c) return code;
  return locale === 'fr' ? c.nameFr : locale === 'pt' ? c.namePt : c.name;
}

export function recName(code: string, locale: string): string {
  const r = RECS[code];
  if (!r) return code.toUpperCase();
  return locale === 'fr' ? r.nameFr : locale === 'pt' ? r.namePt : r.name;
}

export function recsOf(countryCode: string): string[] {
  return COUNTRIES[countryCode]?.recs ?? [];
}

export function fmtDate(d: string | null | undefined, locale: string): string {
  if (!d) return '—';
  const t = new Date(d.length === 10 ? `${d}T00:00:00Z` : d);
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function median(list: number[]): number | null {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* ── Filters ── */

export interface KitFilters {
  year: string;     // '' = all
  rec: string;
  country: string;
  product: string;
  history: 'include' | 'exclude';
}
export const NO_KIT_FILTERS: KitFilters = { year: '', rec: '', country: '', product: '', history: 'include' };

export function matchCountry(code: string, f: KitFilters): boolean {
  if (f.country && code !== f.country) return false;
  if (f.rec && !recsOf(code).includes(f.rec)) return false;
  return true;
}

export function filterRequests(list: KitRequest[], f: KitFilters): KitRequest[] {
  return list.filter((r) =>
    matchCountry(r.countryCode, f)
    && (!f.year || r.requestedAt.slice(0, 4) === f.year)
    && (!f.product || (r.product ?? 'hppr_belisa') === f.product)
    && (f.history === 'include' || !r.isHistorical));
}

/** Shipments of the filtered requests plus history shipments with no request (country/year filters only). */
export function filterShipments(requests: KitRequest[], orphans: KitShipment[], f: KitFilters): KitShipment[] {
  const out = requests.flatMap((r) => r.shipments);
  if (f.history === 'include' && (!f.product || f.product === 'hppr_belisa')) {
    out.push(...orphans.filter((s) => matchCountry(s.countryCode, f) && (!f.year || s.shippedAt.slice(0, 4) === f.year)));
  }
  return out;
}

/* ── Indicators ── */

export interface KitIndicators {
  requests: number;
  countries: number;
  qtyRequested: number;
  qtyApproved: number;          // current-system decisions only
  qtyShipped: number;           // all shipments in scope (incl. history)
  qtyReceived: number;          // confirmed receptions (current system)
  fulfilmentPct: number | null; // shipped / requested
  approvalPct: number | null;   // approved / requested, decided requests only
  pending: number;              // waiting for a PANVAC decision
  pendingOverdue: number;       // ... for more than the SLA
  decided: number;
  medianDecisionDays: number | null;
  slaPct: number | null;        // decisions taken within the SLA
  medianShipmentDays: number | null;
  medianDeliveryDays: number | null;
  medianTotalDays: number | null;
  onTimePct: number | null;     // first shipment within the announced availability period
  receptionPct: number | null;  // current-system shipments confirmed by the country
  awaitingShipment: number;
  inTransit: number;
  rejected: number;
  mixedUnits: boolean;          // kits and vaccine doses are summed together
}

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);

export function indicators(reqs: KitRequest[], ships: KitShipment[], slaDays: number): KitIndicators {
  const live = reqs.filter((r) => r.status !== 'CANCELLED');
  const current = live.filter((r) => !r.isHistorical);
  const decided = current.filter((r) => r.decidedAt && r.status !== 'SUBMITTED');
  const approved = decided.filter((r) => r.status === 'APPROVED' || r.status === 'PARTIAL');
  const pending = current.filter((r) => r.status === 'SUBMITTED');
  const currentShips = ships.filter((s) => !s.isHistorical);
  const qtyRequested = live.reduce((s, r) => s + (r.quantityRequested ?? 0), 0);
  const qtyShipped = ships.reduce((s, x) => s + x.quantity, 0);
  const requestedDecided = decided.reduce((s, r) => s + (r.quantityRequested ?? 0), 0);
  const qtyApproved = approved.reduce((s, r) => s + (r.quantityApproved ?? 0), 0);
  const nums = (f: (r: KitRequest) => number | null, list = current) => list.map(f).filter((n): n is number => n !== null);
  const withPeriod = current.filter((r) => r.metrics.shippedOnTime !== null);
  const products = new Set(live.map((r) => r.product ?? 'hppr_belisa'));
  return {
    requests: live.length,
    countries: new Set(live.map((r) => r.countryCode)).size,
    qtyRequested,
    qtyApproved,
    qtyShipped,
    qtyReceived: currentShips.reduce((s, x) => s + (x.receivedAt ? (x.quantityReceived ?? x.quantity) : 0), 0),
    fulfilmentPct: pct(qtyShipped, qtyRequested),
    approvalPct: pct(qtyApproved, requestedDecided),
    pending: pending.length,
    pendingOverdue: pending.filter((r) => (r.metrics.waitingDays ?? 0) > slaDays).length,
    decided: decided.length,
    medianDecisionDays: median(nums((r) => r.metrics.decisionDays, decided)),
    slaPct: pct(decided.filter((r) => r.metrics.decisionWithinSla === true).length, decided.length),
    medianShipmentDays: median(nums((r) => r.metrics.shipmentDays, approved)),
    medianDeliveryDays: median(nums((r) => r.metrics.deliveryDays)),
    medianTotalDays: median(nums((r) => r.metrics.totalDays)),
    onTimePct: pct(withPeriod.filter((r) => r.metrics.shippedOnTime).length, withPeriod.length),
    receptionPct: pct(currentShips.filter((s) => s.receivedAt).length, currentShips.length),
    awaitingShipment: current.filter((r) => r.metrics.stage === 'AWAITING_SHIPMENT' || r.metrics.stage === 'PARTIALLY_SHIPPED').length,
    inTransit: current.filter((r) => r.metrics.stage === 'IN_TRANSIT').length,
    rejected: decided.filter((r) => r.status === 'REJECTED').length,
    mixedUnits: products.size > 1,
  };
}

/* ── By country / REC ── */

export interface CountryRow {
  code: string;
  requests: number;
  requested: number;
  approved: number;
  shipped: number;
  received: number;
  gap: number;                // requested - shipped
  fulfilmentPct: number | null;
  pending: number;
  medianDecisionDays: number | null;
  lastRequest: string | null;
}

export function byCountry(reqs: KitRequest[], ships: KitShipment[]): CountryRow[] {
  const map = new Map<string, CountryRow & { _dec: number[] }>();
  const row = (code: string) => {
    let r = map.get(code);
    if (!r) {
      r = { code, requests: 0, requested: 0, approved: 0, shipped: 0, received: 0, gap: 0, fulfilmentPct: null, pending: 0, medianDecisionDays: null, lastRequest: null, _dec: [] };
      map.set(code, r);
    }
    return r;
  };
  for (const q of reqs) {
    if (q.status === 'CANCELLED') continue;
    const r = row(q.countryCode);
    r.requests += 1;
    r.requested += q.quantityRequested ?? 0;
    if (q.status === 'APPROVED' || q.status === 'PARTIAL') r.approved += q.isHistorical ? 0 : (q.quantityApproved ?? 0);
    if (q.status === 'SUBMITTED') r.pending += 1;
    if (q.metrics.decisionDays !== null && q.status !== 'SUBMITTED') r._dec.push(q.metrics.decisionDays);
    if (!r.lastRequest || q.requestedAt > r.lastRequest) r.lastRequest = q.requestedAt;
  }
  for (const s of ships) {
    const r = row(s.countryCode);
    r.shipped += s.quantity;
    if (s.receivedAt) r.received += s.quantityReceived ?? s.quantity;
  }
  return [...map.values()].map(({ _dec, ...r }) => ({
    ...r,
    gap: Math.max(0, r.requested - r.shipped),
    fulfilmentPct: pct(r.shipped, r.requested),
    medianDecisionDays: median(_dec),
  }));
}

export function byRec(rows: CountryRow[]): { rec: string; requested: number; shipped: number; countries: number }[] {
  const out = new Map<string, { rec: string; requested: number; shipped: number; countries: number }>();
  for (const r of rows) {
    for (const rec of recsOf(r.code)) {
      const o = out.get(rec) ?? { rec, requested: 0, shipped: 0, countries: 0 };
      o.requested += r.requested;
      o.shipped += r.shipped;
      o.countries += 1;
      out.set(rec, o);
    }
  }
  return [...out.values()].sort((a, b) => b.requested - a.requested);
}

/* ── Time series ── */

export function monthlyFlow(reqs: KitRequest[], ships: KitShipment[]): { month: string; requested: number; approved: number; shipped: number }[] {
  const map = new Map<string, { month: string; requested: number; approved: number; shipped: number }>();
  const row = (m: string) => {
    let r = map.get(m);
    if (!r) { r = { month: m, requested: 0, approved: 0, shipped: 0 }; map.set(m, r); }
    return r;
  };
  for (const q of reqs) {
    if (q.status === 'CANCELLED') continue;
    row(q.requestedAt.slice(0, 7)).requested += q.quantityRequested ?? 0;
    if (!q.isHistorical && q.decidedAt && (q.status === 'APPROVED' || q.status === 'PARTIAL')) row(q.decidedAt.slice(0, 7)).approved += q.quantityApproved ?? 0;
  }
  for (const s of ships) row(s.shippedAt.slice(0, 7)).shipped += s.quantity;
  // Fill missing months so the time axis is continuous
  const keys = [...map.keys()].sort();
  if (keys.length > 1) {
    const [y0, m0] = keys[0].split('-').map(Number);
    const [y1, m1] = keys[keys.length - 1].split('-').map(Number);
    for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? (y++, m = 1) : m++) row(`${y}-${String(m).padStart(2, '0')}`);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export const DELAY_BUCKETS = [
  { key: '0-7', max: 7 }, { key: '8-15', max: 15 }, { key: '16-30', max: 30 }, { key: '31-60', max: 60 }, { key: '>60', max: Infinity },
];

export function decisionBuckets(reqs: KitRequest[]): { key: string; decided: number; pending: number }[] {
  const out = DELAY_BUCKETS.map((b) => ({ key: b.key, decided: 0, pending: 0 }));
  for (const r of reqs) {
    if (r.isHistorical || r.status === 'CANCELLED') continue;
    const d = r.metrics.decisionDays;
    if (d === null) continue;
    const i = DELAY_BUCKETS.findIndex((b) => d <= b.max);
    if (r.status === 'SUBMITTED') out[i].pending += 1; else out[i].decided += 1;
  }
  return out;
}

/** PANVAC performance per quarter of the request date: median decision delay and share within the SLA. */
export function quarterlyPerformance(reqs: KitRequest[]): { quarter: string; decided: number; medianDays: number | null; slaPct: number | null }[] {
  const map = new Map<string, number[]>();
  const sla = new Map<string, number>();
  for (const r of reqs) {
    if (r.isHistorical || r.status === 'SUBMITTED' || r.status === 'CANCELLED' || r.metrics.decisionDays === null) continue;
    const q = `${r.requestedAt.slice(0, 4)}-T${Math.ceil(Number(r.requestedAt.slice(5, 7)) / 3)}`;
    map.set(q, [...(map.get(q) ?? []), r.metrics.decisionDays]);
    if (r.metrics.decisionWithinSla) sla.set(q, (sla.get(q) ?? 0) + 1);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([quarter, days]) => ({
    quarter, decided: days.length, medianDays: median(days), slaPct: pct(sla.get(quarter) ?? 0, days.length),
  }));
}

/** Requests waiting on someone, oldest first. */
export function waitingList(reqs: KitRequest[]): KitRequest[] {
  return reqs
    .filter((r) => !r.isHistorical && ['PENDING_DECISION', 'AWAITING_SHIPMENT', 'PARTIALLY_SHIPPED', 'IN_TRANSIT'].includes(r.metrics.stage))
    .sort((a, b) => (b.metrics.waitingDays ?? 0) - (a.metrics.waitingDays ?? 0));
}

export function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map((v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}

export function downloadCsv(name: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
