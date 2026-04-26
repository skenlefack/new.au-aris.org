/**
 * seed-dashboard-templates.ts -- Idempotent seed for SYSTEM_TEMPLATE dashboards.
 *
 * Creates one continental dashboard per main domain with a standard layout:
 *   Row 0: 4x KPI_CARD (gridW=3 each)
 *   Row 1: 1x MAP_AFRICA (gridW=8) + 1x BAR_CHART (gridW=4)
 *   Row 2: 1x LINE_CHART (gridW=6) + 1x STACKED_BAR (gridW=6)
 *
 * Usage:
 *   DATABASE_URL="..." npx tsx packages/db-schemas/prisma/seed-dashboard-templates.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Domain KPI definitions ────────────────────────────────────────────

interface DomainKpi {
  titleEn: string;
  titleFr: string;
  config: Record<string, unknown>;
}

const DOMAIN_KPIS: Record<string, { titleEn: string; titleFr: string; kpis: DomainKpi[] }> = {
  'animal-health': {
    titleEn: 'Animal Health - Continental Overview',
    titleFr: 'Sante animale - Vue continentale',
    kpis: [
      { titleEn: 'Active Outbreaks', titleFr: 'Foyers actifs', config: { indicatorCode: 'active-outbreaks', color: '#C62828' } },
      { titleEn: 'Vaccination Coverage', titleFr: 'Couverture vaccinale', config: { indicatorCode: 'vaccination-coverage', color: '#1565C0', unit: '%' } },
      { titleEn: 'Lab Confirmations', titleFr: 'Confirmations labo', config: { indicatorCode: 'lab-confirmations', color: '#2E7D32' } },
      { titleEn: 'Notification Rate', titleFr: 'Taux de notification', config: { indicatorCode: 'disease-notification', color: '#E65100', unit: '%' } },
    ],
  },
  'livestock-prod': {
    titleEn: 'Livestock Production - Continental Overview',
    titleFr: 'Production animale - Vue continentale',
    kpis: [
      { titleEn: 'Total Livestock (M heads)', titleFr: 'Cheptel total (M tetes)', config: { indicatorCode: 'total-livestock', color: '#E65100' } },
      { titleEn: 'Census Completion', titleFr: 'Achevement recensement', config: { indicatorCode: 'livestock-census', color: '#1565C0', unit: '%' } },
      { titleEn: 'Production Volume', titleFr: 'Volume production', config: { indicatorCode: 'production-volume', color: '#2E7D32' } },
      { titleEn: 'Active Campaigns', titleFr: 'Campagnes actives', config: { indicatorCode: 'active-campaigns', color: '#6A1B9A' } },
    ],
  },
  'trade-sps': {
    titleEn: 'Trade & SPS - Continental Overview',
    titleFr: 'Commerce & SPS - Vue continentale',
    kpis: [
      { titleEn: 'Trade Flows', titleFr: 'Flux commerciaux', config: { indicatorCode: 'trade-flows', color: '#1565C0' } },
      { titleEn: 'SPS Certification Rate', titleFr: 'Taux certification SPS', config: { indicatorCode: 'trade-certification', color: '#2E7D32', unit: '%' } },
      { titleEn: 'Active Markets', titleFr: 'Marches actifs', config: { indicatorCode: 'active-markets', color: '#E65100' } },
      { titleEn: 'Border Points', titleFr: 'Points frontaliers', config: { indicatorCode: 'border-points', color: '#6A1B9A' } },
    ],
  },
  'fisheries': {
    titleEn: 'Fisheries & Aquaculture - Continental Overview',
    titleFr: 'Peches & Aquaculture - Vue continentale',
    kpis: [
      { titleEn: 'Total Captures (t)', titleFr: 'Captures totales (t)', config: { indicatorCode: 'total-captures', color: '#0277BD' } },
      { titleEn: 'Monitoring Coverage', titleFr: 'Couverture surveillance', config: { indicatorCode: 'fisheries-monitoring', color: '#1565C0', unit: '%' } },
      { titleEn: 'Aquaculture Production', titleFr: 'Production aquacole', config: { indicatorCode: 'aquaculture-production', color: '#2E7D32' } },
      { titleEn: 'Active Vessels', titleFr: 'Navires actifs', config: { indicatorCode: 'active-vessels', color: '#E65100' } },
    ],
  },
  'governance': {
    titleEn: 'Governance & Capacities - Continental Overview',
    titleFr: 'Gouvernance & Capacites - Vue continentale',
    kpis: [
      { titleEn: 'Legal Frameworks', titleFr: 'Cadres juridiques', config: { indicatorCode: 'legal-frameworks', color: '#4527A0' } },
      { titleEn: 'Vet Evaluation Score (avg)', titleFr: 'Score evaluation vet. (moy)', config: { indicatorCode: 'vet-eval-score-avg', color: '#1565C0' } },
      { titleEn: 'Staff Capacity', titleFr: 'Capacite en personnel', config: { indicatorCode: 'staff-capacity', color: '#2E7D32' } },
      { titleEn: 'Countries Evaluated', titleFr: 'Pays evalues', config: { indicatorCode: 'countries-evaluated', color: '#E65100' } },
    ],
  },
};

// ── Main seed ─────────────────────────────────────────────────────────

async function seedDashboardTemplates() {
  console.log('[seed-dashboard-templates] Starting...');

  // Ensure schema exists
  try {
    await (prisma as any).$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS dashboard_builder`);
  } catch { /* schema may already exist */ }

  // Lookup real domain IDs from the governance.domains table
  const domains: { id: string; code: string }[] = await (prisma as any).$queryRawUnsafe(
    `SELECT id, code FROM governance.domains WHERE code = ANY($1::text[])`,
    Object.keys(DOMAIN_KPIS),
  );

  if (domains.length === 0) {
    console.log('  No domains found in governance.domains — skipping dashboard templates.');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const domain of domains) {
    const def = DOMAIN_KPIS[domain.code];
    if (!def) continue;

    // Check if template already exists
    const existing: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT id FROM dashboard_builder.dashboards WHERE ownership = 'SYSTEM_TEMPLATE' AND scope = 'CONTINENTAL' AND domain_id = $1::uuid LIMIT 1`,
      domain.id,
    );

    if (existing.length > 0) {
      console.log(`  [SKIP] ${domain.code} — already exists`);
      skipped++;
      continue;
    }

    // Create dashboard
    const dashId: any[] = await (prisma as any).$queryRawUnsafe(
      `INSERT INTO dashboard_builder.dashboards (id, ownership, scope, domain_id, title_en, title_fr, description, grid_columns, row_height, is_default, created_at, updated_at)
       VALUES (gen_random_uuid(), 'SYSTEM_TEMPLATE', 'CONTINENTAL', $1::uuid, $2, $3, $4, 12, 80, true, NOW(), NOW())
       RETURNING id`,
      domain.id, def.titleEn, def.titleFr, `System template for ${domain.code} continental dashboard`,
    );

    const dashboardId = dashId[0].id;

    // Create widgets
    const widgets = [
      // Row 0: 4 KPI cards
      ...def.kpis.map((kpi, i) => ({
        type: 'KPI_CARD', dataSource: 'INDICATOR', gridX: i * 3, gridY: 0, gridW: 3, gridH: 2,
        titleEn: kpi.titleEn, titleFr: kpi.titleFr, config: JSON.stringify({ ...kpi.config, dataSource: 'INDICATOR' }),
      })),
      // Row 1: MAP + BAR
      { type: 'MAP_AFRICA', dataSource: 'KPI_CONTINENTAL', gridX: 0, gridY: 2, gridW: 8, gridH: 5,
        titleEn: 'Geographic Distribution', titleFr: 'Distribution geographique', config: JSON.stringify({ domain: domain.code }) },
      { type: 'BAR_CHART', dataSource: 'KPI_CONTINENTAL', gridX: 8, gridY: 2, gridW: 4, gridH: 5,
        titleEn: 'Top 10 Countries', titleFr: 'Top 10 Pays', config: JSON.stringify({ domain: domain.code, limit: 10 }) },
      // Row 2: LINE + STACKED
      { type: 'LINE_CHART', dataSource: 'KPI_CONTINENTAL', gridX: 0, gridY: 7, gridW: 6, gridH: 4,
        titleEn: 'Trend (Last 12 Months)', titleFr: 'Tendance (12 derniers mois)', config: JSON.stringify({ domain: domain.code, period: '12M' }) },
      { type: 'STACKED_BAR', dataSource: 'KPI_CONTINENTAL', gridX: 6, gridY: 7, gridW: 6, gridH: 4,
        titleEn: 'Breakdown by REC', titleFr: 'Repartition par CER', config: JSON.stringify({ domain: domain.code, groupBy: 'rec' }) },
    ];

    for (const w of widgets) {
      await (prisma as any).$executeRawUnsafe(
        `INSERT INTO dashboard_builder.dashboard_widgets (id, dashboard_id, type, data_source, grid_x, grid_y, grid_w, grid_h, title_en, title_fr, config, filters, created_at, updated_at)
         VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, '{}'::jsonb, NOW(), NOW())`,
        dashboardId, w.type, w.dataSource, w.gridX, w.gridY, w.gridW, w.gridH, w.titleEn, w.titleFr, w.config,
      );
    }

    console.log(`  [CREATE] ${domain.code} — ${dashboardId} (${widgets.length} widgets)`);
    created++;
  }

  console.log(`\n[seed-dashboard-templates] Done: ${created} created, ${skipped} skipped.`);
}

seedDashboardTemplates()
  .catch((err) => {
    console.error('[seed-dashboard-templates] FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
