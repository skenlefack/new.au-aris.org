/**
 * seed-dashboard-templates.ts -- Idempotent seed for SYSTEM_TEMPLATE dashboards.
 *
 * Creates one continental dashboard per main domain with a standard layout:
 *   Row 0: 4x KPI_CARD (gridW=3 each)
 *   Row 1: 1x MAP_AFRICA (gridW=8) + 1x BAR_CHART (gridW=4)
 *   Row 2: 1x LINE_CHART (gridW=6) + 1x STACKED_BAR (gridW=6)
 *
 * Usage:
 *   npx tsx packages/db-schemas/prisma/seed-dashboard-templates.ts
 *
 * Idempotent: uses upsert-like logic keyed on (ownership=SYSTEM_TEMPLATE, domainId, scope=CONTINENTAL).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Domain definitions ─────────────────────────────────────────────────

interface DomainDef {
  code: string;
  domainId: string; // deterministic UUID per domain
  titleEn: string;
  titleFr: string;
  kpis: { titleEn: string; titleFr: string; config: Record<string, unknown> }[];
}

const DOMAINS: DomainDef[] = [
  {
    code: 'animal-health',
    domainId: 'a0000000-0000-4000-8000-000000000001',
    titleEn: 'Animal Health - Continental Overview',
    titleFr: 'Sante animale - Vue continentale',
    kpis: [
      { titleEn: 'Active Outbreaks', titleFr: 'Foyers actifs', config: { indicatorCode: 'active-outbreaks', color: '#C62828' } },
      { titleEn: 'Vaccination Coverage', titleFr: 'Couverture vaccinale', config: { indicatorCode: 'vaccination-coverage', color: '#1565C0', unit: '%' } },
      { titleEn: 'Lab Confirmations', titleFr: 'Confirmations labo', config: { indicatorCode: 'lab-confirmations', color: '#2E7D32' } },
      { titleEn: 'Notification Rate', titleFr: 'Taux de notification', config: { indicatorCode: 'disease-notification', color: '#E65100', unit: '%' } },
    ],
  },
  {
    code: 'livestock-prod',
    domainId: 'a0000000-0000-4000-8000-000000000002',
    titleEn: 'Livestock Production - Continental Overview',
    titleFr: 'Production animale - Vue continentale',
    kpis: [
      { titleEn: 'Total Livestock (M heads)', titleFr: 'Cheptel total (M tetes)', config: { indicatorCode: 'total-livestock', color: '#E65100' } },
      { titleEn: 'Census Completion', titleFr: 'Achevement recensement', config: { indicatorCode: 'livestock-census', color: '#1565C0', unit: '%' } },
      { titleEn: 'Production Volume', titleFr: 'Volume production', config: { indicatorCode: 'production-volume', color: '#2E7D32' } },
      { titleEn: 'Active Campaigns', titleFr: 'Campagnes actives', config: { indicatorCode: 'active-campaigns', color: '#6A1B9A' } },
    ],
  },
  {
    code: 'trade-sps',
    domainId: 'a0000000-0000-4000-8000-000000000003',
    titleEn: 'Trade & SPS - Continental Overview',
    titleFr: 'Commerce & SPS - Vue continentale',
    kpis: [
      { titleEn: 'Trade Flows', titleFr: 'Flux commerciaux', config: { indicatorCode: 'trade-flows', color: '#1565C0' } },
      { titleEn: 'SPS Certification Rate', titleFr: 'Taux certification SPS', config: { indicatorCode: 'trade-certification', color: '#2E7D32', unit: '%' } },
      { titleEn: 'Active Markets', titleFr: 'Marches actifs', config: { indicatorCode: 'active-markets', color: '#E65100' } },
      { titleEn: 'Border Points', titleFr: 'Points frontaliers', config: { indicatorCode: 'border-points', color: '#6A1B9A' } },
    ],
  },
  {
    code: 'fisheries',
    domainId: 'a0000000-0000-4000-8000-000000000004',
    titleEn: 'Fisheries & Aquaculture - Continental Overview',
    titleFr: 'Peches & Aquaculture - Vue continentale',
    kpis: [
      { titleEn: 'Total Captures (t)', titleFr: 'Captures totales (t)', config: { indicatorCode: 'total-captures', color: '#0277BD' } },
      { titleEn: 'Monitoring Coverage', titleFr: 'Couverture surveillance', config: { indicatorCode: 'fisheries-monitoring', color: '#1565C0', unit: '%' } },
      { titleEn: 'Aquaculture Production', titleFr: 'Production aquacole', config: { indicatorCode: 'aquaculture-production', color: '#2E7D32' } },
      { titleEn: 'Active Vessels', titleFr: 'Navires actifs', config: { indicatorCode: 'active-vessels', color: '#E65100' } },
    ],
  },
  {
    code: 'governance',
    domainId: 'a0000000-0000-4000-8000-000000000005',
    titleEn: 'Governance & Capacities - Continental Overview',
    titleFr: 'Gouvernance & Capacites - Vue continentale',
    kpis: [
      { titleEn: 'Legal Frameworks', titleFr: 'Cadres juridiques', config: { indicatorCode: 'legal-frameworks', color: '#4527A0' } },
      { titleEn: 'PVS Score (avg)', titleFr: 'Score PVS (moy)', config: { indicatorCode: 'pvs-score-avg', color: '#1565C0' } },
      { titleEn: 'Staff Capacity', titleFr: 'Capacite en personnel', config: { indicatorCode: 'staff-capacity', color: '#2E7D32' } },
      { titleEn: 'Countries Evaluated', titleFr: 'Pays evalues', config: { indicatorCode: 'countries-evaluated', color: '#E65100' } },
    ],
  },
];

// ── Widget template builder ────────────────────────────────────────────

interface WidgetInput {
  type: 'KPI_CARD' | 'MAP_AFRICA' | 'BAR_CHART' | 'LINE_CHART' | 'STACKED_BAR';
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  titleEn: string;
  titleFr: string;
  config: Record<string, unknown>;
}

function buildWidgets(domain: DomainDef): WidgetInput[] {
  const widgets: WidgetInput[] = [];

  // Row 0: 4 KPI cards
  domain.kpis.forEach((kpi, i) => {
    widgets.push({
      type: 'KPI_CARD',
      gridX: i * 3,
      gridY: 0,
      gridW: 3,
      gridH: 2,
      titleEn: kpi.titleEn,
      titleFr: kpi.titleFr,
      config: { ...kpi.config, dataSource: 'INDICATOR' },
    });
  });

  // Row 1: MAP_AFRICA (8 cols) + BAR_CHART (4 cols)
  widgets.push({
    type: 'MAP_AFRICA',
    gridX: 0,
    gridY: 2,
    gridW: 8,
    gridH: 5,
    titleEn: `${domain.code.replace(/-/g, ' ')} - Geographic Distribution`,
    titleFr: `${domain.code.replace(/-/g, ' ')} - Distribution geographique`,
    config: { domain: domain.code, dataSource: 'KPI_CONTINENTAL' },
  });

  widgets.push({
    type: 'BAR_CHART',
    gridX: 8,
    gridY: 2,
    gridW: 4,
    gridH: 5,
    titleEn: 'Top 10 Countries',
    titleFr: 'Top 10 Pays',
    config: { domain: domain.code, metric: 'records', limit: 10, dataSource: 'KPI_CONTINENTAL' },
  });

  // Row 2: LINE_CHART (6 cols) + STACKED_BAR (6 cols)
  widgets.push({
    type: 'LINE_CHART',
    gridX: 0,
    gridY: 7,
    gridW: 6,
    gridH: 4,
    titleEn: 'Trend (Last 12 Months)',
    titleFr: 'Tendance (12 derniers mois)',
    config: { domain: domain.code, period: '12M', dataSource: 'KPI_CONTINENTAL' },
  });

  widgets.push({
    type: 'STACKED_BAR',
    gridX: 6,
    gridY: 7,
    gridW: 6,
    gridH: 4,
    titleEn: 'Breakdown by REC',
    titleFr: 'Repartition par CER',
    config: { domain: domain.code, groupBy: 'rec', dataSource: 'KPI_CONTINENTAL' },
  });

  return widgets;
}

// ── Main seed logic ────────────────────────────────────────────────────

async function seedDashboardTemplates() {
  console.log('[seed-dashboard-templates] Starting...');

  // Ensure schema exists
  await (prisma as any).$executeRawUnsafe(
    `CREATE SCHEMA IF NOT EXISTS dashboard_builder`,
  );

  let created = 0;
  let skipped = 0;

  for (const domain of DOMAINS) {
    // Check if a SYSTEM_TEMPLATE already exists for this domain + scope
    const existing = await (prisma as any).dashboard.findFirst({
      where: {
        ownership: 'SYSTEM_TEMPLATE',
        scope: 'CONTINENTAL',
        domain_id: domain.domainId,
      },
    });

    if (existing) {
      console.log(`  [SKIP] ${domain.code} — template already exists (${existing.id})`);
      skipped++;
      continue;
    }

    // Create dashboard with widgets
    const widgets = buildWidgets(domain);
    const dashboard = await (prisma as any).dashboard.create({
      data: {
        ownership: 'SYSTEM_TEMPLATE',
        scope: 'CONTINENTAL',
        domain_id: domain.domainId,
        title_en: domain.titleEn,
        title_fr: domain.titleFr,
        description: `System template for ${domain.code} continental dashboard`,
        grid_columns: 12,
        row_height: 80,
        is_default: true,
        widgets: {
          create: widgets.map((w) => ({
            type: w.type,
            data_source: 'KPI_CONTINENTAL',
            grid_x: w.gridX,
            grid_y: w.gridY,
            grid_w: w.gridW,
            grid_h: w.gridH,
            title_en: w.titleEn,
            title_fr: w.titleFr,
            config: w.config,
            filters: {},
          })),
        },
      },
      include: { widgets: true },
    });

    console.log(`  [CREATE] ${domain.code} — ${dashboard.id} (${dashboard.widgets.length} widgets)`);
    created++;
  }

  console.log(`[seed-dashboard-templates] Done: ${created} created, ${skipped} skipped.`);
}

seedDashboardTemplates()
  .catch((err) => {
    console.error('[seed-dashboard-templates] FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
