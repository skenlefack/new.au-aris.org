import type { ParsedSheet } from './types';

/**
 * Parse a JSON file into a flat tabular structure.
 * Handles: arrays of objects, nested objects (flattened with dot notation).
 */
export function parseJson(buffer: Buffer): ParsedSheet {
  const raw = JSON.parse(buffer.toString('utf-8'));

  // Determine the array to process
  const array: Record<string, unknown>[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null
      ? findFirstArray(raw as Record<string, unknown>) ?? [raw as Record<string, unknown>]
      : [];

  if (array.length === 0) {
    return { sheetIndex: 0, sheetName: 'data', headerRow: 0, headers: [], dataRows: [] };
  }

  // Flatten nested objects
  const flatRows = array.map((obj) => flattenObject(obj));

  // Collect all unique keys
  const headerSet = new Set<string>();
  for (const row of flatRows) {
    for (const key of Object.keys(row)) headerSet.add(key);
  }
  const headers = Array.from(headerSet);

  // Convert to string arrays
  const dataRows = flatRows.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (val instanceof Date) return val.toISOString().split('T')[0];
      return String(val);
    }),
  );

  return { sheetIndex: 0, sheetName: 'data', headerRow: 0, headers, dataRows };
}

function findFirstArray(obj: Record<string, unknown>): Record<string, unknown>[] | null {
  for (const value of Object.values(obj)) {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      return value as Record<string, unknown>[];
    }
  }
  return null;
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}
