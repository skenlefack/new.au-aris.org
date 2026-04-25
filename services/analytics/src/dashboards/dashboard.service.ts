/**
 * dashboard.service.ts — CRUD for Dashboard, Widget, Share, Preference.
 *
 * Uses pg Pool directly (consistent with analytics service pattern).
 * All writes publish Kafka events with a 5 s timeout (feedback_kafka_timeout_pattern).
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { RedisClient } from '../services/redis-client';
import type { FastifyKafka } from '@aris/kafka-client/fastify';
import {
  TOPIC_SYS_ANALYTICS_DASHBOARD_CREATED,
  TOPIC_SYS_ANALYTICS_DASHBOARD_UPDATED,
  TOPIC_SYS_ANALYTICS_DASHBOARD_DELETED,
  TOPIC_SYS_ANALYTICS_WIDGET_UPDATED,
} from '@aris/shared-types';
import type {
  CreateDashboardDto,
  UpdateDashboardDto,
  CreateWidgetDto,
  UpdateWidgetDto,
  BatchUpdateWidgetsDto,
  CreateShareDto,
  SetPreferenceDto,
  ListDashboardsQuery,
  DefaultForQuery,
} from './dashboard.schemas';

const CACHE_PREFIX = 'analytics:dashboard:';
const CACHE_TTL = 300; // 5 min

export class DashboardService {
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
  //  Dashboard CRUD
  // ═══════════════════════════════════════════════════════════════════════

  async list(
    filters: ListDashboardsQuery,
    userId: string,
  ): Promise<{ data: unknown[]; meta: { total: number; page: number; limit: number } }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    // Ownership filter or default: own + shared + system templates
    if (filters.ownership) {
      conditions.push(`d.ownership = $${idx++}`);
      params.push(filters.ownership);
    } else {
      conditions.push(`(d.ownership = 'SYSTEM_TEMPLATE' OR d.owner_user_id = $${idx} OR EXISTS (
        SELECT 1 FROM dashboard_builder.dashboard_shares s
        WHERE s.dashboard_id = d.id
          AND (s.shared_with_user_id = $${idx} OR s.is_public = true)
      ))`);
      params.push(userId);
      idx++;
    }

    if (filters.scope) {
      conditions.push(`d.scope = $${idx++}`);
      params.push(filters.scope);
    }
    if (filters.domainCode) {
      conditions.push(`d.domain_id = $${idx++}`);
      params.push(filters.domainCode);
    }
    if (filters.subDomainCode) {
      conditions.push(`d.sub_domain_id = $${idx++}`);
      params.push(filters.subDomainCode);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM dashboard_builder.dashboards d ${where}`,
      params,
    );
    const total = countResult.rows[0].total;

    params.push(limit, offset);
    const { rows } = await this.pool.query(
      `SELECT d.*,
              (SELECT COUNT(*)::int FROM dashboard_builder.dashboard_widgets w WHERE w.dashboard_id = d.id) AS widget_count
       FROM dashboard_builder.dashboards d
       ${where}
       ORDER BY d.updated_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );

    return { data: rows, meta: { total, page, limit } };
  }

  async getById(id: string, userId: string): Promise<unknown> {
    const cacheKey = `${CACHE_PREFIX}${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Check access even on cached results
        if (this.hasAccess(parsed, userId)) return parsed;
      } catch { /* stale */ }
    }

    const { rows } = await this.pool.query(
      `SELECT d.*,
              COALESCE(
                (SELECT json_agg(w ORDER BY w.grid_y, w.grid_x)
                 FROM dashboard_builder.dashboard_widgets w
                 WHERE w.dashboard_id = d.id),
                '[]'::json
              ) AS widgets,
              COALESCE(
                (SELECT json_agg(s)
                 FROM dashboard_builder.dashboard_shares s
                 WHERE s.dashboard_id = d.id),
                '[]'::json
              ) AS shares
       FROM dashboard_builder.dashboards d
       WHERE d.id = $1`,
      [id],
    );

    if (rows.length === 0) {
      throw Object.assign(new Error('Dashboard not found'), { statusCode: 404 });
    }

    const dashboard = rows[0];
    if (!this.hasAccess(dashboard, userId)) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }

    await this.redis.set(cacheKey, JSON.stringify(dashboard), CACHE_TTL);
    return dashboard;
  }

  async getDefaultFor(userId: string, query: DefaultForQuery): Promise<unknown> {
    // 1. Check user preference
    const prefConditions = ['p.user_id = $1', 'p.scope = $2'];
    const prefParams: unknown[] = [userId, query.scope];
    let idx = 3;

    if (query.domainId) {
      prefConditions.push(`p.domain_id = $${idx++}`);
      prefParams.push(query.domainId);
    } else {
      prefConditions.push('p.domain_id IS NULL');
    }
    if (query.subDomainId) {
      prefConditions.push(`p.sub_domain_id = $${idx++}`);
      prefParams.push(query.subDomainId);
    } else {
      prefConditions.push('p.sub_domain_id IS NULL');
    }
    if (query.valueChainCode) {
      prefConditions.push(`p.value_chain_code = $${idx++}`);
      prefParams.push(query.valueChainCode);
    } else {
      prefConditions.push('p.value_chain_code IS NULL');
    }

    const { rows: prefRows } = await this.pool.query(
      `SELECT p.dashboard_id FROM dashboard_builder.user_dashboard_preferences p
       WHERE ${prefConditions.join(' AND ')}
       LIMIT 1`,
      prefParams,
    );

    if (prefRows.length > 0) {
      return this.getById(prefRows[0].dashboard_id, userId);
    }

    // 2. Fall back to system_template isDefault
    const sysConditions = [
      `d.ownership = 'SYSTEM_TEMPLATE'`,
      'd.is_default = true',
      `d.scope = $1`,
    ];
    const sysParams: unknown[] = [query.scope];
    let sysIdx = 2;

    if (query.domainId) {
      sysConditions.push(`d.domain_id = $${sysIdx++}`);
      sysParams.push(query.domainId);
    }

    const { rows: sysRows } = await this.pool.query(
      `SELECT d.id FROM dashboard_builder.dashboards d
       WHERE ${sysConditions.join(' AND ')}
       ORDER BY d.updated_at DESC LIMIT 1`,
      sysParams,
    );

    if (sysRows.length > 0) {
      return this.getById(sysRows[0].id, userId);
    }

    return null;
  }

  async create(input: CreateDashboardDto, userId: string): Promise<unknown> {
    const id = randomUUID();
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO dashboard_builder.dashboards
          (id, ownership, scope, domain_id, sub_domain_id, value_chain_code,
           rec_code, country_code, title_fr, title_en, title_ar, title_pt,
           description, grid_columns, row_height, owner_user_id, is_default)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [
          id,
          input.ownership ?? 'USER_OWNED',
          input.scope ?? 'PERSONAL',
          input.domainId ?? null,
          input.subDomainId ?? null,
          input.valueChainCode ?? null,
          input.recCode ?? null,
          input.countryCode ?? null,
          input.titleFr,
          input.titleEn,
          input.titleAr ?? null,
          input.titlePt ?? null,
          input.description ?? null,
          input.gridColumns ?? 12,
          input.rowHeight ?? 80,
          userId,
          input.isDefault ?? false,
        ],
      );

      // Clone widgets from another dashboard if requested
      if (input.cloneFrom) {
        await client.query(
          `INSERT INTO dashboard_builder.dashboard_widgets
            (id, dashboard_id, type, data_source, grid_x, grid_y, grid_w, grid_h,
             title_fr, title_en, title_ar, title_pt, config, filters)
           SELECT gen_random_uuid(), $1, type, data_source, grid_x, grid_y, grid_w, grid_h,
                  title_fr, title_en, title_ar, title_pt, config, filters
           FROM dashboard_builder.dashboard_widgets
           WHERE dashboard_id = $2`,
          [id, input.cloneFrom],
        );
      }

      await client.query('COMMIT');

      const dashboard = rows[0];
      await this.publishWithTimeout(TOPIC_SYS_ANALYTICS_DASHBOARD_CREATED, id, dashboard);
      return dashboard;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(id: string, input: UpdateDashboardDto, userId: string): Promise<unknown> {
    // Verify ownership
    await this.verifyOwnership(id, userId);

    const fieldMap: Record<string, string> = {
      ownership: 'ownership',
      scope: 'scope',
      domainId: 'domain_id',
      subDomainId: 'sub_domain_id',
      valueChainCode: 'value_chain_code',
      recCode: 'rec_code',
      countryCode: 'country_code',
      titleFr: 'title_fr',
      titleEn: 'title_en',
      titleAr: 'title_ar',
      titlePt: 'title_pt',
      description: 'description',
      gridColumns: 'grid_columns',
      rowHeight: 'row_height',
      isDefault: 'is_default',
    };

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries(fieldMap)) {
      const val = (input as Record<string, unknown>)[key];
      if (val !== undefined) {
        sets.push(`${col} = $${idx++}`);
        params.push(val);
      }
    }

    if (sets.length === 0) return this.getById(id, userId);

    sets.push('updated_at = NOW()');
    params.push(id);

    const { rows } = await this.pool.query(
      `UPDATE dashboard_builder.dashboards SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );

    if (rows.length === 0) {
      throw Object.assign(new Error('Dashboard not found'), { statusCode: 404 });
    }

    await this.redis.del(`${CACHE_PREFIX}${id}`);
    await this.publishWithTimeout(TOPIC_SYS_ANALYTICS_DASHBOARD_UPDATED, id, rows[0]);
    return rows[0];
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.verifyOwnership(id, userId);

    const { rowCount } = await this.pool.query(
      `DELETE FROM dashboard_builder.dashboards WHERE id = $1`,
      [id],
    );

    if (rowCount === 0) {
      throw Object.assign(new Error('Dashboard not found'), { statusCode: 404 });
    }

    await this.redis.del(`${CACHE_PREFIX}${id}`);
    await this.publishWithTimeout(TOPIC_SYS_ANALYTICS_DASHBOARD_DELETED, id, { id });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Widget CRUD
  // ═══════════════════════════════════════════════════════════════════════

  async addWidget(dashboardId: string, input: CreateWidgetDto, userId: string): Promise<unknown> {
    await this.verifyOwnership(dashboardId, userId);

    const gridX = input.gridX ?? 0;
    const gridW = input.gridW ?? 3;
    if (gridX + gridW > 12) {
      throw Object.assign(new Error('Widget exceeds grid width: gridX + gridW must be <= 12'), { statusCode: 400 });
    }

    const id = randomUUID();
    const { rows } = await this.pool.query(
      `INSERT INTO dashboard_builder.dashboard_widgets
        (id, dashboard_id, type, data_source, grid_x, grid_y, grid_w, grid_h,
         title_fr, title_en, title_ar, title_pt, config, filters)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        id,
        dashboardId,
        input.type,
        input.dataSource ?? 'INDICATOR',
        gridX,
        input.gridY ?? 0,
        gridW,
        input.gridH ?? 2,
        input.titleFr,
        input.titleEn,
        input.titleAr ?? null,
        input.titlePt ?? null,
        input.config ? JSON.stringify(input.config) : '{}',
        input.filters ? JSON.stringify(input.filters) : '{}',
      ],
    );

    await this.redis.del(`${CACHE_PREFIX}${dashboardId}`);
    await this.publishWithTimeout(TOPIC_SYS_ANALYTICS_WIDGET_UPDATED, id, rows[0]);
    return rows[0];
  }

  async updateWidget(
    dashboardId: string,
    widgetId: string,
    input: UpdateWidgetDto,
    userId: string,
  ): Promise<unknown> {
    await this.verifyOwnership(dashboardId, userId);

    const fieldMap: Record<string, string> = {
      type: 'type',
      dataSource: 'data_source',
      gridX: 'grid_x',
      gridY: 'grid_y',
      gridW: 'grid_w',
      gridH: 'grid_h',
      titleFr: 'title_fr',
      titleEn: 'title_en',
      titleAr: 'title_ar',
      titlePt: 'title_pt',
    };

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries(fieldMap)) {
      const val = (input as Record<string, unknown>)[key];
      if (val !== undefined) {
        sets.push(`${col} = $${idx++}`);
        params.push(val);
      }
    }

    // JSON fields need stringify
    if (input.config !== undefined) {
      sets.push(`config = $${idx++}`);
      params.push(JSON.stringify(input.config));
    }
    if (input.filters !== undefined) {
      sets.push(`filters = $${idx++}`);
      params.push(JSON.stringify(input.filters));
    }

    if (sets.length === 0) {
      const { rows } = await this.pool.query(
        `SELECT * FROM dashboard_builder.dashboard_widgets WHERE id = $1 AND dashboard_id = $2`,
        [widgetId, dashboardId],
      );
      return rows[0] ?? null;
    }

    // Validate grid bounds if position changed
    const newGridX = input.gridX;
    const newGridW = input.gridW;
    if (newGridX !== undefined && newGridW !== undefined && newGridX + newGridW > 12) {
      throw Object.assign(new Error('Widget exceeds grid width: gridX + gridW must be <= 12'), { statusCode: 400 });
    }

    sets.push('updated_at = NOW()');
    params.push(widgetId, dashboardId);

    const { rows } = await this.pool.query(
      `UPDATE dashboard_builder.dashboard_widgets SET ${sets.join(', ')}
       WHERE id = $${idx++} AND dashboard_id = $${idx}
       RETURNING *`,
      params,
    );

    if (rows.length === 0) {
      throw Object.assign(new Error('Widget not found'), { statusCode: 404 });
    }

    await this.redis.del(`${CACHE_PREFIX}${dashboardId}`);
    await this.publishWithTimeout(TOPIC_SYS_ANALYTICS_WIDGET_UPDATED, widgetId, rows[0]);
    return rows[0];
  }

  async batchUpdateWidgets(
    dashboardId: string,
    input: BatchUpdateWidgetsDto,
    userId: string,
  ): Promise<unknown[]> {
    await this.verifyOwnership(dashboardId, userId);

    const client = await this.pool.connect();
    const results: unknown[] = [];

    try {
      await client.query('BEGIN');

      for (const w of input.widgets) {
        if (w.gridX + w.gridW > 12) {
          throw Object.assign(
            new Error(`Widget ${w.id} exceeds grid width: gridX + gridW must be <= 12`),
            { statusCode: 400 },
          );
        }

        const { rows } = await client.query(
          `UPDATE dashboard_builder.dashboard_widgets
           SET grid_x = $1, grid_y = $2, grid_w = $3, grid_h = $4, updated_at = NOW()
           WHERE id = $5 AND dashboard_id = $6
           RETURNING *`,
          [w.gridX, w.gridY, w.gridW, w.gridH, w.id, dashboardId],
        );

        if (rows.length === 0) {
          throw Object.assign(new Error(`Widget not found: ${w.id}`), { statusCode: 404 });
        }
        results.push(rows[0]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.redis.del(`${CACHE_PREFIX}${dashboardId}`);
    return results;
  }

  async removeWidget(dashboardId: string, widgetId: string, userId: string): Promise<void> {
    await this.verifyOwnership(dashboardId, userId);

    const { rowCount } = await this.pool.query(
      `DELETE FROM dashboard_builder.dashboard_widgets WHERE id = $1 AND dashboard_id = $2`,
      [widgetId, dashboardId],
    );

    if (rowCount === 0) {
      throw Object.assign(new Error('Widget not found'), { statusCode: 404 });
    }

    await this.redis.del(`${CACHE_PREFIX}${dashboardId}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Shares
  // ═══════════════════════════════════════════════════════════════════════

  async share(dashboardId: string, input: CreateShareDto, userId: string): Promise<unknown> {
    await this.verifyOwnership(dashboardId, userId);

    const id = randomUUID();
    const { rows } = await this.pool.query(
      `INSERT INTO dashboard_builder.dashboard_shares
        (id, dashboard_id, shared_with_user_id, shared_with_role, is_public, permission, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        id,
        dashboardId,
        input.sharedWithUserId ?? null,
        input.sharedWithRole ?? null,
        input.isPublic ?? false,
        input.permission ?? 'VIEW',
        userId,
      ],
    );

    await this.redis.del(`${CACHE_PREFIX}${dashboardId}`);
    return rows[0];
  }

  async removeShare(dashboardId: string, shareId: string, userId: string): Promise<void> {
    await this.verifyOwnership(dashboardId, userId);

    const { rowCount } = await this.pool.query(
      `DELETE FROM dashboard_builder.dashboard_shares WHERE id = $1 AND dashboard_id = $2`,
      [shareId, dashboardId],
    );

    if (rowCount === 0) {
      throw Object.assign(new Error('Share not found'), { statusCode: 404 });
    }

    await this.redis.del(`${CACHE_PREFIX}${dashboardId}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Preferences
  // ═══════════════════════════════════════════════════════════════════════

  async setPreference(userId: string, input: SetPreferenceDto): Promise<unknown> {
    const id = randomUUID();
    const { rows } = await this.pool.query(
      `INSERT INTO dashboard_builder.user_dashboard_preferences
        (id, user_id, scope, domain_id, sub_domain_id, value_chain_code, dashboard_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT ON CONSTRAINT uq_user_dashboard_pref
       DO UPDATE SET dashboard_id = EXCLUDED.dashboard_id, updated_at = NOW()
       RETURNING *`,
      [
        id,
        userId,
        input.scope,
        input.domainId ?? null,
        input.subDomainId ?? null,
        input.valueChainCode ?? null,
        input.dashboardId,
      ],
    );

    return rows[0];
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Raw widget loading (for WidgetResolver)
  // ═══════════════════════════════════════════════════════════════════════

  async getDashboardWithWidgets(id: string): Promise<{ dashboard: Record<string, unknown>; widgets: Record<string, unknown>[] } | null> {
    const { rows: dashRows } = await this.pool.query(
      `SELECT * FROM dashboard_builder.dashboards WHERE id = $1`,
      [id],
    );
    if (dashRows.length === 0) return null;

    const { rows: widgetRows } = await this.pool.query(
      `SELECT * FROM dashboard_builder.dashboard_widgets WHERE dashboard_id = $1 ORDER BY grid_y, grid_x`,
      [id],
    );

    return { dashboard: dashRows[0], widgets: widgetRows };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════════════════════════

  private hasAccess(dashboard: Record<string, unknown>, userId: string): boolean {
    if (dashboard.ownership === 'SYSTEM_TEMPLATE') return true;
    if (dashboard.owner_user_id === userId) return true;
    // Check shares array if loaded
    const shares = dashboard.shares as Array<Record<string, unknown>> | undefined;
    if (shares && shares.some((s) => s.shared_with_user_id === userId || s.is_public)) {
      return true;
    }
    return false;
  }

  private async verifyOwnership(dashboardId: string, userId: string): Promise<void> {
    const { rows } = await this.pool.query(
      `SELECT owner_user_id, ownership FROM dashboard_builder.dashboards WHERE id = $1`,
      [dashboardId],
    );
    if (rows.length === 0) {
      throw Object.assign(new Error('Dashboard not found'), { statusCode: 404 });
    }
    // SYSTEM_TEMPLATE can only be edited by the admin routes; ownership check skipped there
    if (rows[0].owner_user_id !== userId && rows[0].ownership !== 'SYSTEM_TEMPLATE') {
      throw Object.assign(new Error('Not the dashboard owner'), { statusCode: 403 });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Kafka helper (5 s timeout — see feedback_kafka_timeout_pattern)
  // ═══════════════════════════════════════════════════════════════════════

  private async publishWithTimeout(topic: string, key: string, payload: unknown): Promise<void> {
    if (!this.kafka) return;
    try {
      await Promise.race([
        this.kafka.send(topic, key, payload, {
          source: 'analytics-dashboard-service',
          correlationId: randomUUID(),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Kafka publish timeout')), 5_000),
        ),
      ]);
    } catch (err) {
      console.warn(`[DashboardService] Kafka publish to ${topic} failed:`, err);
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
