/**
 * seed-strategic-helpers.ts — Shared helpers for strategic dashboard seeds.
 *
 * Each domain seed file imports these helpers to avoid code duplication.
 * The main orchestrator (seed-strategic-dashboards.ts) calls each domain seed.
 */

import { PrismaClient } from '@prisma/client';

// ── Types ────────────────────────────────────────────────────────────────

export interface WidgetDef {
  type: string;
  dataSource: string;
  titleEn: string;
  titleFr: string;
  config: Record<string, unknown>;
  filters?: Record<string, unknown>;
  gridX?: number;
  gridY?: number;
  gridW?: number;
  gridH?: number;
}

export interface SectionDef {
  titleEn: string;
  titleFr: string;
  columnCount: number;
  sortOrder: number;
  widgets: WidgetDef[];
}

export interface DashboardDef {
  code: string; // used for idempotency check in description
  domainCode: string;
  subDomainCode?: string;
  valueChainCode?: string;
  scope: string;
  titleEn: string;
  titleFr: string;
  description: string;
  sections: SectionDef[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Resolve domain UUID from governance.domains table.
 * Returns null if not found (domain not seeded yet).
 */
export async function resolveDomainId(prisma: PrismaClient, code: string): Promise<string | null> {
  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT id FROM governance.domains WHERE code = $1 LIMIT 1`,
    code,
  );
  return rows.length > 0 ? rows[0].id : null;
}

/**
 * Resolve sub-domain UUID from governance.sub_domains table.
 */
export async function resolveSubDomainId(prisma: PrismaClient, code: string): Promise<string | null> {
  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT id FROM governance.sub_domains WHERE code = $1 LIMIT 1`,
    code,
  );
  return rows.length > 0 ? rows[0].id : null;
}

/**
 * Check if a strategic dashboard already exists (by description convention).
 */
async function dashboardExists(prisma: PrismaClient, code: string): Promise<boolean> {
  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT id FROM dashboard_builder.dashboards
     WHERE ownership = 'SYSTEM_TEMPLATE'::dashboard_builder."DashboardOwnership" AND description LIKE $1 LIMIT 1`,
    `%[${code}]%`,
  );
  return rows.length > 0;
}

/**
 * Create a full dashboard with sections and widgets. Idempotent.
 * Returns the dashboard UUID or null if skipped.
 */
export async function createStrategicDashboard(
  prisma: PrismaClient,
  def: DashboardDef,
): Promise<string | null> {
  // Idempotency check
  if (await dashboardExists(prisma, def.code)) {
    console.log(`  [SKIP] ${def.code} — already exists`);
    return null;
  }

  // Resolve domain
  const domainId = await resolveDomainId(prisma, def.domainCode);
  if (!domainId) {
    console.log(`  [SKIP] ${def.code} — domain '${def.domainCode}' not found`);
    return null;
  }

  // Resolve optional sub-domain
  let subDomainId: string | null = null;
  if (def.subDomainCode) {
    subDomainId = await resolveSubDomainId(prisma, def.subDomainCode);
  }

  // Create dashboard
  const descWithCode = `${def.description} [${def.code}]`;
  const dashRows: any[] = await (prisma as any).$queryRawUnsafe(
    `INSERT INTO dashboard_builder.dashboards
       (id, ownership, scope, domain_id, sub_domain_id, value_chain_code,
        title_en, title_fr, description, grid_columns, row_height, is_default, created_at, updated_at)
     VALUES (gen_random_uuid(), 'SYSTEM_TEMPLATE'::dashboard_builder."DashboardOwnership",
             $1::dashboard_builder."DashboardScope", $2::uuid, $3::uuid, $4,
             $5, $6, $7, 12, 80, true, NOW(), NOW())
     RETURNING id`,
    def.scope, domainId, subDomainId, def.valueChainCode || null,
    def.titleEn, def.titleFr, descWithCode,
  );
  const dashboardId = dashRows[0].id;

  // Create sections + widgets
  let totalWidgets = 0;
  for (const section of def.sections) {
    const secRows: any[] = await (prisma as any).$queryRawUnsafe(
      `INSERT INTO dashboard_builder.dashboard_sections
         (id, dashboard_id, title_en, title_fr, column_count, sort_order, is_collapsed, config, created_at, updated_at)
       VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, false, '{}'::jsonb, NOW(), NOW())
       RETURNING id`,
      dashboardId, section.titleEn, section.titleFr, section.columnCount, section.sortOrder,
    );
    const sectionId = secRows[0].id;

    for (let i = 0; i < section.widgets.length; i++) {
      const w = section.widgets[i];
      const colIdx = i % section.columnCount;
      const sortOrd = Math.floor(i / section.columnCount);

      await (prisma as any).$executeRawUnsafe(
        `INSERT INTO dashboard_builder.dashboard_widgets
           (id, dashboard_id, section_id, column_index, sort_order,
            type, data_source, grid_x, grid_y, grid_w, grid_h,
            title_en, title_fr, config, filters, created_at, updated_at)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4,
                 $5::dashboard_builder."WidgetType", $6::dashboard_builder."WidgetDataSource",
                 $7, $8, $9, $10,
                 $11, $12, $13::jsonb, $14::jsonb, NOW(), NOW())`,
        dashboardId, sectionId, colIdx, sortOrd,
        w.type, w.dataSource, w.gridX || 0, w.gridY || 0, w.gridW || 3, w.gridH || 2,
        w.titleEn, w.titleFr, JSON.stringify(w.config), JSON.stringify(w.filters || {}),
      );
      totalWidgets++;
    }
  }

  console.log(`  [CREATE] ${def.code} — ${dashboardId} (${def.sections.length} sections, ${totalWidgets} widgets)`);
  return dashboardId;
}

// ── KPI Widget shorthand ────────────────────────────────────────────────

export function kpi(titleEn: string, titleFr: string, indicatorCode: string, color: string, unit?: string): WidgetDef {
  return {
    type: 'KPI_CARD', dataSource: 'INDICATOR',
    titleEn, titleFr,
    config: { indicatorCode, color, dataSource: 'INDICATOR', ...(unit ? { unit } : {}) },
  };
}

export function kpiManual(titleEn: string, titleFr: string, label: string, color: string, value?: number): WidgetDef {
  return {
    type: 'KPI_CARD', dataSource: 'MANUAL_VALUE',
    titleEn, titleFr,
    config: { label, color, value: value ?? 0, dataSource: 'MANUAL_VALUE' },
  };
}

// ── Chart Widget shorthands ─────────────────────────────────────────────

export function lineChart(titleEn: string, titleFr: string, domain: string, extra?: Record<string, unknown>): WidgetDef {
  return {
    type: 'LINE_CHART', dataSource: 'KPI_CONTINENTAL',
    titleEn, titleFr,
    config: { domain, period: '12M', ...extra },
  };
}

export function barChart(titleEn: string, titleFr: string, domain: string, extra?: Record<string, unknown>): WidgetDef {
  return {
    type: 'BAR_CHART', dataSource: 'KPI_CONTINENTAL',
    titleEn, titleFr,
    config: { domain, limit: 10, ...extra },
  };
}

export function stackedBar(titleEn: string, titleFr: string, domain: string, extra?: Record<string, unknown>): WidgetDef {
  return {
    type: 'STACKED_BAR', dataSource: 'KPI_CONTINENTAL',
    titleEn, titleFr,
    config: { domain, groupBy: 'rec', ...extra },
  };
}

export function pieChart(titleEn: string, titleFr: string, domain: string, extra?: Record<string, unknown>): WidgetDef {
  return {
    type: 'PIE_CHART', dataSource: 'KPI_CONTINENTAL',
    titleEn, titleFr,
    config: { domain, ...extra },
  };
}

export function areaChart(titleEn: string, titleFr: string, domain: string, extra?: Record<string, unknown>): WidgetDef {
  return {
    type: 'AREA_CHART', dataSource: 'KPI_CONTINENTAL',
    titleEn, titleFr,
    config: { domain, period: '12M', ...extra },
  };
}

export function mapAfrica(titleEn: string, titleFr: string, domain: string, extra?: Record<string, unknown>): WidgetDef {
  return {
    type: 'MAP_AFRICA', dataSource: 'KPI_CONTINENTAL',
    titleEn, titleFr,
    config: { domain, ...extra },
  };
}

export function gauge(titleEn: string, titleFr: string, indicatorCode: string, target: number, extra?: Record<string, unknown>): WidgetDef {
  return {
    type: 'GAUGE', dataSource: 'INDICATOR',
    titleEn, titleFr,
    config: { indicatorCode, target, dataSource: 'INDICATOR', ...extra },
  };
}

export function dualAxis(titleEn: string, titleFr: string, domain: string, extra?: Record<string, unknown>): WidgetDef {
  return {
    type: 'STACKED_BAR', dataSource: 'KPI_CONTINENTAL', // DUAL_AXIS not in enum, use STACKED_BAR as proxy
    titleEn, titleFr,
    config: { domain, chartMode: 'dual-axis', ...extra },
  };
}

export function table(titleEn: string, titleFr: string, domain: string, extra?: Record<string, unknown>): WidgetDef {
  return {
    type: 'TABLE', dataSource: 'KPI_CONTINENTAL',
    titleEn, titleFr,
    config: { domain, ...extra },
  };
}

export function rankedList(titleEn: string, titleFr: string, domain: string, extra?: Record<string, unknown>): WidgetDef {
  return {
    type: 'TABLE', dataSource: 'KPI_CONTINENTAL', // RANKED_LIST not in enum, use TABLE
    titleEn, titleFr,
    config: { domain, displayMode: 'ranked', ...extra },
  };
}

export function alertFeed(titleEn: string, titleFr: string, domain: string, extra?: Record<string, unknown>): WidgetDef {
  return {
    type: 'ALERT_FEED', dataSource: 'KPI_CONTINENTAL',
    titleEn, titleFr,
    config: { domain, ...extra },
  };
}

export function heatmap(titleEn: string, titleFr: string, domain: string, extra?: Record<string, unknown>): WidgetDef {
  return {
    type: 'HEATMAP', dataSource: 'KPI_CONTINENTAL',
    titleEn, titleFr,
    config: { domain, ...extra },
  };
}

export function textBlock(titleEn: string, titleFr: string, contentEn: string, contentFr: string): WidgetDef {
  return {
    type: 'TEXT_BLOCK', dataSource: 'MANUAL_VALUE',
    titleEn, titleFr,
    config: { contentEn, contentFr, format: 'markdown' },
  };
}

export function progressBar(titleEn: string, titleFr: string, indicatorCode: string, target: number): WidgetDef {
  return {
    type: 'PROGRESS_BAR', dataSource: 'INDICATOR',
    titleEn, titleFr,
    config: { indicatorCode, target, dataSource: 'INDICATOR' },
  };
}

export function sqlWidget(titleEn: string, titleFr: string, type: string, query: string): WidgetDef {
  return {
    type, dataSource: 'SQL_QUERY',
    titleEn, titleFr,
    config: { query, dataSource: 'SQL_QUERY' },
  };
}

export function iframeBi(titleEn: string, titleFr: string, url: string): WidgetDef {
  return {
    type: 'IFRAME_BI', dataSource: 'MANUAL_VALUE',
    titleEn, titleFr,
    config: { url },
  };
}
