/**
 * FAOSTAT CSV builder — generates CSV files compatible with FAOSTAT data format.
 * Output includes UTF-8 BOM for Excel compatibility.
 */

export interface FaostatCsvRow {
  area: string;
  item: string;
  element: string;
  unit: string;
  year: number;
  value: number;
}

const CSV_HEADERS = ['Area', 'Item', 'Element', 'Unit', 'Year', 'Value'];
const UTF8_BOM = '\uFEFF';

/**
 * Escape a CSV field value. Wraps in double-quotes if the value contains
 * a comma, double-quote, or newline.
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Build a FAOSTAT-compatible CSV string from rows.
 * Returns a UTF-8 string with BOM for Excel compatibility.
 */
export function buildFaostatCsv(rows: FaostatCsvRow[]): string {
  const lines: string[] = [CSV_HEADERS.join(',')];

  for (const row of rows) {
    const fields = [
      escapeCsvField(row.area),
      escapeCsvField(row.item),
      escapeCsvField(row.element),
      escapeCsvField(row.unit),
      String(row.year),
      String(row.value),
    ];
    lines.push(fields.join(','));
  }

  return UTF8_BOM + lines.join('\r\n') + '\r\n';
}
