/**
 * seed-dashboards-transversal.ts
 *
 * Creates 7 strategic cross-domain (transversal) dashboards for ARIS 4.0.
 * These dashboards span multiple domains and provide executive, quality,
 * food security, One Health, REC/Country templates, and workflow views.
 */

import { PrismaClient } from '@prisma/client';
import {
  createStrategicDashboard,
  DashboardDef,
  kpi,
  lineChart,
  barChart,
  stackedBar,
  pieChart,
  areaChart,
  mapAfrica,
  gauge,
  table,
  rankedList,
  alertFeed,
  heatmap,
  progressBar,
} from './seed-strategic-helpers';

// ── T1 — Executive Continental Dashboard (Directrice) ───────────────────

const T1_EXEC_CONTINENTAL: DashboardDef = {
  code: 'STRAT-EXEC-CONTINENTAL',
  domainCode: 'governance',
  scope: 'CONTINENTAL',
  titleEn: 'Executive Continental Dashboard',
  titleFr: 'Tableau de Bord Exécutif Continental',
  description: 'Strategic overview for AU-IBAR Directrice — all 8 domains at a glance',
  sections: [
    {
      titleEn: 'Key Indicators',
      titleFr: 'Indicateurs Clés',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Active Outbreaks', 'Foyers Actifs', 'active-outbreaks', '#C62828'),
        kpi('Total Livestock', 'Cheptel Total', 'total-livestock', '#E65100', 'M heads'),
        kpi('Trade Volume', 'Volume Commercial', 'trade-volume', '#1565C0'),
        kpi('Total Captures', 'Captures Totales', 'total-captures', '#0277BD', 'T'),
        kpi('Protected Areas', 'Aires Protégées', 'protected-areas', '#2E7D32', 'km2'),
        kpi('Honey Production', 'Production de Miel', 'honey-production', '#FFA000', 'T'),
        kpi('PVS Score Avg', 'Score PVS Moyen', 'pvs-score-avg', '#4527A0'),
        kpi('Climate Hotspots', 'Points Chauds Climatiques', 'climate-hotspots', '#D84315'),
      ],
    },
    {
      titleEn: 'Continental Map & Alerts',
      titleFr: 'Carte Continentale & Alertes',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        mapAfrica('Continental Overview', 'Vue Continentale', 'governance'),
        alertFeed('Recent Alerts', 'Alertes Récentes', 'animal-health'),
      ],
    },
    {
      titleEn: 'REC Performance',
      titleFr: 'Performance des CER',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        rankedList('Top RECs', 'Meilleurs CER', 'governance'),
        stackedBar('Data Submissions by Domain', 'Soumissions par Domaine', 'governance', { groupBy: 'domain' }),
      ],
    },
    {
      titleEn: 'Trends',
      titleFr: 'Tendances',
      columnCount: 2,
      sortOrder: 4,
      widgets: [
        lineChart('12-Month Trend', 'Tendance 12 Mois', 'governance'),
        pieChart('Workflow Status', 'Statut du Workflow', 'governance', { groupBy: 'workflowStatus' }),
      ],
    },
    {
      titleEn: 'Data Quality',
      titleFr: 'Qualité des Données',
      columnCount: 2,
      sortOrder: 5,
      widgets: [
        gauge('Quality Pass Rate', 'Taux de Conformité', 'quality-pass-rate', 90),
        progressBar('Countries Reporting', 'Pays Rapportant', 'countries-reporting', 55),
      ],
    },
  ],
};

// ── T2 — Data Performance & Quality Dashboard ───────────────────────────

const T2_DATA_QUALITY: DashboardDef = {
  code: 'STRAT-DATA-QUALITY',
  domainCode: 'governance',
  scope: 'CONTINENTAL',
  titleEn: 'Data Performance & Quality Dashboard',
  titleFr: 'Tableau de Bord Performance & Qualité des Données',
  description: 'Cross-cutting view of data quality, completeness, and workflow performance',
  sections: [
    {
      titleEn: 'Quality KPIs',
      titleFr: 'KPI Qualité',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Quality Pass Rate', 'Taux de Conformité', 'quality-pass-rate', '#2E7D32', '%'),
        kpi('Timeliness Rate', 'Taux de Ponctualité', 'timeliness-rate', '#1565C0', '%'),
        kpi('Countries Reporting', 'Pays Rapportant', 'countries-reporting', '#E65100'),
        kpi('Total Submissions', 'Total Soumissions', 'total-submissions', '#6A1B9A'),
      ],
    },
    {
      titleEn: 'Completeness Matrix',
      titleFr: 'Matrice de Complétude',
      columnCount: 1,
      sortOrder: 2,
      widgets: [
        heatmap('Countries x Domains Completeness', 'Complétude Pays x Domaines', 'governance', { matrix: 'country-domain' }),
      ],
    },
    {
      titleEn: 'Workflow Pipeline',
      titleFr: 'Pipeline de Validation',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        stackedBar('Validation Levels L1-L4', 'Niveaux de Validation L1-L4', 'governance', { groupBy: 'validationLevel' }),
        lineChart('Submissions Trend', 'Tendance des Soumissions', 'governance', { metric: 'submissions' }),
      ],
    },
    {
      titleEn: 'Engagement',
      titleFr: 'Engagement',
      columnCount: 2,
      sortOrder: 4,
      widgets: [
        rankedList('Top Countries by Submissions', 'Top Pays par Soumissions', 'governance'),
        barChart('Submissions per Domain', 'Soumissions par Domaine', 'governance', { groupBy: 'domain' }),
      ],
    },
  ],
};

// ── T3 — Food Security & Nutrition Dashboard ────────────────────────────

const T3_FOOD_SECURITY: DashboardDef = {
  code: 'STRAT-FOOD-SECURITY',
  domainCode: 'livestock-prod',
  scope: 'CONTINENTAL',
  titleEn: 'Food Security & Nutrition Dashboard',
  titleFr: 'Tableau de Bord Sécurité Alimentaire & Nutrition',
  description: 'Cross-domain view of animal protein supply, self-sufficiency, and trade balance',
  sections: [
    {
      titleEn: 'Protein Supply KPIs',
      titleFr: 'KPI Approvisionnement en Protéines',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Meat Production', 'Production de Viande', 'meat-production-total', '#C62828', 'T'),
        kpi('Milk Production', 'Production de Lait', 'milk-production-total', '#1565C0', 'T'),
        kpi('Egg Production', 'Production d\'Oeufs', 'egg-production-total', '#E65100'),
        kpi('Fish Production', 'Production de Poisson', 'fish-production-total', '#0277BD', 'T'),
      ],
    },
    {
      titleEn: 'Production Trends',
      titleFr: 'Tendances de Production',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        areaChart('Animal Protein Production Trend', 'Tendance Production Protéines Animales', 'livestock-prod'),
        stackedBar('Production by Species', 'Production par Espèce', 'livestock-prod', { groupBy: 'species' }),
      ],
    },
    {
      titleEn: 'Self-Sufficiency',
      titleFr: 'Autosuffisance',
      columnCount: 3,
      sortOrder: 3,
      widgets: [
        gauge('Meat Self-Sufficiency', 'Autosuffisance Viande', 'meat-self-sufficiency', 100),
        gauge('Milk Self-Sufficiency', 'Autosuffisance Lait', 'milk-self-sufficiency', 100),
        gauge('Fish Self-Sufficiency', 'Autosuffisance Poisson', 'fish-self-sufficiency', 100),
      ],
    },
    {
      titleEn: 'Market & Trade',
      titleFr: 'Marché & Commerce',
      columnCount: 2,
      sortOrder: 4,
      widgets: [
        lineChart('Food Basket Price Index', 'Indice Prix Panier Alimentaire', 'trade-sps', { metric: 'priceIndex' }),
        barChart('Net Food Trade Balance', 'Balance Commerciale Alimentaire Nette', 'trade-sps', { metric: 'tradeBalance' }),
      ],
    },
  ],
};

// ── T4 — One Health Dashboard ───────────────────────────────────────────

const T4_ONE_HEALTH: DashboardDef = {
  code: 'STRAT-ONE-HEALTH',
  domainCode: 'animal-health',
  scope: 'CONTINENTAL',
  titleEn: 'One Health Dashboard',
  titleFr: 'Tableau de Bord Une Seule Santé',
  description: 'Integrated view of animal health, environment, and capacity — One Health approach',
  sections: [
    {
      titleEn: 'One Health Triangle',
      titleFr: 'Triangle Une Seule Santé',
      columnCount: 3,
      sortOrder: 1,
      widgets: [
        gauge('Animal Health Score', 'Score Santé Animale', 'animal-health-score', 100),
        gauge('Environmental Score', 'Score Environnemental', 'environment-score', 100),
        gauge('Capacity Score', 'Score de Capacité', 'capacity-score', 100),
      ],
    },
    {
      titleEn: 'Zoonoses Surveillance',
      titleFr: 'Surveillance des Zoonoses',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        barChart('Priority Zoonoses', 'Zoonoses Prioritaires', 'animal-health', { filter: 'zoonotic' }),
        lineChart('Zoonosis Trends 12M', 'Tendances Zoonoses 12M', 'animal-health', { filter: 'zoonotic' }),
      ],
    },
    {
      titleEn: 'Climate-Disease Correlation',
      titleFr: 'Corrélation Climat-Maladies',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        stackedBar('Rainfall vs RVF Outbreaks', 'Pluviométrie vs Foyers FVR', 'climate-env', { overlay: 'animal-health' }),
        mapAfrica('Convergence Hotspots', 'Points de Convergence', 'animal-health', { layer: 'one-health' }),
      ],
    },
    {
      titleEn: 'Response Capacity',
      titleFr: 'Capacité de Réponse',
      columnCount: 2,
      sortOrder: 4,
      widgets: [
        barChart('Vaccination Coverage Zoonoses', 'Couverture Vaccinale Zoonoses', 'animal-health', { filter: 'zoonotic-vaccination' }),
        table('PVS Recommendations Open', 'Recommandations PVS Ouvertes', 'governance', { filter: 'open-recommendations' }),
      ],
    },
  ],
};

// ── T5 — REC Template Dashboard ─────────────────────────────────────────

const T5_REC_TEMPLATE: DashboardDef = {
  code: 'STRAT-REC-TEMPLATE',
  domainCode: 'governance',
  scope: 'REC',
  titleEn: 'REC Dashboard Template',
  titleFr: 'Modèle Tableau de Bord CER',
  description: 'Template dashboard for Regional Economic Communities — adaptable per REC',
  sections: [
    {
      titleEn: 'REC Overview',
      titleFr: 'Vue d\'Ensemble CER',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Member States', 'États Membres', 'member-states-count', '#1565C0'),
        kpi('Data Completeness', 'Complétude des Données', 'rec-data-completeness', '#2E7D32', '%'),
        kpi('Active Outbreaks', 'Foyers Actifs', 'rec-active-outbreaks', '#C62828'),
        kpi('Trade Volume', 'Volume Commercial', 'rec-trade-volume', '#E65100'),
      ],
    },
    {
      titleEn: 'Member States Performance',
      titleFr: 'Performance des États Membres',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        rankedList('Countries by Score', 'Pays par Score', 'governance', { groupBy: 'country' }),
        heatmap('Domain Coverage per Country', 'Couverture par Domaine et Pays', 'governance', { matrix: 'country-domain' }),
      ],
    },
    {
      titleEn: 'Regional Trends',
      titleFr: 'Tendances Régionales',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        lineChart('Regional KPI Trend', 'Tendance KPI Régional', 'governance'),
        stackedBar('Submissions per Country', 'Soumissions par Pays', 'governance', { groupBy: 'country' }),
      ],
    },
    {
      titleEn: 'Cross-Border',
      titleFr: 'Transfrontalier',
      columnCount: 2,
      sortOrder: 4,
      widgets: [
        mapAfrica('Regional Map', 'Carte Régionale', 'governance'),
        barChart('Cross-Border Trade', 'Commerce Transfrontalier', 'trade-sps', { filter: 'intra-rec' }),
      ],
    },
  ],
};

// ── T6 — Country Template Dashboard ─────────────────────────────────────

const T6_COUNTRY_TEMPLATE: DashboardDef = {
  code: 'STRAT-COUNTRY-TEMPLATE',
  domainCode: 'governance',
  scope: 'COUNTRY',
  titleEn: 'Country Dashboard Template',
  titleFr: 'Modèle Tableau de Bord Pays',
  description: 'Template dashboard for Member States — national overview across all domains',
  sections: [
    {
      titleEn: 'National KPIs',
      titleFr: 'KPI Nationaux',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Livestock Total', 'Cheptel Total', 'national-livestock-total', '#E65100'),
        kpi('Active Outbreaks', 'Foyers Actifs', 'national-outbreaks', '#C62828'),
        kpi('Trade Volume', 'Volume Commercial', 'national-trade-volume', '#1565C0'),
        kpi('PVS Score', 'Score PVS', 'national-pvs-score', '#4527A0'),
      ],
    },
    {
      titleEn: 'Domain Summary',
      titleFr: 'Résumé par Domaine',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        barChart('Indicators by Domain', 'Indicateurs par Domaine', 'governance', { groupBy: 'domain' }),
        pieChart('Data Classification', 'Classification des Données', 'governance', { groupBy: 'classification' }),
      ],
    },
    {
      titleEn: 'Campaigns & Workflow',
      titleFr: 'Campagnes & Workflow',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        table('Active Campaigns', 'Campagnes Actives', 'governance', { filter: 'active-campaigns' }),
        stackedBar('Workflow Status', 'Statut du Workflow', 'governance', { groupBy: 'workflowStatus' }),
      ],
    },
    {
      titleEn: 'Subnational',
      titleFr: 'Infranational',
      columnCount: 1,
      sortOrder: 4,
      widgets: [
        mapAfrica('Admin1 Map', 'Carte Admin1', 'governance', { level: 'admin1' }),
      ],
    },
  ],
};

// ── T7 — Workflow & Validation Pipeline ─────────────────────────────────

const T7_WORKFLOW_PIPELINE: DashboardDef = {
  code: 'STRAT-WORKFLOW-PIPELINE',
  domainCode: 'governance',
  scope: 'CONTINENTAL',
  titleEn: 'Workflow & Validation Pipeline',
  titleFr: 'Pipeline de Workflow & Validation',
  description: 'End-to-end view of the 4-level validation pipeline across all domains',
  sections: [
    {
      titleEn: 'Validation KPIs',
      titleFr: 'KPI de Validation',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Pending L1', 'En Attente N1', 'pending-l1', '#FFA000'),
        kpi('Pending L2', 'En Attente N2', 'pending-l2', '#E65100'),
        kpi('Pending L3', 'En Attente N3', 'pending-l3', '#C62828'),
        kpi('Validated L4', 'Validé N4', 'validated-l4', '#2E7D32'),
      ],
    },
    {
      titleEn: 'Pipeline Flow',
      titleFr: 'Flux du Pipeline',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        stackedBar('Records by Validation Level', 'Enregistrements par Niveau', 'governance', { groupBy: 'validationLevel' }),
        lineChart('Validation Rate Trend', 'Tendance du Taux de Validation', 'governance', { metric: 'validationRate' }),
      ],
    },
    {
      titleEn: 'Timeliness',
      titleFr: 'Ponctualité',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        barChart('Avg Days per Level', 'Jours Moyens par Niveau', 'governance', { metric: 'avgDaysPerLevel' }),
        heatmap('Timeliness by Country x Level', 'Ponctualité Pays x Niveau', 'governance', { matrix: 'country-level' }),
      ],
    },
  ],
};

// ── Main export ─────────────────────────────────────────────────────────

export async function seedTransversalDashboards(prisma: PrismaClient): Promise<void> {
  const dashboards: DashboardDef[] = [
    T1_EXEC_CONTINENTAL,
    T2_DATA_QUALITY,
    T3_FOOD_SECURITY,
    T4_ONE_HEALTH,
    T5_REC_TEMPLATE,
    T6_COUNTRY_TEMPLATE,
    T7_WORKFLOW_PIPELINE,
  ];

  for (const def of dashboards) {
    console.log(`[Transversal] Seeding ${def.code}...`);
    await createStrategicDashboard(prisma, def);
  }

  console.log(`[Transversal] Done — ${dashboards.length} cross-domain dashboards processed.`);
}
