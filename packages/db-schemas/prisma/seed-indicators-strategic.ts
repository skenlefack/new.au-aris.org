/**
 * Seed ~113 strategic indicator definitions into analytics.indicators
 * Idempotent: uses ON CONFLICT (code) DO UPDATE
 *
 * Run: DATABASE_URL="..." npx tsx packages/db-schemas/prisma/seed-indicators-strategic.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

interface IndicatorSeed {
  code: string;
  typeCode: string;
  nameEn: string;
  nameFr: string;
  domainCode: string;
  scope: string;
  unit: string;
  periodicity: string;
  aggregation: string;
  measurementMode: string;
  targetValue?: number | null;
  betterIsHigher: boolean;
  isPublic: boolean;
}

// ---------------------------------------------------------------------------
// ALL 113 INDICATORS
// ---------------------------------------------------------------------------

const INDICATORS: IndicatorSeed[] = [
  // =========================================================================
  // GOVERNANCE (28)
  // =========================================================================
  { code: 'quality-pass-rate', typeCode: 'IBAR', nameEn: 'Quality Pass Rate', nameFr: 'Taux de conformité', domainCode: 'governance', scope: 'CONTINENTAL', unit: '%', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 90, betterIsHigher: true, isPublic: true },
  { code: 'timeliness-rate', typeCode: 'IBAR', nameEn: 'Timeliness Rate', nameFr: 'Taux de ponctualité', domainCode: 'governance', scope: 'CONTINENTAL', unit: '%', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 95, betterIsHigher: true, isPublic: true },
  { code: 'countries-reporting', typeCode: 'IBAR', nameEn: 'Countries Reporting', nameFr: 'Pays rapportant', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: 55, betterIsHigher: true, isPublic: true },
  { code: 'total-submissions', typeCode: 'IBAR', nameEn: 'Total Submissions', nameFr: 'Total soumissions', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'pending-l1', typeCode: 'IBAR', nameEn: 'Pending Level 1', nameFr: 'En attente N1', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'pending-l2', typeCode: 'IBAR', nameEn: 'Pending Level 2', nameFr: 'En attente N2', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'pending-l3', typeCode: 'IBAR', nameEn: 'Pending Level 3', nameFr: 'En attente N3', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'validated-l4', typeCode: 'IBAR', nameEn: 'Validated Level 4', nameFr: 'Validé N4', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'pvs-score-avg', typeCode: 'OMSA', nameEn: 'PVS Score Average', nameFr: 'Score PVS moyen', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'score', periodicity: 'ANNUAL', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 4.0, betterIsHigher: true, isPublic: true },
  { code: 'pvs-score-continental-avg', typeCode: 'OMSA', nameEn: 'PVS Score Continental Avg', nameFr: 'Score PVS continental moy', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'score', periodicity: 'ANNUAL', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 4.0, betterIsHigher: true, isPublic: true },
  { code: 'countries-evaluated', typeCode: 'OMSA', nameEn: 'Countries Evaluated', nameFr: 'Pays évalués', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: 55, betterIsHigher: true, isPublic: true },
  { code: 'legal-frameworks-in-force', typeCode: 'IBAR', nameEn: 'Legal Frameworks In Force', nameFr: 'Cadres juridiques en vigueur', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'total-vet-budget-usd', typeCode: 'IBAR', nameEn: 'Total Vet Budget USD', nameFr: 'Budget vétérinaire total USD', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'USD', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'laws-in-force', typeCode: 'IBAR', nameEn: 'Laws In Force', nameFr: 'Lois en vigueur', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'regulations-adopted', typeCode: 'IBAR', nameEn: 'Regulations Adopted', nameFr: 'Règlements adoptés', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'policies-draft', typeCode: 'IBAR', nameEn: 'Policies Draft', nameFr: 'Politiques en projet', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'stakeholders-registered', typeCode: 'IBAR', nameEn: 'Stakeholders Registered', nameFr: 'Parties prenantes enregistrées', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'member-states-count', typeCode: 'IBAR', nameEn: 'Member States Count', nameFr: "Nombre d'États membres", domainCode: 'governance', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'rec-data-completeness', typeCode: 'IBAR', nameEn: 'REC Data Completeness', nameFr: 'Complétude données CER', domainCode: 'governance', scope: 'REGIONAL', unit: '%', periodicity: 'QUARTERLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 100, betterIsHigher: true, isPublic: true },
  { code: 'rec-active-outbreaks', typeCode: 'IBAR', nameEn: 'REC Active Outbreaks', nameFr: 'Foyers actifs CER', domainCode: 'governance', scope: 'REGIONAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'rec-trade-volume', typeCode: 'IBAR', nameEn: 'REC Trade Volume', nameFr: 'Volume commercial CER', domainCode: 'governance', scope: 'REGIONAL', unit: 'T', periodicity: 'QUARTERLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'national-livestock-total', typeCode: 'IBAR', nameEn: 'National Livestock Total', nameFr: 'Cheptel national total', domainCode: 'governance', scope: 'NATIONAL', unit: 'M heads', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'national-outbreaks', typeCode: 'IBAR', nameEn: 'National Outbreaks', nameFr: 'Foyers nationaux', domainCode: 'governance', scope: 'NATIONAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'national-trade-volume', typeCode: 'IBAR', nameEn: 'National Trade Volume', nameFr: 'Volume commercial national', domainCode: 'governance', scope: 'NATIONAL', unit: 'T', periodicity: 'QUARTERLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'national-pvs-score', typeCode: 'OMSA', nameEn: 'National PVS Score', nameFr: 'Score PVS national', domainCode: 'governance', scope: 'NATIONAL', unit: 'score', periodicity: 'ANNUAL', aggregation: 'LATEST', measurementMode: 'MANUAL_ENTRY', targetValue: 4.0, betterIsHigher: true, isPublic: true },
  { code: 'animal-health-score', typeCode: 'IBAR', nameEn: 'Animal Health Score', nameFr: 'Score santé animale', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'score', periodicity: 'ANNUAL', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 100, betterIsHigher: true, isPublic: true },
  { code: 'environment-score', typeCode: 'IBAR', nameEn: 'Environment Score', nameFr: 'Score environnemental', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'score', periodicity: 'ANNUAL', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 100, betterIsHigher: true, isPublic: true },
  { code: 'capacity-score', typeCode: 'IBAR', nameEn: 'Capacity Score', nameFr: 'Score de capacité', domainCode: 'governance', scope: 'CONTINENTAL', unit: 'score', periodicity: 'ANNUAL', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 100, betterIsHigher: true, isPublic: true },

  // =========================================================================
  // ANIMAL HEALTH (24)
  // =========================================================================
  { code: 'active-outbreaks', typeCode: 'OMSA', nameEn: 'Active Outbreaks', nameFr: 'Foyers actifs', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'ah-active-outbreaks', typeCode: 'OMSA', nameEn: 'AH Active Outbreaks', nameFr: 'SA Foyers actifs', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'ah-notification-rate', typeCode: 'OMSA', nameEn: 'Notification Rate <24h', nameFr: 'Taux notification <24h', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: '%', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 100, betterIsHigher: true, isPublic: true },
  { code: 'ah-confirmed-month', typeCode: 'OMSA', nameEn: 'Confirmed Cases This Month', nameFr: 'Cas confirmés ce mois', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'ah-case-fatality-rate', typeCode: 'OMSA', nameEn: 'Case Fatality Rate', nameFr: 'Taux de létalité', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: '%', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'ah-detection-to-confirmation', typeCode: 'OMSA', nameEn: 'Detection to Confirmation', nameFr: 'Détection à confirmation', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'days', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 7, betterIsHigher: false, isPublic: true },
  { code: 'ah-confirmation-to-response', typeCode: 'OMSA', nameEn: 'Confirmation to Response', nameFr: 'Confirmation à réponse', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'days', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 3, betterIsHigher: false, isPublic: true },
  { code: 'ah-wahis-ready-rate', typeCode: 'OMSA', nameEn: 'WAHIS Ready Rate', nameFr: 'Taux prêt WAHIS', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: '%', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 100, betterIsHigher: true, isPublic: true },
  { code: 'ah-vaccination-coverage-avg', typeCode: 'OMSA', nameEn: 'Vaccination Coverage Avg', nameFr: 'Couverture vaccinale moy', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: '%', periodicity: 'QUARTERLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 80, betterIsHigher: true, isPublic: true },
  { code: 'ah-doses-utilization', typeCode: 'OMSA', nameEn: 'Doses Utilization Rate', nameFr: 'Taux utilisation doses', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: '%', periodicity: 'QUARTERLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 95, betterIsHigher: true, isPublic: true },
  { code: 'ah-active-campaigns', typeCode: 'OMSA', nameEn: 'Active Vaccination Campaigns', nameFr: 'Campagnes vaccination actives', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'ah-target-remaining', typeCode: 'OMSA', nameEn: 'Target Population Remaining', nameFr: 'Population cible restante', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'heads', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'ah-lab-analyses-month', typeCode: 'OMSA', nameEn: 'Lab Analyses This Month', nameFr: 'Analyses labo ce mois', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'ah-positivity-rate', typeCode: 'OMSA', nameEn: 'Lab Positivity Rate', nameFr: 'Taux de positivité', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: '%', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'ah-lab-turnaround-avg', typeCode: 'OMSA', nameEn: 'Lab Turnaround Average', nameFr: 'Délai moyen labo', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'days', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 5, betterIsHigher: false, isPublic: true },
  { code: 'ah-labs-eqa', typeCode: 'OMSA', nameEn: 'Labs Participating EQA', nameFr: 'Labos participant EQA', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'ah-aquatic-events', typeCode: 'OMSA', nameEn: 'Aquatic Disease Events', nameFr: 'Événements maladies aquatiques', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'ah-aquatic-species', typeCode: 'OMSA', nameEn: 'Aquatic Species Affected', nameFr: 'Espèces aquatiques affectées', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'ah-aquatic-lab-confirmed', typeCode: 'OMSA', nameEn: 'Aquatic Lab Confirmations', nameFr: 'Confirmations labo aquatiques', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'ah-aquatic-surveillance', typeCode: 'OMSA', nameEn: 'Aquatic Surveillance Active', nameFr: 'Surveillance aquatique active', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'ah-amr-samples', typeCode: 'OMSA', nameEn: 'AMR Samples Tested', nameFr: 'Échantillons AMR testés', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'ah-amr-resistance-rate', typeCode: 'OMSA', nameEn: 'AMR Resistance Rate', nameFr: 'Taux de résistance AMR', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: '%', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'ah-amr-sentinel-sites', typeCode: 'OMSA', nameEn: 'AMR Sentinel Sites Active', nameFr: 'Sites sentinelles AMR actifs', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'ah-amr-pathogens', typeCode: 'OMSA', nameEn: 'AMR Pathogens Monitored', nameFr: 'Pathogènes AMR surveillés', domainCode: 'animal-health', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },

  // =========================================================================
  // LIVESTOCK (31)
  // =========================================================================
  { code: 'total-livestock', typeCode: 'FAO', nameEn: 'Total Livestock', nameFr: 'Cheptel total', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'M heads', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'total-population', typeCode: 'FAO', nameEn: 'Total Population', nameFr: 'Population totale', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'M heads', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'annual-growth-rate', typeCode: 'FAO', nameEn: 'Annual Growth Rate', nameFr: 'Taux croissance annuel', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: '%', periodicity: 'ANNUAL', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'species-covered', typeCode: 'IBAR', nameEn: 'Species Covered', nameFr: 'Espèces couvertes', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'geo-coverage', typeCode: 'IBAR', nameEn: 'Geographic Coverage', nameFr: 'Couverture géographique', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: '%', periodicity: 'ANNUAL', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 100, betterIsHigher: true, isPublic: true },
  { code: 'cattle-population', typeCode: 'FAO', nameEn: 'Cattle Population', nameFr: 'Population bovine', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'M heads', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'meat-production-tonnes', typeCode: 'FAO', nameEn: 'Meat Production', nameFr: 'Production viande', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'T', periodicity: 'QUARTERLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'meat-production-total', typeCode: 'FAO', nameEn: 'Meat Production Total', nameFr: 'Production viande totale', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'T', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'slaughter-count-month', typeCode: 'FAO', nameEn: 'Monthly Slaughter Count', nameFr: 'Abattages mensuels', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'heads', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'cattle-price-avg', typeCode: 'FAO', nameEn: 'Cattle Average Price', nameFr: 'Prix moyen bovins', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'USD', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'lp-condemnation-rate', typeCode: 'IBAR', nameEn: 'Condemnation Rate', nameFr: 'Taux condamnation', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: '%', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 5, betterIsHigher: false, isPublic: true },
  { code: 'milk-production-total', typeCode: 'FAO', nameEn: 'Milk Production Total', nameFr: 'Production laitière totale', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'T', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'dairy-herd-size', typeCode: 'FAO', nameEn: 'Dairy Herd Size', nameFr: 'Taille troupeau laitier', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'M heads', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'milk-price-avg', typeCode: 'FAO', nameEn: 'Milk Average Price', nameFr: 'Prix moyen lait', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'USD/L', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'dairy-export-volume', typeCode: 'FAO', nameEn: 'Dairy Export Volume', nameFr: 'Volume export laitier', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'T', periodicity: 'QUARTERLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'poultry-population', typeCode: 'FAO', nameEn: 'Poultry Population', nameFr: 'Population avicole', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'M heads', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'egg-production', typeCode: 'FAO', nameEn: 'Egg Production', nameFr: 'Production œufs', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'egg-production-total', typeCode: 'FAO', nameEn: 'Egg Production Total', nameFr: 'Production œufs totale', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'poultry-slaughter-month', typeCode: 'FAO', nameEn: 'Poultry Monthly Slaughter', nameFr: 'Abattage avicole mensuel', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'heads', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'hpai-alerts', typeCode: 'OMSA', nameEn: 'HPAI Alerts', nameFr: 'Alertes IAHP', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'sheep-population', typeCode: 'FAO', nameEn: 'Sheep Population', nameFr: 'Population ovine', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'M heads', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'goat-population', typeCode: 'FAO', nameEn: 'Goat Population', nameFr: 'Population caprine', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'M heads', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'ppr-vaccination-coverage', typeCode: 'OMSA', nameEn: 'PPR Vaccination Coverage', nameFr: 'Couverture vaccinale PPR', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: '%', periodicity: 'ANNUAL', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 80, betterIsHigher: true, isPublic: true },
  { code: 'small-ruminant-trade', typeCode: 'FAO', nameEn: 'Small Ruminant Trade', nameFr: 'Commerce petits ruminants', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'T', periodicity: 'QUARTERLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'transhumance-corridors', typeCode: 'IBAR', nameEn: 'Transhumance Corridors', nameFr: 'Corridors transhumance', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'cross-border-corridors', typeCode: 'IBAR', nameEn: 'Cross-Border Corridors', nameFr: 'Corridors transfrontaliers', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'pastoral-population', typeCode: 'IBAR', nameEn: 'Pastoral Population', nameFr: 'Population pastorale', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'M heads', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'rangeland-condition-avg', typeCode: 'IBAR', nameEn: 'Rangeland Condition Avg', nameFr: 'Condition pâturages moy', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: 'score', periodicity: 'QUARTERLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'meat-self-sufficiency', typeCode: 'IBAR', nameEn: 'Meat Self-Sufficiency', nameFr: 'Autosuffisance viande', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: '%', periodicity: 'ANNUAL', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 100, betterIsHigher: true, isPublic: true },
  { code: 'milk-self-sufficiency', typeCode: 'IBAR', nameEn: 'Milk Self-Sufficiency', nameFr: 'Autosuffisance lait', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: '%', periodicity: 'ANNUAL', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 100, betterIsHigher: true, isPublic: true },
  { code: 'fish-self-sufficiency', typeCode: 'IBAR', nameEn: 'Fish Self-Sufficiency', nameFr: 'Autosuffisance poisson', domainCode: 'livestock-prod', scope: 'CONTINENTAL', unit: '%', periodicity: 'ANNUAL', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 100, betterIsHigher: true, isPublic: true },

  // =========================================================================
  // TRADE & SPS (8)
  // =========================================================================
  { code: 'total-trade-volume', typeCode: 'FAO', nameEn: 'Total Trade Volume', nameFr: 'Volume commercial total', domainCode: 'trade-sps', scope: 'CONTINENTAL', unit: 'T', periodicity: 'QUARTERLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'trade-volume', typeCode: 'FAO', nameEn: 'Trade Volume', nameFr: 'Volume commercial', domainCode: 'trade-sps', scope: 'CONTINENTAL', unit: 'T', periodicity: 'QUARTERLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'trade-balance', typeCode: 'FAO', nameEn: 'Trade Balance', nameFr: 'Balance commerciale', domainCode: 'trade-sps', scope: 'CONTINENTAL', unit: 'USD', periodicity: 'QUARTERLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'sps-certificates-issued', typeCode: 'IBAR', nameEn: 'SPS Certificates Issued', nameFr: 'Certificats SPS émis', domainCode: 'trade-sps', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'sps-compliance-rate', typeCode: 'IBAR', nameEn: 'SPS Compliance Rate', nameFr: 'Taux conformité SPS', domainCode: 'trade-sps', scope: 'CONTINENTAL', unit: '%', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 95, betterIsHigher: true, isPublic: true },
  { code: 'active-markets', typeCode: 'IBAR', nameEn: 'Active Markets', nameFr: 'Marchés actifs', domainCode: 'trade-sps', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'commodities-tracked', typeCode: 'IBAR', nameEn: 'Commodities Tracked', nameFr: 'Commodités suivies', domainCode: 'trade-sps', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'price-alerts', typeCode: 'IBAR', nameEn: 'Price Alerts', nameFr: 'Alertes prix', domainCode: 'trade-sps', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },

  // =========================================================================
  // FISHERIES (11)
  // =========================================================================
  { code: 'total-captures', typeCode: 'FAO', nameEn: 'Total Captures', nameFr: 'Captures totales', domainCode: 'fisheries', scope: 'CONTINENTAL', unit: 'T', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'total-capture-tonnes', typeCode: 'FAO', nameEn: 'Total Capture Tonnes', nameFr: 'Captures totales tonnes', domainCode: 'fisheries', scope: 'CONTINENTAL', unit: 'T', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'active-vessels', typeCode: 'FAO', nameEn: 'Active Vessels', nameFr: 'Navires actifs', domainCode: 'fisheries', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'main-species-count', typeCode: 'FAO', nameEn: 'Main Species Count', nameFr: 'Nombre espèces principales', domainCode: 'fisheries', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'cpue-average', typeCode: 'FAO', nameEn: 'CPUE Average', nameFr: 'CPUE moyen', domainCode: 'fisheries', scope: 'CONTINENTAL', unit: 'kg/effort', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'aquaculture-production-tonnes', typeCode: 'FAO', nameEn: 'Aquaculture Production', nameFr: 'Production aquacole', domainCode: 'fisheries', scope: 'CONTINENTAL', unit: 'T', periodicity: 'QUARTERLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'active-farms', typeCode: 'FAO', nameEn: 'Active Farms', nameFr: 'Fermes actives', domainCode: 'fisheries', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'fcr-average', typeCode: 'FAO', nameEn: 'FCR Average', nameFr: 'FCR moyen', domainCode: 'fisheries', scope: 'CONTINENTAL', unit: 'ratio', periodicity: 'QUARTERLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 1.5, betterIsHigher: false, isPublic: true },
  { code: 'survival-rate-avg', typeCode: 'FAO', nameEn: 'Survival Rate Average', nameFr: 'Taux survie moyen', domainCode: 'fisheries', scope: 'CONTINENTAL', unit: '%', periodicity: 'QUARTERLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 80, betterIsHigher: true, isPublic: true },
  { code: 'fi-survival-rate', typeCode: 'FAO', nameEn: 'Fish Survival Rate', nameFr: 'Taux survie poisson', domainCode: 'fisheries', scope: 'CONTINENTAL', unit: '%', periodicity: 'QUARTERLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 80, betterIsHigher: true, isPublic: true },
  { code: 'fish-production-total', typeCode: 'FAO', nameEn: 'Fish Production Total', nameFr: 'Production poisson totale', domainCode: 'fisheries', scope: 'CONTINENTAL', unit: 'T', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },

  // =========================================================================
  // WILDLIFE (9)
  // =========================================================================
  { code: 'species-monitored', typeCode: 'IBAR', nameEn: 'Species Monitored', nameFr: 'Espèces suivies', domainCode: 'wildlife', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'protected-areas', typeCode: 'IBAR', nameEn: 'Protected Areas', nameFr: 'Aires protégées', domainCode: 'wildlife', scope: 'CONTINENTAL', unit: 'km2', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'protected-area-km2', typeCode: 'IBAR', nameEn: 'Protected Area km2', nameFr: 'Aires protégées km2', domainCode: 'wildlife', scope: 'CONTINENTAL', unit: 'km2', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'cites-permits-active', typeCode: 'IBAR', nameEn: 'CITES Permits Active', nameFr: 'Permis CITES actifs', domainCode: 'wildlife', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'poaching-incidents', typeCode: 'IBAR', nameEn: 'Poaching Incidents', nameFr: 'Incidents braconnage', domainCode: 'wildlife', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'cites-export-permits', typeCode: 'IBAR', nameEn: 'CITES Export Permits', nameFr: 'Permis export CITES', domainCode: 'wildlife', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'cites-import-permits', typeCode: 'IBAR', nameEn: 'CITES Import Permits', nameFr: 'Permis import CITES', domainCode: 'wildlife', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'permits-expired', typeCode: 'IBAR', nameEn: 'Permits Expired', nameFr: 'Permis expirés', domainCode: 'wildlife', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'seizure-volume', typeCode: 'IBAR', nameEn: 'Seizure Volume', nameFr: 'Volume saisies', domainCode: 'wildlife', scope: 'CONTINENTAL', unit: 'kg', periodicity: 'MONTHLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },

  // =========================================================================
  // CLIMATE & ENVIRONMENT (8)
  // =========================================================================
  { code: 'zones-severe-water-stress', typeCode: 'IBAR', nameEn: 'Zones Severe Water Stress', nameFr: 'Zones stress hydrique sévère', domainCode: 'climate-env', scope: 'CONTINENTAL', unit: 'count', periodicity: 'QUARTERLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'climate-hotspots', typeCode: 'IBAR', nameEn: 'Climate Hotspots', nameFr: 'Points chauds climatiques', domainCode: 'climate-env', scope: 'CONTINENTAL', unit: 'count', periodicity: 'MONTHLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'ndvi-average', typeCode: 'IBAR', nameEn: 'NDVI Average', nameFr: 'NDVI moyen', domainCode: 'climate-env', scope: 'CONTINENTAL', unit: 'index', periodicity: 'MONTHLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 0.5, betterIsHigher: true, isPublic: true },
  { code: 'ce-severe-degradation-pct', typeCode: 'IBAR', nameEn: 'Severe Degradation %', nameFr: '% dégradation sévère', domainCode: 'climate-env', scope: 'CONTINENTAL', unit: '%', periodicity: 'QUARTERLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 20, betterIsHigher: false, isPublic: true },
  { code: 'water-stress-avg-index', typeCode: 'IBAR', nameEn: 'Water Stress Average Index', nameFr: 'Index stress hydrique moyen', domainCode: 'climate-env', scope: 'CONTINENTAL', unit: 'index', periodicity: 'QUARTERLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'irrigated-area-pct', typeCode: 'IBAR', nameEn: 'Irrigated Area %', nameFr: '% superficie irriguée', domainCode: 'climate-env', scope: 'CONTINENTAL', unit: '%', periodicity: 'ANNUAL', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'zones-scarce', typeCode: 'IBAR', nameEn: 'Zones Scarce Water', nameFr: 'Zones eau rare', domainCode: 'climate-env', scope: 'CONTINENTAL', unit: 'count', periodicity: 'QUARTERLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: false, isPublic: true },
  { code: 'zones-adequate', typeCode: 'IBAR', nameEn: 'Zones Adequate Water', nameFr: 'Zones eau adéquate', domainCode: 'climate-env', scope: 'CONTINENTAL', unit: 'count', periodicity: 'QUARTERLY', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },

  // =========================================================================
  // APICULTURE (4)
  // =========================================================================
  { code: 'apiaries-active', typeCode: 'IBAR', nameEn: 'Active Apiaries', nameFr: 'Ruchers actifs', domainCode: 'apiculture', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'COUNT', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'honey-production', typeCode: 'FAO', nameEn: 'Honey Production', nameFr: 'Production de miel', domainCode: 'apiculture', scope: 'CONTINENTAL', unit: 'kg', periodicity: 'QUARTERLY', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
  { code: 'colony-health-strong-pct', typeCode: 'IBAR', nameEn: 'Colony Health Strong %', nameFr: '% colonies fortes', domainCode: 'apiculture', scope: 'CONTINENTAL', unit: '%', periodicity: 'QUARTERLY', aggregation: 'AVERAGE', measurementMode: 'MANUAL_ENTRY', targetValue: 80, betterIsHigher: true, isPublic: true },
  { code: 'beekeepers-trained', typeCode: 'IBAR', nameEn: 'Beekeepers Trained', nameFr: 'Apiculteurs formés', domainCode: 'apiculture', scope: 'CONTINENTAL', unit: 'count', periodicity: 'ANNUAL', aggregation: 'SUM', measurementMode: 'MANUAL_ENTRY', targetValue: null, betterIsHigher: true, isPublic: true },
];

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seeding ${INDICATORS.length} strategic indicators...\n`);

  // 1. Resolve domain IDs from governance.domains
  const domains = await prisma.$queryRawUnsafe<{ id: string; code: string }[]>(
    `SELECT id, code FROM governance.domains WHERE code = ANY($1::text[])`,
    ['governance', 'animal-health', 'livestock-prod', 'trade-sps', 'fisheries', 'wildlife', 'apiculture', 'climate-env'],
  );
  const domainMap = Object.fromEntries(domains.map((d) => [d.code, d.id]));
  console.log(`Resolved ${domains.length} domains: ${domains.map((d) => d.code).join(', ')}\n`);

  let ok = 0;
  let skipped = 0;

  // 2. Upsert each indicator
  for (const ind of INDICATORS) {
    const domainId = domainMap[ind.domainCode];
    if (!domainId) {
      console.log(`  [SKIP] ${ind.code} — domain "${ind.domainCode}" not found`);
      skipped++;
      continue;
    }

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO analytics.indicators
        (id, code, type_code, name_en, name_fr, domain_id, scope, unit,
         periodicity, aggregation, measurement_mode,
         target_value, better_is_higher, is_public, active,
         created_at, updated_at)
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5::uuid,
        $6::analytics."IndicatorScope", $7,
        $8::analytics."IndicatorPeriodicity",
        $9::analytics."IndicatorAggregation",
        $10::analytics."IndicatorMeasurementMode",
        $11, $12, true, true, NOW(), NOW()
      )
      ON CONFLICT (code) DO UPDATE SET
        name_en        = EXCLUDED.name_en,
        name_fr        = EXCLUDED.name_fr,
        type_code      = EXCLUDED.type_code,
        domain_id      = EXCLUDED.domain_id,
        scope          = EXCLUDED.scope,
        unit           = EXCLUDED.unit,
        periodicity    = EXCLUDED.periodicity,
        aggregation    = EXCLUDED.aggregation,
        measurement_mode = EXCLUDED.measurement_mode,
        target_value   = EXCLUDED.target_value,
        better_is_higher = EXCLUDED.better_is_higher,
        updated_at     = NOW()
      `,
      ind.code,
      ind.typeCode,
      ind.nameEn,
      ind.nameFr,
      domainId,
      ind.scope || 'CONTINENTAL',
      ind.unit,
      ind.periodicity,
      ind.aggregation,
      ind.measurementMode || 'MANUAL_ENTRY',
      ind.targetValue ?? null,
      ind.betterIsHigher,
    );

    console.log(`  [OK] ${ind.code}`);
    ok++;
  }

  console.log(`\nDone. ${ok} seeded, ${skipped} skipped. Total defined: ${INDICATORS.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
