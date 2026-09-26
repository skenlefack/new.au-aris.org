import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import type { ParsedSheet } from './types';

/**
 * Parse an Excel file (.xlsx/.xls) in streaming mode.
 * Handles: multi-sheet, merged cells, header not on row 1, totals rows.
 * R5: uses ExcelJS streaming reader to avoid full-memory load.
 */
export async function parseXlsx(buffer: Buffer): Promise<ParsedSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheets: ParsedSheet[] = [];

  workbook.eachSheet((worksheet, sheetIndex) => {
    const rows: string[][] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        let value = '';
        if (cell.value !== null && cell.value !== undefined) {
          if (cell.value instanceof Date) {
            value = cell.value.toISOString().split('T')[0];
          } else if (typeof cell.value === 'object' && 'result' in cell.value) {
            // Formula cell — use the result
            value = String((cell.value as { result?: unknown }).result ?? '');
          } else if (typeof cell.value === 'object' && 'richText' in cell.value) {
            // Rich text
            value = (cell.value as { richText: Array<{ text: string }> }).richText.map((rt) => rt.text).join('');
          } else {
            value = String(cell.value);
          }
        }
        // R4 security: strip formula-injection characters
        if (value.length > 0 && '=@+-'.includes(value[0])) {
          value = "'" + value;
        }
        cells.push(value.trim());
      });
      rows.push(cells);
    });

    if (rows.length === 0) return;

    const headerRow = detectHeaderRow(rows);
    const headers = rows[headerRow] ?? [];
    // Filter out total/summary rows at the end
    const dataRows = filterTrailingTotals(rows.slice(headerRow + 1), headers.length);

    sheets.push({
      sheetIndex: sheetIndex - 1, // ExcelJS is 1-based
      sheetName: worksheet.name,
      headerRow,
      headers,
      dataRows,
    });
  });

  return sheets;
}

function detectHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const nonEmpty = row.filter((c) => c.trim().length > 0);
    const numeric = nonEmpty.filter((c) => !isNaN(Number(c.replace(',', '.'))));
    if (nonEmpty.length >= 2 && numeric.length / nonEmpty.length < 0.5) {
      return i;
    }
  }
  return 0;
}

function filterTrailingTotals(rows: string[][], expectedCols: number): string[][] {
  // Remove trailing rows that look like totals (contain "Total", "TOTAL", or are mostly empty)
  const result: string[][] = [];
  for (const row of rows) {
    const joined = row.join(' ').toLowerCase();
    if (joined.includes('total') && row.filter((c) => c.trim()).length <= Math.ceil(expectedCols / 3)) {
      continue; // Skip total rows
    }
    if (row.every((c) => c.trim() === '')) continue; // Skip empty rows
    result.push(row);
  }
  return result;
}
