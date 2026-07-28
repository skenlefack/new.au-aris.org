/**
 * indicator.service.ts — CRUD for IndicatorType, Indicator, IndicatorValue.
 *
 * Uses pg Pool directly (consistent with analytics service pattern).
 * All writes publish Kafka events with a 5 s timeout (feedback_kafka_timeout_pattern).
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { RedisClient } from '../services/redis-client';
import type { FastifyKafka } from '@aris/kafka-client/fastify';
import {
  TOPIC_SYS_ANALYTICS_INDICATOR_CREATED,
  TOPIC_SYS_ANALYTICS_INDICATOR_UPDATED,
  TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_CREATED,
  TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_UPDATED,
} from '@aris/shared-types';
import type {
  CreateIndicatorTypeDto,
  UpdateIndicatorTypeDto,
  CreateIndicatorDto,
  UpdateIndicatorDto,
  CreateIndicatorValueDto,
  BulkIndicatorValueDto,
  IndicatorListQuery,
  IndicatorValueQuery,
  SetFormulaDto,
} from './indicator.schemas';

const CACHE_PREFIX = 'analytics:indicator:';
const CACHE_TTL = 300; // 5 min

/** Convert snake_case DB row keys to camelCase for frontend consumption. */
function toCamelCase(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camel] = value;
  }
  return result;
}

export class IndicatorService {
  private pool: Pool;

  constructor(
    private readonly redis: RedisClient,
    private readonly kafka: FastifyKafka | null,
    databaseUrl?: string,
  ) {
    const url =
      databaseUrl ||
      process.env['DATABASE_URL'] ||
      process.env['DIRECT_DATABASE_URL'] ||
      'postgresql://aris:aris@localhost:5432/aris';
    this.pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  IndicatorType CRUD
  // ═══════════════════════════════════════════════════════════════════════

  async listIndicatorTypes(): Promise<unknown[]> {
    const cacheKey = `${CACHE_PREFIX}types`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* stale */ }
    }
    const { rows } = await this.pool.query(
      `SELECT * FROM analytics.indicator_types WHERE active = true ORDER BY display_order, code`,
    );
    const camelRows = rows.map(toCamelCase);
    await this.redis.set(cacheKey, JSON.stringify(camelRows), CACHE_TTL);
    return camelRows;
  }

  async createIndicatorType(dto: CreateIndicatorTypeDto): Promise<unknown> {
    const { rows } = await this.pool.query(
      `INSERT INTO analytics.indicator_types
        (code, label_fr, label_en, label_ar, label_pt, description, color, icon_name, external_ref, display_order, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
       RETURNING *`,
      [
        dto.code, dto.labelFr, dto.labelEn, dto.labelAr ?? null, dto.labelPt ?? null,
        dto.description ?? null, dto.color ?? null, dto.iconName ?? null,
        dto.externalRef ?? null, dto.displayOrder ?? 0,
      ],
    );
    await this.redis.del(`${CACHE_PREFIX}types`);
    return toCamelCase(rows[0]);
  }

  async updateIndicatorType(code: string, dto: UpdateIndicatorTypeDto): Promise<unknown> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fieldMap: Record<string, string> = {
      labelFr: 'label_fr', labelEn: 'label_en', labelAr: 'label_ar', labelPt: 'label_pt',
      description: 'description', color: 'color', iconName: 'icon_name',
      externalRef: 'external_ref', displayOrder: 'display_order', active: 'active',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((dto as Record<string, unknown>)[key] !== undefined) {
        sets.push(`${col} = $${idx++}`);
        params.push((dto as Record<string, unknown>)[key]);
      }
    }

    if (sets.length === 0) return this.getIndicatorTypeByCode(code);

    sets.push(`updated_at = NOW()`);
    params.push(code);

    const { rows } = await this.pool.query(
      `UPDATE analytics.indicator_types SET ${sets.join(', ')} WHERE code = $${idx} RETURNING *`,
      params,
    );
    if (rows.length === 0) throw Object.assign(new Error('Indicator type not found'), { statusCode: 404 });
    await this.redis.del(`${CACHE_PREFIX}types`);
    return toCamelCase(rows[0]);
  }

  async deleteIndicatorType(code: string): Promise<void> {
    const { rowCount } = await this.pool.query(
      `UPDATE analytics.indicator_types SET active = false, updated_at = NOW() WHERE code = $1`,
      [code],
    );
    if (rowCount === 0) throw Object.assign(new Error('Indicator type not found'), { statusCode: 404 });
    await this.redis.del(`${CACHE_PREFIX}types`);
  }

  private async getIndicatorTypeByCode(code: string): Promise<unknown> {
    const { rows } = await this.pool.query(`SELECT * FROM analytics.indicator_types WHERE code = $1`, [code]);
    return rows[0] ? toCamelCase(rows[0]) : null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Indicator CRUD
  // ═══════════════════════════════════════════════════════════════════════

  async listIndicators(query: IndicatorListQuery): Promise<{ data: unknown[]; meta: { total: number; page: number; limit: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query.typeCode) { conditions.push(`i.type_code = $${idx++}`); params.push(query.typeCode); }
    if (query.domainId) { conditions.push(`i.domain_id = $${idx++}`); params.push(query.domainId); }
    if (query.subDomainId) { conditions.push(`i.sub_domain_id = $${idx++}`); params.push(query.subDomainId); }
    if (query.measurementMode) { conditions.push(`i.measurement_mode = $${idx++}`); params.push(query.measurementMode); }
    if (query.active !== undefined) { conditions.push(`i.active = $${idx++}`); params.push(query.active); }
    if (query.search) {
      conditions.push(`(i.name_en ILIKE $${idx} OR i.name_fr ILIKE $${idx} OR i.code ILIKE $${idx})`);
      params.push(`%${query.search}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM analytics.indicators i ${where}`,
      params,
    );
    const total = countResult.rows[0].total;

    params.push(limit, offset);
    const { rows } = await this.pool.query(
      `SELECT i.*, t.label_en AS type_label_en, t.label_fr AS type_label_fr, t.color AS type_color
       FROM analytics.indicators i
       LEFT JOIN analytics.indicator_types t ON t.code = i.type_code
       ${where}
       ORDER BY i.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );

    return { data: rows.map(toCamelCase), meta: { total, page, limit } };
  }

  async getIndicatorById(id: string): Promise<unknown> {
    const cacheKey = `${CACHE_PREFIX}${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* stale */ }
    }

    const { rows } = await this.pool.query(
      `SELECT i.*, t.label_en AS type_label_en, t.label_fr AS type_label_fr, t.color AS type_color,
              f.expression AS formula_expression, f.is_validated AS formula_validated
       FROM analytics.indicators i
       LEFT JOIN analytics.indicator_types t ON t.code = i.type_code
       LEFT JOIN analytics.indicator_formulas f ON f.indicator_id = i.id
       WHERE i.id = $1`,
      [id],
    );
    if (rows.length === 0) throw Object.assign(new Error('Indicator not found'), { statusCode: 404 });

    const camelRow = toCamelCase(rows[0]);
    await this.redis.set(cacheKey, JSON.stringify(camelRow), CACHE_TTL);
    return camelRow;
  }

  async getIndicatorByCode(code: string): Promise<unknown> {
    const { rows } = await this.pool.query(
      `SELECT i.*, t.label_en AS type_label_en, t.label_fr AS type_label_fr, t.color AS type_color,
              f.expression AS formula_expression, f.is_validated AS formula_validated
       FROM analytics.indicators i
       LEFT JOIN analytics.indicator_types t ON t.code = i.type_code
       LEFT JOIN analytics.indicator_formulas f ON f.indicator_id = i.id
       WHERE i.code = $1`,
      [code],
    );
    if (rows.length === 0) throw Object.assign(new Error('Indicator not found'), { statusCode: 404 });
    return toCamelCase(rows[0]);
  }

  async createIndicator(dto: CreateIndicatorDto, userId?: string): Promise<unknown> {
    const id = randomUUID();
    const { rows } = await this.pool.query(
      `INSERT INTO analytics.indicators
        (id, code, type_code, name_fr, name_en, name_ar, name_pt,
         description_fr, description_en, description_ar, description_pt,
         domain_id, sub_domain_id, value_chain_code,
         scope, measurement_mode, aggregation, periodicity,
         source_form_id, source_form_field_id, external_source,
         unit, decimal_places, format_pattern,
         target_value, thresholds, better_is_higher,
         active, is_public, external_framework_reference, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,true,$28,$29,$30)
       RETURNING *`,
      [
        id, dto.code, dto.typeCode, dto.nameFr, dto.nameEn,
        dto.nameAr ?? null, dto.namePt ?? null,
        dto.descriptionFr ?? null, dto.descriptionEn ?? null,
        dto.descriptionAr ?? null, dto.descriptionPt ?? null,
        dto.domainId ?? null, dto.subDomainId ?? null, dto.valueChainCode ?? null,
        dto.scope ?? 'NATIONAL', dto.measurementMode ?? 'MANUAL_ENTRY',
        dto.aggregation ?? 'SUM', dto.periodicity ?? 'ANNUAL',
        dto.sourceFormId ?? null, dto.sourceFormFieldId ?? null, dto.externalSource ?? null,
        dto.unit ?? 'count', dto.decimalPlaces ?? 0, dto.formatPattern ?? null,
        dto.targetValue ?? null, dto.thresholds ? JSON.stringify(dto.thresholds) : null,
        dto.betterIsHigher ?? true, dto.isPublic ?? false,
        dto.externalFrameworkReference ?? null, dto.notes ?? null,
      ],
    );

    const camelRow = toCamelCase(rows[0]);
    await this.publishWithTimeout(TOPIC_SYS_ANALYTICS_INDICATOR_CREATED, id, camelRow);
    return camelRow;
  }

  async updateIndicator(id: string, dto: UpdateIndicatorDto): Promise<unknown> {
    const fieldMap: Record<string, string> = {
      typeCode: 'type_code', nameFr: 'name_fr', nameEn: 'name_en',
      nameAr: 'name_ar', namePt: 'name_pt',
      descriptionFr: 'description_fr', descriptionEn: 'description_en',
      descriptionAr: 'description_ar', descriptionPt: 'description_pt',
      domainId: 'domain_id', subDomainId: 'sub_domain_id', valueChainCode: 'value_chain_code',
      scope: 'scope', measurementMode: 'measurement_mode',
      aggregation: 'aggregation', periodicity: 'periodicity',
      sourceFormId: 'source_form_id', sourceFormFieldId: 'source_form_field_id',
      externalSource: 'external_source',
      unit: 'unit', decimalPlaces: 'decimal_places', formatPattern: 'format_pattern',
      targetValue: 'target_value', thresholds: 'thresholds', betterIsHigher: 'better_is_higher',
      isPublic: 'is_public', externalFrameworkReference: 'external_framework_reference', notes: 'notes',
      active: 'active',
    };

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries(fieldMap)) {
      const val = (dto as Record<string, unknown>)[key];
      if (val !== undefined) {
        sets.push(`${col} = $${idx++}`);
        params.push(key === 'thresholds' ? JSON.stringify(val) : val);
      }
    }

    if (sets.length === 0) return this.getIndicatorById(id);

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const { rows } = await this.pool.query(
      `UPDATE analytics.indicators SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (rows.length === 0) throw Object.assign(new Error('Indicator not found'), { statusCode: 404 });

    const camelRow = toCamelCase(rows[0]);
    await this.redis.del(`${CACHE_PREFIX}${id}`);
    await this.publishWithTimeout(TOPIC_SYS_ANALYTICS_INDICATOR_UPDATED, id, camelRow);
    return camelRow;
  }

  async deleteIndicator(id: string): Promise<void> {
    const { rowCount } = await this.pool.query(
      `UPDATE analytics.indicators SET active = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    if (rowCount === 0) throw Object.assign(new Error('Indicator not found'), { statusCode: 404 });
    await this.redis.del(`${CACHE_PREFIX}${id}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  IndicatorValue
  // ═══════════════════════════════════════════════════════════════════════

  async listValues(
    indicatorId: string,
    query: IndicatorValueQuery,
  ): Promise<{ data: unknown[]; meta: { total: number; page: number; limit: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['indicator_id = $1'];
    const params: unknown[] = [indicatorId];
    let idx = 2;

    if (query.year) { conditions.push(`year = $${idx++}`); params.push(query.year); }
    if (query.countryCode) { conditions.push(`country_code = $${idx++}`); params.push(query.countryCode); }
    if (query.recCode) { conditions.push(`rec_code = $${idx++}`); params.push(query.recCode); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM analytics.indicator_values ${where}`,
      params,
    );
    const total = countResult.rows[0].total;

    params.push(limit, offset);
    const { rows } = await this.pool.query(
      `SELECT * FROM analytics.indicator_values ${where} ORDER BY year DESC, month DESC NULLS LAST LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );

    return { data: rows.map(toCamelCase), meta: { total, page, limit } };
  }

  async getLatestValue(indicatorId: string): Promise<unknown> {
    const { rows } = await this.pool.query(
      `SELECT * FROM analytics.indicator_values
       WHERE indicator_id = $1
       ORDER BY year DESC, month DESC NULLS LAST, quarter DESC NULLS LAST
       LIMIT 1`,
      [indicatorId],
    );
    return rows[0] ? toCamelCase(rows[0]) : null;
  }

  async createValue(indicatorId: string, dto: CreateIndicatorValueDto, userId?: string): Promise<unknown> {
    const id = randomUUID();
    const { rows } = await this.pool.query(
      `INSERT INTO analytics.indicator_values
        (id, indicator_id, year, month, quarter, country_code, rec_code, is_continental, value, source, entered_by_user_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT ON CONSTRAINT uq_indicator_value
       DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, notes = EXCLUDED.notes, updated_at = NOW()
       RETURNING *`,
      [
        id, indicatorId, dto.year, dto.month ?? null, dto.quarter ?? null,
        dto.countryCode ?? null, dto.recCode ?? null, dto.isContinental ?? false,
        dto.value, dto.source ?? null, userId ?? null, dto.notes ?? null,
      ],
    );

    const camelValueRow = toCamelCase(rows[0]);
    await this.publishWithTimeout(TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_CREATED, id, {
      indicatorId,
      ...camelValueRow,
    });
    return camelValueRow;
  }

  async bulkCreateValues(
    indicatorId: string,
    dto: BulkIndicatorValueDto,
    userId?: string,
  ): Promise<{ inserted: number; updated: number }> {
    const client = await this.pool.connect();
    let inserted = 0;
    let updated = 0;

    try {
      await client.query('BEGIN');

      for (const v of dto.values) {
        const id = randomUUID();
        const result = await client.query(
          `INSERT INTO analytics.indicator_values
            (id, indicator_id, year, month, quarter, country_code, rec_code, is_continental, value, source, entered_by_user_id, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT ON CONSTRAINT uq_indicator_value
           DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, notes = EXCLUDED.notes, updated_at = NOW()
           RETURNING (xmax = 0) AS is_insert`,
          [
            id, indicatorId, v.year, v.month ?? null, v.quarter ?? null,
            v.countryCode ?? null, v.recCode ?? null, v.isContinental ?? false,
            v.value, v.source ?? null, userId ?? null, v.notes ?? null,
          ],
        );
        if (result.rows[0]?.is_insert) inserted++;
        else updated++;
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return { inserted, updated };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Formula
  // ═══════════════════════════════════════════════════════════════════════

  async setFormula(indicatorId: string, dto: SetFormulaDto): Promise<unknown> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Upsert formula
      const formulaId = randomUUID();
      const { rows: formulaRows } = await client.query(
        `INSERT INTO analytics.indicator_formulas (id, indicator_id, expression, is_validated)
         VALUES ($1, $2, $3, false)
         ON CONFLICT (indicator_id)
         DO UPDATE SET expression = EXCLUDED.expression, is_validated = false, updated_at = NOW()
         RETURNING *`,
        [formulaId, indicatorId, dto.expression],
      );

      const fId = formulaRows[0].id;

      // Clear old dependencies
      await client.query(`DELETE FROM analytics.indicator_formula_dependencies WHERE formula_id = $1`, [fId]);

      // Insert new dependencies
      for (const dep of dto.dependencies) {
        const refResult = await client.query(
          `SELECT id FROM analytics.indicators WHERE code = $1`,
          [dep.indicatorCode],
        );
        if (refResult.rows.length === 0) {
          throw Object.assign(
            new Error(`Referenced indicator not found: ${dep.indicatorCode}`),
            { statusCode: 400 },
          );
        }
        await client.query(
          `INSERT INTO analytics.indicator_formula_dependencies (id, formula_id, referenced_indicator_id)
           VALUES ($1, $2, $3)
           ON CONFLICT ON CONSTRAINT uq_formula_dependency DO NOTHING`,
          [randomUUID(), fId, refResult.rows[0].id],
        );
      }

      // Update indicator measurement_mode to COMPOSITE_FORMULA
      await client.query(
        `UPDATE analytics.indicators SET measurement_mode = 'COMPOSITE_FORMULA', updated_at = NOW() WHERE id = $1`,
        [indicatorId],
      );

      await client.query('COMMIT');
      await this.redis.del(`${CACHE_PREFIX}${indicatorId}`);

      return formulaRows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getFormula(indicatorId: string): Promise<{ formula: unknown; dependencies: unknown[] } | null> {
    const { rows: formulaRows } = await this.pool.query(
      `SELECT * FROM analytics.indicator_formulas WHERE indicator_id = $1`,
      [indicatorId],
    );
    if (formulaRows.length === 0) return null;

    const { rows: depRows } = await this.pool.query(
      `SELECT d.*, i.code AS indicator_code, i.name_en AS indicator_name
       FROM analytics.indicator_formula_dependencies d
       JOIN analytics.indicators i ON i.id = d.referenced_indicator_id
       WHERE d.formula_id = $1`,
      [formulaRows[0].id],
    );

    return { formula: formulaRows[0], dependencies: depRows };
  }

  /**
   * Resolve all dependency values for a composite indicator at a given point.
   * Returns a map: indicatorCode -> value
   */
  async resolveDependencyValues(
    indicatorId: string,
    year: number,
    countryCode?: string,
  ): Promise<Record<string, number>> {
    const formulaData = await this.getFormula(indicatorId);
    if (!formulaData) return {};

    const result: Record<string, number> = {};

    for (const dep of formulaData.dependencies as Array<{ indicator_code: string; referenced_indicator_id: string }>) {
      const conditions: string[] = ['indicator_id = $1', 'year = $2'];
      const params: unknown[] = [dep.referenced_indicator_id, year];
      if (countryCode) {
        conditions.push('country_code = $3');
        params.push(countryCode);
      }

      const { rows } = await this.pool.query(
        `SELECT value FROM analytics.indicator_values WHERE ${conditions.join(' AND ')} ORDER BY month DESC NULLS LAST LIMIT 1`,
        params,
      );
      if (rows.length > 0) {
        result[dep.indicator_code] = rows[0].value;
      }
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Kafka helper (5 s timeout — see feedback_kafka_timeout_pattern)
  // ═══════════════════════════════════════════════════════════════════════

  private async publishWithTimeout(topic: string, key: string, payload: unknown): Promise<void> {
    if (!this.kafka) return;
    try {
      await Promise.race([
        this.kafka.send(topic, key, payload, {
          source: 'analytics-indicator-service',
          correlationId: randomUUID(),
        } as any),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Kafka publish timeout')), 5_000),
        ),
      ]);
    } catch (err) {
      // Log but don't fail the request
      console.warn(`[IndicatorService] Kafka publish to ${topic} failed:`, err);
    }
  }

  /** Expose the connection pool for consumers that need direct SQL access. */
  getPool(): Pool {
    return this.pool;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
