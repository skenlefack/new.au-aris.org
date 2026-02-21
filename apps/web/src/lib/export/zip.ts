/**
 * Create a ZIP file from multiple items and download it.
 */
export interface ZipEntry {
  filename: string;
  content: string | Blob;
}

export async function exportToZip(
  entries: ZipEntry[],
  zipFilename: string,
): Promise<void> {
  const { default: JSZip } = await import('jszip');

  const zip = new JSZip();

  for (const entry of entries) {
    if (entry.content instanceof Blob) {
      zip.file(entry.filename, entry.content);
    } else {
      zip.file(entry.filename, entry.content);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${zipFilename}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Helper: generate CSV content as string (for adding to ZIP).
 */
export function generateCsvString<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T | ((row: T) => string | number); header: string }[],
): string {
  const header = columns.map((c) => escapeCsvValue(c.header)).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value =
          typeof col.key === 'function' ? col.key(row) : row[col.key];
        return escapeCsvValue(String(value ?? ''));
      })
      .join(','),
  );
  return '\uFEFF' + [header, ...rows].join('\r\n');
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
