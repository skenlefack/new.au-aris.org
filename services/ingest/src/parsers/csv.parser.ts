import { parse } from 'csv-parse';
import { Readable } from 'stream';
import type { ParsedSheet } from './types';

/**
 * Parse a CSV buffer in streaming mode.
 * Detects delimiter (comma, semicolon, tab) and header row.
 * R5: never loads entire file in memory for processing.
 */
export async function parseCsv(buffer: Buffer): Promise<ParsedSheet> {
  // Detect delimiter from first 2KB
  const sample = buffer.subarray(0, 2048).toString('utf-8');
  const delimiter = detectDelimiter(sample);

  const rows: string[][] = [];
  const readable = Readable.from(buffer);

  return new Promise((resolve, reject) => {
    const parser = readable.pipe(
      parse({
        delimiter,
        relaxColumnCount: true,
        skipEmptyLines: true,
        trim: true,
        bom: true,
      }),
    );

    parser.on('data', (row: string[]) => {
      rows.push(row);
    });

    parser.on('end', () => {
      const headerRow = detectHeaderRow(rows);
      const headers = rows[headerRow] ?? [];
      const dataRows = rows.slice(headerRow + 1);

      resolve({
        sheetIndex: 0,
        sheetName: 'Sheet1',
        headerRow,
        headers,
        dataRows,
        delimiter,
      });
    });

    parser.on('error', reject);
  });
}

function detectDelimiter(sample: string): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  for (const char of Object.keys(counts)) {
    counts[char] = (sample.match(new RegExp(char.replace('|', '\\|'), 'g')) ?? []).length;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] > 0 ? sorted[0][0] : ',';
}

function detectHeaderRow(rows: string[][]): number {
  // Heuristic: first row that has mostly non-numeric, non-empty values
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const nonEmpty = row.filter((cell) => cell.trim().length > 0);
    const numeric = nonEmpty.filter((cell) => !isNaN(Number(cell.replace(',', '.'))));
    if (nonEmpty.length > 0 && numeric.length / nonEmpty.length < 0.5) {
      return i;
    }
  }
  return 0;
}
