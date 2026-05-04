/**
 * seed-dashboards-livestock.ts
 *
 * Creates 6 strategic Livestock & Production dashboards for ARIS 4.0.
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
  dualAxis,
  table,
  heatmap,
  textBlock,
} from './seed-strategic-helpers';

// ── L1 — National Livestock Census ──────────────────────────────────────

const L1_CENSUS: DashboardDef = {
  code: 'STRAT-LP-CENSUS',
  domainCode: 'livestock-prod',
  scope: 'CONTINENTAL',
  titleEn: 'National Livestock Census',
  titleFr: 'Recensement National du Betail',
  description: 'Continental livestock census overview — population, species coverage, methodology breakdown',
  sections: [
    {
      titleEn: 'Census KPIs', titleFr: 'KPIs Recensement',
      columnCount: 4, sortOrder: 1,
      widgets: [
        kpi('Total Population', 'Population Totale', 'total-population', '#E65100', 'M'),
        kpi('Annual Growth Rate', 'Taux de Croissance Annuel', 'annual-growth-rate', '#2E7D32', '%'),
        kpi('Species Covered', 'Especes Couvertes', 'species-covered', '#1565C0'),
        kpi('Geographic Coverage', 'Couverture Geographique', 'geo-coverage', '#4527A0', '%'),
      ],
    },
    {
      titleEn: 'Population by Species', titleFr: 'Population par Espece',
      columnCount: 2, sortOrder: 2,
      widgets: [
        stackedBar('Population by Species x Year', 'Population par Espece x Annee', 'livestock-prod', { metric: 'censusBySpecies' }),
        mapAfrica('Livestock Density', 'Densite du Betail', 'livestock-prod', { layer: 'census' }),
      ],
    },
    {
      titleEn: 'Trends & Sources', titleFr: 'Tendances & Sources',
      columnCount: 2, sortOrder: 3,
      widgets: [
        lineChart('5-Year Population Trend by Species', 'Tendance 5 Ans par Espece', 'livestock-prod', { metric: 'populationTrend', period: '5Y' }),
        pieChart('Methodology: Enumeration vs Sampling', 'Methodologie : Enumeration vs Sondage', 'livestock-prod', { metric: 'censusMethods' }),
      ],
    },
    {
      titleEn: 'Denominators', titleFr: 'Denominateurs',
      columnCount: 2, sortOrder: 4,
      widgets: [
        dualAxis('FAOSTAT vs National Census Comparison', 'Comparaison FAOSTAT vs Recensement National', 'livestock-prod', { metric: 'denominatorComparison' }),
        table('Census Data Completeness by Country', 'Completude des Donnees par Pays', 'livestock-prod', { metric: 'censusCompleteness' }),
      ],
    },
  ],
};

// ── L2 — Red Meat Value Chain ───────────────────────────────────────────

const L2_RED_MEAT: DashboardDef = {
  code: 'STRAT-LP-RED-MEAT',
  domainCode: 'livestock-prod',
  valueChainCode: 'RED_MEAT',
  scope: 'CONTINENTAL',
  titleEn: 'Red Meat Value Chain',
  titleFr: 'Chaine de Valeur Viande Rouge',
  description: 'End-to-end red meat value chain — production, slaughter, market prices, SPS, transhumance',
  sections: [
    {
      titleEn: 'Value Chain Overview', titleFr: 'Vue d\'Ensemble de la Filiere',
      columnCount: 1, sortOrder: 1,
      widgets: [
        textBlock(
          'Red Meat Value Chain', 'Chaine de Valeur Viande Rouge',
          'Farm → Abattoir → Transport → Market → Export',
          'Elevage → Abattoir → Transport → Marche → Export',
        ),
      ],
    },
    {
      titleEn: 'Filiere KPIs', titleFr: 'KPIs Filiere',
      columnCount: 4, sortOrder: 2,
      widgets: [
        kpi('Cattle Population', 'Population Bovine', 'cattle-population', '#8B4513'),
        kpi('Meat Production', 'Production de Viande', 'meat-production-tonnes', '#C62828', 'T'),
        kpi('Monthly Slaughter Count', 'Abattages Mensuels', 'slaughter-count-month', '#E65100'),
        kpi('Avg Cattle Price', 'Prix Moyen Bovin', 'cattle-price-avg', '#1565C0'),
      ],
    },
    {
      titleEn: 'Production & Slaughter', titleFr: 'Production & Abattage',
      columnCount: 2, sortOrder: 3,
      widgets: [
        dualAxis('Meat Production (area) vs Slaughter (bar)', 'Production Viande (aire) vs Abattage (barre)', 'livestock-prod', { metric: 'meatVsSlaughter' }),
        gauge('Condemnation Rate', 'Taux de Saisie', 'lp-condemnation-rate', 5, { color: '#C62828' }),
      ],
    },
    {
      titleEn: 'Market & Prices', titleFr: 'Marche & Prix',
      columnCount: 2, sortOrder: 4,
      widgets: [
        lineChart('Cattle Price Evolution (Wholesale/Retail/FarmGate)', 'Evolution Prix Bovin (Gros/Detail/Producteur)', 'trade-sps', { metric: 'cattlePrices' }),
        barChart('Export vs Import Beef by Partner', 'Export vs Import Viande par Partenaire', 'trade-sps', { metric: 'beefTradeBalance' }),
      ],
    },
    {
      titleEn: 'SPS & Transhumance', titleFr: 'SPS & Transhumance',
      columnCount: 2, sortOrder: 5,
      widgets: [
        pieChart('SPS Certificates: PASS/FAIL/CONDITIONAL', 'Certificats SPS : CONFORME/NON-CONFORME/CONDITIONNEL', 'trade-sps', { metric: 'spsCattleResults' }),
        mapAfrica('Transhumance Corridors', 'Corridors de Transhumance', 'livestock-prod', { layer: 'transhumance' }),
      ],
    },
  ],
};

// ── L3 — Dairy Value Chain ──────────────────────────────────────────────

const L3_DAIRY: DashboardDef = {
  code: 'STRAT-LP-DAIRY',
  domainCode: 'livestock-prod',
  valueChainCode: 'DAIRY',
  scope: 'CONTINENTAL',
  titleEn: 'Dairy Value Chain',
  titleFr: 'Chaine de Valeur Laitiere',
  description: 'Dairy value chain — milk production by species, pricing, seasonality, trade flows',
  sections: [
    {
      titleEn: 'Dairy KPIs', titleFr: 'KPIs Laitiers',
      columnCount: 4, sortOrder: 1,
      widgets: [
        kpi('Total Milk Production', 'Production Laitiere Totale', 'milk-production-total', '#1565C0', 'T'),
        kpi('Dairy Herd Size', 'Taille du Troupeau Laitier', 'dairy-herd-size', '#8B4513', 'M'),
        kpi('Avg Milk Price', 'Prix Moyen du Lait', 'milk-price-avg', '#2E7D32'),
        kpi('Dairy Export Volume', 'Volume Export Laitier', 'dairy-export-volume', '#E65100', 'T'),
      ],
    },
    {
      titleEn: 'Production', titleFr: 'Production',
      columnCount: 2, sortOrder: 2,
      widgets: [
        areaChart('Milk Production by Species (Bovine/Goat/Camel)', 'Production Laitiere par Espece (Bovin/Caprin/Camelin)', 'livestock-prod', { metric: 'milkBySpecies' }),
        lineChart('Milk Price Trend', 'Tendance Prix du Lait', 'trade-sps', { metric: 'milkPrices' }),
      ],
    },
    {
      titleEn: 'Seasonality & Trade', titleFr: 'Saisonnalite & Commerce',
      columnCount: 2, sortOrder: 3,
      widgets: [
        heatmap('Monthly Production x Region', 'Production Mensuelle x Region', 'livestock-prod', { metric: 'milkSeasonality' }),
        stackedBar('Import/Export/Transit Dairy Products', 'Import/Export/Transit Produits Laitiers', 'trade-sps', { metric: 'dairyTrade' }),
      ],
    },
  ],
};

// ── L4 — Poultry & Eggs Value Chain ─────────────────────────────────────

const L4_POULTRY: DashboardDef = {
  code: 'STRAT-LP-POULTRY',
  domainCode: 'livestock-prod',
  valueChainCode: 'POULTRY',
  scope: 'CONTINENTAL',
  titleEn: 'Poultry & Eggs Value Chain',
  titleFr: 'Chaine de Valeur Volaille & Oeufs',
  description: 'Poultry and eggs value chain — population, production, slaughter, HPAI alerts, trade',
  sections: [
    {
      titleEn: 'Poultry KPIs', titleFr: 'KPIs Volaille',
      columnCount: 4, sortOrder: 1,
      widgets: [
        kpi('Poultry Population', 'Population Avicole', 'poultry-population', '#E65100', 'M'),
        kpi('Egg Production', 'Production d\'Oeufs', 'egg-production', '#FFA000'),
        kpi('Monthly Poultry Slaughter', 'Abattage Volaille Mensuel', 'poultry-slaughter-month', '#C62828'),
        kpi('HPAI Alerts', 'Alertes IAHP', 'hpai-alerts', '#D32F2F'),
      ],
    },
    {
      titleEn: 'Production', titleFr: 'Production',
      columnCount: 2, sortOrder: 2,
      widgets: [
        lineChart('Egg Production Monthly', 'Production Oeufs Mensuelle', 'livestock-prod', { metric: 'eggProduction' }),
        barChart('Poultry Slaughter by Facility', 'Abattage Volaille par Etablissement', 'livestock-prod', { metric: 'poultrySlaughter' }),
      ],
    },
    {
      titleEn: 'Health & Trade', titleFr: 'Sante & Commerce',
      columnCount: 2, sortOrder: 3,
      widgets: [
        barChart('HPAI Events by Country', 'Evenements IAHP par Pays', 'animal-health', { filter: 'hpai' }),
        stackedBar('Poultry Trade Flows', 'Flux Commerciaux Volaille', 'trade-sps', { metric: 'poultryTrade' }),
      ],
    },
  ],
};

// ── L5 — Small Ruminants Value Chain ────────────────────────────────────

const L5_SMALL_RUMINANTS: DashboardDef = {
  code: 'STRAT-LP-SMALL-RUMINANTS',
  domainCode: 'livestock-prod',
  valueChainCode: 'SMALL_RUMINANTS',
  scope: 'CONTINENTAL',
  titleEn: 'Small Ruminants Value Chain',
  titleFr: 'Chaine de Valeur Petits Ruminants',
  description: 'Small ruminants value chain — sheep/goat census, PPR vaccination, production, markets',
  sections: [
    {
      titleEn: 'Small Ruminants KPIs', titleFr: 'KPIs Petits Ruminants',
      columnCount: 4, sortOrder: 1,
      widgets: [
        kpi('Sheep Population', 'Population Ovine', 'sheep-population', '#8B4513', 'M'),
        kpi('Goat Population', 'Population Caprine', 'goat-population', '#6D4C41', 'M'),
        kpi('PPR Vaccination Coverage', 'Couverture Vaccinale PPR', 'ppr-vaccination-coverage', '#1565C0', '%'),
        kpi('Small Ruminant Trade', 'Commerce Petits Ruminants', 'small-ruminant-trade', '#E65100'),
      ],
    },
    {
      titleEn: 'Census & Production', titleFr: 'Recensement & Production',
      columnCount: 2, sortOrder: 2,
      widgets: [
        stackedBar('Sheep vs Goat Population by Country', 'Population Ovine vs Caprine par Pays', 'livestock-prod', { metric: 'smallRuminantCensus' }),
        areaChart('Meat & Milk Production Small Ruminants', 'Production Viande & Lait Petits Ruminants', 'livestock-prod', { metric: 'smallRuminantProduction' }),
      ],
    },
    {
      titleEn: 'Health & Markets', titleFr: 'Sante & Marches',
      columnCount: 2, sortOrder: 3,
      widgets: [
        barChart('PPR Events & Vaccination Coverage', 'Evenements PPR & Couverture Vaccinale', 'animal-health', { filter: 'ppr' }),
        lineChart('Goat/Sheep Price Trend', 'Tendance Prix Caprin/Ovin', 'trade-sps', { metric: 'smallRuminantPrices' }),
      ],
    },
  ],
};

// ── L6 — Pastoralism & Transhumance ─────────────────────────────────────

const L6_PASTORALISM: DashboardDef = {
  code: 'STRAT-LP-PASTORALISM',
  domainCode: 'livestock-prod',
  scope: 'CONTINENTAL',
  titleEn: 'Pastoralism & Transhumance',
  titleFr: 'Pastoralisme & Transhumance',
  description: 'Pastoral systems — transhumance corridors, cross-border movement, rangeland condition',
  sections: [
    {
      titleEn: 'Pastoralism KPIs', titleFr: 'KPIs Pastoralisme',
      columnCount: 4, sortOrder: 1,
      widgets: [
        kpi('Transhumance Corridors', 'Corridors de Transhumance', 'transhumance-corridors', '#2E7D32'),
        kpi('Cross-Border Corridors', 'Corridors Transfrontaliers', 'cross-border-corridors', '#C62828'),
        kpi('Pastoral Population', 'Population Pastorale', 'pastoral-population', '#E65100', 'M'),
        kpi('Avg Rangeland Condition', 'Condition Moyenne des Parcours', 'rangeland-condition-avg', '#4527A0'),
      ],
    },
    {
      titleEn: 'Corridors & Map', titleFr: 'Corridors & Carte',
      columnCount: 2, sortOrder: 2,
      widgets: [
        mapAfrica('Transhumance Corridors Map', 'Carte des Corridors de Transhumance', 'livestock-prod', { layer: 'transhumance' }),
        barChart('Corridors by Species', 'Corridors par Espece', 'livestock-prod', { metric: 'corridorsBySpecies' }),
      ],
    },
    {
      titleEn: 'Climate & Rangelands', titleFr: 'Climat & Parcours',
      columnCount: 2, sortOrder: 3,
      widgets: [
        dualAxis('NDVI Index vs Livestock Movement', 'Indice NDVI vs Mouvement du Betail', 'climate-env', { metric: 'ndviVsMovement' }),
        heatmap('Rangeland Condition x Region', 'Condition des Parcours x Region', 'climate-env', { metric: 'rangelandCondition' }),
      ],
    },
  ],
};

// ── Main export ─────────────────────────────────────────────────────────

export async function seedLivestockDashboards(prisma: PrismaClient): Promise<void> {
  console.log('\n── Livestock & Production Dashboards ──');

  const dashboards: DashboardDef[] = [
    L1_CENSUS,
    L2_RED_MEAT,
    L3_DAIRY,
    L4_POULTRY,
    L5_SMALL_RUMINANTS,
    L6_PASTORALISM,
  ];

  for (const def of dashboards) {
    await createStrategicDashboard(prisma, def);
  }

  console.log('── Livestock & Production Dashboards — done ──\n');
}
