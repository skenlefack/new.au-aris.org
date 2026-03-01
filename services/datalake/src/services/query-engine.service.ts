import type { PrismaClient } from '@prisma/client';

const DATALAKE_TABLE = 'datalake."data_lake_entry"';

/** Whitelist of columns that can be used in queries */
const ALLOWED_COLUMNS = [
  'source',
  'entity_type',
  'entity_id',
  'action',
  'tenant_id',
  'country_code',
  'rec_code',
  'year',
  'month',
  'week',
  'ingested_at',
] as const;

/** Whitelist of aggregate functions */
const ALLOWED_FUNCTIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] as const;

/** Whitelist of date truncation granularities */
const ALLOWED_GRANULARITY = ['day', 'week', 'month', 'quarter', 'year'] as const;

/** Regex for safe identifiers */
const SAFE_IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface AnalyticalQueryParams {
  source?: string;
  entityType?: string;
  dimensions: string[];
  measures: { field: string; function: string; alias?: string }[];
  filters?: { field: string; operator: string; value: string | number }[];
  dateRange?: { from: string; to: string };
  page?: number;
  limit?: number;
}

export interface TimeSeriesParams {
  metric: string;
  function: string;
  granularity: string;
  dateRange: { from: string; to: string };
  source?: string;
  entityType?: string;
  groupBy?: string;
}

export interface GeoQueryParams {
  bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number };
  entityType?: string;
  source?: string;
  dateRange?: { from: string; to: string };
  limit?: number;
}

export class QueryEngineService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Run an analytical query on the datalake event store.
   */
  async query(
    params: AnalyticalQueryParams,
    tenantId: string,
    tenantLevel: string,
  ): Promise<{ data: unknown[]; meta: { total: number; page: number; limit: number } }> {
    // Validate dimensions
    for (const dim of params.dimensions) {
      this.validateColumn(dim);
    }

    // Validate measures
    for (const m of params.measures) {
      if (m.field !== '*') {
        this.validateColumn(m.field);
      }
      this.validateFunction(m.function);
    }

    const selectParts: string[] = [];
    const groupParts: string[] = [];

    // Dimensions
    for (const dim of params.dimensions) {
      selectParts.push(`"${dim}"`);
      groupParts.push(`"${dim}"`);
    }

    // Measures
    for (const m of params.measures) {
      const fn = m.function.toUpperCase();
      const alias = m.alias ? this.sanitizeAlias(m.alias) : `${fn.toLowerCase()}_${m.field}`;
      if (fn === 'COUNT' && m.field === '*') {
        selectParts.push(`COUNT(*)::bigint AS "${alias}"`);
      } else {
        selectParts.push(`${fn}("${m.field}")::float AS "${alias}"`);
      }
    }

    if (selectParts.length === 0) {
      selectParts.push('COUNT(*)::bigint AS "count"');
    }

    // WHERE clauses
    const whereClauses = this.buildWhereClauses(tenantId, tenantLevel, {
      source: params.source,
      entityType: params.entityType,
      filters: params.filters,
      dateRange: params.dateRange,
    });

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const groupStr = groupParts.length > 0 ? `GROUP BY ${groupParts.join(', ')}` : '';

    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 100, 10000);
    const offset = (page - 1) * limit;

    // Count query
    let total = 0;
    if (groupParts.length > 0) {
      const countSql = `SELECT COUNT(DISTINCT (${groupParts.join(', ')}))::int AS cnt FROM ${DATALAKE_TABLE} ${whereStr}`;
      const countResult: Array<{ cnt: number }> = await this.prisma.$queryRawUnsafe(countSql);
      total = countResult[0]?.cnt ?? 0;
    } else {
      total = 1; // single aggregate row
    }

    const sql = `SELECT ${selectParts.join(', ')} FROM ${DATALAKE_TABLE} ${whereStr} ${groupStr} LIMIT ${limit} OFFSET ${offset}`;
    const data: unknown[] = await this.prisma.$queryRawUnsafe(sql);

    return { data, meta: { total, page, limit } };
  }

  /**
   * Time series query on the datalake.
   */
  async timeseries(
    params: TimeSeriesParams,
    tenantId: string,
    tenantLevel: string,
  ): Promise<{ data: unknown[] }> {
    this.validateFunction(params.function);
    this.validateGranularity(params.granularity);

    const fn = params.function.toUpperCase();
    const gran = params.granularity.toLowerCase();

    const selectParts: string[] = [
      `DATE_TRUNC('${gran}', "ingested_at") AS "period"`,
    ];
    const groupParts: string[] = ['1'];

    if (params.groupBy) {
      this.validateColumn(params.groupBy);
      selectParts.push(`"${params.groupBy}"`);
      groupParts.push(`"${params.groupBy}"`);
    }

    if (params.metric === '*' || params.metric === 'count') {
      selectParts.push(`${fn}(*)::bigint AS "value"`);
    } else {
      this.validateColumn(params.metric);
      selectParts.push(`${fn}("${params.metric}")::float AS "value"`);
    }

    const whereClauses = this.buildWhereClauses(tenantId, tenantLevel, {
      source: params.source,
      entityType: params.entityType,
      dateRange: params.dateRange,
    });

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const groupStr = `GROUP BY ${groupParts.join(', ')}`;

    const sql = `SELECT ${selectParts.join(', ')} FROM ${DATALAKE_TABLE} ${whereStr} ${groupStr} ORDER BY "period" ASC`;
    const data: unknown[] = await this.prisma.$queryRawUnsafe(sql);

    return { data };
  }

  /**
   * Geo bounding box query on the datalake.
   */
  async geo(
    params: GeoQueryParams,
    tenantId: string,
    tenantLevel: string,
  ): Promise<{ data: unknown[] }> {
    const whereClauses = this.buildWhereClauses(tenantId, tenantLevel, {
      source: params.source,
      entityType: params.entityType,
      dateRange: params.dateRange,
    });

    // Geo bounding box filter
    whereClauses.push(`"geo_point" IS NOT NULL`);
    whereClauses.push(`("geo_point"->>'lat')::float BETWEEN ${Number(params.bbox.minLat)} AND ${Number(params.bbox.maxLat)}`);
    whereClauses.push(`("geo_point"->>'lng')::float BETWEEN ${Number(params.bbox.minLng)} AND ${Number(params.bbox.maxLng)}`);

    const whereStr = `WHERE ${whereClauses.join(' AND ')}`;
    const limit = Math.min(params.limit ?? 1000, 10000);

    const sql = `SELECT "id", "source", "entity_type", "entity_id", "action", "tenant_id", "country_code", "geo_point", "year", "month", "ingested_at" FROM ${DATALAKE_TABLE} ${whereStr} ORDER BY "ingested_at" DESC LIMIT ${limit}`;
    const data: unknown[] = await this.prisma.$queryRawUnsafe(sql);

    return { data };
  }

  /**
   * Get the available schema (distinct source/entity_type combinations).
   */
  async getSchema(
    tenantId: string,
    tenantLevel: string,
  ): Promise<{ data: unknown[] }> {
    const whereClauses: string[] = [];
    if (tenantLevel !== 'CONTINENTAL') {
      whereClauses.push(`"tenant_id" = '${this.escapeUuid(tenantId)}'`);
    }
    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `SELECT DISTINCT "source", "entity_type", COUNT(*)::int AS "count" FROM ${DATALAKE_TABLE} ${whereStr} GROUP BY "source", "entity_type" ORDER BY "count" DESC`;
    const data: unknown[] = await this.prisma.$queryRawUnsafe(sql);

    return { data };
  }

  // ── Validation helpers ──

  validateColumn(col: string): void {
    if (!SAFE_IDENTIFIER_RE.test(col)) {
      throw new HttpError(400, `Invalid column name: ${col}`);
    }
    if (!ALLOWED_COLUMNS.includes(col as any)) {
      throw new HttpError(400, `Column not allowed: ${col}. Allowed: ${ALLOWED_COLUMNS.join(', ')}`);
    }
  }

  validateFunction(fn: string): void {
    if (!ALLOWED_FUNCTIONS.includes(fn.toUpperCase() as any)) {
      throw new HttpError(400, `Function not allowed: ${fn}. Allowed: ${ALLOWED_FUNCTIONS.join(', ')}`);
    }
  }

  validateGranularity(gran: string): void {
    if (!ALLOWED_GRANULARITY.includes(gran.toLowerCase() as any)) {
      throw new HttpError(400, `Granularity not allowed: ${gran}. Allowed: ${ALLOWED_GRANULARITY.join(', ')}`);
    }
  }

  private buildWhereClauses(
    tenantId: string,
    tenantLevel: string,
    opts: {
      source?: string;
      entityType?: string;
      filters?: { field: string; operator: string; value: string | number }[];
      dateRange?: { from: string; to: string };
    },
  ): string[] {
    const clauses: string[] = [];

    // Tenant scoping
    if (tenantLevel !== 'CONTINENTAL') {
      clauses.push(`"tenant_id" = '${this.escapeUuid(tenantId)}'`);
    }

    if (opts.source) {
      clauses.push(`"source" = '${this.escapeString(opts.source)}'`);
    }

    if (opts.entityType) {
      clauses.push(`"entity_type" = '${this.escapeString(opts.entityType)}'`);
    }

    if (opts.dateRange) {
      if (opts.dateRange.from) {
        clauses.push(`"ingested_at" >= '${this.escapeString(opts.dateRange.from)}'::timestamptz`);
      }
      if (opts.dateRange.to) {
        clauses.push(`"ingested_at" <= '${this.escapeString(opts.dateRange.to)}'::timestamptz`);
      }
    }

    if (opts.filters) {
      for (const f of opts.filters) {
        this.validateColumn(f.field);
        const op = this.sanitizeOperator(f.operator);
        const val = typeof f.value === 'number' ? f.value : `'${this.escapeString(String(f.value))}'`;
        clauses.push(`"${f.field}" ${op} ${val}`);
      }
    }

    return clauses;
  }

  private sanitizeOperator(op: string): string {
    const allowed: Record<string, string> = {
      '=': '=',
      '!=': '!=',
      '<>': '<>',
      '>': '>',
      '<': '<',
      '>=': '>=',
      '<=': '<=',
      'LIKE': 'LIKE',
      'ILIKE': 'ILIKE',
      'IN': 'IN',
    };
    const normalized = op.toUpperCase().trim();
    return allowed[normalized] ?? '=';
  }

  private sanitizeAlias(alias: string): string {
    return alias.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 63);
  }

  private escapeString(value: string): string {
    return value.replace(/'/g, "''");
  }

  private escapeUuid(value: string): string {
    // Only allow UUID characters
    return value.replace(/[^a-f0-9-]/gi, '');
  }
}
