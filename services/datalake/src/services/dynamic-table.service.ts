import type { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { parse as csvParse } from 'csv-parse/sync';
import type { ColumnInfo } from './file-analyzer.service';

const HISTORICAL_SCHEMA = 'historical';
const BATCH_SIZE = 500;

interface TableColumn {
  pgColumnName: string;
  dataType: string;
  nullable: boolean;
}

/**
 * Creates and manages dynamic PostgreSQL tables in the "historical" schema
 * for imported datasets.
 */
export class DynamicTableService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Ensures the "historical" schema exists in PostgreSQL.
   */
  async ensureSchema(): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS "${HISTORICAL_SCHEMA}"`,
    );
  }

  /**
   * Creates a table in the historical schema with columns derived from analysis.
   */
  async createTable(
    tableName: string,
    columns: ColumnInfo[],
  ): Promise<void> {
    await this.ensureSchema();

    const colDefs = columns.map((col) => {
      const pgType = this.mapToPgType(col.dataType);
      const nullConstraint = col.nullable ? '' : ' NOT NULL';
      return `"${col.pgColumnName ?? this.toPgName(col.name)}" ${pgType}${nullConstraint}`;
    });

    // Add a serial ID column
    colDefs.unshift('"_row_id" SERIAL PRIMARY KEY');
    // Add metadata columns
    colDefs.push('"_imported_at" TIMESTAMPTZ DEFAULT NOW()');

    const safeTableName = this.sanitizeTableName(tableName);
    const ddl = `CREATE TABLE IF NOT EXISTS "${HISTORICAL_SCHEMA}"."${safeTableName}" (\n  ${colDefs.join(',\n  ')}\n)`;

    await this.prisma.$executeRawUnsafe(ddl);
  }

  /**
   * Loads data from a buffer into the dynamic table.
   * Returns the number of rows inserted.
   */
  async loadData(
    tableName: string,
    buffer: Buffer,
    fileName: string,
    columns: TableColumn[],
  ): Promise<number> {
    const ext = this.getExtension(fileName);
    let rows: Record<string, unknown>[];

    switch (ext) {
      case 'xlsx':
      case 'xls': {
        const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('No sheets in workbook');
        rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]!, {
          defval: null,
          raw: false,
        });
        break;
      }
      case 'csv':
      case 'tsv': {
        const content = buffer.toString('utf-8');
        rows = csvParse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          delimiter: ext === 'tsv' ? '\t' : ',',
          relax_column_count: true,
        });
        break;
      }
      case 'json': {
        const parsed = JSON.parse(buffer.toString('utf-8'));
        if (Array.isArray(parsed)) {
          rows = parsed;
        } else if (parsed?.data && Array.isArray(parsed.data)) {
          rows = parsed.data;
        } else {
          rows = [parsed];
        }
        break;
      }
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }

    if (rows.length === 0) return 0;

    const safeTableName = this.sanitizeTableName(tableName);

    // Build a mapping from original column name to pg column name
    const colMap = new Map<string, TableColumn>();
    for (const col of columns) {
      colMap.set(col.pgColumnName, col);
    }

    // Get ordered pg column names
    const pgCols = columns.map((c) => c.pgColumnName);

    // Insert in batches
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const valueSets: string[] = [];

      for (const row of batch) {
        const vals: string[] = [];
        for (const col of columns) {
          // Find the value by trying both pgColumnName and original keys
          let rawVal = row[col.pgColumnName];
          if (rawVal === undefined) {
            // Try original column names (case-insensitive match)
            for (const key of Object.keys(row)) {
              if (this.toPgName(key) === col.pgColumnName) {
                rawVal = row[key];
                break;
              }
            }
          }
          vals.push(this.escapeValue(rawVal, col.dataType));
        }
        valueSets.push(`(${vals.join(', ')})`);
      }

      const insertSql = `INSERT INTO "${HISTORICAL_SCHEMA}"."${safeTableName}" (${pgCols.map((c) => `"${c}"`).join(', ')}) VALUES ${valueSets.join(', ')}`;

      await this.prisma.$executeRawUnsafe(insertSql);
      totalInserted += batch.length;
    }

    return totalInserted;
  }

  /**
   * Queries the dynamic table with pagination, filtering, sorting.
   */
  async queryTable(
    tableName: string,
    options: {
      page?: number;
      limit?: number;
      sort?: string;
      order?: 'asc' | 'desc';
      filters?: Record<string, string>;
      search?: string;
      searchColumns?: string[];
    },
  ): Promise<{ data: unknown[]; meta: { total: number; page: number; limit: number } }> {
    const safeTable = this.sanitizeTableName(tableName);
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 1000);
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    if (options.filters) {
      for (const [col, val] of Object.entries(options.filters)) {
        const safeCol = this.toPgName(col);
        whereClauses.push(`"${safeCol}"::text ILIKE ${this.escapeString(`%${val}%`)}`);
      }
    }
    if (options.search && options.searchColumns && options.searchColumns.length > 0) {
      const searchClauses = options.searchColumns
        .map((c) => `"${this.toPgName(c)}"::text ILIKE ${this.escapeString(`%${options.search}%`)}`)
        .join(' OR ');
      whereClauses.push(`(${searchClauses})`);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sortCol = options.sort ? `"${this.toPgName(options.sort)}"` : '"_row_id"';
    const sortOrder = options.order === 'desc' ? 'DESC' : 'ASC';

    const countSql = `SELECT COUNT(*)::int as count FROM "${HISTORICAL_SCHEMA}"."${safeTable}" ${whereStr}`;
    const countResult: Array<{ count: number }> = await this.prisma.$queryRawUnsafe(countSql);
    const total = countResult[0]?.count ?? 0;

    const dataSql = `SELECT * FROM "${HISTORICAL_SCHEMA}"."${safeTable}" ${whereStr} ORDER BY ${sortCol} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`;
    const data: unknown[] = await this.prisma.$queryRawUnsafe(dataSql);

    return { data, meta: { total, page, limit } };
  }

  /**
   * Gets aggregation data for a specific column.
   */
  async aggregate(
    tableName: string,
    columnName: string,
    operation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distribution',
    groupBy?: string,
  ): Promise<unknown[]> {
    const safeTable = this.sanitizeTableName(tableName);
    const safeCol = this.toPgName(columnName);

    if (operation === 'distribution') {
      const sql = groupBy
        ? `SELECT "${this.toPgName(groupBy)}" as label, COUNT(*)::int as value FROM "${HISTORICAL_SCHEMA}"."${safeTable}" GROUP BY "${this.toPgName(groupBy)}" ORDER BY value DESC LIMIT 50`
        : `SELECT "${safeCol}"::text as label, COUNT(*)::int as value FROM "${HISTORICAL_SCHEMA}"."${safeTable}" GROUP BY "${safeCol}" ORDER BY value DESC LIMIT 50`;
      return this.prisma.$queryRawUnsafe(sql);
    }

    const aggFn = operation.toUpperCase();
    if (groupBy) {
      const safeGroup = this.toPgName(groupBy);
      const sql = `SELECT "${safeGroup}" as label, ${aggFn}("${safeCol}")::float as value FROM "${HISTORICAL_SCHEMA}"."${safeTable}" GROUP BY "${safeGroup}" ORDER BY value DESC LIMIT 100`;
      return this.prisma.$queryRawUnsafe(sql);
    }

    const sql = `SELECT ${aggFn}("${safeCol}")::float as value FROM "${HISTORICAL_SCHEMA}"."${safeTable}"`;
    return this.prisma.$queryRawUnsafe(sql);
  }

  /**
   * Gets time-series data from a date column and a value column.
   */
  async timeSeries(
    tableName: string,
    dateColumn: string,
    valueColumn: string,
    interval: 'day' | 'week' | 'month' | 'year',
    operation: 'count' | 'sum' | 'avg' = 'count',
  ): Promise<unknown[]> {
    const safeTable = this.sanitizeTableName(tableName);
    const safeDate = this.toPgName(dateColumn);
    const safeValue = this.toPgName(valueColumn);
    const aggFn = operation.toUpperCase();

    const truncFn = interval === 'week' ? 'week' : interval;

    const sql = `
      SELECT
        DATE_TRUNC('${truncFn}', "${safeDate}"::timestamp) as period,
        ${aggFn}("${safeValue}"::numeric)::float as value
      FROM "${HISTORICAL_SCHEMA}"."${safeTable}"
      WHERE "${safeDate}" IS NOT NULL
      GROUP BY period
      ORDER BY period ASC
    `;

    return this.prisma.$queryRawUnsafe(sql);
  }

  /**
   * Drops a dynamic table.
   */
  async dropTable(tableName: string): Promise<void> {
    const safeTable = this.sanitizeTableName(tableName);
    await this.prisma.$executeRawUnsafe(
      `DROP TABLE IF EXISTS "${HISTORICAL_SCHEMA}"."${safeTable}" CASCADE`,
    );
  }

  private mapToPgType(dataType: string): string {
    switch (dataType) {
      case 'INTEGER': return 'BIGINT';
      case 'FLOAT': return 'DOUBLE PRECISION';
      case 'DATE': return 'TIMESTAMPTZ';
      case 'BOOLEAN': return 'BOOLEAN';
      case 'JSON': return 'JSONB';
      default: return 'TEXT';
    }
  }

  private escapeValue(value: unknown, dataType: string): string {
    if (value === null || value === undefined || value === '') return 'NULL';
    const str = String(value);
    if (str.trim() === '') return 'NULL';

    switch (dataType) {
      case 'BIGINT':
      case 'DOUBLE PRECISION': {
        const num = Number(str);
        return isNaN(num) ? 'NULL' : String(num);
      }
      case 'BOOLEAN':
        return str === 'true' || str === '1' ? 'TRUE' : 'FALSE';
      case 'TIMESTAMPTZ': {
        const d = new Date(str);
        return isNaN(d.getTime()) ? 'NULL' : `'${d.toISOString()}'`;
      }
      case 'JSONB':
        return `'${str.replace(/'/g, "''")}'::jsonb`;
      default:
        return this.escapeString(str);
    }
  }

  private escapeString(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  private sanitizeTableName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 63);
  }

  private toPgName(name: string): string {
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
