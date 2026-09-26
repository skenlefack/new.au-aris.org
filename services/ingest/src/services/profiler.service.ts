import { createHash } from 'crypto';
import type { ParsedSheet, ColumnStats } from '../parsers/types';

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,               // ISO: 2024-01-15
  /^\d{2}\/\d{2}\/\d{4}$/,             // DD/MM/YYYY or MM/DD/YYYY
  /^\d{2}-\d{2}-\d{4}$/,               // DD-MM-YYYY
  /^\d{2}\.\d{2}\.\d{4}$/,             // DD.MM.YYYY
  /^\d{4}\/\d{2}\/\d{2}$/,             // YYYY/MM/DD
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[\+]?[\d\s\-\(\)]{7,20}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COORD_PATTERN = /^-?\d{1,3}\.\d{3,}$/;

/**
 * Profile columns of a parsed sheet: infer types, compute stats, detect patterns.
 */
export function profileColumns(sheet: ParsedSheet): ColumnStats[] {
  const { headers, dataRows } = sheet;
  const stats: ColumnStats[] = [];

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const rawName = headers[colIdx] ?? `column_${colIdx}`;
    const values = dataRows.map((row) => row[colIdx] ?? '');

    const nonEmpty = values.filter((v) => v.trim().length > 0);
    const cardinality = new Set(nonEmpty).size;
    const nullRate = values.length > 0 ? (values.length - nonEmpty.length) / values.length : 1;

    const lengths = nonEmpty.map((v) => v.length);
    const minLength = lengths.length > 0 ? Math.min(...lengths) : null;
    const maxLength = lengths.length > 0 ? Math.max(...lengths) : null;

    const inferredType = inferType(nonEmpty);
    const detectedPatterns = detectPatterns(nonEmpty);

    // Sample: up to 5 unique non-empty values
    const uniqueVals = Array.from(new Set(nonEmpty));
    const sampleValues = uniqueVals.slice(0, 5);

    stats.push({
      rawName,
      normalizedName: normalizeName(rawName),
      inferredType,
      cardinality,
      nullRate: Math.round(nullRate * 10000) / 10000,
      minLength,
      maxLength,
      sampleValues,
      detectedPatterns,
    });
  }

  return stats;
}

/**
 * Compute a structural hash of a sheet (column names + types).
 */
export function computeStructureHash(columns: ColumnStats[]): string {
  const signature = columns.map((c) => `${c.normalizedName}:${c.inferredType}`).join('|');
  return createHash('sha256').update(signature).digest('hex');
}

/**
 * Normalize a column name: lowercase, trim, replace whitespace/special chars with underscore.
 */
export function normalizeName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\u0600-\u06FF]/gi, '_') // keep accented & arabic chars
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function inferType(values: string[]): string {
  if (values.length === 0) return 'unknown';

  const sample = values.slice(0, 200); // Sample for performance

  // Check date first (per ARIS convention: date patterns → type 'date')
  const dateCount = sample.filter((v) => DATE_PATTERNS.some((p) => p.test(v.trim()))).length;
  if (dateCount / sample.length > 0.7) return 'date';

  // Check numeric (integer or decimal, handle comma as decimal separator)
  const numericCount = sample.filter((v) => {
    const normalized = v.replace(/\s/g, '').replace(',', '.');
    return !isNaN(Number(normalized)) && normalized.length > 0;
  }).length;
  if (numericCount / sample.length > 0.8) {
    const hasDecimal = sample.some((v) => v.includes('.') || v.includes(','));
    return hasDecimal ? 'decimal' : 'integer';
  }

  // Check boolean
  const boolValues = new Set(['true', 'false', 'yes', 'no', 'oui', 'non', '0', '1', 'y', 'n']);
  const boolCount = sample.filter((v) => boolValues.has(v.trim().toLowerCase())).length;
  if (boolCount / sample.length > 0.8) return 'boolean';

  // Check email
  const emailCount = sample.filter((v) => EMAIL_PATTERN.test(v.trim())).length;
  if (emailCount / sample.length > 0.7) return 'email';

  // Check phone
  const phoneCount = sample.filter((v) => PHONE_PATTERN.test(v.trim())).length;
  if (phoneCount / sample.length > 0.7) return 'phone';

  // Check coordinate
  const coordCount = sample.filter((v) => COORD_PATTERN.test(v.trim())).length;
  if (coordCount / sample.length > 0.7) return 'coordinate';

  // Check UUID
  const uuidCount = sample.filter((v) => UUID_PATTERN.test(v.trim())).length;
  if (uuidCount / sample.length > 0.7) return 'uuid';

  // Default text, with cardinality heuristic for select/enum
  const cardinality = new Set(sample).size;
  if (cardinality <= 20 && sample.length > 10) return 'select';

  return 'text';
}

function detectPatterns(values: string[]): string[] {
  const patterns: string[] = [];
  const sample = values.slice(0, 50);

  if (sample.some((v) => DATE_PATTERNS.some((p) => p.test(v.trim())))) {
    patterns.push('date');
  }
  if (sample.some((v) => EMAIL_PATTERN.test(v.trim()))) {
    patterns.push('email');
  }
  if (sample.some((v) => PHONE_PATTERN.test(v.trim()))) {
    patterns.push('phone');
  }

  // Detect mixed date formats
  const dateFormats = new Set<string>();
  for (const v of sample) {
    const trimmed = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) dateFormats.add('ISO');
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) dateFormats.add('DD/MM/YYYY');
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) dateFormats.add('DD-MM-YYYY');
  }
  if (dateFormats.size > 1) patterns.push('mixed_date_formats');

  return patterns;
}
