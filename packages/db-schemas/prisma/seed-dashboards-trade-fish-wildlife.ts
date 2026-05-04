/**
 * seed-dashboards-trade-fish-wildlife.ts
 *
 * Creates 6 strategic dashboards for Trade & SPS, Fisheries, and Wildlife domains.
 * - C1: Trade Intelligence Continental
 * - C2: Markets & Prices
 * - F1: Capture Fisheries
 * - F2: Aquaculture Value Chain
 * - W1: Conservation & Anti-Poaching
 * - W2: CITES & Wildlife Trade
 */

import { PrismaClient } from '@prisma/client';
import {
  DashboardDef,
  createStrategicDashboard,
  kpi,
  lineChart,
  barChart,
  stackedBar,
  pieChart,
  mapAfrica,
  gauge,
  dualAxis,
  rankedList,
  heatmap,
  textBlock,
} from './seed-strategic-helpers';

// ── Trade & SPS Dashboards ──────────────────────────────────────────────────

const tradeIntelligence: DashboardDef = {
  code: 'STRAT-TS-INTELLIGENCE',
  domainCode: 'trade-sps',
  scope: 'CONTINENTAL',
  titleEn: 'Trade Intelligence Continental',
  titleFr: 'Intelligence Commerciale Continentale',
  description: 'Continental trade flows, SPS certification, and commodity analysis',
  sections: [
    {
      titleEn: 'Trade KPIs',
      titleFr: 'KPIs Commerce',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Total Trade Volume', 'Volume Total du Commerce', 'total-trade-volume', '#1565C0'),
        kpi('Trade Balance', 'Balance Commerciale', 'trade-balance', '#2E7D32'),
        kpi('SPS Certificates Issued', 'Certificats SPS Emis', 'sps-certificates-issued', '#E65100'),
        kpi('SPS Compliance Rate', 'Taux de Conformite SPS', 'sps-compliance-rate', '#4527A0', '%'),
      ],
    },
    {
      titleEn: 'Flows & Map',
      titleFr: 'Flux & Carte',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        mapAfrica('Trade Flow Map', 'Carte des Flux Commerciaux', 'trade-sps', { layer: 'flows' }),
        stackedBar('Volume by Commodity Group', 'Volume par Groupe de Produits', 'trade-sps', { groupBy: 'commodityGroup' }),
      ],
    },
    {
      titleEn: 'Partners & HS Codes',
      titleFr: 'Partenaires & Codes SH',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        rankedList('Top 10 Trading Partners by FOB Value', 'Top 10 Partenaires par Valeur FOB', 'trade-sps', { metric: 'topPartners' }),
        lineChart('Trade Volume Trend by HS Code', 'Tendance Volume par Code SH', 'trade-sps', { metric: 'hsTrend' }),
      ],
    },
    {
      titleEn: 'SPS Certification',
      titleFr: 'Certification SPS',
      columnCount: 2,
      sortOrder: 4,
      widgets: [
        pieChart('Inspection Results: PASS/FAIL/CONDITIONAL', 'Resultats Inspection: PASSE/ECHEC/CONDITIONNEL', 'trade-sps', { metric: 'spsResults' }),
        barChart('Certificates by Status', 'Certificats par Statut', 'trade-sps', { metric: 'certStatus' }),
      ],
    },
    {
      titleEn: 'Processing Level',
      titleFr: 'Niveau de Transformation',
      columnCount: 2,
      sortOrder: 5,
      widgets: [
        stackedBar('RAW vs SEMI vs PROCESSED by Direction', 'BRUT vs SEMI vs TRANSFORME par Direction', 'trade-sps', { metric: 'processingLevel', groupBy: 'flowDirection' }),
        barChart('Product State Distribution', 'Distribution Etat du Produit', 'trade-sps', { metric: 'productState' }),
      ],
    },
  ],
};

const marketsAndPrices: DashboardDef = {
  code: 'STRAT-TS-MARKETS',
  domainCode: 'trade-sps',
  scope: 'CONTINENTAL',
  titleEn: 'Markets & Prices',
  titleFr: 'Marches & Prix',
  description: 'Market price intelligence, commodity tracking, and value chain margins',
  sections: [
    {
      titleEn: 'Market KPIs',
      titleFr: 'KPIs Marches',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Active Markets', 'Marches Actifs', 'active-markets', '#E65100'),
        kpi('Commodities Tracked', 'Produits Suivis', 'commodities-tracked', '#1565C0'),
        kpi('Price Variation (Month)', 'Variation Prix (Mois)', 'price-variation-month', '#C62828', '%'),
        kpi('Price Alerts', 'Alertes Prix', 'price-alerts', '#D32F2F'),
      ],
    },
    {
      titleEn: 'Price Evolution',
      titleFr: 'Evolution des Prix',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        lineChart('Price Trends by Commodity', 'Tendances Prix par Produit', 'trade-sps', { metric: 'priceTrend' }),
        barChart('Price Comparison Across Markets', 'Comparaison Prix entre Marches', 'trade-sps', { metric: 'priceByMarket' }),
      ],
    },
    {
      titleEn: 'Price Analysis',
      titleFr: 'Analyse des Prix',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        heatmap('Commodity x Market Price Matrix', 'Matrice Prix Produit x Marche', 'trade-sps', { metric: 'priceMatrix' }),
        dualAxis('Average Price vs Volatility', 'Prix Moyen vs Volatilite', 'trade-sps', { metric: 'priceVolatility' }),
      ],
    },
    {
      titleEn: 'Value Chain Margins',
      titleFr: 'Marges Chaine de Valeur',
      columnCount: 1,
      sortOrder: 4,
      widgets: [
        stackedBar('Farm Gate -> Wholesale -> Retail Margins', 'Marges Producteur -> Gros -> Detail', 'trade-sps', { metric: 'priceMargins', groupBy: 'priceType' }),
      ],
    },
  ],
};

// ── Fisheries Dashboards ────────────────────────────────────────────────────

const captureFisheries: DashboardDef = {
  code: 'STRAT-FI-CAPTURE',
  domainCode: 'fisheries',
  scope: 'CONTINENTAL',
  titleEn: 'Capture Fisheries',
  titleFr: 'Peche de Capture',
  description: 'Capture fisheries volumes, fleet status, species ranking, and effort analysis',
  sections: [
    {
      titleEn: 'Capture KPIs',
      titleFr: 'KPIs Capture',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Total Capture (Tonnes)', 'Capture Totale (Tonnes)', 'total-capture-tonnes', '#0277BD', 'T'),
        kpi('Active Vessels', 'Navires Actifs', 'active-vessels', '#00838F'),
        kpi('Main Species Count', 'Nombre Especes Principales', 'main-species-count', '#1565C0'),
        kpi('CPUE Average', 'CPUE Moyen', 'cpue-average', '#2E7D32'),
      ],
    },
    {
      titleEn: 'Volume & Environment',
      titleFr: 'Volume & Environnement',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        pieChart('MARINE vs INLAND vs BRACKISH', 'MARIN vs INTERIEUR vs SAUMATRE', 'fisheries', { metric: 'captureByEnvironment' }),
        rankedList('Top Species by Capture Volume', 'Top Especes par Volume de Capture', 'fisheries', { metric: 'speciesRanking' }),
      ],
    },
    {
      titleEn: 'Trends & Effort',
      titleFr: 'Tendances & Effort',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        lineChart('Monthly Capture Volume + FAO Area', 'Volume Mensuel Capture + Zone FAO', 'fisheries', { metric: 'captureTrend' }),
        dualAxis('Capture (bar) vs Effort (line) = CPUE', 'Capture (barre) vs Effort (ligne) = CPUE', 'fisheries', { metric: 'cpue' }),
      ],
    },
    {
      titleEn: 'Fleet & Production Type',
      titleFr: 'Flotte & Type de Production',
      columnCount: 2,
      sortOrder: 4,
      widgets: [
        stackedBar('Vessels by Type + License Status', 'Navires par Type + Statut Licence', 'fisheries', { metric: 'fleetStatus', groupBy: 'vesselType' }),
        pieChart('ARTISANAL vs INDUSTRIAL vs SUBSISTENCE', 'ARTISANAL vs INDUSTRIEL vs SUBSISTANCE', 'fisheries', { metric: 'productionType' }),
      ],
    },
  ],
};

const aquacultureValueChain: DashboardDef = {
  code: 'STRAT-FI-AQUACULTURE',
  domainCode: 'fisheries',
  valueChainCode: 'AQUACULTURE',
  scope: 'CONTINENTAL',
  titleEn: 'Aquaculture Value Chain',
  titleFr: 'Chaine de Valeur Aquaculture',
  description: 'Aquaculture production, farm performance, feed efficiency, and employment',
  sections: [
    {
      titleEn: 'Aquaculture KPIs',
      titleFr: 'KPIs Aquaculture',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Aquaculture Production (Tonnes)', 'Production Aquacole (Tonnes)', 'aquaculture-production-tonnes', '#0277BD', 'T'),
        kpi('Active Farms', 'Fermes Actives', 'active-farms', '#2E7D32'),
        kpi('FCR Average', 'ICA Moyen', 'fcr-average', '#E65100'),
        kpi('Survival Rate Average', 'Taux de Survie Moyen', 'survival-rate-avg', '#1565C0', '%'),
      ],
    },
    {
      titleEn: 'Chain Overview',
      titleFr: 'Vue d\'Ensemble de la Chaine',
      columnCount: 1,
      sortOrder: 2,
      widgets: [
        textBlock(
          'Aquaculture Value Chain',
          'Chaine de Valeur Aquaculture',
          'Hatchery → Grow-out → Harvest → Processing → Market',
          'Ecloserie → Grossissement → Recolte → Transformation → Marche',
        ),
      ],
    },
    {
      titleEn: 'Production & Performance',
      titleFr: 'Production & Performance',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        barChart('Production by Species', 'Production par Espece', 'fisheries', { metric: 'aquaProductionBySpecies' }),
        heatmap('FCR x Species x Farm Performance', 'ICA x Espece x Performance Ferme', 'fisheries', { metric: 'fcrMatrix' }),
      ],
    },
    {
      titleEn: 'Efficiency & Employment',
      titleFr: 'Efficacite & Emploi',
      columnCount: 2,
      sortOrder: 4,
      widgets: [
        dualAxis('Feed Used (bar) vs FCR (line)', 'Aliment Utilise (barre) vs ICA (ligne)', 'fisheries', { metric: 'feedEfficiency' }),
        stackedBar('Workers Male/Female per Farm', 'Travailleurs Homme/Femme par Ferme', 'fisheries', { metric: 'employment', groupBy: 'gender' }),
      ],
    },
    {
      titleEn: 'Geography & Capacity',
      titleFr: 'Geographie & Capacite',
      columnCount: 2,
      sortOrder: 5,
      widgets: [
        mapAfrica('Farm Locations (bubble=capacity)', 'Localisation Fermes (bulle=capacite)', 'fisheries', { layer: 'farms' }),
        gauge('Average Survival Rate', 'Taux de Survie Moyen', 'fi-survival-rate', 80),
      ],
    },
  ],
};

// ── Wildlife Dashboards ─────────────────────────────────────────────────────

const conservationAntiPoaching: DashboardDef = {
  code: 'STRAT-WL-CONSERVATION',
  domainCode: 'wildlife',
  scope: 'CONTINENTAL',
  titleEn: 'Conservation & Anti-Poaching',
  titleFr: 'Conservation & Anti-Braconnage',
  description: 'Species monitoring, protected areas, CITES permits, and wildlife crime',
  sections: [
    {
      titleEn: 'Conservation KPIs',
      titleFr: 'KPIs Conservation',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('Species Monitored', 'Especes Suivies', 'species-monitored', '#2E7D32'),
        kpi('Protected Area (km2)', 'Aire Protegee (km2)', 'protected-area-km2', '#1565C0', 'km2'),
        kpi('CITES Permits Active', 'Permis CITES Actifs', 'cites-permits-active', '#E65100'),
        kpi('Poaching Incidents', 'Incidents de Braconnage', 'poaching-incidents', '#C62828'),
      ],
    },
    {
      titleEn: 'Conservation Status',
      titleFr: 'Statut de Conservation',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        stackedBar('Species by IUCN Status (CR/EN/VU/NT/LC)', 'Especes par Statut UICN (CR/EN/VU/NT/LC)', 'wildlife', { metric: 'iucnStatus' }),
        mapAfrica('Protected Areas Map', 'Carte des Aires Protegees', 'wildlife', { layer: 'protectedAreas' }),
      ],
    },
    {
      titleEn: 'Population Trends',
      titleFr: 'Tendances des Populations',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        lineChart('Key Species Population Trend', 'Tendance Population Especes Cles', 'wildlife', { metric: 'populationTrend' }),
        heatmap('Species x Region Threat Level', 'Espece x Region Niveau de Menace', 'wildlife', { metric: 'threatMatrix' }),
      ],
    },
    {
      titleEn: 'Crime & CITES',
      titleFr: 'Crime & CITES',
      columnCount: 2,
      sortOrder: 4,
      widgets: [
        barChart('Crimes by Type (Poaching/Trafficking/Trade)', 'Crimes par Type (Braconnage/Trafic/Commerce)', 'wildlife', { metric: 'crimeByType' }),
        stackedBar('CITES Permits Export/Import/Re-Export', 'Permis CITES Export/Import/Re-Export', 'wildlife', { metric: 'citesFlows' }),
      ],
    },
  ],
};

const citesWildlifeTrade: DashboardDef = {
  code: 'STRAT-WL-CITES',
  domainCode: 'wildlife',
  scope: 'CONTINENTAL',
  titleEn: 'CITES & Wildlife Trade',
  titleFr: 'CITES & Commerce de la Faune',
  description: 'CITES permit management, wildlife trade flows, and enforcement',
  sections: [
    {
      titleEn: 'CITES KPIs',
      titleFr: 'KPIs CITES',
      columnCount: 4,
      sortOrder: 1,
      widgets: [
        kpi('CITES Export Permits', 'Permis Export CITES', 'cites-export-permits', '#1565C0'),
        kpi('CITES Import Permits', 'Permis Import CITES', 'cites-import-permits', '#2E7D32'),
        kpi('Permits Expired', 'Permis Expires', 'permits-expired', '#E65100'),
        kpi('Seizure Volume', 'Volume des Saisies', 'seizure-volume', '#C62828'),
      ],
    },
    {
      titleEn: 'Permit Flows',
      titleFr: 'Flux de Permis',
      columnCount: 2,
      sortOrder: 2,
      widgets: [
        stackedBar('Permits by Type x Country', 'Permis par Type x Pays', 'wildlife', { metric: 'citesByCountry' }),
        pieChart('Permit Purpose: Research/Zoo/Trophy', 'Objet du Permis: Recherche/Zoo/Trophee', 'wildlife', { metric: 'citesPurpose' }),
      ],
    },
    {
      titleEn: 'Enforcement',
      titleFr: 'Application de la Loi',
      columnCount: 2,
      sortOrder: 3,
      widgets: [
        barChart('Seizures by Species', 'Saisies par Espece', 'wildlife', { metric: 'seizuresBySpecies' }),
        lineChart('Crime Incidents Trend 12M', 'Tendance Incidents Criminels 12M', 'wildlife', { metric: 'crimeTrend' }),
      ],
    },
  ],
};

// ── Main Export ──────────────────────────────────────────────────────────────

export async function seedTradeFishWildlifeDashboards(prisma: PrismaClient): Promise<void> {
  console.log('\n── Trade & SPS Dashboards ──');
  await createStrategicDashboard(prisma, tradeIntelligence);
  await createStrategicDashboard(prisma, marketsAndPrices);

  console.log('\n── Fisheries Dashboards ──');
  await createStrategicDashboard(prisma, captureFisheries);
  await createStrategicDashboard(prisma, aquacultureValueChain);

  console.log('\n── Wildlife Dashboards ──');
  await createStrategicDashboard(prisma, conservationAntiPoaching);
  await createStrategicDashboard(prisma, citesWildlifeTrade);
}
