/**
 * Lightweight CSV parser for master-data imports.
 * Handles quoted fields, escaped quotes, and CRLF/LF line endings.
 */

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: { row: number; message: string }[];
}

export function parseCsv(content: string): CsvParseResult {
  const errors: { row: number; message: string }[] = [];
  const trimmed = content.trim();

  if (trimmed === '') {
    return { headers: [], rows: [], errors: [{ row: 0, message: 'Empty CSV content' }] };
  }

  const lines = splitLines(trimmed);

  if (lines.length === 0) {
    return { headers: [], rows: [], errors: [{ row: 0, message: 'Empty CSV content' }] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  if (headers.length === 0) {
    return { headers: [], rows: [], errors: [{ row: 1, message: 'No headers found' }] };
  }

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;

    const values = parseCsvLine(line);
    if (values.length !== headers.length) {
      errors.push({
        row: i + 1,
        message: `Expected ${headers.length} columns, got ${values.length}`,
      });
      continue;
    }

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j].trim();
    }
    rows.push(row);
  }

  return { headers, rows, errors };
}

function splitLines(content: string): string[] {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  fields.push(current);
  return fields;
}

export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const escapeCsvField = (value: unknown): string => {
    const str = value === null || value === undefined ? '' : String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCsvField).join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvField(row[h])).join(','),
  );

  return [headerLine, ...dataLines].join('\n');
}

// -- Schema validators per referential type --

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const REQUIRED_GEO_FIELDS = ['code', 'name', 'name_en', 'name_fr', 'level', 'country_code'];
const VALID_GEO_LEVELS = ['COUNTRY', 'ADMIN1', 'ADMIN2', 'ADMIN3', 'SPECIAL_ZONE'];

const REQUIRED_SPECIES_FIELDS = ['code', 'scientific_name', 'common_name_en', 'common_name_fr', 'category'];
const VALID_SPECIES_CATEGORIES = ['DOMESTIC', 'WILDLIFE', 'AQUATIC', 'APICULTURE'];

const REQUIRED_DISEASE_FIELDS = ['code', 'name_en', 'name_fr'];

const REQUIRED_UNIT_FIELDS = ['code', 'name_en', 'name_fr', 'symbol', 'category'];
const VALID_UNIT_CATEGORIES = ['COUNT', 'WEIGHT', 'VOLUME', 'AREA', 'LENGTH', 'DOSE', 'CURRENCY', 'PROPORTION', 'TIME'];

const REQUIRED_IDENTIFIER_FIELDS = ['code', 'name_en', 'name_fr', 'type'];
const VALID_IDENTIFIER_TYPES = ['LAB', 'MARKET', 'BORDER_POINT', 'PROTECTED_AREA', 'SLAUGHTERHOUSE', 'QUARANTINE_STATION'];

const REQUIRED_DENOMINATOR_FIELDS = ['country_code', 'species_code', 'year', 'source', 'population'];
const VALID_DENOMINATOR_SOURCES = ['FAOSTAT', 'NATIONAL_CENSUS', 'ESTIMATE'];

export function validateGeoRow(row: Record<string, string>): ValidationResult {
  return validateRow(row, REQUIRED_GEO_FIELDS, { level: VALID_GEO_LEVELS });
}

export function validateSpeciesRow(row: Record<string, string>): ValidationResult {
  return validateRow(row, REQUIRED_SPECIES_FIELDS, { category: VALID_SPECIES_CATEGORIES });
}

export function validateDiseaseRow(row: Record<string, string>): ValidationResult {
  return validateRow(row, REQUIRED_DISEASE_FIELDS);
}

export function validateUnitRow(row: Record<string, string>): ValidationResult {
  return validateRow(row, REQUIRED_UNIT_FIELDS, { category: VALID_UNIT_CATEGORIES });
}

export function validateIdentifierRow(row: Record<string, string>): ValidationResult {
  return validateRow(row, REQUIRED_IDENTIFIER_FIELDS, { type: VALID_IDENTIFIER_TYPES });
}

export function validateDenominatorRow(row: Record<string, string>): ValidationResult {
  const result = validateRow(row, REQUIRED_DENOMINATOR_FIELDS, { source: VALID_DENOMINATOR_SOURCES });
  if (row['year'] && isNaN(parseInt(row['year'], 10))) {
    result.valid = false;
    result.errors.push('year must be a number');
  }
  if (row['population'] && isNaN(parseInt(row['population'], 10))) {
    result.valid = false;
    result.errors.push('population must be a number');
  }
  return result;
}

function validateRow(
  row: Record<string, string>,
  requiredFields: string[],
  enumFields?: Record<string, string[]>,
): ValidationResult {
  const errors: string[] = [];

  for (const field of requiredFields) {
    if (!row[field] || row[field].trim() === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (enumFields) {
    for (const [field, validValues] of Object.entries(enumFields)) {
      if (row[field] && !validValues.includes(row[field].toUpperCase())) {
        errors.push(`Invalid ${field}: "${row[field]}". Must be one of: ${validValues.join(', ')}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
