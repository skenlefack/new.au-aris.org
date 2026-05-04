/**
 * seed-dashboards-gov-climate-api.ts
 *
 * Creates 5 strategic dashboards for Governance, Climate & Environment, and Apiculture.
 * - G1: Veterinary Services Capacity
 * - G2: Legal Frameworks & Stakeholders
 * - E1: Climate Vulnerability & Pastoralism
 * - E2: Water Stress & Rangelands
 * - B1: Honey Value Chain & Apiculture
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
  mapAfrica,
  gauge,
  dualAxis,
  heatmap,
  textBlock,
  alertFeed,
  table,
} from './seed-strategic-helpers';

// ── G1 — Veterinary Services Capacity ───────────────────────────────────

const G1_VET_CAPACITY: DashboardDef = {
  code: 'STRAT-GV-CAPACITY',
  domainCode: 'governance',
  scope: 'CONTINENTAL',
  titleEn: 'Veterinary Services Capacity',
  titleFr: 'Capacite des Services Veterinaires',
  description: 'Continental overview of PVS evaluations, human resources, legal frameworks and institutional capacity.',
  sections: [
    {
      titleEn: 'Governance KPIs',
      titleFr: 'KPIs Gouvernance',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('PVS Score (Continental Avg)', 'Score PVS (Moy. Continentale)', 'pvs-score-continental-avg', '#4527A0'),
        kpi('Countries Evaluated', 'Pays Evalues', 'countries-evaluated', '#1565C0'),
        kpi('Legal Frameworks In Force', 'Cadres Juridiques en Vigueur', 'legal-frameworks-in-force', '#2E7D32'),
        kpi('Total Vet Budget (USD)', 'Budget Veterinaire Total (USD)', 'total-vet-budget-usd', '#E65100'),
      ],
    },
    {
      titleEn: 'PVS Performance',
      titleFr: 'Performance PVS',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        mapAfrica('PVS Score by Country (gradient)', 'Score PVS par Pays (gradient)', 'governance', { layer: 'pvs' }),
        lineChart('PVS Score Evolution: Initial → Gap → Follow-up', 'Evolution PVS : Initial → Gap → Suivi', 'governance', { metric: 'pvsEvolution' }),
      ],
    },
    {
      titleEn: 'Critical Competencies',
      titleFr: 'Competences Critiques',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        heatmap('Competency x Country Matrix (1-5 score)', 'Matrice Competence x Pays (score 1-5)', 'governance', { metric: 'competencyMatrix' }),
        barChart('Recommendations Open by Country', 'Recommandations Ouvertes par Pays', 'governance', { metric: 'openRecommendations' }),
      ],
    },
    {
      titleEn: 'Human Resources',
      titleFr: 'Ressources Humaines',
      columnCount: 2,
      sortOrder: 4,
      widgets: [
        dualAxis('Epi + Lab Staff (bars) vs Budget (line)', 'Personnel Epi + Lab (barres) vs Budget (ligne)', 'governance', { metric: 'staffVsBudget' }),
        stackedBar('Staff Growth by Year', 'Croissance du Personnel par Annee', 'governance', { metric: 'staffTrend', groupBy: 'year' }),
      ],
    },
    {
      titleEn: 'Legal Frameworks',
      titleFr: 'Cadres Juridiques',
      columnCount: 2,
      sortOrder: 5,
      widgets: [
        stackedBar('Frameworks by Type x Status', 'Cadres par Type x Statut', 'governance', { metric: 'legalByTypeStatus', groupBy: 'type' }),
        pieChart('Stakeholder Types', 'Types de Parties Prenantes', 'governance', { metric: 'stakeholderTypes' }),
      ],
    },
  ],
};

// ── G2 — Legal Frameworks & Stakeholders ────────────────────────────────

const G2_LEGAL: DashboardDef = {
  code: 'STRAT-GV-LEGAL',
  domainCode: 'governance',
  scope: 'CONTINENTAL',
  titleEn: 'Legal Frameworks & Stakeholders',
  titleFr: 'Cadres Juridiques & Parties Prenantes',
  description: 'Analysis of legal instruments by type and status, and stakeholder ecosystem mapping.',
  sections: [
    {
      titleEn: 'Legal KPIs',
      titleFr: 'KPIs Juridiques',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Laws In Force', 'Lois en Vigueur', 'laws-in-force', '#2E7D32'),
        kpi('Regulations Adopted', 'Reglements Adoptes', 'regulations-adopted', '#1565C0'),
        kpi('Policies Draft', 'Politiques en Projet', 'policies-draft', '#FFA000'),
        kpi('Stakeholders Registered', 'Parties Prenantes Enregistrees', 'stakeholders-registered', '#4527A0'),
      ],
    },
    {
      titleEn: 'Legal Landscape',
      titleFr: 'Paysage Juridique',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        stackedBar('Frameworks: LAW/REGULATION/POLICY/STANDARD/GUIDELINE by Status', 'Cadres : LOI/REGLEMENT/POLITIQUE/NORME/DIRECTIVE par Statut', 'governance', { metric: 'frameworksByStatus' }),
        barChart('Legal Coverage by Domain', 'Couverture Juridique par Domaine', 'governance', { metric: 'legalByDomain' }),
      ],
    },
    {
      titleEn: 'Stakeholders',
      titleFr: 'Parties Prenantes',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        pieChart('Stakeholder Types: Govt/NGO/Private/Academic/International', 'Types : Govt/ONG/Prive/Academique/International', 'governance', { metric: 'stakeholderPie' }),
        table('Stakeholder Registry with Domains', 'Registre des Parties Prenantes avec Domaines', 'governance', { metric: 'stakeholderTable' }),
      ],
    },
  ],
};

// ── E1 — Climate Vulnerability & Pastoralism ────────────────────────────

const E1_VULNERABILITY: DashboardDef = {
  code: 'STRAT-CE-VULNERABILITY',
  domainCode: 'climate-env',
  scope: 'CONTINENTAL',
  titleEn: 'Climate Vulnerability & Pastoralism',
  titleFr: 'Vulnerabilite Climatique & Pastoralisme',
  description: 'Water stress, environmental hotspots, NDVI trends, and climate-disease correlations for pastoral zones.',
  sections: [
    {
      titleEn: 'Climate KPIs',
      titleFr: 'KPIs Climat',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Zones Severe Water Stress', 'Zones Stress Hydrique Severe', 'zones-severe-water-stress', '#C62828'),
        kpi('Active Hotspots', 'Points Chauds Actifs', 'active-hotspots', '#D32F2F'),
        kpi('Avg Rainfall (mm)', 'Pluviometrie Moy. (mm)', 'avg-rainfall-mm', '#1565C0'),
        kpi('NDVI Average', 'NDVI Moyen', 'ndvi-average', '#2E7D32'),
      ],
    },
    {
      titleEn: 'Water Stress & Map',
      titleFr: 'Stress Hydrique & Carte',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        mapAfrica('Water Stress Index by Zone (blue to red)', 'Indice de Stress Hydrique par Zone (bleu a rouge)', 'climate-env', { layer: 'waterStress' }),
        gauge('% Zones Severe/Critical Degradation', '% Zones Degradation Severe/Critique', 'ce-severe-degradation-pct', 20, { color: '#C62828' }),
      ],
    },
    {
      titleEn: 'Hotspots',
      titleFr: 'Points Chauds',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        alertFeed('Active Environmental Hotspots', 'Points Chauds Environnementaux Actifs', 'climate-env', { filter: 'active' }),
        barChart('Hotspots by Type', 'Points Chauds par Type', 'climate-env', { metric: 'hotspotsByType' }),
      ],
    },
    {
      titleEn: 'Climate-Disease Correlation',
      titleFr: 'Correlation Climat-Maladie',
      columnCount: 2,
      sortOrder: 4,
      widgets: [
        dualAxis('Rainfall (area) vs RVF Outbreaks (line)', 'Pluviometrie (aire) vs Foyers FVR (ligne)', 'climate-env', { metric: 'rainfallVsRvf' }),
        heatmap('NDVI Trend x Pastoral Zone (12 months)', 'Tendance NDVI x Zone Pastorale (12 mois)', 'climate-env', { metric: 'ndviTrend' }),
      ],
    },
    {
      titleEn: 'Rangelands',
      titleFr: 'Parcours',
      columnCount: 2,
      sortOrder: 5,
      widgets: [
        stackedBar('Degradation Level by Region (NONE/LIGHT/MODERATE/SEVERE)', 'Niveau de Degradation par Region (AUCUN/LEGER/MODERE/SEVERE)', 'climate-env', { metric: 'degradationByRegion' }),
        dualAxis('Biomass vs Carrying Capacity', 'Biomasse vs Capacite de Charge', 'climate-env', { metric: 'biomassVsCapacity' }),
      ],
    },
  ],
};

// ── E2 — Water Stress & Rangelands ──────────────────────────────────────

const E2_WATER_RANGE: DashboardDef = {
  code: 'STRAT-CE-WATER-RANGE',
  domainCode: 'climate-env',
  scope: 'CONTINENTAL',
  titleEn: 'Water Stress & Rangelands',
  titleFr: 'Stress Hydrique & Parcours',
  description: 'Detailed water availability analysis and rangeland condition monitoring across the continent.',
  sections: [
    {
      titleEn: 'Water KPIs',
      titleFr: 'KPIs Eau',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Water Stress Avg Index', 'Indice Moyen Stress Hydrique', 'water-stress-avg-index', '#1565C0'),
        kpi('Irrigated Area %', 'Surface Irriguee %', 'irrigated-area-pct', '#2E7D32', '%'),
        kpi('Zones Scarce', 'Zones Rares', 'zones-scarce', '#C62828'),
        kpi('Zones Adequate', 'Zones Adequates', 'zones-adequate', '#4527A0'),
      ],
    },
    {
      titleEn: 'Water Analysis',
      titleFr: 'Analyse Hydrique',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        mapAfrica('Water Availability Map', 'Carte de Disponibilite en Eau', 'climate-env', { layer: 'waterAvailability' }),
        barChart('Stress Index by Admin Region', 'Indice de Stress par Region Admin', 'climate-env', { metric: 'stressByRegion' }),
      ],
    },
    {
      titleEn: 'Rangelands',
      titleFr: 'Parcours',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        lineChart('NDVI Evolution 12M by Zone', 'Evolution NDVI 12M par Zone', 'climate-env', { metric: 'ndviEvolution' }),
        heatmap('Biomass x Carrying Capacity x Region', 'Biomasse x Capacite de Charge x Region', 'climate-env', { metric: 'rangelandMatrix' }),
      ],
    },
  ],
};

// ── B1 — Honey Value Chain & Apiculture ─────────────────────────────────

const B1_HONEY: DashboardDef = {
  code: 'STRAT-AP-HONEY',
  domainCode: 'apiculture',
  valueChainCode: 'HONEY',
  scope: 'CONTINENTAL',
  titleEn: 'Honey Value Chain & Apiculture',
  titleFr: 'Chaine de Valeur Miel & Apiculture',
  description: 'Apiculture overview: apiaries, honey production, colony health, and beekeeper training across the continent.',
  sections: [
    {
      titleEn: 'Apiculture KPIs',
      titleFr: 'KPIs Apiculture',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Apiaries Active', 'Ruchers Actifs', 'apiaries-active', '#FFA000'),
        kpi('Honey Production (kg)', 'Production de Miel (kg)', 'honey-production-kg', '#8B4513', 'kg'),
        kpi('Colony Health Strong %', 'Sante Colonies Fort %', 'colony-health-strong-pct', '#2E7D32', '%'),
        kpi('Beekeepers Trained', 'Apiculteurs Formes', 'beekeepers-trained', '#1565C0'),
      ],
    },
    {
      titleEn: 'Value Chain',
      titleFr: 'Chaine de Valeur',
      columnCount: 1,
      sortOrder: 2,
      widgets: [
        textBlock(
          'Honey Value Chain',
          'Chaine de Valeur Miel',
          'Apiary → Harvest → Extraction → Conditioning → Market/Export',
          'Rucher → Recolte → Extraction → Conditionnement → Marche/Export',
        ),
      ],
    },
    {
      titleEn: 'Production & Quality',
      titleFr: 'Production & Qualite',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        barChart('Production by Season & Floral Source', 'Production par Saison & Source Florale', 'apiculture', { metric: 'productionBySeason' }),
        pieChart('Quality Distribution: Grade A/B/C', 'Distribution Qualite : Grade A/B/C', 'apiculture', { metric: 'qualityGrades' }),
      ],
    },
    {
      titleEn: 'Colony Health',
      titleFr: 'Sante des Colonies',
      columnCount: 2,
      sortOrder: 4,
      widgets: [
        stackedBar('Colony Strength: STRONG/MEDIUM/WEAK/DEAD per Apiary', 'Force Colonie : FORT/MOYEN/FAIBLE/MORT par Rucher', 'apiculture', { metric: 'colonyStrength' }),
        barChart('Disease Prevalence: Varroa/AFB/EFB/Nosema', 'Prevalence Maladies : Varroa/AFB/EFB/Nosema', 'apiculture', { metric: 'diseasePrevalence' }),
      ],
    },
    {
      titleEn: 'Infrastructure & Training',
      titleFr: 'Infrastructure & Formation',
      columnCount: 2,
      sortOrder: 5,
      widgets: [
        pieChart('Hive Types: Langstroth/Top-Bar/Traditional', 'Types de Ruche : Langstroth/Top-Bar/Traditionnelle', 'apiculture', { metric: 'hiveTypes' }),
        lineChart('Beekeepers Trained per Quarter (Basic vs Advanced)', 'Apiculteurs Formes par Trimestre (Base vs Avance)', 'apiculture', { metric: 'trainingTrend' }),
      ],
    },
  ],
};

// ── Main export ─────────────────────────────────────────────────────────

export async function seedGovClimateApiDashboards(prisma: PrismaClient): Promise<void> {
  console.log('\n--- Seeding Governance, Climate & Apiculture Dashboards ---');

  const dashboards: DashboardDef[] = [
    G1_VET_CAPACITY,
    G2_LEGAL,
    E1_VULNERABILITY,
    E2_WATER_RANGE,
    B1_HONEY,
  ];

  for (const def of dashboards) {
    await createStrategicDashboard(prisma, def);
  }

  console.log('--- Done: Governance, Climate & Apiculture Dashboards ---\n');
}
