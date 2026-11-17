/**
 * Duplicate detection rules for form submissions (pure functions, no I/O).
 *
 * A form opts in through `schema.settings.duplicateDetection`:
 *   { enabled: true, action: 'warn' | 'block', fields: ['admin_location', 'goats_count', ...],
 *     tolerances?: { goats_count: 2 }, sameCollectorOnly?: false, gpsField?: 'geo_location', gpsMeters?: 100 }
 *
 * Older templates carry `{ enabled, fields }` without `action`; they stay inactive so that
 * publishing this feature changes nothing for forms nobody configured.
 */

export type DuplicateAction = 'warn' | 'block';
export type MatchKind = 'admin' | 'number' | 'date' | 'set' | 'text' | 'exact';

export interface DuplicateRuleField {
  code: string;
  kind: MatchKind;
  /** number: absolute difference allowed; date: days allowed. */
  tolerance: number;
}

export interface DuplicateRule {
  action: DuplicateAction;
  fields: DuplicateRuleField[];
  sameCollectorOnly: boolean;
  gpsField: string | null;
  gpsMeters: number | null;
}

export interface CandidateRow {
  id: string;
  data: Record<string, unknown>;
  submittedBy: string;
  submittedAt: Date | string;
}

const ADMIN_TYPES = new Set(['admin-location', 'admin_location', 'geo-admin']);
const NUMBER_TYPES = new Set(['number', 'integer', 'decimal', 'calculated']);
const DATE_TYPES = new Set(['date', 'datetime']);
const SET_TYPES = new Set(['multi-select', 'multiselect', 'checkbox', 'checkboxes']);
const TEXT_TYPES = new Set(['text', 'textarea', 'email', 'phone']);

/** Field code → type for every field of a template schema, including repeater sub-fields. */
export function fieldTypes(schema: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const sections = (schema as any)?.sections;
  if (!Array.isArray(sections)) return out;
  for (const s of sections) {
    for (const f of Array.isArray(s?.fields) ? s.fields : []) {
      const code = f?.code || f?.id;
      if (code && typeof f?.type === 'string') out[code] = f.type;
    }
  }
  return out;
}

function kindOf(type: string | undefined): MatchKind {
  if (!type) return 'exact';
  if (ADMIN_TYPES.has(type)) return 'admin';
  if (NUMBER_TYPES.has(type)) return 'number';
  if (DATE_TYPES.has(type)) return 'date';
  if (SET_TYPES.has(type)) return 'set';
  if (TEXT_TYPES.has(type)) return 'text';
  return 'exact';
}

/** Returns the active rule of a template, or null when duplicate detection is off. */
export function parseRule(schema: unknown): DuplicateRule | null {
  const cfg = (schema as any)?.settings?.duplicateDetection;
  if (!cfg || typeof cfg !== 'object' || cfg.enabled !== true) return null;
  if (cfg.action !== 'warn' && cfg.action !== 'block') return null;
  const codes: string[] = Array.isArray(cfg.fields) ? cfg.fields.filter((c: unknown) => typeof c === 'string' && c) : [];
  if (codes.length === 0) return null;
  const types = fieldTypes(schema);
  const tol = (cfg.tolerances && typeof cfg.tolerances === 'object') ? cfg.tolerances : {};
  const gpsMeters = Number(cfg.gpsMeters);
  return {
    action: cfg.action,
    fields: codes.map((code) => ({
      code,
      kind: kindOf(types[code]),
      tolerance: Math.max(0, Number(tol[code]) || 0),
    })),
    sameCollectorOnly: cfg.sameCollectorOnly === true,
    gpsField: typeof cfg.gpsField === 'string' && cfg.gpsField && gpsMeters > 0 ? cfg.gpsField : null,
    gpsMeters: gpsMeters > 0 ? gpsMeters : null,
  };
}

/* ── Normalisation ── */

/** Deepest filled level of an admin-location value, e.g. the village id. */
export function adminLeaf(v: unknown): { level: string; id: string } | null {
  if (typeof v === 'string' && v) return { level: '', id: v };
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  for (let i = 9; i >= 0; i--) {
    const val = o[`level_${i}`];
    if (typeof val === 'string' && val) return { level: `level_${i}`, id: val };
  }
  return null;
}

function normText(v: unknown): string {
  return String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function toDay(v: unknown): number | null {
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v.length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isFinite(t) ? Math.floor(t / 86_400_000) : null;
}

function toSet(v: unknown): string {
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => String(x)).sort().join('|');
}

/** Whether two values of one rule field count as the same. Two empty values match; one empty does not. */
export function valuesMatch(f: DuplicateRuleField, a: unknown, b: unknown): boolean {
  const ea = isEmpty(a), eb = isEmpty(b);
  if (ea || eb) return ea && eb;
  switch (f.kind) {
    case 'admin': return adminLeaf(a)?.id === adminLeaf(b)?.id;
    case 'number': {
      const x = toNumber(a), y = toNumber(b);
      return x !== null && y !== null ? Math.abs(x - y) <= f.tolerance : normText(a) === normText(b);
    }
    case 'date': {
      const x = toDay(a), y = toDay(b);
      return x !== null && y !== null ? Math.abs(x - y) <= f.tolerance : normText(a) === normText(b);
    }
    case 'set': return toSet(a) === toSet(b);
    case 'text': return normText(a) === normText(b);
    default: return JSON.stringify(a) === JSON.stringify(b);
  }
}

function gpsOf(v: unknown): { lat: number; lng: number } | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const lat = toNumber(o.lat ?? o.latitude), lng = toNumber(o.lng ?? o.longitude ?? o.lon);
  return lat !== null && lng !== null && !(lat === 0 && lng === 0) ? { lat, lng } : null;
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** True when `b` is a probable duplicate of `a` under the rule. */
export function isProbableDuplicate(rule: DuplicateRule, a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  for (const f of rule.fields) {
    if (!valuesMatch(f, a[f.code], b[f.code])) return false;
  }
  if (rule.gpsField && rule.gpsMeters) {
    const ga = gpsOf(a[rule.gpsField]), gb = gpsOf(b[rule.gpsField]);
    // Missing GPS on either side: the other fields decide.
    if (ga && gb && distanceMeters(ga, gb) > rule.gpsMeters) return false;
  }
  return true;
}

/** Candidates matching `data`, most recent first. */
export function matchCandidates(
  rule: DuplicateRule,
  data: Record<string, unknown>,
  rows: CandidateRow[],
  opts: { excludeId?: string; submittedBy?: string } = {},
): CandidateRow[] {
  return rows
    .filter((r) => r.id !== opts.excludeId)
    .filter((r) => !rule.sameCollectorOnly || !opts.submittedBy || r.submittedBy === opts.submittedBy)
    .filter((r) => isProbableDuplicate(rule, data, r.data ?? {}))
    .sort((x, y) => new Date(y.submittedAt).getTime() - new Date(x.submittedAt).getTime());
}

/** Content key used for exact duplicates: same answers, key order ignored. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stableJson((v as any)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/**
 * Groups rows into clusters of probable duplicates (union-find), for the campaign review screen.
 * Rows are first bucketed on fields that must match exactly, then compared pairwise in each bucket.
 */
export function clusterDuplicates(rule: DuplicateRule, rows: CandidateRow[]): string[][] {
  const parent = new Map<string, string>(rows.map((r) => [r.id, r.id]));
  const find = (x: string): string => {
    let p = parent.get(x)!;
    while (p !== parent.get(p)) p = parent.get(p)!;
    parent.set(x, p);
    return p;
  };
  const strict = rule.fields.filter((f) => f.kind === 'admin' || f.kind === 'set' || f.kind === 'text' || f.kind === 'exact' || f.tolerance === 0);
  const bucketKey = (d: Record<string, unknown>) => strict.map((f) => {
    const v = d[f.code];
    if (isEmpty(v)) return '';
    if (f.kind === 'admin') return adminLeaf(v)?.id ?? '';
    if (f.kind === 'set') return toSet(v);
    if (f.kind === 'number') return String(toNumber(v) ?? normText(v));
    if (f.kind === 'date') return String(toDay(v) ?? normText(v));
    return f.kind === 'text' ? normText(v) : JSON.stringify(v);
  }).join('\u0001');
  const buckets = new Map<string, CandidateRow[]>();
  for (const r of rows) {
    const k = bucketKey(r.data ?? {}) + (rule.sameCollectorOnly ? `\u0002${r.submittedBy}` : '');
    const list = buckets.get(k);
    if (list) list.push(r); else buckets.set(k, [r]);
  }
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (isProbableDuplicate(rule, list[i].data ?? {}, list[j].data ?? {})) {
          const a = find(list[i].id), b = find(list[j].id);
          if (a !== b) parent.set(a, b);
        }
      }
    }
  }
  const groups = new Map<string, string[]>();
  for (const r of rows) {
    const root = find(r.id);
    const g = groups.get(root);
    if (g) g.push(r.id); else groups.set(root, [r.id]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
