/**
 * Disease Mapping & Risk Profiling — data model.
 * Turns raw campaign submissions into one "herd" record each, then computes
 * indicators, an indicative risk score, cross-tabulations and relative risks.
 * Pure functions only, so the dashboard can recompute instantly on every filter.
 */
import type { CampaignDataset, CampaignDatasetRow } from '@/lib/api/workflow-hooks';

export type YesNo = boolean | null;

export const RISK_FACTORS = [
  'clinicalSigns',
  'mortality',
  'neighbourDisease',
  'notVaccinated',
  'movesOut',
  'sharedGrazing',
  'recentAdditions',
  'noBiosecurity',
  'noVetAccess',
] as const;
export type RiskFactor = (typeof RISK_FACTORS)[number];

/** Weights of the indicative risk score (sum = 100). */
export const RISK_WEIGHTS: Record<RiskFactor, number> = {
  clinicalSigns: 15,
  mortality: 10,
  neighbourDisease: 15,
  notVaccinated: 15,
  movesOut: 10,
  sharedGrazing: 10,
  recentAdditions: 10,
  noBiosecurity: 10,
  noVetAccess: 5,
};

/** Exposures tested against the clinical-sign outcome (the outcome itself is excluded). */
export const EXPOSURES: RiskFactor[] = ['neighbourDisease', 'notVaccinated', 'movesOut', 'sharedGrazing', 'recentAdditions', 'noBiosecurity', 'noVetAccess'];

export type RiskLevel = 'low' | 'moderate' | 'high' | 'veryHigh';
export const RISK_LEVELS: RiskLevel[] = ['low', 'moderate', 'high', 'veryHigh'];

export function riskLevelOf(score: number): RiskLevel {
  if (score >= 75) return 'veryHigh';
  if (score >= 50) return 'high';
  if (score >= 25) return 'moderate';
  return 'low';
}

export interface Herd {
  id: string;
  tenantId: string;
  country: string;
  agentId: string;
  agent: string;
  at: Date;
  day: string;
  status: string;
  l1: string;
  l2: string;
  l3: string;
  lat: number | null;
  lng: number | null;
  system: string;
  goats: number;
  sheep: number;
  animals: number;
  sizeClass: string;
  ages: string[];
  recentAdditions: YesNo;
  signs: string[];
  anySign: boolean;
  pprSuspect: boolean;
  firstCase: string | null;
  affected: number;
  died: number;
  lab: string;
  vaccinated: YesNo;
  vaccinationDate: string | null;
  monthsSinceVaccination: number | null;
  coverage: string;
  vetAccess: YesNo;
  moves: YesNo;
  moveReasons: string[];
  moveDirections: string[];
  marketAttendance: string[];
  sharedGrazing: YesNo;
  sharedWhat: string[];
  water: string[];
  neighbour: string;
  biosecurity: string[];
  factors: Record<RiskFactor, boolean>;
  risk: number;
  riskLevel: RiskLevel;
}

/* ── Value helpers ── */

const str = (v: unknown): string => (v == null ? '' : String(v).trim());
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : str(v) ? [str(v)] : []);
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
function yesNo(v: unknown): YesNo {
  const s = str(v).toLowerCase();
  if (s === 'yes' || s === 'true' || s === 'oui') return true;
  if (s === 'no' || s === 'false' || s === 'non') return false;
  return null;
}

export function sizeClassOf(n: number): string {
  if (n <= 0) return '0';
  if (n <= 10) return '1-10';
  if (n <= 50) return '11-50';
  if (n <= 100) return '51-100';
  return '>100';
}
export const SIZE_CLASSES = ['0', '1-10', '11-50', '51-100', '>100'];

/**
 * Suspected PPR case, after the FAO/WOAH field definition:
 * fever plus at least two of discharge, mouth lesions, diarrhoea, respiratory signs.
 */
export function isPprSuspect(signs: string[]): boolean {
  const s = new Set(signs);
  if (!s.has('fever')) return false;
  const others = [
    s.has('nasal_discharge') || s.has('ocular_discharge'),
    s.has('mouth_lesions'),
    s.has('diarrhea'),
    s.has('coughing'),
  ].filter(Boolean).length;
  return others >= 2;
}

function monthsBetween(from: string, to: Date): number | null {
  const d = new Date(from);
  if (Number.isNaN(d.getTime())) return null;
  const m = (to.getFullYear() - d.getFullYear()) * 12 + (to.getMonth() - d.getMonth());
  return m >= 0 ? m : null;
}

function coverageBelowHalf(c: string): boolean {
  return c === '<25%' || c === '25-50%';
}

export function toHerd(row: CampaignDatasetRow, ds: Pick<CampaignDataset, 'agents' | 'tenants'>): Herd {
  const d = row.data ?? {};
  const loc = (d['admin_location'] ?? {}) as Record<string, unknown>;
  const gps = d['geo_location'] as { lat?: unknown; lng?: unknown } | null | undefined;
  const lat = gps && typeof gps.lat === 'number' && gps.lat !== 0 ? gps.lat : null;
  const lng = gps && typeof gps.lng === 'number' && gps.lng !== 0 ? gps.lng : null;

  const goats = num(d['goats_count']);
  const sheep = num(d['sheep_count']);
  const signs = list(d['clinical_signs']).filter((s) => s !== 'none');
  const affected = num(d['animals_affected']);
  const died = num(d['animals_died']);
  const vaccinated = yesNo(d['vaccinated_ppr']);
  const coverage = str(d['vaccination_coverage']);
  const vaccinationDate = str(d['vaccination_date']) || null;
  const at = new Date(row.submittedAt);
  const movements = Array.isArray(d['animal_movements']) ? (d['animal_movements'] as Record<string, unknown>[]) : [];
  const biosecurity = list(d['biosecurity_measures']);
  const realBiosecurity = biosecurity.filter((b) => b !== 'none');

  const h: Omit<Herd, 'factors' | 'risk' | 'riskLevel'> = {
    id: row.id,
    tenantId: row.tenantId,
    country: str(loc['level_0']) || ds.tenants[row.tenantId]?.code || '',
    agentId: row.submittedBy,
    agent: ds.agents[row.submittedBy] ?? '—',
    at,
    day: row.submittedAt.slice(0, 10),
    status: row.status,
    l1: str(loc['level_1']),
    l2: str(loc['level_2']),
    l3: str(loc['level_3']),
    lat: lat != null && lng != null ? lat : null,
    lng: lat != null && lng != null ? lng : null,
    system: str(d['production_system']),
    goats,
    sheep,
    animals: goats + sheep,
    sizeClass: sizeClassOf(goats + sheep),
    ages: list(d['age_distribution']),
    recentAdditions: yesNo(d['recent_additions']),
    signs,
    anySign: signs.length > 0,
    pprSuspect: isPprSuspect(signs),
    firstCase: str(d['first_case_date']) || null,
    affected,
    died,
    lab: str(d['lab_confirmation']),
    vaccinated,
    vaccinationDate,
    monthsSinceVaccination: vaccinationDate ? monthsBetween(vaccinationDate, at) : null,
    coverage,
    vetAccess: yesNo(d['vet_access']),
    moves: yesNo(d['animals_move']),
    moveReasons: [...new Set([...list(d['movement_reasons']), ...movements.flatMap((m) => list(m['movement_reasons']))])],
    moveDirections: [...new Set(movements.map((m) => str(m['movement_direction'])).filter(Boolean))],
    marketAttendance: [...new Set([...list(d['market_attendance']), ...movements.map((m) => str(m['market_attendance'])).filter(Boolean)])],
    sharedGrazing: yesNo(d['shared_grazing']),
    sharedWhat: list(d['shared_what']),
    water: list(d['water_sources']),
    neighbour: str(d['neighbor_disease']).toLowerCase(),
    biosecurity,
  };

  const factors: Record<RiskFactor, boolean> = {
    clinicalSigns: h.anySign,
    mortality: died > 0 || signs.includes('sudden_death'),
    neighbourDisease: h.neighbour === 'yes',
    notVaccinated: vaccinated === false || (vaccinated === true && coverageBelowHalf(coverage)),
    movesOut: h.moves === true,
    sharedGrazing: h.sharedGrazing === true,
    recentAdditions: h.recentAdditions === true,
    noBiosecurity: realBiosecurity.length === 0 && biosecurity.length > 0,
    noVetAccess: h.vetAccess === false,
  };
  const risk = RISK_FACTORS.reduce((s, f) => s + (factors[f] ? RISK_WEIGHTS[f] : 0), 0);
  return { ...h, factors, risk, riskLevel: riskLevelOf(risk) };
}

export function buildHerds(ds: CampaignDataset): Herd[] {
  return ds.rows.map((r) => toHerd(r, ds));
}

/* ── Indicators ── */

export interface Indicators {
  herds: number;
  animals: number;
  goats: number;
  sheep: number;
  withSigns: number;
  pctSigns: number;
  suspects: number;
  pctSuspect: number;
  affected: number;
  died: number;
  /** deaths / affected animals */
  caseFatality: number;
  /** affected / animals in herds reporting signs */
  attackRate: number;
  pctVaccinated: number;
  pctVetAccess: number;
  pctMoves: number;
  pctShared: number;
  pctNoBiosecurity: number;
  pctNeighbour: number;
  pctRecentAdditions: number;
  pctHighRisk: number;
  meanRisk: number;
  pctGps: number;
  pctValidated: number;
  agents: number;
  days: number;
}

const pct = (a: number, b: number): number => (b > 0 ? (a / b) * 100 : 0);
/** Share among herds that answered the question (null = not answered). */
const pctAnswered = (hs: Herd[], get: (h: Herd) => YesNo): number => {
  let yes = 0;
  let n = 0;
  for (const h of hs) {
    const v = get(h);
    if (v == null) continue;
    n++;
    if (v) yes++;
  }
  return pct(yes, n);
};

export function indicators(hs: Herd[]): Indicators {
  let animals = 0, goats = 0, sheep = 0, withSigns = 0, suspects = 0, affected = 0, died = 0;
  let animalsInSick = 0, highRisk = 0, riskSum = 0, gps = 0, validated = 0, neighbourYes = 0, neighbourAnswered = 0, noBio = 0, bioAnswered = 0;
  const agents = new Set<string>();
  const days = new Set<string>();
  for (const h of hs) {
    animals += h.animals; goats += h.goats; sheep += h.sheep;
    if (h.anySign) { withSigns++; animalsInSick += h.animals; }
    if (h.pprSuspect) suspects++;
    affected += h.affected; died += h.died;
    if (h.riskLevel === 'high' || h.riskLevel === 'veryHigh') highRisk++;
    riskSum += h.risk;
    if (h.lat != null) gps++;
    if (h.status === 'VALIDATED') validated++;
    if (h.neighbour) { neighbourAnswered++; if (h.neighbour === 'yes') neighbourYes++; }
    if (h.biosecurity.length > 0) { bioAnswered++; if (h.factors.noBiosecurity) noBio++; }
    agents.add(h.agentId);
    days.add(h.day);
  }
  const n = hs.length;
  return {
    herds: n,
    animals, goats, sheep,
    withSigns,
    pctSigns: pct(withSigns, n),
    suspects,
    pctSuspect: pct(suspects, n),
    affected, died,
    caseFatality: pct(died, affected),
    attackRate: pct(affected, animalsInSick),
    pctVaccinated: pctAnswered(hs, (h) => h.vaccinated),
    pctVetAccess: pctAnswered(hs, (h) => h.vetAccess),
    pctMoves: pctAnswered(hs, (h) => h.moves),
    pctShared: pctAnswered(hs, (h) => h.sharedGrazing),
    pctNoBiosecurity: pct(noBio, bioAnswered),
    pctNeighbour: pct(neighbourYes, neighbourAnswered),
    pctRecentAdditions: pctAnswered(hs, (h) => h.recentAdditions),
    pctHighRisk: pct(highRisk, n),
    meanRisk: n > 0 ? riskSum / n : 0,
    pctGps: pct(gps, n),
    pctValidated: pct(validated, n),
    agents: agents.size,
    days: days.size,
  };
}

/* ── Dimensions (for grouping, comparison and cross-tabulation) ── */

export type DimensionKey =
  | 'country' | 'l1' | 'l2' | 'l3' | 'system' | 'sizeClass' | 'agent' | 'status' | 'month'
  | 'riskLevel' | 'anySign' | 'pprSuspect' | 'vaccinated' | 'coverage' | 'vetAccess' | 'moves'
  | 'sharedGrazing' | 'recentAdditions' | 'neighbour' | 'lab'
  | 'signs' | 'water' | 'biosecurity' | 'ages' | 'moveReasons' | 'sharedWhat';

/** Multi-valued dimensions: a herd counts once in each value it reports. */
export const MULTI_DIMENSIONS: DimensionKey[] = ['signs', 'water', 'biosecurity', 'ages', 'moveReasons', 'sharedWhat'];

const yn = (v: YesNo): string => (v == null ? '' : v ? 'yes' : 'no');

export function dimensionValues(h: Herd, dim: DimensionKey): string[] {
  switch (dim) {
    case 'country': return [h.country];
    case 'l1': return [h.l1];
    case 'l2': return [h.l2];
    case 'l3': return [h.l3];
    case 'system': return [h.system];
    case 'sizeClass': return [h.sizeClass];
    case 'agent': return [h.agentId];
    case 'status': return [h.status];
    case 'month': return [h.day.slice(0, 7)];
    case 'riskLevel': return [h.riskLevel];
    case 'anySign': return [h.anySign ? 'yes' : 'no'];
    case 'pprSuspect': return [h.pprSuspect ? 'yes' : 'no'];
    case 'vaccinated': return [yn(h.vaccinated)];
    case 'coverage': return [h.coverage];
    case 'vetAccess': return [yn(h.vetAccess)];
    case 'moves': return [yn(h.moves)];
    case 'sharedGrazing': return [yn(h.sharedGrazing)];
    case 'recentAdditions': return [yn(h.recentAdditions)];
    case 'neighbour': return [h.neighbour];
    case 'lab': return [h.lab];
    case 'signs': return h.signs.length ? h.signs : ['none'];
    case 'water': return h.water;
    case 'biosecurity': return h.biosecurity;
    case 'ages': return h.ages;
    case 'moveReasons': return h.moveReasons;
    case 'sharedWhat': return h.sharedWhat;
  }
}

export function groupBy(hs: Herd[], dim: DimensionKey): Map<string, Herd[]> {
  const out = new Map<string, Herd[]>();
  for (const h of hs) {
    for (const v of dimensionValues(h, dim)) {
      const key = v || '';
      let arr = out.get(key);
      if (!arr) { arr = []; out.set(key, arr); }
      arr.push(h);
    }
  }
  return out;
}

/** Counts per value, sorted by count (descending); empty answers dropped. */
export function counts(hs: Herd[], dim: DimensionKey): { key: string; value: number }[] {
  return [...groupBy(hs, dim).entries()]
    .filter(([k]) => k !== '')
    .map(([key, arr]) => ({ key, value: arr.length }))
    .sort((a, b) => b.value - a.value);
}

export interface CrossTab {
  rows: string[];
  cols: string[];
  cells: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  total: number;
  /** Pearson chi-square on single-valued dimensions; null when not applicable. */
  chi2: { value: number; df: number; p: number } | null;
}

export function crossTab(hs: Herd[], rowDim: DimensionKey, colDim: DimensionKey, maxRows = 15, maxCols = 10): CrossTab {
  const cells: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  for (const h of hs) {
    const rs = dimensionValues(h, rowDim).filter(Boolean);
    const cs = dimensionValues(h, colDim).filter(Boolean);
    for (const r of rs) {
      for (const c of cs) {
        (cells[r] ??= {})[c] = (cells[r][c] ?? 0) + 1;
        rowTotals[r] = (rowTotals[r] ?? 0) + 1;
        colTotals[c] = (colTotals[c] ?? 0) + 1;
      }
    }
  }
  const rows = Object.keys(rowTotals).sort((a, b) => rowTotals[b] - rowTotals[a]).slice(0, maxRows);
  const cols = Object.keys(colTotals).sort((a, b) => colTotals[b] - colTotals[a]).slice(0, maxCols);
  const total = rows.reduce((s, r) => s + cols.reduce((t, c) => t + (cells[r]?.[c] ?? 0), 0), 0);

  let chi2: CrossTab['chi2'] = null;
  const single = !MULTI_DIMENSIONS.includes(rowDim) && !MULTI_DIMENSIONS.includes(colDim);
  if (single && rows.length > 1 && cols.length > 1 && total > 0) {
    let x = 0;
    const rt = (r: string) => cols.reduce((t, c) => t + (cells[r]?.[c] ?? 0), 0);
    const ct = (c: string) => rows.reduce((t, r) => t + (cells[r]?.[c] ?? 0), 0);
    for (const r of rows) {
      for (const c of cols) {
        const e = (rt(r) * ct(c)) / total;
        if (e > 0) x += ((cells[r]?.[c] ?? 0) - e) ** 2 / e;
      }
    }
    const df = (rows.length - 1) * (cols.length - 1);
    chi2 = { value: x, df, p: chiSquarePValue(x, df) };
  }
  return { rows, cols, cells, rowTotals, colTotals, total, chi2 };
}

/* ── Relative risk of reporting clinical signs, per exposure ── */

export interface RelativeRisk {
  factor: RiskFactor;
  exposed: number;
  exposedSick: number;
  unexposed: number;
  unexposedSick: number;
  riskExposed: number;
  riskUnexposed: number;
  rr: number | null;
  low: number | null;
  high: number | null;
}

export function relativeRisks(hs: Herd[], outcome: (h: Herd) => boolean = (h) => h.anySign): RelativeRisk[] {
  return EXPOSURES.map((factor) => {
    let a = 0, b = 0, c = 0, d = 0;
    for (const h of hs) {
      const sick = outcome(h);
      if (h.factors[factor]) { if (sick) a++; else b++; }
      else if (sick) c++; else d++;
    }
    const exposed = a + b;
    const unexposed = c + d;
    const r1 = exposed ? a / exposed : 0;
    const r0 = unexposed ? c / unexposed : 0;
    let rr: number | null = null, low: number | null = null, high: number | null = null;
    if (a > 0 && c > 0 && exposed > 0 && unexposed > 0) {
      rr = r1 / r0;
      const se = Math.sqrt(1 / a - 1 / exposed + 1 / c - 1 / unexposed);
      low = Math.exp(Math.log(rr) - 1.96 * se);
      high = Math.exp(Math.log(rr) + 1.96 * se);
    }
    return { factor, exposed, exposedSick: a, unexposed, unexposedSick: c, riskExposed: r1 * 100, riskUnexposed: r0 * 100, rr, low, high };
  });
}

/* ── Time series ── */

export function dailySeries(hs: Herd[], seriesOf: (h: Herd) => string): { day: string; [series: string]: number | string }[] {
  if (hs.length === 0) return [];
  const byDay = new Map<string, Record<string, number>>();
  let min = hs[0].day, max = hs[0].day;
  for (const h of hs) {
    if (h.day < min) min = h.day;
    if (h.day > max) max = h.day;
    const rec = byDay.get(h.day) ?? {};
    const s = seriesOf(h);
    rec[s] = (rec[s] ?? 0) + 1;
    byDay.set(h.day, rec);
  }
  const out: { day: string; [series: string]: number | string }[] = [];
  const d = new Date(`${min}T00:00:00Z`);
  const end = new Date(`${max}T00:00:00Z`);
  // Fill gaps so idle days show as zero; cap at 400 days.
  for (let i = 0; d <= end && i < 400; i++) {
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, ...(byDay.get(key) ?? {}) });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** ISO week start (Monday) of a YYYY-MM-DD date. */
export function weekOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/* ── Statistics ── */

/** Upper-tail p-value of the chi-square distribution (regularized gamma). */
export function chiSquarePValue(x: number, df: number): number {
  if (x <= 0 || df <= 0) return 1;
  return 1 - lowerRegularizedGamma(df / 2, x / 2);
}

function lowerRegularizedGamma(s: number, x: number): number {
  if (x < s + 1) {
    let sum = 1 / s, term = 1 / s;
    for (let n = 1; n < 200; n++) {
      term *= x / (s + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-12) break;
    }
    return Math.min(1, sum * Math.exp(-x + s * Math.log(x) - logGamma(s)));
  }
  // Continued fraction for the upper tail (Lentz)
  let b = x + 1 - s, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return Math.max(0, 1 - Math.exp(-x + s * Math.log(x) - logGamma(s)) * h);
}

function logGamma(z: number): number {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const c of g) ser += c / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/* ── CSV export ── */

export function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n');
}
