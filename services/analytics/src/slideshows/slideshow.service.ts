/**
 * slideshow.service.ts — CRUD for Dashboard Slideshows.
 * Uses pg Pool directly (consistent with analytics service pattern).
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { RedisClient } from '../services/redis-client';
import type { FastifyKafka } from '@aris/kafka-client/fastify';
import type {
  CreateSlideshowDto,
  UpdateSlideshowDto,
  UpdateSlidesDto,
  ListSlideshowsQuery,
} from './slideshow.schemas';

const CACHE_PREFIX = 'analytics:slideshow:';
const CACHE_TTL = 300;

export class SlideshowService {
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

  getPool(): Pool { return this.pool; }

  private async publishEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.kafka) return;
    try {
      await Promise.race([
        this.kafka.send(topic, randomUUID(), payload, {
          source: 'analytics-slideshow-service',
          correlationId: randomUUID(),
        } as any),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka timeout')), 5000)),
      ]);
    } catch { /* non-blocking */ }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  List
  // ═══════════════════════════════════════════════════════════════════════

  async list(
    filters: ListSlideshowsQuery,
    tenantId: string,
  ): Promise<{ data: unknown[]; meta: { total: number; page: number; limit: number } }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const countRes = await this.pool.query(
      `SELECT COUNT(*) FROM dashboard_builder.dashboard_slideshows WHERE tenant_id = $1`,
      [tenantId],
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const res = await this.pool.query(
      `SELECT s.*,
              COALESCE(json_agg(
                json_build_object(
                  'id', sl.id,
                  'dashboardId', sl.dashboard_id,
                  'sortOrder', sl.sort_order,
                  'durationMs', sl.duration_ms,
                  'transition', sl.transition,
                  'dashboardTitle', d.title_fr
                ) ORDER BY sl.sort_order
              ) FILTER (WHERE sl.id IS NOT NULL), '[]') AS slides
       FROM dashboard_builder.dashboard_slideshows s
       LEFT JOIN dashboard_builder.dashboard_slideshow_slides sl ON sl.slideshow_id = s.id
       LEFT JOIN dashboard_builder.dashboards d ON d.id = sl.dashboard_id
       WHERE s.tenant_id = $1
       GROUP BY s.id
       ORDER BY s.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );

    return {
      data: res.rows.map(this.mapRow),
      meta: { total, page, limit },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Get by ID
  // ═══════════════════════════════════════════════════════════════════════

  async getById(id: string): Promise<unknown> {
    const cached = await this.redis.get(`${CACHE_PREFIX}${id}`);
    if (cached) return JSON.parse(cached);

    const res = await this.pool.query(
      `SELECT s.*,
              COALESCE(json_agg(
                json_build_object(
                  'id', sl.id,
                  'dashboardId', sl.dashboard_id,
                  'sortOrder', sl.sort_order,
                  'durationMs', sl.duration_ms,
                  'transition', sl.transition,
                  'dashboardTitleFr', d.title_fr,
                  'dashboardTitleEn', d.title_en
                ) ORDER BY sl.sort_order
              ) FILTER (WHERE sl.id IS NOT NULL), '[]') AS slides
       FROM dashboard_builder.dashboard_slideshows s
       LEFT JOIN dashboard_builder.dashboard_slideshow_slides sl ON sl.slideshow_id = s.id
       LEFT JOIN dashboard_builder.dashboards d ON d.id = sl.dashboard_id
       WHERE s.id = $1
       GROUP BY s.id`,
      [id],
    );

    if (res.rows.length === 0) {
      throw Object.assign(new Error('Slideshow not found'), { statusCode: 404 });
    }

    const data = this.mapRow(res.rows[0]);
    await this.redis.set(`${CACHE_PREFIX}${id}`, JSON.stringify(data), CACHE_TTL);
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Get by public token (no auth)
  // ═══════════════════════════════════════════════════════════════════════

  async getByPublicToken(token: string): Promise<unknown> {
    const cached = await this.redis.get(`${CACHE_PREFIX}public:${token}`);
    if (cached) return JSON.parse(cached);

    const res = await this.pool.query(
      `SELECT s.*,
              COALESCE(json_agg(
                json_build_object(
                  'id', sl.id,
                  'dashboardId', sl.dashboard_id,
                  'sortOrder', sl.sort_order,
                  'durationMs', sl.duration_ms,
                  'transition', sl.transition,
                  'dashboardTitleFr', d.title_fr,
                  'dashboardTitleEn', d.title_en
                ) ORDER BY sl.sort_order
              ) FILTER (WHERE sl.id IS NOT NULL), '[]') AS slides
       FROM dashboard_builder.dashboard_slideshows s
       LEFT JOIN dashboard_builder.dashboard_slideshow_slides sl ON sl.slideshow_id = s.id
       LEFT JOIN dashboard_builder.dashboards d ON d.id = sl.dashboard_id
       WHERE s.public_token = $1 AND s.is_active = true
       GROUP BY s.id`,
      [token],
    );

    if (res.rows.length === 0) {
      throw Object.assign(new Error('Slideshow not found or inactive'), { statusCode: 404 });
    }

    const data = this.mapRow(res.rows[0]);
    await this.redis.set(`${CACHE_PREFIX}public:${token}`, JSON.stringify(data), CACHE_TTL);
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Create
  // ═══════════════════════════════════════════════════════════════════════

  async create(dto: CreateSlideshowDto, userId: string, tenantId: string): Promise<unknown> {
    const id = randomUUID();
    const publicToken = randomUUID();
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO dashboard_builder.dashboard_slideshows
         (id, tenant_id, title_fr, title_en, title_ar, title_pt, description,
          public_token, transition, interval_ms, auto_play, loop, show_progress, show_controls,
          created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())`,
        [
          id, tenantId,
          dto.titleFr, dto.titleEn, dto.titleAr ?? null, dto.titlePt ?? null,
          dto.description ?? null, publicToken,
          dto.transition ?? 'FADE', dto.intervalMs ?? 15000,
          dto.autoPlay ?? true, dto.loop ?? true,
          dto.showProgress ?? true, dto.showControls ?? false,
          userId,
        ],
      );

      if (dto.slides?.length) {
        for (const slide of dto.slides) {
          await client.query(
            `INSERT INTO dashboard_builder.dashboard_slideshow_slides
             (id, slideshow_id, dashboard_id, sort_order, duration_ms, transition)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [randomUUID(), id, slide.dashboardId, slide.sortOrder, slide.durationMs ?? null, slide.transition ?? null],
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.publishEvent('sys.analytics.slideshow.created.v1', { id, tenantId, userId });
    return this.getById(id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Update
  // ═══════════════════════════════════════════════════════════════════════

  async update(id: string, dto: UpdateSlideshowDto, userId: string): Promise<unknown> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fields: Array<[string, string, unknown]> = [
      ['titleFr', 'title_fr', dto.titleFr],
      ['titleEn', 'title_en', dto.titleEn],
      ['titleAr', 'title_ar', dto.titleAr],
      ['titlePt', 'title_pt', dto.titlePt],
      ['description', 'description', dto.description],
      ['isActive', 'is_active', dto.isActive],
      ['transition', 'transition', dto.transition],
      ['intervalMs', 'interval_ms', dto.intervalMs],
      ['autoPlay', 'auto_play', dto.autoPlay],
      ['loop', 'loop', dto.loop],
      ['showProgress', 'show_progress', dto.showProgress],
      ['showControls', 'show_controls', dto.showControls],
    ];

    for (const [, col, val] of fields) {
      if (val !== undefined) {
        sets.push(`${col} = $${idx++}`);
        params.push(val);
      }
    }

    if (sets.length === 0) {
      return this.getById(id);
    }

    sets.push(`updated_at = NOW()`);
    params.push(id);

    await this.pool.query(
      `UPDATE dashboard_builder.dashboard_slideshows SET ${sets.join(', ')} WHERE id = $${idx}`,
      params,
    );

    await this.redis.del(`${CACHE_PREFIX}${id}`);
    // Also invalidate public token cache
    const row = await this.pool.query(`SELECT public_token FROM dashboard_builder.dashboard_slideshows WHERE id = $1`, [id]);
    if (row.rows[0]) {
      await this.redis.del(`${CACHE_PREFIX}public:${row.rows[0].public_token}`);
    }

    await this.publishEvent('sys.analytics.slideshow.updated.v1', { id, userId });
    return this.getById(id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Update slides (replace all)
  // ═══════════════════════════════════════════════════════════════════════

  async updateSlides(id: string, dto: UpdateSlidesDto, userId: string): Promise<unknown> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM dashboard_builder.dashboard_slideshow_slides WHERE slideshow_id = $1`, [id]);

      for (const slide of dto.slides) {
        await client.query(
          `INSERT INTO dashboard_builder.dashboard_slideshow_slides
           (id, slideshow_id, dashboard_id, sort_order, duration_ms, transition)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [randomUUID(), id, slide.dashboardId, slide.sortOrder, slide.durationMs ?? null, slide.transition ?? null],
        );
      }

      await client.query(`UPDATE dashboard_builder.dashboard_slideshows SET updated_at = NOW() WHERE id = $1`, [id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.redis.del(`${CACHE_PREFIX}${id}`);
    const row = await this.pool.query(`SELECT public_token FROM dashboard_builder.dashboard_slideshows WHERE id = $1`, [id]);
    if (row.rows[0]) {
      await this.redis.del(`${CACHE_PREFIX}public:${row.rows[0].public_token}`);
    }

    await this.publishEvent('sys.analytics.slideshow.updated.v1', { id, userId });
    return this.getById(id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Regenerate public token
  // ═══════════════════════════════════════════════════════════════════════

  async regenerateToken(id: string, userId: string): Promise<{ publicToken: string }> {
    // Invalidate old token cache
    const old = await this.pool.query(`SELECT public_token FROM dashboard_builder.dashboard_slideshows WHERE id = $1`, [id]);
    if (old.rows[0]) {
      await this.redis.del(`${CACHE_PREFIX}public:${old.rows[0].public_token}`);
    }

    const newToken = randomUUID();
    await this.pool.query(
      `UPDATE dashboard_builder.dashboard_slideshows SET public_token = $1, updated_at = NOW() WHERE id = $2`,
      [newToken, id],
    );

    await this.redis.del(`${CACHE_PREFIX}${id}`);
    await this.publishEvent('sys.analytics.slideshow.updated.v1', { id, userId, action: 'regenerate-token' });
    return { publicToken: newToken };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Delete
  // ═══════════════════════════════════════════════════════════════════════

  async delete(id: string, userId: string): Promise<void> {
    const row = await this.pool.query(`SELECT public_token FROM dashboard_builder.dashboard_slideshows WHERE id = $1`, [id]);
    if (row.rows[0]) {
      await this.redis.del(`${CACHE_PREFIX}public:${row.rows[0].public_token}`);
    }

    await this.pool.query(`DELETE FROM dashboard_builder.dashboard_slideshows WHERE id = $1`, [id]);
    await this.redis.del(`${CACHE_PREFIX}${id}`);
    await this.publishEvent('sys.analytics.slideshow.deleted.v1', { id, userId });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Row mapper
  // ═══════════════════════════════════════════════════════════════════════

  private mapRow(row: any): Record<string, unknown> {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      titleFr: row.title_fr,
      titleEn: row.title_en,
      titleAr: row.title_ar,
      titlePt: row.title_pt,
      description: row.description,
      publicToken: row.public_token,
      isActive: row.is_active,
      transition: row.transition,
      intervalMs: row.interval_ms,
      autoPlay: row.auto_play,
      loop: row.loop,
      showProgress: row.show_progress,
      showControls: row.show_controls,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      slides: row.slides ?? [],
    };
  }
}
