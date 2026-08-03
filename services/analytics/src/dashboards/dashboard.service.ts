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
  TOPIC_SYS_ANALYTICS_DASHBOARD_SHARED,
} from '@aris/shared-types';
import type {
  CreateDashboardDto,
  UpdateDashboardDto,
  CreateWidgetDto,
  UpdateWidgetDto,
  BatchUpdateWidgetsDto,
  SaveLayoutDto,
  CreateShareDto,
  UpdateShareDto,
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
    userId?: string,
    userRole?: string,
    userTenantId?: string,
  ): Promise<{ data: unknown[]; meta: { total: number; page: number; limit: number } }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    // Ownership filter or default: own + shared + system templates
    if (!userId) {
      // Public mode — only show USER_OWNED dashboards (no auth context)
      if (filters.ownership) {
        conditions.push(`d.ownership = $${idx++}`);
        params.push(filters.ownership);
      }
    } else if (filters.ownership) {
      conditions.push(`d.ownership = $${idx++}`);
      params.push(filters.ownership);
    } else {
      // $idx = userId, $idx+1 = userRole, $idx+2 = userTenantId
      const userIdx = idx++;
      const roleIdx = idx++;
      const tenantIdx = idx++;
      conditions.push(`(d.ownership = 'SYSTEM_TEMPLATE' OR d.owner_user_id = $${userIdx} OR EXISTS (
        SELECT 1 FROM dashboard_builder.dashboard_shares s
        WHERE s.dashboard_id = d.id AND s.status = 'ACTIVE'
          AND (s.expires_at IS NULL OR s.expires_at > NOW())
          AND (
            s.shared_with_user_id = $${userIdx}
            OR s.shared_with_role = $${roleIdx}
            OR s.shared_with_tenant_id = $${tenantIdx}
            OR s.share_type = 'PUBLIC'
          )
      ))`);
      params.push(userId, userRole ?? null, userTenantId ?? null);
    }

    if (filters.scope) {
      conditions.push(`d.scope = $${idx++}`);
      params.push(filters.scope);
    }
    if (filters.domainCode) {
      // domainCode may be a UUID or a domain code string — support both
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.domainCode);
      if (isUuid) {
        conditions.push(`d.domain_id = $${idx++}`);
        params.push(filters.domainCode);
      } else {
        conditions.push(`d.domain_id IN (SELECT id FROM governance.domains WHERE code = $${idx++})`);
        params.push(filters.domainCode);
      }
    }
    if (filters.subDomainCode) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.subDomainCode);
      if (isUuid) {
        conditions.push(`d.sub_domain_id = $${idx++}`);
        params.push(filters.subDomainCode);
      } else {
        conditions.push(`d.sub_domain_id IN (SELECT id FROM governance.sub_domains WHERE code = $${idx++})`);
        params.push(filters.subDomainCode);
      }
    }
    if (filters.recCode) {
      conditions.push(`d.rec_code = $${idx++}`);
      params.push(filters.recCode);
    }
    if (filters.countryCode) {
      conditions.push(`d.country_code = $${idx++}`);
      params.push(filters.countryCode);
    }
    if (filters.campaignId) {
      conditions.push(`d.campaign_id = $${idx++}`);
      params.push(filters.campaignId);
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

  async getById(id: string, userId: string, userRole?: string, userTenantId?: string): Promise<unknown> {
    const cacheKey = `${CACHE_PREFIX}${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Check access even on cached results
        if (this.hasAccess(parsed, { userId, role: userRole, tenantId: userTenantId })) return parsed;
      } catch { /* stale */ }
    }

    const { rows } = await this.pool.query(
      `SELECT d.*,
              COALESCE(
                (SELECT json_agg(
                   json_build_object(
                     'id', sec.id,
                     'dashboard_id', sec.dashboard_id,
                     'title_fr', sec.title_fr,
                     'title_en', sec.title_en,
                     'title_ar', sec.title_ar,
                     'title_pt', sec.title_pt,
                     'column_count', sec.column_count,
                     'sort_order', sec.sort_order,
                     'is_collapsed', sec.is_collapsed,
                     'config', sec.config,
                     'created_at', sec.created_at,
                     'updated_at', sec.updated_at,
                     'widgets', COALESCE(
                       (SELECT json_agg(w ORDER BY w.column_index, w.sort_order)
                        FROM dashboard_builder.dashboard_widgets w
                        WHERE w.section_id = sec.id),
                       '[]'::json
                     )
                   )
                   ORDER BY sec.sort_order
                 )
                 FROM dashboard_builder.dashboard_sections sec
                 WHERE sec.dashboard_id = d.id),
                '[]'::json
              ) AS sections,
              COALESCE(
                (SELECT json_agg(w ORDER BY w.grid_y, w.grid_x)
                 FROM dashboard_builder.dashboard_widgets w
                 WHERE w.dashboard_id = d.id AND w.section_id IS NULL),
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
    if (!this.hasAccess(dashboard, { userId, role: userRole, tenantId: userTenantId })) {
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
           rec_code, country_code, campaign_id, title_fr, title_en, title_ar, title_pt,
           description, grid_columns, row_height, owner_user_id, is_default,
           refresh_interval, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),NOW())
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
          (input as any).campaignId ?? null,
          input.titleFr,
          input.titleEn,
          input.titleAr ?? null,
          input.titlePt ?? null,
          input.description ?? null,
          input.gridColumns ?? 12,
          input.rowHeight ?? 80,
          userId,
          input.isDefault ?? false,
          (input as any).refreshInterval ?? null,
        ],
      );

      if (input.cloneFrom) {
        // Clone sections and widgets from source dashboard
        const { rows: srcSections } = await client.query(
          `SELECT * FROM dashboard_builder.dashboard_sections WHERE dashboard_id = $1 ORDER BY sort_order`,
          [input.cloneFrom],
        );

        if (srcSections.length > 0) {
          // Clone sections with ID mapping
          const sectionMap = new Map<string, string>();
          for (const sec of srcSections) {
            const newSecId = randomUUID();
            sectionMap.set(sec.id, newSecId);
            await client.query(
              `INSERT INTO dashboard_builder.dashboard_sections
                (id, dashboard_id, title_fr, title_en, title_ar, title_pt,
                 column_count, sort_order, is_collapsed, config, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,
              [newSecId, id, sec.title_fr, sec.title_en, sec.title_ar, sec.title_pt,
               sec.column_count, sec.sort_order, sec.is_collapsed, JSON.stringify(sec.config)],
            );
          }

          // Clone widgets with remapped section IDs
          const { rows: srcWidgets } = await client.query(
            `SELECT * FROM dashboard_builder.dashboard_widgets WHERE dashboard_id = $1`,
            [input.cloneFrom],
          );
          for (const w of srcWidgets) {
            const newSectionId = w.section_id ? (sectionMap.get(w.section_id) ?? null) : null;
            await client.query(
              `INSERT INTO dashboard_builder.dashboard_widgets
                (id, dashboard_id, section_id, column_index, sort_order,
                 type, data_source, grid_x, grid_y, grid_w, grid_h,
                 title_fr, title_en, title_ar, title_pt, config, filters,
                 created_at, updated_at)
               VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())`,
              [id, newSectionId, w.column_index ?? 0, w.sort_order ?? 0,
               w.type, w.data_source, w.grid_x, w.grid_y, w.grid_w, w.grid_h,
               w.title_fr, w.title_en, w.title_ar, w.title_pt,
               JSON.stringify(w.config), JSON.stringify(w.filters)],
            );
          }
        } else {
          // No sections — just clone widgets flat
          await client.query(
            `INSERT INTO dashboard_builder.dashboard_widgets
              (id, dashboard_id, type, data_source, grid_x, grid_y, grid_w, grid_h,
               title_fr, title_en, title_ar, title_pt, config, filters,
               created_at, updated_at)
             SELECT gen_random_uuid(), $1, type, data_source, grid_x, grid_y, grid_w, grid_h,
                    title_fr, title_en, title_ar, title_pt, config, filters,
                    NOW(), NOW()
             FROM dashboard_builder.dashboard_widgets
             WHERE dashboard_id = $2`,
            [id, input.cloneFrom],
          );
        }
      } else {
        // Create a default section for new dashboards
        await client.query(
          `INSERT INTO dashboard_builder.dashboard_sections
            (id, dashboard_id, title_fr, title_en, column_count, sort_order, created_at, updated_at)
           VALUES ($1, $2, 'Section 1', 'Section 1', 2, 0, NOW(), NOW())`,
          [randomUUID(), id],
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
      refreshInterval: 'refresh_interval',
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

  async delete(id: string, userId: string, userRole?: string): Promise<void> {
    // Admins can delete any user-owned dashboard
    const isAdmin = userRole && ['SUPER_ADMIN', 'CONTINENTAL_ADMIN'].includes(userRole);
    if (!isAdmin) {
      await this.verifyOwnership(id, userId);
    }

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
        (id, dashboard_id, section_id, column_index, sort_order,
         type, data_source, grid_x, grid_y, grid_w, grid_h,
         title_fr, title_en, title_ar, title_pt, config, filters,
         created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW())
       RETURNING *`,
      [
        id,
        dashboardId,
        input.sectionId ?? null,
        input.columnIndex ?? 0,
        input.sortOrder ?? 0,
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
      sectionId: 'section_id',
      columnIndex: 'column_index',
      sortOrder: 'sort_order',
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
        // Build dynamic SET clause based on provided fields
        const sets: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        if (w.sectionId !== undefined) { sets.push(`section_id = $${idx++}`); params.push(w.sectionId); }
        if (w.columnIndex !== undefined) { sets.push(`column_index = $${idx++}`); params.push(w.columnIndex); }
        if (w.sortOrder !== undefined) { sets.push(`sort_order = $${idx++}`); params.push(w.sortOrder); }
        if (w.gridX !== undefined) { sets.push(`grid_x = $${idx++}`); params.push(w.gridX); }
        if (w.gridY !== undefined) { sets.push(`grid_y = $${idx++}`); params.push(w.gridY); }
        if (w.gridW !== undefined) { sets.push(`grid_w = $${idx++}`); params.push(w.gridW); }
        if (w.gridH !== undefined) { sets.push(`grid_h = $${idx++}`); params.push(w.gridH); }

        if (sets.length === 0) continue;

        sets.push('updated_at = NOW()');
        params.push(w.id, dashboardId);

        const { rows } = await client.query(
          `UPDATE dashboard_builder.dashboard_widgets
           SET ${sets.join(', ')}
           WHERE id = $${idx++} AND dashboard_id = $${idx}
           RETURNING *`,
          params,
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
  //  Layout (sections + widget positions — bulk save)
  // ═══════════════════════════════════════════════════════════════════════

  async saveLayout(dashboardId: string, input: SaveLayoutDto, userId: string): Promise<unknown> {
    await this.verifyOwnership(dashboardId, userId);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get existing section IDs for this dashboard
      const { rows: existingSections } = await client.query(
        `SELECT id FROM dashboard_builder.dashboard_sections WHERE dashboard_id = $1`,
        [dashboardId],
      );
      const existingIds = new Set(existingSections.map((s: any) => s.id));
      const incomingIds = new Set(
        input.sections.filter((s) => s.id).map((s) => s.id as string),
      );

      // 2. Delete removed sections (widgets get section_id = NULL via ON DELETE SET NULL)
      for (const existing of existingIds) {
        if (!incomingIds.has(existing)) {
          await client.query(
            `DELETE FROM dashboard_builder.dashboard_sections WHERE id = $1 AND dashboard_id = $2`,
            [existing, dashboardId],
          );
        }
      }

      // 3. Upsert sections — map temp IDs to real IDs
      const sectionIdMap = new Map<string, string>();
      for (const sec of input.sections) {
        if (sec.id && existingIds.has(sec.id)) {
          // Update existing section
          sectionIdMap.set(sec.id, sec.id);
          await client.query(
            `UPDATE dashboard_builder.dashboard_sections
             SET title_fr = COALESCE($1, title_fr),
                 title_en = COALESCE($2, title_en),
                 title_ar = $3,
                 title_pt = $4,
                 column_count = COALESCE($5, column_count),
                 sort_order = $6,
                 is_collapsed = COALESCE($7, is_collapsed),
                 config = COALESCE($8, config),
                 updated_at = NOW()
             WHERE id = $9 AND dashboard_id = $10`,
            [
              sec.titleFr ?? '', sec.titleEn ?? '',
              sec.titleAr ?? null, sec.titlePt ?? null,
              sec.columnCount ?? 2, sec.sortOrder,
              sec.isCollapsed ?? false,
              sec.config ? JSON.stringify(sec.config) : '{}',
              sec.id, dashboardId,
            ],
          );
        } else {
          // Insert new section
          const newId = randomUUID();
          const tempId = sec.id || `temp-${sec.sortOrder}`;
          sectionIdMap.set(tempId, newId);
          await client.query(
            `INSERT INTO dashboard_builder.dashboard_sections
              (id, dashboard_id, title_fr, title_en, title_ar, title_pt,
               column_count, sort_order, is_collapsed, config, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,
            [
              newId, dashboardId,
              sec.titleFr ?? '', sec.titleEn ?? '',
              sec.titleAr ?? null, sec.titlePt ?? null,
              sec.columnCount ?? 2, sec.sortOrder,
              sec.isCollapsed ?? false,
              sec.config ? JSON.stringify(sec.config) : '{}',
            ],
          );
        }
      }

      // 4. Update widget positions
      for (const w of input.widgets) {
        // Resolve section ID (may be a temp ID that was just created)
        const resolvedSectionId = w.sectionId
          ? (sectionIdMap.get(w.sectionId) ?? w.sectionId)
          : null;

        await client.query(
          `UPDATE dashboard_builder.dashboard_widgets
           SET section_id = $1, column_index = $2, sort_order = $3, updated_at = NOW()
           WHERE id = $4 AND dashboard_id = $5`,
          [resolvedSectionId, w.columnIndex, w.sortOrder, w.id, dashboardId],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.redis.del(`${CACHE_PREFIX}${dashboardId}`);
    await this.publishWithTimeout(TOPIC_SYS_ANALYTICS_DASHBOARD_UPDATED, dashboardId, { id: dashboardId });

    return this.getById(dashboardId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Shares
  // ═══════════════════════════════════════════════════════════════════════

  async share(dashboardId: string, input: CreateShareDto, userId: string): Promise<unknown> {
    await this.verifyOwnership(dashboardId, userId);

    // Validate shareType ↔ fields
    if (input.shareType === 'USER' && !input.sharedWithUserId) throw Object.assign(new Error('sharedWithUserId required for USER share'), { statusCode: 400 });
    if (input.shareType === 'ROLE' && !input.sharedWithRole) throw Object.assign(new Error('sharedWithRole required for ROLE share'), { statusCode: 400 });
    if ((input.shareType === 'COUNTRY' || input.shareType === 'REC') && !input.sharedWithTenantId) throw Object.assign(new Error('sharedWithTenantId required for COUNTRY/REC share'), { statusCode: 400 });

    // Deduplication check
    const dupCheck = await this.pool.query(
      `SELECT id FROM dashboard_builder.dashboard_shares
       WHERE dashboard_id = $1 AND share_type = $2 AND status = 'ACTIVE'
         AND (shared_with_user_id IS NOT DISTINCT FROM $3)
         AND (shared_with_role IS NOT DISTINCT FROM $4)
         AND (shared_with_tenant_id IS NOT DISTINCT FROM $5)
       LIMIT 1`,
      [dashboardId, input.shareType, input.sharedWithUserId ?? null, input.sharedWithRole ?? null, input.sharedWithTenantId ?? null],
    );
    if (dupCheck.rows.length > 0) throw Object.assign(new Error('Share already exists for this target'), { statusCode: 409 });

    const id = randomUUID();
    const isPublic = input.shareType === 'PUBLIC';
    const { rows } = await this.pool.query(
      `INSERT INTO dashboard_builder.dashboard_shares
        (id, dashboard_id, shared_with_user_id, shared_with_role, shared_with_tenant_id,
         is_public, permission, share_type, share_label, expires_at, status, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ACTIVE',$11,NOW())
       RETURNING *`,
      [id, dashboardId, input.sharedWithUserId ?? null, input.sharedWithRole ?? null,
       input.sharedWithTenantId ?? null, isPublic, input.permission ?? 'VIEW',
       input.shareType, input.shareLabel ?? null, input.expiresAt ?? null, userId],
    );

    await this.redis.del(`${CACHE_PREFIX}${dashboardId}`);

    // Publish Kafka event
    this.publishWithTimeout(TOPIC_SYS_ANALYTICS_DASHBOARD_SHARED, dashboardId, {
      dashboardId, shareType: input.shareType,
      targetId: input.sharedWithUserId ?? input.sharedWithRole ?? input.sharedWithTenantId ?? 'public',
      targetLabel: input.shareLabel, permission: input.permission ?? 'VIEW', sharedBy: userId,
    }).catch(() => {});

    return rows[0];
  }

  async listShares(dashboardId: string, userId: string, page = 1, limit = 20): Promise<{ data: unknown[]; meta: { total: number; page: number; limit: number } }> {
    await this.verifyOwnership(dashboardId, userId);

    const countResult = await this.pool.query(
      `SELECT COUNT(*)::int as total FROM dashboard_builder.dashboard_shares WHERE dashboard_id = $1 AND status = 'ACTIVE'`,
      [dashboardId],
    );
    const total = countResult.rows[0].total;
    const offset = (page - 1) * limit;

    const { rows } = await this.pool.query(
      `SELECT id, dashboard_id, shared_with_user_id, shared_with_role, shared_with_tenant_id,
              is_public, permission, share_type, share_label, expires_at, status, created_by, created_at
       FROM dashboard_builder.dashboard_shares
       WHERE dashboard_id = $1 AND status = 'ACTIVE'
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [dashboardId, limit, offset],
    );

    return { data: rows, meta: { total, page, limit } };
  }

  async updateShare(dashboardId: string, shareId: string, input: UpdateShareDto, userId: string): Promise<unknown> {
    await this.verifyOwnership(dashboardId, userId);

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.permission !== undefined) { sets.push(`permission = $${idx++}`); params.push(input.permission); }
    if (input.expiresAt !== undefined) { sets.push(`expires_at = $${idx++}`); params.push(input.expiresAt); }
    if (input.status !== undefined) { sets.push(`status = $${idx++}`); params.push(input.status); }

    if (sets.length === 0) return {};

    params.push(shareId, dashboardId);
    const { rows } = await this.pool.query(
      `UPDATE dashboard_builder.dashboard_shares SET ${sets.join(', ')} WHERE id = $${idx++} AND dashboard_id = $${idx++} RETURNING *`,
      params,
    );
    if (rows.length === 0) throw Object.assign(new Error('Share not found'), { statusCode: 404 });

    await this.redis.del(`${CACHE_PREFIX}${dashboardId}`);
    return rows[0];
  }

  async removeShare(dashboardId: string, shareId: string, userId: string): Promise<void> {
    await this.verifyOwnership(dashboardId, userId);

    const { rowCount } = await this.pool.query(
      `UPDATE dashboard_builder.dashboard_shares SET status = 'REVOKED' WHERE id = $1 AND dashboard_id = $2 AND status = 'ACTIVE'`,
      [shareId, dashboardId],
    );
    if (rowCount === 0) throw Object.assign(new Error('Share not found'), { statusCode: 404 });

    await this.redis.del(`${CACHE_PREFIX}${dashboardId}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Preferences
  // ═══════════════════════════════════════════════════════════════════════

  async setPreference(userId: string, input: SetPreferenceDto): Promise<unknown> {
    const id = randomUUID();
    const { rows } = await this.pool.query(
      `INSERT INTO dashboard_builder.user_dashboard_preferences
        (id, user_id, scope, domain_id, sub_domain_id, value_chain_code, dashboard_id,
         created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
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

  async getDashboardWithWidgets(id: string): Promise<{ dashboard: Record<string, unknown>; widgets: Record<string, unknown>[]; sections: Record<string, unknown>[] } | null> {
    const { rows: dashRows } = await this.pool.query(
      `SELECT * FROM dashboard_builder.dashboards WHERE id = $1`,
      [id],
    );
    if (dashRows.length === 0) return null;

    const { rows: widgetRows } = await this.pool.query(
      `SELECT * FROM dashboard_builder.dashboard_widgets WHERE dashboard_id = $1 ORDER BY grid_y, grid_x`,
      [id],
    );

    const { rows: sectionRows } = await this.pool.query(
      `SELECT * FROM dashboard_builder.dashboard_sections WHERE dashboard_id = $1 ORDER BY sort_order`,
      [id],
    );

    return { dashboard: dashRows[0], widgets: widgetRows, sections: sectionRows };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════════════════════════

  private hasAccess(dashboard: Record<string, unknown>, user: { userId: string; role?: string; tenantId?: string }): boolean {
    if (dashboard.ownership === 'SYSTEM_TEMPLATE') return true;
    if (dashboard.owner_user_id === user.userId) return true;
    const shares = dashboard.shares as Array<Record<string, unknown>> | undefined;
    if (!shares) return false;
    const now = new Date();
    return shares.some((s) => {
      if (s.status !== 'ACTIVE') return false;
      if (s.expires_at && new Date(s.expires_at as string) < now) return false;
      const st = s.share_type || (s.is_public ? 'PUBLIC' : s.shared_with_role ? 'ROLE' : 'USER');
      switch (st) {
        case 'PUBLIC': return true;
        case 'USER': return s.shared_with_user_id === user.userId;
        case 'ROLE': return s.shared_with_role === user.role;
        case 'COUNTRY': return s.shared_with_tenant_id === user.tenantId;
        case 'REC': return s.shared_with_tenant_id === user.tenantId;
        default: return false;
      }
    });
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
        } as any),
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
