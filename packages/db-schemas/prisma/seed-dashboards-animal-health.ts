/**
 * seed-dashboards-animal-health.ts
 *
 * Creates 5 strategic Animal Health dashboards for ARIS 4.0:
 *   A1 — Epidemiological Surveillance
 *   A2 — Vaccination & Prophylaxis
 *   A3 — Laboratory Capacity
 *   A4 — Aquatic Health
 *   A5 — AMR Surveillance
 */

import { PrismaClient } from '@prisma/client';
import {
  DashboardDef,
  createStrategicDashboard,
  kpi,
  barChart,
  lineChart,
  stackedBar,
  pieChart,
  mapAfrica,
  gauge,
  dualAxis,
  rankedList,
  alertFeed,
  heatmap,
} from './seed-strategic-helpers';

// ── Dashboard Definitions ───────────────────────────────────────────────────

const A1_SURVEILLANCE: DashboardDef = {
  code: 'STRAT-AH-SURVEILLANCE',
  domainCode: 'animal-health',
  scope: 'CONTINENTAL',
  titleEn: 'Epidemiological Surveillance',
  titleFr: 'Surveillance \u00c9pid\u00e9miologique',
  description: 'Continental overview of disease events, detection performance, and alert status.',
  sections: [
    {
      titleEn: 'Critical KPIs',
      titleFr: 'KPIs Critiques',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Active Outbreaks', 'Foyers Actifs', 'ah-active-outbreaks', '#C62828'),
        kpi('Notification Rate <24h', 'Taux de Notification <24h', 'ah-notification-rate', '#E65100', '%'),
        kpi('Confirmed Cases This Month', 'Cas Confirm\u00e9s ce Mois', 'ah-confirmed-month', '#D32F2F'),
        kpi('Case Fatality Rate', 'Taux de L\u00e9talit\u00e9', 'ah-case-fatality-rate', '#4527A0', '%'),
      ],
    },
    {
      titleEn: 'Epidemic Curve & Map',
      titleFr: 'Courbe \u00c9pid\u00e9mique & Carte',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        barChart('Epi Curve \u2014 Cases by Week', 'Courbe \u00c9pi \u2014 Cas par Semaine', 'animal-health', { metric: 'epiCurve', xKey: 'epiWeek' }),
        mapAfrica('Outbreak Hotspots', 'Points Chauds des Foyers', 'animal-health', { layer: 'outbreaks' }),
      ],
    },
    {
      titleEn: 'Disease Ranking',
      titleFr: 'Classement des Maladies',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        rankedList('Top 10 Diseases by Outbreaks', 'Top 10 Maladies par Foyers', 'animal-health', { metric: 'diseaseRanking' }),
        stackedBar('Events by Confidence Level', '\u00c9v\u00e9nements par Niveau de Confiance', 'animal-health', { groupBy: 'confidenceLevel' }),
      ],
    },
    {
      titleEn: 'Detection Chain Performance',
      titleFr: 'Performance de la Cha\u00eene de D\u00e9tection',
      columnCount: 3,
      sortOrder: 4,
      widgets: [
        gauge('Detection\u2192Confirmation (days avg)', 'D\u00e9tection\u2192Confirmation (jours moy.)', 'ah-detection-to-confirmation', 7),
        gauge('Confirmation\u2192Response (days avg)', 'Confirmation\u2192R\u00e9ponse (jours moy.)', 'ah-confirmation-to-response', 3),
        gauge('WAHIS-Ready Rate', 'Taux WAHIS-Ready', 'ah-wahis-ready-rate', 100),
      ],
    },
    {
      titleEn: 'Alert Feed',
      titleFr: 'Flux d\'Alertes',
      columnCount: 1,
      sortOrder: 5,
      widgets: [
        alertFeed('Latest Reported Events', 'Derniers \u00c9v\u00e9nements Signal\u00e9s', 'animal-health', { limit: 20 }),
      ],
    },
  ],
};

const A2_VACCINATION: DashboardDef = {
  code: 'STRAT-AH-VACCINATION',
  domainCode: 'animal-health',
  scope: 'CONTINENTAL',
  titleEn: 'Vaccination & Prophylaxis',
  titleFr: 'Vaccination & Prophylaxie',
  description: 'Campaign coverage, cold chain performance, and multi-year vaccination trends.',
  sections: [
    {
      titleEn: 'Campaign KPIs',
      titleFr: 'KPIs des Campagnes',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Avg Vaccination Coverage', 'Couverture Vaccinale Moyenne', 'ah-vaccination-coverage-avg', '#1565C0', '%'),
        kpi('Doses Used/Delivered', 'Doses Utilis\u00e9es/Livr\u00e9es', 'ah-doses-utilization', '#2E7D32', '%'),
        kpi('Active Campaigns', 'Campagnes Actives', 'ah-active-campaigns', '#E65100'),
        kpi('Target Population Remaining', 'Population Cible Restante', 'ah-target-remaining', '#C62828'),
      ],
    },
    {
      titleEn: 'Coverage by Disease',
      titleFr: 'Couverture par Maladie',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        stackedBar('Vaccination Coverage by Disease \u00d7 Country', 'Couverture Vaccinale par Maladie \u00d7 Pays', 'animal-health', { metric: 'vaccinationCoverage', groupBy: 'disease' }),
        mapAfrica('Coverage Map', 'Carte de Couverture', 'animal-health', { layer: 'vaccination' }),
      ],
    },
    {
      titleEn: 'Cold Chain & Quality',
      titleFr: 'Cha\u00eene du Froid & Qualit\u00e9',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        pieChart('Doses: Used vs Lost vs Remaining', 'Doses : Utilis\u00e9es vs Perdues vs Restantes', 'animal-health', { metric: 'dosesBreakdown' }),
        barChart('PVE Serology Done %', 'PVE S\u00e9rologie Effectu\u00e9e %', 'animal-health', { metric: 'pveRate', groupBy: 'disease' }),
      ],
    },
    {
      titleEn: 'Trends',
      titleFr: 'Tendances',
      columnCount: 1,
      sortOrder: 4,
      widgets: [
        lineChart('Multi-Year Coverage Trend', 'Tendance Couverture Pluriannuelle', 'animal-health', { metric: 'vaccinationTrend', period: '5Y' }),
      ],
    },
  ],
};

const A3_LABORATORY: DashboardDef = {
  code: 'STRAT-AH-LABORATORY',
  domainCode: 'animal-health',
  scope: 'CONTINENTAL',
  titleEn: 'Laboratory Capacity',
  titleFr: 'Capacit\u00e9 Laboratoire',
  description: 'Lab performance, test volumes, turnaround times, and capacity development.',
  sections: [
    {
      titleEn: 'Lab KPIs',
      titleFr: 'KPIs Laboratoire',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Analyses This Month', 'Analyses ce Mois', 'ah-lab-analyses-month', '#1565C0'),
        kpi('Positivity Rate', 'Taux de Positivit\u00e9', 'ah-positivity-rate', '#C62828', '%'),
        kpi('Avg Turnaround Days', 'D\u00e9lai Moyen (jours)', 'ah-lab-turnaround-avg', '#E65100'),
        kpi('Labs Participating EQA', 'Labos Participant EEQ', 'ah-labs-eqa', '#2E7D32'),
      ],
    },
    {
      titleEn: 'Performance by Test Type',
      titleFr: 'Performance par Type de Test',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        barChart('Volume & Positivity by Test Type', 'Volume & Positivit\u00e9 par Type de Test', 'animal-health', { metric: 'labByTestType' }),
        rankedList('Labs Ranked by Turnaround', 'Labos Class\u00e9s par D\u00e9lai', 'animal-health', { metric: 'labTurnaroundRanking' }),
      ],
    },
    {
      titleEn: 'Results by Disease',
      titleFr: 'R\u00e9sultats par Maladie',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        stackedBar('POSITIVE/NEGATIVE/INCONCLUSIVE by Disease', 'POSITIF/N\u00c9GATIF/INCONCLUSIF par Maladie', 'animal-health', { metric: 'labResultsByDisease', groupBy: 'disease' }),
        lineChart('Lab Workload Trend 12M', 'Tendance Charge Labo 12M', 'animal-health', { metric: 'labWorkloadTrend' }),
      ],
    },
    {
      titleEn: 'Capacity Development',
      titleFr: 'D\u00e9veloppement des Capacit\u00e9s',
      columnCount: 2,
      sortOrder: 4,
      widgets: [
        dualAxis('Epi+Lab Staff (bars) vs PVS Score (line)', 'Personnel \u00c9pi+Labo (barres) vs Score PVS (ligne)', 'animal-health', { metric: 'capacityStaffVsScore' }),
        barChart('Test Types Available by Country', 'Types de Tests Disponibles par Pays', 'animal-health', { metric: 'testTypesAvailable', groupBy: 'country' }),
      ],
    },
  ],
};

const A4_AQUATIC: DashboardDef = {
  code: 'STRAT-AH-AQUATIC',
  domainCode: 'animal-health',
  subDomainCode: 'AQUATIC_HEALTH',
  scope: 'CONTINENTAL',
  titleEn: 'Aquatic Health',
  titleFr: 'Sant\u00e9 Aquatique',
  description: 'Aquatic disease events, species surveillance, and diagnostic results.',
  sections: [
    {
      titleEn: 'Aquatic Health KPIs',
      titleFr: 'KPIs Sant\u00e9 Aquatique',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Aquatic Disease Events', '\u00c9v\u00e9nements Maladies Aquatiques', 'ah-aquatic-events', '#0277BD'),
        kpi('Species Affected', 'Esp\u00e8ces Affect\u00e9es', 'ah-aquatic-species', '#00838F'),
        kpi('Lab Confirmations Aquatic', 'Confirmations Labo Aquatique', 'ah-aquatic-lab-confirmed', '#2E7D32'),
        kpi('Active Surveillance Programs', 'Programmes Surveillance Actifs', 'ah-aquatic-surveillance', '#1565C0'),
      ],
    },
    {
      titleEn: 'Events & Map',
      titleFr: '\u00c9v\u00e9nements & Carte',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        barChart('Aquatic Disease Events by Species', '\u00c9v\u00e9nements Maladies Aquatiques par Esp\u00e8ce', 'animal-health', { filter: 'aquatic', groupBy: 'species' }),
        mapAfrica('Aquatic Health Hotspots', 'Points Chauds Sant\u00e9 Aquatique', 'animal-health', { filter: 'aquatic', layer: 'outbreaks' }),
      ],
    },
    {
      titleEn: 'Diagnostics & Surveillance',
      titleFr: 'Diagnostics & Surveillance',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        pieChart('Lab Results Aquatic', 'R\u00e9sultats Labo Aquatique', 'animal-health', { filter: 'aquatic', metric: 'labResults' }),
        stackedBar('Surveillance Type Aquatic', 'Type de Surveillance Aquatique', 'animal-health', { filter: 'aquatic', groupBy: 'surveillanceType' }),
      ],
    },
  ],
};

const A5_AMR: DashboardDef = {
  code: 'STRAT-AH-AMR',
  domainCode: 'animal-health',
  subDomainCode: 'AMR',
  scope: 'CONTINENTAL',
  titleEn: 'AMR Surveillance',
  titleFr: 'Surveillance RAM',
  description: 'Antimicrobial resistance monitoring: resistance patterns, trends, and geographic distribution.',
  sections: [
    {
      titleEn: 'AMR KPIs',
      titleFr: 'KPIs RAM',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('AMR Samples Tested', '\u00c9chantillons RAM Test\u00e9s', 'ah-amr-samples', '#C62828'),
        kpi('Resistance Rate', 'Taux de R\u00e9sistance', 'ah-amr-resistance-rate', '#D32F2F', '%'),
        kpi('Sentinel Sites Active', 'Sites Sentinelles Actifs', 'ah-amr-sentinel-sites', '#1565C0'),
        kpi('Pathogens Monitored', 'Pathog\u00e8nes Surveill\u00e9s', 'ah-amr-pathogens', '#2E7D32'),
      ],
    },
    {
      titleEn: 'Resistance Patterns',
      titleFr: 'Profils de R\u00e9sistance',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        heatmap('Pathogen \u00d7 Antibiotic Resistance Matrix', 'Matrice R\u00e9sistance Pathog\u00e8ne \u00d7 Antibiotique', 'animal-health', { metric: 'amrMatrix' }),
        barChart('Resistance Rate by Pathogen', 'Taux de R\u00e9sistance par Pathog\u00e8ne', 'animal-health', { metric: 'amrByPathogen' }),
      ],
    },
    {
      titleEn: 'Trends & Geography',
      titleFr: 'Tendances & G\u00e9ographie',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        lineChart('AMR Trends 12M', 'Tendances RAM 12M', 'animal-health', { metric: 'amrTrend' }),
        mapAfrica('AMR Hotspots', 'Points Chauds RAM', 'animal-health', { layer: 'amr' }),
      ],
    },
  ],
};

// ── Export ───────────────────────────────────────────────────────────────────

export async function seedAnimalHealthDashboards(prisma: PrismaClient): Promise<void> {
  console.log('\n[Animal Health] Seeding strategic dashboards...');

  await createStrategicDashboard(prisma, A1_SURVEILLANCE);
  await createStrategicDashboard(prisma, A2_VACCINATION);
  await createStrategicDashboard(prisma, A3_LABORATORY);
  await createStrategicDashboard(prisma, A4_AQUATIC);
  await createStrategicDashboard(prisma, A5_AMR);

  console.log('[Animal Health] Done.\n');
}
