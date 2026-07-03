/**
 * Smart import resolver — converts raw Excel text values into structured
 * data matching form template field types (admin-location, master-data-select, etc.)
 */

import { COUNTRIES } from '@/data/countries-config';

// ── Types ──

export interface FieldDef {
  code: string;
  label: string;
  type: string;
  required: boolean;
  properties?: {
    masterDataType?: string;
    parentFilter?: Record<string, string>;
    options?: { value: string; label: Record<string, string> | string }[];
  };
}

export interface ResolvedCell {
  raw: unknown;
  resolved: unknown;
  status: 'ok' | 'error' | 'warning';
  message?: string;
}

export interface ResolvedRow {
  index: number;
  cells: Record<string, ResolvedCell>;
  status: 'valid' | 'error';
  errorCount: number;
}

// ── Country name → ISO code mapping ──

const COUNTRY_NAME_MAP: Record<string, string> = {};
for (const [code, c] of Object.entries(COUNTRIES)) {
  const names = [c.name, c.nameFr, c.namePt].filter(Boolean);
  for (const n of names) {
    if (n) COUNTRY_NAME_MAP[n.toLowerCase()] = code;
  }
}
// Common aliases
Object.assign(COUNTRY_NAME_MAP, {
  'madagascar': 'MG', 'malagasy': 'MG', 'cameroun': 'CM', 'cameroon': 'CM',
  'kenya': 'KE', 'nigeria': 'NG', 'senegal': 'SN', 'sénégal': 'SN',
  'ghana': 'GH', 'tanzania': 'TZ', 'tanzanie': 'TZ', 'egypt': 'EG',
  'egypte': 'EG', 'égypte': 'EG', 'south africa': 'ZA', 'afrique du sud': 'ZA',
  'morocco': 'MA', 'maroc': 'MA', 'tunisia': 'TN', 'tunisie': 'TN',
  'ethiopia': 'ET', 'ethiopie': 'ET', 'éthiopie': 'ET', 'uganda': 'UG',
  'ouganda': 'UG', 'mozambique': 'MZ', 'namibia': 'NA', 'namibie': 'NA',
  'angola': 'AO', 'djibouti': 'DJ', 'seychelles': 'SC', 'mauritius': 'MU',
  'maurice': 'MU', 'gambia': 'GM', 'gambie': 'GM',
  "cote d'ivoire": 'CI', "côte d'ivoire": 'CI', 'ivory coast': 'CI',
});

// ── Helpers ──

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function fuzzyMatch(needle: string, haystack: string): boolean {
  return normalize(haystack).includes(normalize(needle)) ||
    normalize(needle).includes(normalize(haystack));
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const raw = localStorage.getItem('aris-auth');
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.state?.accessToken) headers['Authorization'] = `Bearer ${p.state.accessToken}`;
      if (p?.state?.user?.tenantId) headers['X-Tenant-Id'] = p.state.user.tenantId;
    }
  } catch { /* ignore */ }
  return headers;
}

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { headers: getAuthHeaders() });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Resolvers ──

/** Resolve country name to ISO code */
export function resolveCountryCode(text: string): string | null {
  if (!text) return null;
  const clean = text.trim();
  // Already ISO code?
  if (clean.length === 2 && clean === clean.toUpperCase() && COUNTRIES[clean]) return clean;
  return COUNTRY_NAME_MAP[clean.toLowerCase()] ?? null;
}

/** Resolve "Country, Admin1, Admin2" text to structured admin_location */
export async function resolveAdminLocation(text: string): Promise<ResolvedCell> {
  if (!text || typeof text !== 'string') {
    return { raw: text, resolved: null, status: 'error', message: 'Empty location' };
  }

  const parts = text.split(/[,;/]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { raw: text, resolved: null, status: 'error', message: 'Cannot parse location' };
  }

  // Level 0: Country
  const countryCode = resolveCountryCode(parts[0]);
  if (!countryCode) {
    return { raw: text, resolved: null, status: 'error', message: `Unknown country: "${parts[0]}"` };
  }

  const result: Record<string, string> = { level_0: countryCode };

  // Level 1: Admin1
  if (parts.length >= 2) {
    const admin1Name = parts[1];
    const res = await apiFetch<any>(`/api/v1/master-data/geo?countryCode=${countryCode}&level=ADMIN1&limit=200`);
    const entities = res?.data ?? [];
    const match = entities.find((e: any) => {
      const names = [e.name, e.nameEn, e.nameFr, e.namePt, e.nameAr].filter(Boolean);
      // Also check multilingual name object
      if (typeof e.name === 'object') {
        names.push(...Object.values(e.name as Record<string, string>).filter(Boolean));
      }
      return names.some((n: string) => fuzzyMatch(admin1Name, n));
    });

    if (match) {
      result.level_1 = match.id;

      // Level 2: Admin2
      if (parts.length >= 3) {
        const admin2Name = parts[2];
        const res2 = await apiFetch<any>(`/api/v1/master-data/geo/${match.id}/children?limit=200`);
        const children = res2?.data ?? [];
        const match2 = children.find((e: any) => {
          const names = [e.name, e.nameEn, e.nameFr, e.namePt].filter(Boolean);
          if (typeof e.name === 'object') {
            names.push(...Object.values(e.name as Record<string, string>).filter(Boolean));
          }
          return names.some((n: string) => fuzzyMatch(admin2Name, n));
        });
        if (match2) {
          result.level_2 = match2.id;
        } else {
          // Create with __new: prefix
          result.level_2 = `__new:${admin2Name}`;
        }
      }
    } else {
      // Create with __new: prefix
      result.level_1 = `__new:${admin1Name}`;
    }
  }

  return { raw: text, resolved: result, status: 'ok' };
}

/** Resolve a master-data-select value (text → UUID) */
export async function resolveRefDataValue(
  masterDataType: string,
  text: string,
): Promise<ResolvedCell> {
  if (!text || typeof text !== 'string') {
    return { raw: text, resolved: null, status: 'error', message: 'Empty value' };
  }

  const clean = text.trim();
  const endpoint = masterDataType === 'fish-species'
    ? `/api/v1/master-data/ref/fish-species/for-select?search=${encodeURIComponent(clean)}`
    : `/api/v1/master-data/ref/${masterDataType}/for-select`;

  const res = await apiFetch<any>(endpoint);
  const items = res?.data ?? [];

  // Try exact match first (code, value, name)
  for (const item of items) {
    if (item.code === clean || item.id === clean) {
      return { raw: text, resolved: item.id, status: 'ok' };
    }
    // Check multilingual names
    const names: string[] = [];
    if (typeof item.name === 'object') {
      names.push(...Object.values(item.name as Record<string, string>).filter(Boolean));
    } else if (typeof item.name === 'string') {
      names.push(item.name);
    }
    if (item.scientificName) names.push(item.scientificName);
    if (item.common_name_en) names.push(item.common_name_en);
    if (item.common_name_fr) names.push(item.common_name_fr);

    if (names.some((n) => normalize(n) === normalize(clean))) {
      return { raw: text, resolved: item.id, status: 'ok' };
    }
  }

  // Try fuzzy match
  for (const item of items) {
    const names: string[] = [];
    if (typeof item.name === 'object') {
      names.push(...Object.values(item.name as Record<string, string>).filter(Boolean));
    }
    if (item.scientificName) names.push(item.scientificName);

    if (names.some((n) => fuzzyMatch(clean, n))) {
      return { raw: text, resolved: item.id, status: 'warning', message: `Matched: ${names[0]}` };
    }
  }

  return { raw: text, resolved: null, status: 'error', message: `No match for "${clean}" in ${masterDataType}` };
}

/** Resolve a static select option (text → value) */
export function resolveSelectOption(
  options: { value: string; label: Record<string, string> | string }[],
  text: string,
): ResolvedCell {
  if (!text || typeof text !== 'string') {
    return { raw: text, resolved: null, status: 'error', message: 'Empty value' };
  }

  const clean = text.trim();

  // Direct value match
  const byValue = options.find((o) => normalize(o.value) === normalize(clean));
  if (byValue) return { raw: text, resolved: byValue.value, status: 'ok' };

  // Label match (any locale)
  for (const opt of options) {
    const labels: string[] = [];
    if (typeof opt.label === 'string') {
      labels.push(opt.label);
    } else {
      labels.push(...Object.values(opt.label).filter(Boolean));
    }
    if (labels.some((l) => normalize(l) === normalize(clean))) {
      return { raw: text, resolved: opt.value, status: 'ok' };
    }
  }

  // Common aliases: oui/yes/true, non/no/false
  const boolMap: Record<string, string> = {
    'oui': 'Yes', 'yes': 'Yes', 'true': 'Yes', 'active': 'Yes', 'actif': 'Yes', '1': 'Yes',
    'non': 'No', 'no': 'No', 'false': 'No', 'inactive': 'No', 'inactif': 'No', '0': 'No',
  };
  const boolVal = boolMap[clean.toLowerCase()];
  if (boolVal) {
    const match = options.find((o) => normalize(o.value) === normalize(boolVal));
    if (match) return { raw: text, resolved: match.value, status: 'ok' };
  }

  // Fuzzy match
  for (const opt of options) {
    const labels: string[] = typeof opt.label === 'string' ? [opt.label] : Object.values(opt.label).filter(Boolean);
    if (labels.some((l) => fuzzyMatch(clean, l))) {
      return { raw: text, resolved: opt.value, status: 'warning', message: `Matched: ${labels[0]}` };
    }
  }

  return { raw: text, resolved: null, status: 'error', message: `No match for "${clean}"` };
}

/** Coerce a value to the expected field type */
export function coerceFieldType(fieldType: string, value: unknown): ResolvedCell {
  if (value === null || value === undefined || value === '') {
    return { raw: value, resolved: null, status: 'ok' };
  }

  switch (fieldType) {
    case 'number': {
      const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
      if (isNaN(n)) return { raw: value, resolved: null, status: 'error', message: `"${value}" is not a number` };
      return { raw: value, resolved: n, status: 'ok' };
    }
    case 'date': {
      if (value instanceof Date) {
        return { raw: value, resolved: value.toISOString().slice(0, 10), status: 'ok' };
      }
      const s = String(value);
      // Try ISO format
      const d = new Date(s);
      if (!isNaN(d.getTime())) return { raw: value, resolved: d.toISOString().slice(0, 10), status: 'ok' };
      // Try DD/MM/YYYY
      const parts = s.split(/[/\-.]/).map(Number);
      if (parts.length === 3) {
        const [a, b, yr] = parts;
        const dt = yr > 31 ? new Date(yr, b - 1, a) : new Date(a, b - 1, yr);
        if (!isNaN(dt.getTime())) return { raw: value, resolved: dt.toISOString().slice(0, 10), status: 'ok' };
      }
      return { raw: value, resolved: null, status: 'error', message: `Cannot parse date: "${value}"` };
    }
    default:
      return { raw: value, resolved: String(value), status: 'ok' };
  }
}

// ── Main resolver ──

/** Resolve all fields of a single row against the template */
export async function resolveRow(
  rowIndex: number,
  rawData: Record<string, unknown>,
  fields: FieldDef[],
): Promise<ResolvedRow> {
  const cells: Record<string, ResolvedCell> = {};
  let errorCount = 0;

  for (const field of fields) {
    const rawValue = rawData[field.code];

    // Skip layout fields
    if (['heading', 'divider', 'spacer', 'info-box'].includes(field.type)) continue;
    // Skip geo-selector (optional)
    if (field.type === 'geo-selector') continue;

    // Required check
    if (field.required && (rawValue === null || rawValue === undefined || rawValue === '')) {
      cells[field.code] = { raw: rawValue, resolved: null, status: 'error', message: `${field.label} is required` };
      errorCount++;
      continue;
    }

    // Empty optional field
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      cells[field.code] = { raw: rawValue, resolved: null, status: 'ok' };
      continue;
    }

    let cell: ResolvedCell;

    switch (field.type) {
      case 'admin-location':
        cell = await resolveAdminLocation(String(rawValue));
        break;

      case 'master-data-select': {
        const mdType = field.properties?.masterDataType ?? '';
        cell = await resolveRefDataValue(mdType, String(rawValue));
        break;
      }

      case 'select': {
        const options = field.properties?.options ?? [];
        if (options.length > 0) {
          cell = resolveSelectOption(options, String(rawValue));
        } else {
          cell = { raw: rawValue, resolved: String(rawValue), status: 'ok' };
        }
        break;
      }

      case 'number':
      case 'date':
        cell = coerceFieldType(field.type, rawValue);
        break;

      default:
        cell = { raw: rawValue, resolved: rawValue, status: 'ok' };
    }

    if (cell.status === 'error') errorCount++;
    cells[field.code] = cell;
  }

  return {
    index: rowIndex,
    cells,
    status: errorCount > 0 ? 'error' : 'valid',
    errorCount,
  };
}

/** Build the final submission data from resolved cells */
export function buildSubmissionData(row: ResolvedRow): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [code, cell] of Object.entries(row.cells)) {
    if (cell.resolved !== null && cell.resolved !== undefined) {
      data[code] = cell.resolved;
    }
  }
  return data;
}
