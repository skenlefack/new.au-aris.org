import * as XLSX from 'xlsx';
import { parse as csvParse } from 'csv-parse/sync';

export interface ColumnInfo {
  name: string;
  originalName: string;
  dataType: 'TEXT' | 'INTEGER' | 'FLOAT' | 'DATE' | 'BOOLEAN' | 'JSON';
  pgColumnName: string;
  nullable: boolean;
  ordinal: number;
  sampleValues: unknown[];
  stats: {
    nullCount: number;
    uniqueCount: number;
    min?: unknown;
    max?: unknown;
  };
}

export interface AnalysisResult {
  columns: ColumnInfo[];
  rowCount: number;
  preview: Record<string, unknown>[];
  fileType: string;
}

const SAMPLE_SIZE = 100;
const MAX_ROWS_ANALYSIS = 10000;

/**
 * Analyzes uploaded files (xlsx, csv, json) to detect schema and preview data.
 */
export class FileAnalyzerService {
  analyzeBuffer(buffer: Buffer, fileName: string): AnalysisResult {
    const ext = this.getExtension(fileName);

    switch (ext) {
      case 'xlsx':
      case 'xls':
        return this.analyzeExcel(buffer);
      case 'csv':
      case 'tsv':
        return this.analyzeCsv(buffer, ext === 'tsv' ? '\t' : ',');
      case 'json':
        return this.analyzeJson(buffer);
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  private analyzeExcel(buffer: Buffer): AnalysisResult {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('Excel file has no sheets');

    const sheet = workbook.Sheets[sheetName]!;
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
      raw: false,
    });

    return this.analyzeRows(rows.slice(0, MAX_ROWS_ANALYSIS), rows.length, 'xlsx');
  }

  private analyzeCsv(buffer: Buffer, delimiter: string): AnalysisResult {
    const content = buffer.toString('utf-8');
    const rows: Record<string, string>[] = csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter,
      relax_column_count: true,
    });

    return this.analyzeRows(rows.slice(0, MAX_ROWS_ANALYSIS), rows.length, 'csv');
  }

  private analyzeJson(buffer: Buffer): AnalysisResult {
    const content = buffer.toString('utf-8');
    const parsed = JSON.parse(content);

    let rows: Record<string, unknown>[];
    if (Array.isArray(parsed)) {
      rows = parsed;
    } else if (parsed && typeof parsed === 'object' && 'data' in parsed && Array.isArray(parsed.data)) {
      rows = parsed.data;
    } else {
      rows = [parsed];
    }

    return this.analyzeRows(rows.slice(0, MAX_ROWS_ANALYSIS), rows.length, 'json');
  }

  private analyzeRows(
    rows: Record<string, unknown>[],
    totalCount: number,
    fileType: string,
  ): AnalysisResult {
    if (rows.length === 0) {
      return { columns: [], rowCount: 0, preview: [], fileType };
    }

    // Collect all column names across all rows
    const colNames = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        colNames.add(key);
      }
    }

    const columns: ColumnInfo[] = [];
    let ordinal = 0;

    for (const colName of colNames) {
      const values = rows.map((r) => r[colName]);
      const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '');
      const uniqueSet = new Set(nonNullValues.map(String));

      const detectedType = this.detectType(nonNullValues);

      const stats: ColumnInfo['stats'] = {
        nullCount: values.length - nonNullValues.length,
        uniqueCount: uniqueSet.size,
      };

      if (detectedType === 'INTEGER' || detectedType === 'FLOAT') {
        const nums = nonNullValues.map(Number).filter((n) => !isNaN(n));
        if (nums.length > 0) {
          stats.min = Math.min(...nums);
          stats.max = Math.max(...nums);
        }
      } else if (detectedType === 'DATE') {
        const dates = nonNullValues
          .map((v) => new Date(String(v)))
          .filter((d) => !isNaN(d.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());
        if (dates.length > 0) {
          stats.min = dates[0]!.toISOString();
          stats.max = dates[dates.length - 1]!.toISOString();
        }
      }

      // Collect sample values (up to 5)
      const sampleValues = nonNullValues
        .slice(0, 5)
        .map((v) => (typeof v === 'object' ? JSON.stringify(v) : v));

      columns.push({
        name: colName,
        originalName: colName,
        dataType: detectedType,
        pgColumnName: this.toPgColumnName(colName),
        nullable: stats.nullCount > 0,
        ordinal,
        sampleValues,
        stats,
      });

      ordinal++;
    }

    const preview = rows.slice(0, SAMPLE_SIZE);

    return {
      columns,
      rowCount: totalCount,
      preview,
      fileType,
    };
  }

  private detectType(values: unknown[]): ColumnInfo['dataType'] {
    if (values.length === 0) return 'TEXT';

    let intCount = 0;
    let floatCount = 0;
    let dateCount = 0;
    let boolCount = 0;

    for (const val of values.slice(0, 200)) {
      const str = String(val).trim();
      if (str === '') continue;

      if (str === 'true' || str === 'false' || str === '1' || str === '0') {
        boolCount++;
      }

      if (/^-?\d+$/.test(str) && !isNaN(parseInt(str, 10))) {
        intCount++;
      } else if (/^-?\d+\.?\d*$/.test(str) && !isNaN(parseFloat(str))) {
        floatCount++;
      }

      if (this.isDateLike(str)) {
        dateCount++;
      }
    }

    const total = Math.min(values.length, 200);
    const threshold = 0.7;

    if (boolCount / total >= 0.9) return 'BOOLEAN';
    if (intCount / total >= threshold) return 'INTEGER';
    if ((intCount + floatCount) / total >= threshold) return 'FLOAT';
    if (dateCount / total >= threshold) return 'DATE';
    return 'TEXT';
  }

  private isDateLike(str: string): boolean {
    // Common date patterns
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return true; // ISO
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(str)) return true; // DD/MM/YYYY
    if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(str)) return true; // DD-MM-YYYY
    const d = new Date(str);
    return !isNaN(d.getTime()) && str.length > 6;
  }

  private toPgColumnName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 63) || 'col';
  }

  private getExtension(fileName: string): string {
    const parts = fileName.split('.');
    return (parts[parts.length - 1] ?? '').toLowerCase();
  }
}
