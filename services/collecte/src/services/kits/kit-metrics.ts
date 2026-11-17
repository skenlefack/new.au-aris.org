/**
 * PANVAC kit requests — pure derivations (no I/O).
 * A request goes: country request -> PANVAC decision -> one or more shipments -> reception by the country.
 * Everything shown in the tracking table and the dashboard (stage, delays, gaps) is computed here.
 */

export const DECISION_SLA_DAYS = 15;

export type DecisionStatus = 'SUBMITTED' | 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'CANCELLED';

/** Where the request is in its life, derived from the decision and the shipments. */
export type KitStage =
  | 'PENDING_DECISION'   // waiting for PANVAC
  | 'AWAITING_SHIPMENT'  // approved, nothing shipped yet
  | 'PARTIALLY_SHIPPED'  // approved, shipped less than approved
  | 'IN_TRANSIT'         // everything shipped, at least one shipment not confirmed
  | 'RECEIVED'           // everything shipped and confirmed
  | 'REJECTED'
  | 'CANCELLED'
  | 'HISTORICAL';        // imported 2025-2026 history (no decision recorded)

export interface KitShipmentRow {
  id: string;
  requestId: string | null;
  countryCode: string;
  shippedAt: string;            // YYYY-MM-DD
  quantity: number;
  kitFormat: string | null;
  numSamples: number | null;
  receivedAt: string | null;    // YYYY-MM-DD
  quantityReceived: number | null;
  condition: string | null;
  isHistorical: boolean;
}

export interface KitRequestRow {
  id: string;
  countryCode: string;
  status: DecisionStatus;
  quantityRequested: number | null;
  quantityApproved: number | null;
  requestedAt: string;          // ISO timestamp
  decidedAt: string | null;     // ISO timestamp
  availableFrom: string | null; // YYYY-MM-DD
  availableTo: string | null;   // YYYY-MM-DD
  desiredDate: string | null;   // YYYY-MM-DD
  isHistorical: boolean;
}

export interface KitRequestMetrics {
  stage: KitStage;
  quantityShipped: number;
  quantityReceived: number;
  shipmentsPending: number;          // shipped but not confirmed
  /** Days from request to decision (or to now while pending). */
  decisionDays: number | null;
  /** true/false once decided; while pending, false as soon as the 15 days are exceeded. */
  decisionWithinSla: boolean | null;
  /** Days the request has been waiting for its current step (pending decision or shipment). */
  waitingDays: number | null;
  /** Days from decision to the first shipment (history: from request to first shipment). */
  shipmentDays: number | null;
  /** Average days from shipment to confirmed reception. */
  deliveryDays: number | null;
  /** Days from request to the last confirmed reception, once fully received. */
  totalDays: number | null;
  /** First shipment within the availability period PANVAC announced (null when no period or not shipped). */
  shippedOnTime: boolean | null;
  /** Quantities still missing at each step. */
  gapRequestedApproved: number | null;
  gapApprovedShipped: number | null;
  gapShippedReceived: number;
}

const DAY = 86_400_000;

function toTime(v: string | null | undefined): number | null {
  if (!v) return null;
  const t = Date.parse(v.length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isFinite(t) ? t : null;
}

function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  const ta = toTime(a);
  const tb = toTime(b);
  if (ta === null || tb === null) return null;
  return Math.max(0, Math.round((tb - ta) / DAY));
}

function avg(list: number[]): number | null {
  return list.length ? list.reduce((s, n) => s + n, 0) / list.length : null;
}

export function deriveMetrics(req: KitRequestRow, shipments: KitShipmentRow[], now: Date = new Date()): KitRequestMetrics {
  const nowIso = now.toISOString();
  const ships = [...shipments].sort((a, b) => a.shippedAt.localeCompare(b.shippedAt));
  const quantityShipped = ships.reduce((s, x) => s + (x.quantity || 0), 0);
  const received = ships.filter((x) => x.receivedAt);
  const quantityReceived = received.reduce((s, x) => s + (x.quantityReceived ?? x.quantity ?? 0), 0);
  const shipmentsPending = ships.length - received.length;
  const approved = req.status === 'APPROVED' || req.status === 'PARTIAL';

  let stage: KitStage;
  if (req.isHistorical) stage = 'HISTORICAL';
  else if (req.status === 'REJECTED') stage = 'REJECTED';
  else if (req.status === 'CANCELLED') stage = 'CANCELLED';
  else if (req.status === 'SUBMITTED') stage = 'PENDING_DECISION';
  else {
    const target = req.quantityApproved ?? 0;
    if (quantityShipped === 0) stage = 'AWAITING_SHIPMENT';
    else if (quantityShipped < target) stage = 'PARTIALLY_SHIPPED';
    else if (shipmentsPending > 0) stage = 'IN_TRANSIT';
    else stage = 'RECEIVED';
  }

  const decided = !req.isHistorical && req.decidedAt && req.status !== 'SUBMITTED' && req.status !== 'CANCELLED';
  const decisionDays = req.isHistorical ? null : daysBetween(req.requestedAt, decided ? req.decidedAt : nowIso);
  let decisionWithinSla: boolean | null = null;
  if (!req.isHistorical && decisionDays !== null) {
    if (decided) decisionWithinSla = decisionDays <= DECISION_SLA_DAYS;
    else if (req.status === 'SUBMITTED') decisionWithinSla = decisionDays <= DECISION_SLA_DAYS ? null : false;
  }

  let waitingDays: number | null = null;
  if (stage === 'PENDING_DECISION') waitingDays = daysBetween(req.requestedAt, nowIso);
  else if (stage === 'AWAITING_SHIPMENT' || stage === 'PARTIALLY_SHIPPED') {
    waitingDays = daysBetween(ships.length ? ships[ships.length - 1].shippedAt : req.decidedAt, nowIso);
  } else if (stage === 'IN_TRANSIT') {
    const firstOpen = ships.find((x) => !x.receivedAt);
    waitingDays = daysBetween(firstOpen?.shippedAt, nowIso);
  }

  const first = ships[0];
  const shipmentDays = first ? daysBetween(req.isHistorical ? req.requestedAt : req.decidedAt, first.shippedAt) : null;
  const deliveryDays = avg(received.map((x) => daysBetween(x.shippedAt, x.receivedAt)).filter((d): d is number => d !== null));

  let totalDays: number | null = null;
  if (stage === 'RECEIVED' && received.length) {
    const last = received.map((x) => x.receivedAt as string).sort().pop() as string;
    totalDays = daysBetween(req.requestedAt, last);
  }

  let shippedOnTime: boolean | null = null;
  if (first && req.availableTo) shippedOnTime = first.shippedAt <= req.availableTo;

  const gapRequestedApproved = approved && req.quantityRequested !== null && req.quantityApproved !== null
    ? Math.max(0, req.quantityRequested - req.quantityApproved) : null;
  const gapApprovedShipped = approved && req.quantityApproved !== null
    ? Math.max(0, req.quantityApproved - quantityShipped) : null;

  return {
    stage, quantityShipped, quantityReceived, shipmentsPending,
    decisionDays, decisionWithinSla, waitingDays, shipmentDays, deliveryDays, totalDays, shippedOnTime,
    gapRequestedApproved, gapApprovedShipped, gapShippedReceived: Math.max(0, quantityShipped - quantityReceived),
  };
}

/**
 * Links history shipments to history requests of the same country: each shipment goes to the earliest
 * request made on or before it that still has quantity to cover, else the latest earlier request,
 * else it stays unlinked (shipped before any recorded request).
 */
export function linkHistory(
  requests: { key: string; countryCode: string; requestedAt: string; quantity: number | null }[],
  shipments: { key: string; countryCode: string; shippedAt: string; quantity: number }[],
): Map<string, string | null> {
  const out = new Map<string, string | null>();
  const covered = new Map<string, number>();
  const byCountry = new Map<string, typeof requests>();
  for (const r of requests) {
    const list = byCountry.get(r.countryCode) ?? [];
    list.push(r);
    byCountry.set(r.countryCode, list);
  }
  for (const list of byCountry.values()) list.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  for (const s of [...shipments].sort((a, b) => a.shippedAt.localeCompare(b.shippedAt))) {
    const before = (byCountry.get(s.countryCode) ?? []).filter((r) => r.requestedAt.slice(0, 10) <= s.shippedAt);
    if (!before.length) { out.set(s.key, null); continue; }
    const open = before.find((r) => r.quantity === null || (covered.get(r.key) ?? 0) < r.quantity);
    const target = open ?? before[before.length - 1];
    covered.set(target.key, (covered.get(target.key) ?? 0) + s.quantity);
    out.set(s.key, target.key);
  }
  return out;
}
