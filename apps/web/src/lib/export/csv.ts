/**
 * Export tabular data to a CSV file.
 *
 * @param data - Array of objects (rows)
 * @param columns - Column definitions with key and header label
 * @param filename - Download filename (without extension)
 */
export interface CsvColumn<T> {
  key: keyof T | ((row: T) => string | number);
  header: string;
}

export function exportToCsv<T extends Record<string, unknown>>(
  data: T[],
  columns: CsvColumn<T>[],
  filename: string,
): void {
  // Build header row
  const header = columns.map((c) => escapeCsvValue(c.header)).join(',');

  // Build data rows
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value =
          typeof col.key === 'function' ? col.key(row) : row[col.key];
        return escapeCsvValue(String(value ?? ''));
      })
      .join(','),
  );

  // Add BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF';
  const csv = bom + [header, ...rows].join('\r\n');

  downloadBlob(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
