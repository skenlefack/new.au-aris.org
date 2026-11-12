/**
 * Consistency checks for one collected submission.
 *
 * Pure functions: everything they need (form schema, geo lookups, campaign
 * statistics, duplicates, location suggestion) is passed in by the caller,
 * so the rules are easy to test and reuse.
 *
 * Every issue carries a stable `code` + `params` so the web app can show
 * the message in the user's language; `message` is the English fallback.
 */
import { isInsideCountry } from './country-bounds';

export type Severity = 'error' | 'warning' | 'info';

export interface IssueSuggestion {
  field: string;
  /** New value for the field; null means "clear the field". */
  value: unknown;
  /** Human readable description of the new value (e.g. area names). */
  label?: string;
  /** True when the suggestion is a guess the validator must check. */
  approximate?: boolean;
}

export interface ConsistencyIssue {
  code: string;
  severity: Severity;
  fields: string[];
  message: string;
  params?: Record<string, string | number>;
  suggestion?: IssueSuggestion;
}

// ── Minimal view of the Form Builder schema ──

export interface SchemaRule { field: string; operator: string; value: unknown }
export interface SchemaCondition { type?: string; action?: string; logic?: 'all' | 'any'; rules?: SchemaRule[] }
export interface SchemaField {
  code: string;
  type: string;
  label?: Record<string, string | undefined> | string;
  required?: boolean;
  hidden?: boolean;
  validation?: { min?: number; max?: number; minDate?: string; maxDate?: string; disableFuture?: boolean; disablePast?: boolean; pattern?: string } | null;
  conditions?: SchemaCondition[] | null;
  properties?: Record<string, unknown> | null;
}
export interface SchemaLike {
  sections?: { fields?: SchemaField[]; conditions?: SchemaCondition[] | null }[];
  settings?: { requireGeoLocation?: boolean } | null;
  validationRules?: { fieldA: string; operator: string; fieldB: string; enabled?: boolean; message?: Record<string, string | undefined> }[] | null;
}

export interface GeoEntityInfo { id: string; parentId: string | null; level: string; name: string; countryCode: string }

export interface NumericStats { n: number; median: number; q1: number; q3: number; p99: number }

export interface AdminSuggestion {
  value: Record<string, string>;
  names: string[];
  distanceKm: number;
}

export interface CheckContext {
  data: Record<string, unknown>;
  schema: SchemaLike | null;
  submittedAt: Date;
  /** ISO-2 code of the submission's country (admin_location.level_0 or tenant). */
  countryCode: string | null;
  /** Geo entities referenced by the submission, by id. Missing id = unknown area. */
  geo: Map<string, GeoEntityInfo>;
  /** Per numeric field, statistics over recent submissions of the same campaign. */
  stats?: Map<string, NumericStats>;
  /** Other submissions of the same agent and campaign with identical data. */
  duplicateIds?: string[];
  /** Location guessed from the nearest valid submission, per admin-location field. */
  adminSuggestions?: Map<string, AdminSuggestion | null>;
  /** Fallback GPS from the submission columns. */
  gps?: { lat: number | null; lng: number | null } | null;
}

// ── Helpers ──

const GEO_TYPES = new Set(['geo-point', 'geo-selector', 'gps', 'geo-location', 'geopoint', 'location-point']);
const ADMIN_TYPES = new Set(['admin-location', 'admin_location']);
const DATE_TYPES = new Set(['date', 'datetime', 'date-time']);
const MULTI_TYPES = new Set(['multi-select', 'multiselect', 'checkbox-group', 'checkboxes']);
const SELECT_TYPES = new Set(['select', 'radio', 'dropdown']);

const DEAD_RE = /(^|_)(died|dead|deaths?|mortality|mortalities|deces|morts?)(_|$)/i;
const AFFECTED_RE = /(^|_)(affected|sick|cases|morbidity|ill|infected)(_|$)/i;
const VACCINATED_COUNT_RE = /(^|_)vaccinated(_|$)/i;
const POPULATION_RE = /((^|_)(count|total|population|herd_size|flock_size|headcount|heads|number_of_animals)(_|$))|(_count$)/i;
const NOT_POPULATION_RE = /(vaccinat|sampl|test|positiv|negativ|treat|slaughter|sold|bought|born|birth|death|died|dead|affected|sick|case|movement|visit|dose)/i;
const SIGNS_RE = /(clinical_sign|symptom|(^|_)signs?(_|$))/i;
const VACC_GATE_RE = /^(vaccinated|vaccination)(_[a-z0-9]+)?$|(^|_)vaccinated$/i;
const VACC_DETAIL_RE = /(vaccination_(date|coverage|type|campaign)|vaccine_|_vaccine$|date_vaccin)/i;
const NONE_VALUES = new Set(['none', 'no', 'aucun', 'aucune', 'nenhum', 'ninguno', 'hakuna']);

export function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '' || v === 'null';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v as object).length === 0;
  return false;
}

export function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim());
  return null;
}

function toDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const d = new Date(v.length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fieldLabel(f: SchemaField | undefined, code: string): string {
  if (!f?.label) return code;
  if (typeof f.label === 'string') return f.label;
  return f.label.en || f.label.fr || Object.values(f.label).find(Boolean) || code;
}

export function allFields(schema: SchemaLike | null): SchemaField[] {
  if (!schema?.sections) return [];
  return schema.sections.flatMap((s) => (s.fields ?? []).filter((f) => f && typeof f.code === 'string'));
}

function ruleMatches(rule: SchemaRule, data: Record<string, unknown>): boolean {
  const v = data[rule.field];
  const target = rule.value;
  const asArr = Array.isArray(v) ? v.map(String) : null;
  switch (rule.operator) {
    case 'equals': return asArr ? asArr.includes(String(target)) : String(v ?? '') === String(target ?? '');
    case 'notEquals': return asArr ? !asArr.includes(String(target)) : String(v ?? '') !== String(target ?? '');
    case 'contains': return asArr ? asArr.includes(String(target)) : String(v ?? '').includes(String(target ?? ''));
    case 'notContains': return asArr ? !asArr.includes(String(target)) : !String(v ?? '').includes(String(target ?? ''));
    case 'isEmpty': return isEmpty(v);
    case 'isNotEmpty': return !isEmpty(v);
    case 'isTrue': return v === true || v === 'true' || v === 'yes';
    case 'isFalse': return v === false || v === 'false' || v === 'no';
    case 'in': return Array.isArray(target) && target.map(String).includes(String(v));
    case 'notIn': return Array.isArray(target) && !target.map(String).includes(String(v));
    case 'startsWith': return String(v ?? '').startsWith(String(target ?? ''));
    case 'endsWith': return String(v ?? '').endsWith(String(target ?? ''));
    default: {
      const a = toNumber(v);
      const b = toNumber(target);
      if (a === null || b === null) return false;
      if (rule.operator === 'greaterThan') return a > b;
      if (rule.operator === 'lessThan') return a < b;
      if (rule.operator === 'greaterOrEqual') return a >= b;
      if (rule.operator === 'lessOrEqual') return a <= b;
      return false;
    }
  }
}

function conditionMatches(c: SchemaCondition, data: Record<string, unknown>): boolean {
  const rules = c.rules ?? [];
  if (rules.length === 0) return true;
  return c.logic === 'any' ? rules.some((r) => ruleMatches(r, data)) : rules.every((r) => ruleMatches(r, data));
}

/** True when the field is shown to the person filling the form. */
export function isVisible(f: SchemaField, data: Record<string, unknown>, sectionConditions?: SchemaCondition[] | null): boolean {
  const conds = [...(sectionConditions ?? []), ...(f.conditions ?? [])].filter((c) => (c.type ?? 'visibility') === 'visibility');
  for (const c of conds) {
    const m = conditionMatches(c, data);
    if (c.action === 'hide' ? m : !m) return false;
  }
  return true;
}

function isRequired(f: SchemaField, data: Record<string, unknown>): boolean {
  const reqConds = (f.conditions ?? []).filter((c) => c.type === 'required');
  if (reqConds.length > 0) return reqConds.some((c) => conditionMatches(c, data));
  return !!f.required;
}

function optionValues(f: SchemaField): string[] | null {
  const opts = (f.properties as any)?.options;
  if (!Array.isArray(opts) || opts.length === 0) return null;
  return opts.map((o: any) => String(o?.value ?? o)).filter(Boolean);
}

function readPoint(v: unknown): { lat: number; lng: number } | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const lat = toNumber(o.lat ?? o.latitude);
  const lng = toNumber(o.lng ?? o.lon ?? o.longitude);
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Percentile on a sorted array (linear interpolation). */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function computeStats(values: number[]): NumericStats {
  const s = [...values].sort((a, b) => a - b);
  return { n: s.length, median: percentile(s, 0.5), q1: percentile(s, 0.25), q3: percentile(s, 0.75), p99: percentile(s, 0.99) };
}

// ── Main entry point ──

export function checkSubmission(ctx: CheckContext): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const { data, schema } = ctx;
  const fields = allFields(schema);
  const byCode = new Map(fields.map((f) => [f.code, f]));
  const sectionOf = new Map<string, SchemaCondition[] | null | undefined>();
  for (const s of schema?.sections ?? []) for (const f of s.fields ?? []) sectionOf.set(f.code, s.conditions);
  const label = (code: string) => fieldLabel(byCode.get(code), code);
  const push = (i: ConsistencyIssue) => issues.push(i);
  const submittedDay = ymd(ctx.submittedAt);

  // 1. Per-field checks driven by the form schema
  for (const f of fields) {
    if (f.hidden) continue;
    const v = data[f.code];
    const visible = isVisible(f, data, sectionOf.get(f.code));

    if (!visible) {
      if (!isEmpty(v)) {
        push({
          code: 'HIDDEN_FIELD_FILLED', severity: 'warning', fields: [f.code],
          message: `"${label(f.code)}" has a value although the form hides it for these answers.`,
          params: { field: label(f.code) },
          suggestion: { field: f.code, value: null },
        });
      }
      continue;
    }

    if (isEmpty(v)) {
      if (isRequired(f, data)) {
        push({ code: 'REQUIRED_MISSING', severity: 'error', fields: [f.code], message: `"${label(f.code)}" is required but empty.`, params: { field: label(f.code) } });
      }
      continue;
    }

    if (f.type === 'number' || f.type === 'integer' || f.type === 'decimal') {
      const n = toNumber(v);
      if (n === null) {
        push({ code: 'NOT_A_NUMBER', severity: 'error', fields: [f.code], message: `"${label(f.code)}" should be a number (value: ${String(v)}).`, params: { field: label(f.code), value: String(v) } });
        continue;
      }
      const min = toNumber(f.validation?.min);
      const max = toNumber(f.validation?.max);
      if (min !== null && n < min) {
        push({ code: 'BELOW_MIN', severity: 'error', fields: [f.code], message: `"${label(f.code)}" is ${n}, below the minimum ${min}.`, params: { field: label(f.code), value: n, min } });
      } else if (min === null && n < 0) {
        push({ code: 'NEGATIVE_NUMBER', severity: 'error', fields: [f.code], message: `"${label(f.code)}" is negative (${n}).`, params: { field: label(f.code), value: n } });
      }
      if (max !== null && n > max) {
        push({ code: 'ABOVE_MAX', severity: 'error', fields: [f.code], message: `"${label(f.code)}" is ${n}, above the maximum ${max}.`, params: { field: label(f.code), value: n, max } });
      }
      const st = ctx.stats?.get(f.code);
      if (st && st.n >= 30 && st.q3 > 0) {
        const iqr = st.q3 - st.q1;
        // Only the extreme tail: far above the bulk AND among the top 1% of the campaign.
        if (n > st.q3 + 3 * Math.max(iqr, 1) && n > 3 * st.q3 && n >= st.p99) {
          push({
            code: 'UNUSUALLY_HIGH', severity: 'info', fields: [f.code],
            message: `"${label(f.code)}" = ${n} is much higher than in other submissions of this campaign (median ${round(st.median)}, 75% are at or below ${round(st.q3)}).`,
            params: { field: label(f.code), value: n, median: round(st.median), q3: round(st.q3) },
          });
        }
      }
    }

    if (DATE_TYPES.has(f.type)) {
      const d = toDate(v);
      if (!d) {
        push({ code: 'INVALID_DATE', severity: 'error', fields: [f.code], message: `"${label(f.code)}" is not a valid date (${String(v)}).`, params: { field: label(f.code), value: String(v) } });
      } else {
        const day = ymd(d);
        if (day > submittedDay) {
          push({ code: 'DATE_AFTER_SUBMISSION', severity: 'error', fields: [f.code], message: `"${label(f.code)}" (${day}) is after the submission date (${submittedDay}).`, params: { field: label(f.code), date: day, submitted: submittedDay } });
        } else {
          const yearsBefore = (ctx.submittedAt.getTime() - d.getTime()) / (365.25 * 86400000);
          if (yearsBefore > 10) {
            push({ code: 'DATE_TOO_OLD', severity: 'warning', fields: [f.code], message: `"${label(f.code)}" (${day}) is more than 10 years before the submission.`, params: { field: label(f.code), date: day } });
          }
        }
        if (f.validation?.minDate && day < f.validation.minDate.slice(0, 10)) {
          push({ code: 'DATE_BEFORE_MIN', severity: 'error', fields: [f.code], message: `"${label(f.code)}" (${day}) is before ${f.validation.minDate.slice(0, 10)}.`, params: { field: label(f.code), date: day, min: f.validation.minDate.slice(0, 10) } });
        }
        if (f.validation?.maxDate && day > f.validation.maxDate.slice(0, 10)) {
          push({ code: 'DATE_AFTER_MAX', severity: 'error', fields: [f.code], message: `"${label(f.code)}" (${day}) is after ${f.validation.maxDate.slice(0, 10)}.`, params: { field: label(f.code), date: day, max: f.validation.maxDate.slice(0, 10) } });
        }
      }
    }

    if (SELECT_TYPES.has(f.type) || MULTI_TYPES.has(f.type)) {
      const opts = optionValues(f);
      const values = Array.isArray(v) ? v.map(String) : [String(v)];
      if (opts) {
        for (const val of values) {
          if (opts.includes(val)) continue;
          const ci = opts.find((o) => o.toLowerCase() === val.toLowerCase().trim());
          push({
            code: 'UNKNOWN_OPTION', severity: 'warning', fields: [f.code],
            message: `"${label(f.code)}" contains "${val}", which is not one of the form's options.`,
            params: { field: label(f.code), value: val },
            ...(ci ? { suggestion: { field: f.code, value: Array.isArray(v) ? values.map((x) => (x === val ? ci : x)) : ci } } : {}),
          });
        }
      }
      if (MULTI_TYPES.has(f.type) && values.length > 1) {
        const none = values.find((x) => NONE_VALUES.has(x.toLowerCase()));
        if (none) {
          push({
            code: 'NONE_WITH_OTHERS', severity: 'warning', fields: [f.code],
            message: `"${label(f.code)}" has "${none}" selected together with other answers.`,
            params: { field: label(f.code), none },
            suggestion: { field: f.code, value: values.filter((x) => x !== none) },
          });
        }
      }
    }
  }

  // 2. Cross-field rules defined in the form
  for (const r of schema?.validationRules ?? []) {
    if (r.enabled === false) continue;
    const a = data[r.fieldA];
    const b = data[r.fieldB];
    if (isEmpty(a) || isEmpty(b)) continue;
    const da = toDate(a); const db = toDate(b);
    const na = toNumber(a); const nb = toNumber(b);
    let x: number | string; let y: number | string;
    if (na !== null && nb !== null) { x = na; y = nb; } else if (da && db) { x = ymd(da); y = ymd(db); } else continue;
    const ok = r.operator === 'lessThan' ? x < y : r.operator === 'lessOrEqual' ? x <= y : r.operator === 'greaterThan' ? x > y
      : r.operator === 'greaterOrEqual' ? x >= y : r.operator === 'equals' ? x === y : r.operator === 'notEquals' ? x !== y : true;
    if (!ok) {
      const custom = r.message?.en || r.message?.fr;
      push({
        code: 'FORM_RULE', severity: 'error', fields: [r.fieldA, r.fieldB],
        message: custom || `"${label(r.fieldA)}" (${String(a)}) must be ${r.operator} "${label(r.fieldB)}" (${String(b)}).`,
        params: { fieldA: label(r.fieldA), fieldB: label(r.fieldB), a: String(a), b: String(b), operator: r.operator, ...(custom ? { custom } : {}) },
      });
    }
  }

  // 3. Animal counts: deaths / sick / vaccinated vs. population
  const numberFields = fields.filter((f) => ['number', 'integer', 'decimal'].includes(f.type));
  const popFields = numberFields.filter((f) => POPULATION_RE.test(f.code) && !NOT_POPULATION_RE.test(f.code));
  const deadFields = numberFields.filter((f) => DEAD_RE.test(f.code));
  const affFields = numberFields.filter((f) => AFFECTED_RE.test(f.code) && !DEAD_RE.test(f.code));
  const vacFields = numberFields.filter((f) => VACCINATED_COUNT_RE.test(f.code));
  const sum = (fs: SchemaField[]) => {
    const vals = fs.map((f) => toNumber(data[f.code])).filter((n): n is number => n !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const population = popFields.length && popFields.every((f) => toNumber(data[f.code]) !== null) ? sum(popFields) : null;
  const dead = sum(deadFields);
  const affected = sum(affFields);
  const vaccinated = sum(vacFields);
  const popLabel = popFields.map((f) => label(f.code)).join(' + ');
  if (population !== null) {
    if (dead !== null && dead > population) {
      push({
        code: 'DEATHS_EXCEED_POPULATION', severity: 'error', fields: [...deadFields.map((f) => f.code), ...popFields.map((f) => f.code)],
        message: `${dead} dead animals reported but only ${population} animals in the herd (${popLabel}).`,
        params: { dead, population, populationFields: popLabel },
      });
    }
    if (affected !== null && affected > population) {
      push({
        code: 'AFFECTED_EXCEED_POPULATION', severity: 'error', fields: [...affFields.map((f) => f.code), ...popFields.map((f) => f.code)],
        message: `${affected} sick animals reported but only ${population} animals in the herd (${popLabel}).`,
        params: { affected, population, populationFields: popLabel },
      });
    }
    if (vaccinated !== null && vaccinated > population) {
      push({
        code: 'VACCINATED_EXCEED_POPULATION', severity: 'error', fields: [...vacFields.map((f) => f.code), ...popFields.map((f) => f.code)],
        message: `${vaccinated} vaccinated animals reported but only ${population} animals in the herd (${popLabel}).`,
        params: { vaccinated, population, populationFields: popLabel },
      });
    }
  }
  if (dead !== null && affected !== null && affected > 0 && dead > affected) {
    push({
      code: 'DEATHS_EXCEED_AFFECTED', severity: 'warning', fields: [...deadFields.map((f) => f.code), ...affFields.map((f) => f.code)],
      message: `More dead animals (${dead}) than sick animals (${affected}).`,
      params: { dead, affected },
    });
  }

  // 4. Clinical signs vs. sick animals
  const signsField = fields.find((f) => SIGNS_RE.test(f.code) && (MULTI_TYPES.has(f.type) || SELECT_TYPES.has(f.type)));
  if (signsField && affFields.length) {
    const signs = (Array.isArray(data[signsField.code]) ? (data[signsField.code] as unknown[]) : isEmpty(data[signsField.code]) ? [] : [data[signsField.code]])
      .map(String).filter((s) => !NONE_VALUES.has(s.toLowerCase()));
    if (signs.length > 0 && (affected === null || affected === 0)) {
      push({
        code: 'SIGNS_WITHOUT_SICK_ANIMALS', severity: 'warning', fields: [signsField.code, ...affFields.map((f) => f.code)],
        message: `Clinical signs are reported (${signs.length}) but the number of sick animals is ${affected === null ? 'empty' : '0'}.`,
        params: { count: signs.length, affected: affected === null ? '-' : 0 },
      });
    }
    if (signs.length === 0 && affected !== null && affected > 0) {
      push({
        code: 'SICK_ANIMALS_WITHOUT_SIGNS', severity: 'info', fields: [signsField.code, ...affFields.map((f) => f.code)],
        message: `${affected} sick animals reported but no clinical sign is selected.`,
        params: { affected },
      });
    }
  }

  // 5. Vaccination answered "no" but vaccination details filled
  for (const gate of fields.filter((f) => VACC_GATE_RE.test(f.code) && SELECT_TYPES.has(f.type))) {
    if (String(data[gate.code] ?? '').toLowerCase() !== 'no') continue;
    const filled = fields.filter((f) => f.code !== gate.code && VACC_DETAIL_RE.test(f.code) && !isEmpty(data[f.code]));
    if (filled.length) {
      push({
        code: 'VACCINATION_CONTRADICTION', severity: 'warning', fields: [gate.code, ...filled.map((f) => f.code)],
        message: `"${label(gate.code)}" is "no" but ${filled.map((f) => `"${label(f.code)}"`).join(', ')} ${filled.length > 1 ? 'are' : 'is'} filled.`,
        params: { gate: label(gate.code), details: filled.map((f) => label(f.code)).join(', ') },
      });
    }
  }

  // 6. Location: administrative areas
  for (const f of fields.filter((x) => ADMIN_TYPES.has(x.type))) {
    const v = data[f.code];
    if (!v || typeof v !== 'object') continue;
    const loc = v as Record<string, unknown>;
    const unknownLevels: number[] = [];
    let previous: GeoEntityInfo | null = null;
    for (let lvl = 1; lvl <= 5; lvl++) {
      const id = loc[`level_${lvl}`];
      if (isEmpty(id)) continue;
      const sid = String(id);
      if (sid.startsWith('__new:')) {
        push({
          code: 'NEW_AREA_NAME', severity: 'info', fields: [f.code],
          message: `Level ${lvl} area "${sid.slice(6)}" was typed by the collector and is not in the reference list.`,
          params: { level: lvl, name: sid.slice(6) },
        });
        previous = null;
        continue;
      }
      const ent = ctx.geo.get(sid);
      if (!ent) { unknownLevels.push(lvl); previous = null; continue; }
      if (previous && ent.parentId && ent.parentId !== previous.id) {
        push({
          code: 'AREA_HIERARCHY_MISMATCH', severity: 'error', fields: [f.code],
          message: `"${ent.name}" (level ${lvl}) is not inside "${previous.name}" (level ${lvl - 1}).`,
          params: { child: ent.name, parent: previous.name, level: lvl },
        });
      }
      previous = ent;
    }
    if (unknownLevels.length) {
      const sug = ctx.adminSuggestions?.get(f.code) ?? null;
      push({
        code: 'UNKNOWN_ADMIN_AREA', severity: 'error', fields: [f.code],
        message: `The administrative area${unknownLevels.length > 1 ? 's' : ''} at level ${unknownLevels.join(', ')} no longer exist${unknownLevels.length > 1 ? '' : 's'} in ARIS, so this submission is not counted in any district.`
          + (sug ? ` Nearest valid submission (${round(sug.distanceKm)} km away) is in ${sug.names.join(' / ')}.` : ''),
        params: { levels: unknownLevels.join(', '), ...(sug ? { distanceKm: round(sug.distanceKm), area: sug.names.join(' / ') } : {}) },
        ...(sug ? { suggestion: { field: f.code, value: sug.value, label: sug.names.join(' / '), approximate: true } } : {}),
      });
    }
  }

  // 7. Location: GPS point
  const geoFields = fields.filter((x) => GEO_TYPES.has(x.type));
  const country = ctx.countryCode?.toUpperCase() ?? null;
  for (const f of geoFields) {
    const v = data[f.code];
    const visible = isVisible(f, data, sectionOf.get(f.code));
    if (!visible) continue;
    const p = readPoint(v) ?? (ctx.gps && ctx.gps.lat !== null && ctx.gps.lng !== null ? { lat: ctx.gps.lat, lng: ctx.gps.lng } : null);
    if (!p) {
      if (!isRequired(f, data)) {
        push({
          code: 'GPS_MISSING', severity: schema?.settings?.requireGeoLocation ? 'error' : 'info', fields: [f.code],
          message: `No GPS point recorded ("${label(f.code)}").`, params: { field: label(f.code) },
        });
      }
      continue;
    }
    if (Math.abs(p.lat) < 0.0001 && Math.abs(p.lng) < 0.0001) {
      push({ code: 'GPS_ZERO', severity: 'error', fields: [f.code], message: 'GPS point is 0, 0 (no real position).', params: {} });
      continue;
    }
    if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) {
      push({ code: 'GPS_INVALID', severity: 'error', fields: [f.code], message: `GPS point ${p.lat}, ${p.lng} is not a valid position.`, params: { lat: p.lat, lng: p.lng } });
      continue;
    }
    if (country) {
      const inside = isInsideCountry(country, p.lat, p.lng);
      if (inside === false) {
        const swapped = isInsideCountry(country, p.lng, p.lat);
        push({
          code: 'GPS_OUTSIDE_COUNTRY', severity: 'error', fields: [f.code],
          message: `GPS point ${round(p.lat, 4)}, ${round(p.lng, 4)} is outside ${country}.` + (swapped ? ' Latitude and longitude look swapped.' : ''),
          params: { lat: round(p.lat, 4), lng: round(p.lng, 4), country, swapped: swapped ? 1 : 0 },
          ...(swapped ? { suggestion: { field: f.code, value: { ...(v as object), lat: p.lng, lng: p.lat } } } : {}),
        });
      }
    }
  }

  // 8. Duplicates
  if (ctx.duplicateIds && ctx.duplicateIds.length) {
    push({
      code: 'DUPLICATE', severity: 'warning', fields: [],
      message: `Same answers as ${ctx.duplicateIds.length} other submission${ctx.duplicateIds.length > 1 ? 's' : ''} from the same collector in this campaign.`,
      params: { count: ctx.duplicateIds.length, ids: ctx.duplicateIds.slice(0, 5).join(',') },
    });
  }

  const rank: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function summarize(issues: ConsistencyIssue[]): { error: number; warning: number; info: number } {
  return {
    error: issues.filter((i) => i.severity === 'error').length,
    warning: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
  };
}

function round(n: number, d = 1): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
