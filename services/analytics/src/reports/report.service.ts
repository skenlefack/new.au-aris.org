/**
 * report.service.ts — CRUD for ReportTemplate, Report, FlashAlert, FlashStrategy.
 *
 * Uses pg Pool directly (consistent with analytics service pattern).
 * All writes publish Kafka events with a 5 s timeout (feedback_kafka_timeout_pattern).
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { RedisClient } from '../services/redis-client';
import type { FastifyKafka } from '@aris/kafka-client/fastify';
import {
  TOPIC_SYS_ANALYTICS_REPORT_PUBLISHED,
} from '@aris/shared-types';
import { ReportGenerator } from './report-generator';
import type {
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
  GenerateReportBody,
  ListReportsQuery,
  EditSectionBody,
  CreateFlashStrategyDto,
  UpdateFlashStrategyDto,
} from './report.schemas';

const CACHE_PREFIX = 'analytics:report:';
const CACHE_TTL = 300; // 5 min
const KAFKA_TIMEOUT_MS = 5_000;

export class ReportService {
  private pool: Pool;
  private generator: ReportGenerator;

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
    this.generator = new ReportGenerator(kafka, url);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Report Templates CRUD
  // ═══════════════════════════════════════════════════════════════════════

  async listTemplates(): Promise<unknown[]> {
    const cacheKey = `${CACHE_PREFIX}templates`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* stale */ }
    }
    const { rows } = await this.pool.query(
      `SELECT * FROM analytics.report_templates WHERE active = true ORDER BY created_at DESC`,
    );
    await this.redis.set(cacheKey, JSON.stringify(rows), CACHE_TTL);
    return rows;
  }

  async getTemplateById(id: string): Promise<unknown | null> {
    const cacheKey = `${CACHE_PREFIX}template:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* stale */ }
    }
    const { rows } = await this.pool.query(
      `SELECT * FROM analytics.report_templates WHERE id = $1`,
      [id],
    );
    if (rows[0]) await this.redis.set(cacheKey, JSON.stringify(rows[0]), CACHE_TTL);
    return rows[0] ?? null;
  }

  async createTemplate(dto: CreateReportTemplateDto, userId: string): Promise<unknown> {
    const id = randomUUID();
    const { rows } = await this.pool.query(
      `INSERT INTO analytics.report_templates
         (id, code, name_fr, name_en, type, domain_id, scope, description_fr, description_en, sections, active, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, NOW(), NOW())
       RETURNING *`,
      [
        id, dto.code, dto.nameFr, dto.nameEn, dto.type,
        dto.domainId ?? null, dto.scope ?? null,
        dto.descriptionFr ?? null, dto.descriptionEn ?? null,
        JSON.stringify(dto.sections), userId,
      ],
    );
    await this.invalidateTemplateCache();
    return rows[0];
  }

  async updateTemplate(id: string, dto: UpdateReportTemplateDto): Promise<unknown | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fieldMap: Record<string, string> = {
      nameFr: 'name_fr', nameEn: 'name_en', type: 'type',
      domainId: 'domain_id', scope: 'scope',
      descriptionFr: 'description_fr', descriptionEn: 'description_en',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((dto as Record<string, unknown>)[key] !== undefined) {
        sets.push(`${col} = $${idx++}`);
        values.push((dto as Record<string, unknown>)[key]);
      }
    }

    if (dto.sections !== undefined) {
      sets.push(`sections = $${idx++}`);
      values.push(JSON.stringify(dto.sections));
    }

    if (!sets.length) return this.getTemplateById(id);

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await this.pool.query(
      `UPDATE analytics.report_templates SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    await this.invalidateTemplateCache();
    return rows[0] ?? null;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE analytics.report_templates SET active = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    await this.invalidateTemplateCache();
    return (rowCount ?? 0) > 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Reports
  // ═══════════════════════════════════════════════════════════════════════

  async listReports(
    filters: ListReportsQuery,
    tenantId?: string,
  ): Promise<{ data: unknown[]; meta: { total: number; page: number; limit: number } }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const where: string[] = ['1=1'];
    const values: unknown[] = [];
    let idx = 1;

    if (filters.type) { where.push(`r.type = $${idx++}`); values.push(filters.type); }
    if (filters.status) { where.push(`r.status = $${idx++}`); values.push(filters.status); }
    if (filters.domainId) { where.push(`r.domain_id = $${idx++}`); values.push(filters.domainId); }
    if (filters.scope) { where.push(`r.scope = $${idx++}`); values.push(filters.scope); }
    if (tenantId) { where.push(`r.tenant_id = $${idx++}`); values.push(tenantId); }

    const whereClause = where.join(' AND ');

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM analytics.reports r WHERE ${whereClause}`,
      values,
    );
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    values.push(limit, offset);
    const { rows } = await this.pool.query(
      `SELECT r.*, rt.name_fr AS template_name_fr, rt.name_en AS template_name_en
       FROM analytics.reports r
       LEFT JOIN analytics.report_templates rt ON rt.id = r.template_id
       WHERE ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      values,
    );

    return { data: rows, meta: { total, page, limit } };
  }

  async getReportById(id: string): Promise<unknown | null> {
    const { rows } = await this.pool.query(
      `SELECT r.*,
              rt.name_fr AS template_name_fr,
              rt.name_en AS template_name_en,
              rt.sections AS template_sections,
              COALESCE(
                (SELECT json_agg(s ORDER BY s.display_order)
                 FROM analytics.report_sections s
                 WHERE s.report_id = r.id), '[]'::json
              ) AS sections
       FROM analytics.reports r
       LEFT JOIN analytics.report_templates rt ON rt.id = r.template_id
       WHERE r.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  /**
   * Create a report in DRAFT status, then trigger generation asynchronously.
   */
  async generateReport(dto: GenerateReportBody, userId: string, tenantId?: string): Promise<unknown> {
    const id = randomUUID();

    const { rows } = await this.pool.query(
      `INSERT INTO analytics.reports
         (id, template_id, title_fr, title_en, theme_fr, scope, domain_id, tenant_id,
          period_start, period_end, reference_year, language, type, status, created_by, created_at, updated_at)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, rt.type, 'DRAFT', $13, NOW(), NOW()
       FROM analytics.report_templates rt
       WHERE rt.id = $2
       RETURNING *`,
      [
        id, dto.templateId, dto.titleFr, dto.titleEn,
        dto.themeFr ?? null, dto.scope,
        dto.domainId ?? null, tenantId ?? dto.tenantId ?? null,
        dto.periodStart, dto.periodEnd,
        dto.referenceYear ?? null, dto.language, userId,
      ],
    );

    if (!rows[0]) throw Object.assign(new Error('Template not found'), { statusCode: 404 });

    // Fire-and-forget generation
    this.generator.generate(id).catch((err) => {
      console.error(`[ReportService] Background generation failed for ${id}:`, err);
    });

    return rows[0];
  }

  async getReportStatus(id: string): Promise<unknown | null> {
    const { rows } = await this.pool.query(
      `SELECT id, status, ai_unavailable, error_message, generated_at, updated_at
       FROM analytics.reports WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async editSection(reportId: string, sectionCode: string, dto: EditSectionBody): Promise<unknown | null> {
    const { rows } = await this.pool.query(
      `UPDATE analytics.report_sections
       SET content_html = $1, status = 'EDITED', updated_at = NOW()
       WHERE report_id = $2 AND section_code = $3
       RETURNING *`,
      [dto.contentHtml, reportId, sectionCode],
    );
    return rows[0] ?? null;
  }

  async regenerateSection(reportId: string, sectionCode: string): Promise<{ message: string }> {
    // Re-trigger generation for a single section
    // For now, re-generate the whole report (simpler, sections are upserted)
    this.generator.generate(reportId).catch((err) => {
      console.error(`[ReportService] Section regeneration failed:`, err);
    });
    return { message: 'Regeneration started' };
  }

  async approveReport(id: string, userId: string): Promise<unknown | null> {
    const { rows } = await this.pool.query(
      `UPDATE analytics.reports
       SET status = 'AWAITING_REVIEW', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status IN ('AWAITING_REVIEW', 'DRAFT')
       RETURNING *`,
      [userId, id],
    );
    return rows[0] ?? null;
  }

  async publishReport(id: string, userId: string): Promise<unknown | null> {
    const { rows } = await this.pool.query(
      `UPDATE analytics.reports
       SET status = 'PUBLISHED', published_by = $1, published_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'AWAITING_REVIEW'
       RETURNING *`,
      [userId, id],
    );

    if (rows[0]) {
      await this.publishEvent(TOPIC_SYS_ANALYTICS_REPORT_PUBLISHED, {
        reportId: id,
        publishedBy: userId,
        publishedAt: new Date().toISOString(),
      });
    }

    return rows[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Flash Alerts
  // ═══════════════════════════════════════════════════════════════════════

  async listFlashAlerts(tenantId?: string): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      tenantId
        ? `SELECT * FROM analytics.flash_alerts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`
        : `SELECT * FROM analytics.flash_alerts ORDER BY created_at DESC LIMIT 50`,
      tenantId ? [tenantId] : [],
    );
    return rows;
  }

  async getFlashAlertById(id: string): Promise<unknown | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM analytics.flash_alerts WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async dismissFlashAlert(id: string, userId: string): Promise<unknown | null> {
    const { rows } = await this.pool.query(
      `UPDATE analytics.flash_alerts
       SET dismissed = true, dismissed_by = $1, dismissed_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [userId, id],
    );
    return rows[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Flash Strategies CRUD
  // ═══════════════════════════════════════════════════════════════════════

  async listFlashStrategies(): Promise<unknown[]> {
    const cacheKey = `${CACHE_PREFIX}flash-strategies`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* stale */ }
    }
    const { rows } = await this.pool.query(
      `SELECT * FROM analytics.flash_strategies ORDER BY created_at DESC`,
    );
    await this.redis.set(cacheKey, JSON.stringify(rows), CACHE_TTL);
    return rows;
  }

  async createFlashStrategy(dto: CreateFlashStrategyDto, userId: string): Promise<unknown> {
    const id = randomUUID();
    const { rows } = await this.pool.query(
      `INSERT INTO analytics.flash_strategies
         (id, code, name_fr, name_en, domain_id, indicator_code, condition_type, condition_value,
          template_id, cooldown_minutes, active, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
       RETURNING *`,
      [
        id, dto.code, dto.nameFr, dto.nameEn,
        dto.domainId ?? null, dto.indicatorCode,
        dto.conditionType, dto.conditionValue,
        dto.templateId, dto.cooldownMinutes ?? 60,
        dto.active ?? true, userId,
      ],
    );
    await this.invalidateFlashStrategyCache();
    return rows[0];
  }

  async updateFlashStrategy(id: string, dto: UpdateFlashStrategyDto): Promise<unknown | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fieldMap: Record<string, string> = {
      nameFr: 'name_fr', nameEn: 'name_en',
      domainId: 'domain_id', indicatorCode: 'indicator_code',
      conditionType: 'condition_type', conditionValue: 'condition_value',
      templateId: 'template_id', cooldownMinutes: 'cooldown_minutes',
      active: 'active',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((dto as Record<string, unknown>)[key] !== undefined) {
        sets.push(`${col} = $${idx++}`);
        values.push((dto as Record<string, unknown>)[key]);
      }
    }

    if (!sets.length) return null;

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await this.pool.query(
      `UPDATE analytics.flash_strategies SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    await this.invalidateFlashStrategyCache();
    return rows[0] ?? null;
  }

  async deleteFlashStrategy(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM analytics.flash_strategies WHERE id = $1`,
      [id],
    );
    await this.invalidateFlashStrategyCache();
    return (rowCount ?? 0) > 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════════════════════════

  getPool(): Pool {
    return this.pool;
  }

  getGenerator(): ReportGenerator {
    return this.generator;
  }

  private async invalidateTemplateCache(): Promise<void> {
    await this.redis.del(`${CACHE_PREFIX}templates`);
  }

  private async invalidateFlashStrategyCache(): Promise<void> {
    await this.redis.del(`${CACHE_PREFIX}flash-strategies`);
  }

  private async publishEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.kafka) return;
    try {
      await Promise.race([
        this.kafka.producer.send({
          topic,
          messages: [{ key: payload['reportId'] as string ?? randomUUID(), value: JSON.stringify(payload) }],
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka timeout')), KAFKA_TIMEOUT_MS)),
      ]);
    } catch (err) {
      console.warn(`[ReportService] Kafka publish to ${topic} failed:`, err);
    }
  }
}
