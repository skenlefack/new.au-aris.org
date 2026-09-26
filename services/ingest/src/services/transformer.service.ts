import { createHash } from 'crypto';

/**
 * Transformation types applicable to source values during ingestion.
 */
export interface TransformRule {
  type: 'date_format' | 'unit_convert' | 'ref_lookup' | 'constant' | 'split' | 'trim' | 'number_parse';
  params?: Record<string, unknown>;
}

/**
 * Apply a transformation chain to a raw cell value.
 */
export function applyTransformations(value: string, rules: TransformRule[]): unknown {
  let result: unknown = value;

  for (const rule of rules) {
    switch (rule.type) {
      case 'trim':
        result = typeof result === 'string' ? result.trim() : result;
        break;

      case 'date_format':
        result = parseDate(typeof result === 'string' ? result : String(result));
        break;

      case 'number_parse':
        result = parseNumber(typeof result === 'string' ? result : String(result));
        break;

      case 'constant':
        result = rule.params?.value ?? result;
        break;

      case 'split': {
        const sep = (rule.params?.separator as string) ?? ',';
        const idx = (rule.params?.index as number) ?? 0;
        if (typeof result === 'string') {
          const parts = result.split(sep);
          result = parts[idx]?.trim() ?? result;
        }
        break;
      }

      case 'ref_lookup':
        // Ref lookup is a pass-through — the value is used as-is for matching against referential
        // Actual lookup happens at validation time in Collecte
        break;

      case 'unit_convert': {
        const factor = (rule.params?.factor as number) ?? 1;
        const numVal = typeof result === 'number' ? result : parseNumber(String(result));
        result = numVal !== null ? numVal * factor : result;
        break;
      }
    }
  }

  return result;
}

/**
 * Parse a date string in various formats to ISO YYYY-MM-DD.
 * Handles: ISO, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, MM/DD/YYYY.
 */
export function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    const year = parseInt(dmy[3], 10);
    // Heuristic: if first number > 12, it's day-first
    if (day > 12 || month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    // Could be MM/DD/YYYY
    return `${year}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
  }

  // YYYY/MM/DD
  const ymd = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymd) {
    return `${ymd[1]}-${String(parseInt(ymd[2], 10)).padStart(2, '0')}-${String(parseInt(ymd[3], 10)).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Parse a number string, handling comma as decimal separator.
 */
export function parseNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, '');
  if (!trimmed) return null;

  // Handle comma as decimal separator (European convention)
  const normalized = trimmed.replace(',', '.');
  const num = Number(normalized);
  return isNaN(num) ? null : num;
}

/**
 * Compute an idempotency key for a data row (R4).
 * Hash based on campaign + template + key field values.
 */
export function computeIdempotencyKey(
  campaignId: string,
  templateId: string,
  rowData: Record<string, unknown>,
  keyFields?: string[],
): string {
  const fields = keyFields && keyFields.length > 0
    ? keyFields
    : Object.keys(rowData).sort();

  const parts = [campaignId, templateId, ...fields.map((f) => String(rowData[f] ?? ''))];
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

/**
 * Transform a source row into a submission data object using field mappings.
 */
export function transformRow(
  sourceRow: string[],
  headers: string[],
  fieldMappings: Array<{
    sourceColumn: string;
    targetFieldCode: string;
    transformation?: { type: string; params?: Record<string, unknown> } | null;
  }>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const mapping of fieldMappings) {
    const colIdx = headers.indexOf(mapping.sourceColumn);
    if (colIdx === -1) continue;

    const rawValue = sourceRow[colIdx] ?? '';
    if (!rawValue.trim()) continue;

    const rules: TransformRule[] = [];
    rules.push({ type: 'trim' });

    if (mapping.transformation) {
      rules.push(mapping.transformation as TransformRule);
    }

    result[mapping.targetFieldCode] = applyTransformations(rawValue, rules);
  }

  return result;
}
