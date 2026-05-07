/**
 * Seed REALISTIC DEMO indicator values into analytics.indicator_values
 * for ALL 123 strategic indicators across 5 pilot countries.
 *
 * This script fills dashboards with meaningful data for demo purposes
 * when production domain tables are empty.
 *
 * Idempotent: uses ON CONFLICT on the unique index pattern.
 *
 * Run:
 *   DATABASE_URL="..." npx tsx packages/db-schemas/prisma/seed-indicator-demo-values.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL,
  max: 3,
});

// =============================================================================
// Types & Constants
// =============================================================================

interface DemoValue {
  code: string;
  /** Per-country base values for annual data (2025 baseline) */
  values: Record<string, number>;
  /** If true, generate 12 monthly values for 2025 with +/-10% variation */
  isMonthly?: boolean;
  /** If true, generate 4 quarterly values for 2024 & 2025 with +/-5% variation */
  isQuarterly?: boolean;
  /** Only insert continental-level aggregate (no per-country rows) */
  isContinental?: boolean;
  /** Annual trend % applied backwards: 2024 = base/(1+t), 2023 = base/(1+t)^2 */
  trend?: number;
}

const COUNTRIES = ['KE', 'ET', 'NG', 'SN', 'ZA'] as const;
const COUNTRY_REC: Record<string, string> = {
  KE: 'igad',
  ET: 'igad',
  NG: 'ecowas',
  SN: 'ecowas',
  ZA: 'sadc',
};
const YEARS = [2023, 2024, 2025];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const QUARTERS = [1, 2, 3, 4];

// Deterministic pseudo-random based on seed string (for reproducible runs)
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  // Normalize to 0..1
  return Math.abs((Math.sin(hash) * 10000) % 1);
}

/** Apply +/- variation around a base value, deterministic by seed */
function vary(base: number, pct: number, seed: string): number {
  const r = seededRandom(seed);
  const factor = 1 + (r * 2 - 1) * (pct / 100);
  return Math.round(base * factor * 100) / 100;
}

// =============================================================================
// DEMO DATA — ALL 123 INDICATORS
// =============================================================================

const DEMO_DATA: DemoValue[] = [
  // =========================================================================
  // GOVERNANCE (28 indicators)
  // =========================================================================
  { code: 'quality-pass-rate', isMonthly: true, trend: 3,
    values: { KE: 82, ET: 74, NG: 68, SN: 77, ZA: 88 } },
  { code: 'timeliness-rate', isMonthly: true, trend: 2,
    values: { KE: 85, ET: 78, NG: 72, SN: 80, ZA: 91 } },
  { code: 'countries-reporting', isMonthly: true, trend: 5, isContinental: true,
    values: { _continental: 38 } },
  { code: 'total-submissions', isMonthly: true, trend: 8, isContinental: true,
    values: { _continental: 1250 } },
  { code: 'pending-l1', isMonthly: true, trend: -5, isContinental: true,
    values: { _continental: 85 } },
  { code: 'pending-l2', isMonthly: true, trend: -4, isContinental: true,
    values: { _continental: 42 } },
  { code: 'pending-l3', isMonthly: true, trend: -3, isContinental: true,
    values: { _continental: 18 } },
  { code: 'validated-l4', isMonthly: true, trend: 10, isContinental: true,
    values: { _continental: 320 } },
  { code: 'pvs-score-avg', trend: 2, isContinental: true,
    values: { _continental: 3.1 } },
  { code: 'pvs-score-continental-avg', trend: 2,
    values: { KE: 3.2, ET: 2.8, NG: 2.5, SN: 2.9, ZA: 3.8 } },
  { code: 'countries-evaluated', trend: 3, isContinental: true,
    values: { _continental: 28 } },
  { code: 'legal-frameworks-in-force', trend: 4,
    values: { KE: 15, ET: 12, NG: 18, SN: 10, ZA: 22 } },
  { code: 'total-vet-budget-usd', trend: 5,
    values: { KE: 45000000, ET: 32000000, NG: 28000000, SN: 15000000, ZA: 85000000 } },
  { code: 'laws-in-force', trend: 2,
    values: { KE: 8, ET: 6, NG: 10, SN: 5, ZA: 14 } },
  { code: 'regulations-adopted', trend: 6,
    values: { KE: 12, ET: 9, NG: 14, SN: 7, ZA: 18 } },
  { code: 'policies-draft', trend: -3,
    values: { KE: 3, ET: 5, NG: 6, SN: 4, ZA: 2 } },
  { code: 'stakeholders-registered', trend: 8,
    values: { KE: 245, ET: 180, NG: 320, SN: 120, ZA: 280 } },
  { code: 'member-states-count', trend: 0, isContinental: true,
    values: { _continental: 55 } },
  { code: 'rec-data-completeness', isQuarterly: true, trend: 5,
    values: { KE: 78, ET: 65, NG: 58, SN: 70, ZA: 85 } },
  { code: 'rec-active-outbreaks', isMonthly: true, trend: -3,
    values: { KE: 12, ET: 18, NG: 25, SN: 8, ZA: 6 } },
  { code: 'rec-trade-volume', isQuarterly: true, trend: 6,
    values: { KE: 12500, ET: 8200, NG: 18500, SN: 6800, ZA: 22000 } },
  { code: 'national-livestock-total', trend: 2,
    values: { KE: 28.5, ET: 65.2, NG: 42.8, SN: 16.3, ZA: 14.2 } },
  { code: 'national-outbreaks', isMonthly: true, trend: -4,
    values: { KE: 8, ET: 14, NG: 20, SN: 5, ZA: 4 } },
  { code: 'national-trade-volume', isQuarterly: true, trend: 5,
    values: { KE: 8500, ET: 5200, NG: 12000, SN: 4500, ZA: 15000 } },
  { code: 'national-pvs-score', trend: 2,
    values: { KE: 3.2, ET: 2.8, NG: 2.5, SN: 2.9, ZA: 3.8 } },
  { code: 'animal-health-score', trend: 3, isContinental: true,
    values: { _continental: 62 } },
  { code: 'environment-score', trend: 1, isContinental: true,
    values: { _continental: 48 } },
  { code: 'capacity-score', trend: 4, isContinental: true,
    values: { _continental: 55 } },

  // =========================================================================
  // ANIMAL HEALTH (24 indicators)
  // =========================================================================
  { code: 'active-outbreaks', isMonthly: true, trend: -3,
    values: { KE: 12, ET: 18, NG: 25, SN: 8, ZA: 6 } },
  { code: 'ah-active-outbreaks', isMonthly: true, trend: -3,
    values: { KE: 10, ET: 15, NG: 22, SN: 7, ZA: 5 } },
  { code: 'ah-notification-rate', isMonthly: true, trend: 4,
    values: { KE: 82, ET: 72, NG: 65, SN: 75, ZA: 90 } },
  { code: 'ah-confirmed-month', isMonthly: true, trend: -2,
    values: { KE: 8, ET: 12, NG: 15, SN: 5, ZA: 3 } },
  { code: 'ah-case-fatality-rate', isMonthly: true, trend: -3,
    values: { KE: 12, ET: 18, NG: 22, SN: 15, ZA: 8 } },
  { code: 'ah-detection-to-confirmation', isMonthly: true, trend: -5,
    values: { KE: 6, ET: 10, NG: 12, SN: 8, ZA: 4 } },
  { code: 'ah-confirmation-to-response', isMonthly: true, trend: -4,
    values: { KE: 3, ET: 5, NG: 6, SN: 4, ZA: 2 } },
  { code: 'ah-wahis-ready-rate', isMonthly: true, trend: 6,
    values: { KE: 72, ET: 55, NG: 45, SN: 60, ZA: 82 } },
  { code: 'ah-vaccination-coverage-avg', isQuarterly: true, trend: 4,
    values: { KE: 68, ET: 55, NG: 48, SN: 60, ZA: 78 } },
  { code: 'ah-doses-utilization', isQuarterly: true, trend: 3,
    values: { KE: 82, ET: 75, NG: 72, SN: 78, ZA: 90 } },
  { code: 'ah-active-campaigns', isMonthly: true, trend: 5,
    values: { KE: 4, ET: 6, NG: 8, SN: 3, ZA: 5 } },
  { code: 'ah-target-remaining', isMonthly: true, trend: -8,
    values: { KE: 850000, ET: 1200000, NG: 1800000, SN: 450000, ZA: 320000 } },
  { code: 'ah-lab-analyses-month', isMonthly: true, trend: 6,
    values: { KE: 180, ET: 120, NG: 95, SN: 85, ZA: 280 } },
  { code: 'ah-positivity-rate', isMonthly: true, trend: -2,
    values: { KE: 18, ET: 25, NG: 30, SN: 22, ZA: 12 } },
  { code: 'ah-lab-turnaround-avg', isMonthly: true, trend: -5,
    values: { KE: 5, ET: 9, NG: 11, SN: 7, ZA: 4 } },
  { code: 'ah-labs-eqa', trend: 5,
    values: { KE: 8, ET: 5, NG: 4, SN: 3, ZA: 12 } },
  { code: 'ah-aquatic-events', isMonthly: true, trend: 2,
    values: { KE: 2, ET: 1, NG: 4, SN: 3, ZA: 1 } },
  { code: 'ah-aquatic-species', isMonthly: true, trend: 0,
    values: { KE: 3, ET: 1, NG: 5, SN: 4, ZA: 2 } },
  { code: 'ah-aquatic-lab-confirmed', isMonthly: true, trend: 3,
    values: { KE: 2, ET: 1, NG: 3, SN: 2, ZA: 1 } },
  { code: 'ah-aquatic-surveillance', isMonthly: true, trend: 4,
    values: { KE: 3, ET: 1, NG: 2, SN: 2, ZA: 4 } },
  { code: 'ah-amr-samples', isMonthly: true, trend: 10,
    values: { KE: 45, ET: 28, NG: 22, SN: 18, ZA: 65 } },
  { code: 'ah-amr-resistance-rate', isMonthly: true, trend: -2,
    values: { KE: 28, ET: 35, NG: 42, SN: 32, ZA: 22 } },
  { code: 'ah-amr-sentinel-sites', trend: 8,
    values: { KE: 6, ET: 4, NG: 3, SN: 2, ZA: 9 } },
  { code: 'ah-amr-pathogens', trend: 5,
    values: { KE: 8, ET: 5, NG: 4, SN: 4, ZA: 10 } },

  // =========================================================================
  // LIVESTOCK (31 indicators)
  // =========================================================================
  { code: 'total-livestock', trend: 2,
    values: { KE: 28.5, ET: 65.2, NG: 42.8, SN: 16.3, ZA: 14.2 } },
  { code: 'total-population', trend: 2,
    values: { KE: 28.5, ET: 65.2, NG: 42.8, SN: 16.3, ZA: 14.2 } },
  { code: 'annual-growth-rate', trend: 0,
    values: { KE: 2.1, ET: 1.8, NG: 2.5, SN: 1.6, ZA: 1.2 } },
  { code: 'species-covered', trend: 2,
    values: { KE: 12, ET: 14, NG: 11, SN: 9, ZA: 10 } },
  { code: 'geo-coverage', trend: 3, isContinental: true,
    values: { _continental: 72 } },
  { code: 'cattle-population', trend: 1.5,
    values: { KE: 18.4, ET: 42.5, NG: 20.1, SN: 3.5, ZA: 12.8 } },
  { code: 'meat-production-tonnes', isQuarterly: true, trend: 3,
    values: { KE: 212, ET: 300, NG: 450, SN: 55, ZA: 412 } },
  { code: 'meat-production-total', trend: 3,
    values: { KE: 850, ET: 1200, NG: 1800, SN: 220, ZA: 1650 } },
  { code: 'slaughter-count-month', isMonthly: true, trend: 3,
    values: { KE: 125000, ET: 180000, NG: 280000, SN: 45000, ZA: 195000 } },
  { code: 'cattle-price-avg', isMonthly: true, trend: 4,
    values: { KE: 520, ET: 380, NG: 450, SN: 410, ZA: 680 } },
  { code: 'lp-condemnation-rate', isMonthly: true, trend: -2,
    values: { KE: 3.2, ET: 4.8, NG: 5.5, SN: 4.1, ZA: 2.5 } },
  { code: 'milk-production-total', trend: 3,
    values: { KE: 5200, ET: 4100, NG: 580, SN: 250, ZA: 3400 } },
  { code: 'dairy-herd-size', trend: 2,
    values: { KE: 4.8, ET: 8.5, NG: 2.1, SN: 0.6, ZA: 1.5 } },
  { code: 'milk-price-avg', isMonthly: true, trend: 3,
    values: { KE: 0.52, ET: 0.42, NG: 0.65, SN: 0.58, ZA: 0.48 } },
  { code: 'dairy-export-volume', isQuarterly: true, trend: 5,
    values: { KE: 1200, ET: 350, NG: 80, SN: 45, ZA: 2800 } },
  { code: 'poultry-population', trend: 4,
    values: { KE: 32.5, ET: 56.4, NG: 180.0, SN: 28.5, ZA: 25.0 } },
  { code: 'egg-production', isMonthly: true, trend: 4,
    values: { KE: 10, ET: 7, NG: 54, SN: 3.8, ZA: 29 } },
  { code: 'egg-production-total', trend: 4,
    values: { KE: 120, ET: 85, NG: 650, SN: 45, ZA: 350 } },
  { code: 'poultry-slaughter-month', isMonthly: true, trend: 4,
    values: { KE: 2800000, ET: 3500000, NG: 12000000, SN: 1500000, ZA: 4200000 } },
  { code: 'hpai-alerts', isMonthly: true, trend: -5,
    values: { KE: 1, ET: 2, NG: 3, SN: 1, ZA: 1 } },
  { code: 'sheep-population', trend: 1.5,
    values: { KE: 17.3, ET: 39.2, NG: 41.3, SN: 6.2, ZA: 22.5 } },
  { code: 'goat-population', trend: 2,
    values: { KE: 27.8, ET: 50.5, NG: 79.1, SN: 7.1, ZA: 6.1 } },
  { code: 'ppr-vaccination-coverage', trend: 5,
    values: { KE: 62, ET: 48, NG: 42, SN: 55, ZA: 72 } },
  { code: 'small-ruminant-trade', isQuarterly: true, trend: 4,
    values: { KE: 3500, ET: 5200, NG: 2800, SN: 1200, ZA: 800 } },
  { code: 'transhumance-corridors', trend: 2,
    values: { KE: 5, ET: 8, NG: 12, SN: 6, ZA: 2 } },
  { code: 'cross-border-corridors', trend: 3,
    values: { KE: 3, ET: 5, NG: 8, SN: 4, ZA: 1 } },
  { code: 'pastoral-population', trend: 1,
    values: { KE: 18.5, ET: 42.0, NG: 28.5, SN: 8.2, ZA: 5.5 } },
  { code: 'rangeland-condition-avg', isQuarterly: true, trend: -1,
    values: { KE: 3.2, ET: 2.8, NG: 2.5, SN: 2.9, ZA: 3.5 } },
  { code: 'meat-self-sufficiency', trend: 1,
    values: { KE: 92, ET: 95, NG: 78, SN: 65, ZA: 105 } },
  { code: 'milk-self-sufficiency', trend: 1,
    values: { KE: 88, ET: 82, NG: 35, SN: 28, ZA: 95 } },
  { code: 'fish-self-sufficiency', trend: 1,
    values: { KE: 72, ET: 45, NG: 55, SN: 82, ZA: 68 } },

  // =========================================================================
  // TRADE & SPS (8 indicators)
  // =========================================================================
  { code: 'total-trade-volume', isQuarterly: true, trend: 5,
    values: { KE: 8500, ET: 5200, NG: 22000, SN: 6500, ZA: 45000 } },
  { code: 'trade-volume', isQuarterly: true, trend: 5,
    values: { KE: 7200, ET: 4800, NG: 18000, SN: 5500, ZA: 38000 } },
  { code: 'trade-balance', isQuarterly: true, trend: 3,
    values: { KE: -2500000, ET: -4200000, NG: -8500000, SN: -1800000, ZA: 12000000 } },
  { code: 'sps-certificates-issued', isMonthly: true, trend: 6,
    values: { KE: 180, ET: 95, NG: 250, SN: 75, ZA: 320 } },
  { code: 'sps-compliance-rate', isMonthly: true, trend: 3,
    values: { KE: 82, ET: 72, NG: 68, SN: 75, ZA: 90 } },
  { code: 'active-markets', isMonthly: true, trend: 4,
    values: { KE: 12, ET: 8, NG: 22, SN: 6, ZA: 15 } },
  { code: 'commodities-tracked', isMonthly: true, trend: 5,
    values: { KE: 18, ET: 12, NG: 25, SN: 10, ZA: 22 } },
  { code: 'price-alerts', isMonthly: true, trend: -3,
    values: { KE: 5, ET: 8, NG: 12, SN: 4, ZA: 3 } },

  // =========================================================================
  // FISHERIES (11 indicators)
  // =========================================================================
  { code: 'total-captures', isMonthly: true, trend: 2,
    values: { KE: 15, ET: 4.3, NG: 68, SN: 37, ZA: 48 } },
  { code: 'total-capture-tonnes', isMonthly: true, trend: 2,
    values: { KE: 15, ET: 4.3, NG: 68, SN: 37, ZA: 48 } },
  { code: 'active-vessels', isMonthly: true, trend: 3,
    values: { KE: 1200, ET: 45, NG: 8500, SN: 2800, ZA: 1500 } },
  { code: 'main-species-count', trend: 1,
    values: { KE: 25, ET: 8, NG: 42, SN: 35, ZA: 30 } },
  { code: 'cpue-average', isMonthly: true, trend: -1,
    values: { KE: 12.5, ET: 8.2, NG: 15.8, SN: 18.5, ZA: 14.2 } },
  { code: 'aquaculture-production-tonnes', isQuarterly: true, trend: 8,
    values: { KE: 6.2, ET: 2.0, NG: 77.5, SN: 3.0, ZA: 21.2 } },
  { code: 'active-farms', trend: 6,
    values: { KE: 35, ET: 12, NG: 180, SN: 18, ZA: 65 } },
  { code: 'fcr-average', isQuarterly: true, trend: -2,
    values: { KE: 1.5, ET: 1.8, NG: 1.6, SN: 1.7, ZA: 1.4 } },
  { code: 'survival-rate-avg', isQuarterly: true, trend: 2,
    values: { KE: 78, ET: 65, NG: 72, SN: 70, ZA: 82 } },
  { code: 'fi-survival-rate', isQuarterly: true, trend: 2,
    values: { KE: 78, ET: 65, NG: 72, SN: 70, ZA: 82 } },
  { code: 'fish-production-total', trend: 4,
    values: { KE: 205, ET: 60, NG: 1130, SN: 462, ZA: 665 } },

  // =========================================================================
  // WILDLIFE (9 indicators)
  // =========================================================================
  { code: 'species-monitored', trend: 3,
    values: { KE: 95, ET: 55, NG: 45, SN: 32, ZA: 120 } },
  { code: 'protected-areas', trend: 1,
    values: { KE: 72500, ET: 82000, NG: 45000, SN: 18500, ZA: 102000 } },
  { code: 'protected-area-km2', trend: 1,
    values: { KE: 72500, ET: 82000, NG: 45000, SN: 18500, ZA: 102000 } },
  { code: 'cites-permits-active', isMonthly: true, trend: 3,
    values: { KE: 45, ET: 18, NG: 22, SN: 12, ZA: 65 } },
  { code: 'poaching-incidents', isMonthly: true, trend: -5,
    values: { KE: 8, ET: 5, NG: 12, SN: 3, ZA: 6 } },
  { code: 'cites-export-permits', isMonthly: true, trend: 2,
    values: { KE: 22, ET: 8, NG: 10, SN: 5, ZA: 35 } },
  { code: 'cites-import-permits', isMonthly: true, trend: 2,
    values: { KE: 15, ET: 6, NG: 8, SN: 4, ZA: 25 } },
  { code: 'permits-expired', isMonthly: true, trend: -3,
    values: { KE: 4, ET: 3, NG: 5, SN: 2, ZA: 3 } },
  { code: 'seizure-volume', isMonthly: true, trend: -4,
    values: { KE: 120, ET: 85, NG: 200, SN: 45, ZA: 95 } },

  // =========================================================================
  // CLIMATE & ENVIRONMENT (8 indicators)
  // =========================================================================
  { code: 'zones-severe-water-stress', isQuarterly: true, trend: 2,
    values: { KE: 8, ET: 12, NG: 5, SN: 6, ZA: 4 } },
  { code: 'climate-hotspots', isMonthly: true, trend: 3,
    values: { KE: 5, ET: 8, NG: 4, SN: 3, ZA: 2 } },
  { code: 'ndvi-average', isMonthly: true, trend: -1,
    values: { KE: 0.38, ET: 0.32, NG: 0.48, SN: 0.35, ZA: 0.42 } },
  { code: 'ce-severe-degradation-pct', isQuarterly: true, trend: 2,
    values: { KE: 18, ET: 28, NG: 12, SN: 22, ZA: 10 } },
  { code: 'water-stress-avg-index', isQuarterly: true, trend: 1,
    values: { KE: 52, ET: 68, NG: 35, SN: 58, ZA: 30 } },
  { code: 'irrigated-area-pct', trend: 1,
    values: { KE: 3.5, ET: 2.8, NG: 1.5, SN: 4.2, ZA: 5.8 } },
  { code: 'zones-scarce', isQuarterly: true, trend: 1,
    values: { KE: 6, ET: 10, NG: 3, SN: 5, ZA: 3 } },
  { code: 'zones-adequate', isQuarterly: true, trend: -1,
    values: { KE: 12, ET: 8, NG: 18, SN: 10, ZA: 15 } },

  // =========================================================================
  // APICULTURE (4 indicators)
  // =========================================================================
  { code: 'apiaries-active', trend: 5,
    values: { KE: 280, ET: 450, NG: 120, SN: 85, ZA: 180 } },
  { code: 'honey-production', isQuarterly: true, trend: 4,
    values: { KE: 850, ET: 1200, NG: 520, SN: 380, ZA: 680 } },
  { code: 'colony-health-strong-pct', isQuarterly: true, trend: 2,
    values: { KE: 68, ET: 58, NG: 62, SN: 65, ZA: 75 } },
  { code: 'beekeepers-trained', trend: 10,
    values: { KE: 350, ET: 480, NG: 180, SN: 120, ZA: 250 } },
];

// =============================================================================
// SQL Templates
// =============================================================================

const UPSERT_SQL = `
  INSERT INTO analytics.indicator_values
    (id, indicator_id, year, month, quarter, country_code, rec_code, is_continental, value, source, created_at, updated_at)
  VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'demo-seed', NOW(), NOW())
  ON CONFLICT (indicator_id, year, COALESCE(month,-1), COALESCE(quarter,-1), COALESCE(country_code,''), COALESCE(rec_code,''), is_continental)
  DO UPDATE SET value = EXCLUDED.value, source = 'demo-seed', updated_at = NOW()
`;

// =============================================================================
// Helpers
// =============================================================================

/** Apply trend backwards: for year Y relative to baseYear, multiply base by (1+trend/100)^(Y-baseYear) */
function applyTrend(base: number, trend: number, year: number, baseYear: number): number {
  const delta = year - baseYear;
  return base * Math.pow(1 + trend / 100, delta);
}

// Seasonal factors for monthly indicators (African agriculture patterns)
// Higher activity in wet season (Mar-Jun, Sep-Nov), lower in dry (Jul-Aug, Dec-Feb)
const SEASONAL_FACTORS: Record<number, number> = {
  1: 0.88, 2: 0.90, 3: 1.05, 4: 1.12, 5: 1.15, 6: 1.10,
  7: 0.92, 8: 0.85, 9: 1.02, 10: 1.08, 11: 1.05, 12: 0.88,
};

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('=== Seed Demo Indicator Values ===');
  console.log(`    ${DEMO_DATA.length} indicator definitions`);
  console.log(`    ${COUNTRIES.length} pilot countries: ${COUNTRIES.join(', ')}`);
  console.log(`    Years: ${YEARS.join(', ')}\n`);

  // 1. Load indicator IDs by code
  const { rows: indicators } = await pool.query(
    'SELECT id, code, aggregation FROM analytics.indicators WHERE active = true',
  );
  const idMap = new Map<string, string>();
  const aggMap = new Map<string, string>();
  for (const ind of indicators) {
    idMap.set(ind.code, ind.id);
    aggMap.set(ind.code, ind.aggregation);
  }
  console.log(`Loaded ${idMap.size} active indicator definitions\n`);

  let totalInserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const demo of DEMO_DATA) {
    const indicatorId = idMap.get(demo.code);
    if (!indicatorId) {
      console.log(`  [SKIP] ${demo.code} -- not found in analytics.indicators`);
      skipped++;
      continue;
    }

    const trend = demo.trend ?? 0;
    const baseYear = 2025;

    try {
      // -----------------------------------------------------------------
      // Continental-only indicators
      // -----------------------------------------------------------------
      if (demo.isContinental) {
        const baseVal = demo.values['_continental'] ?? Object.values(demo.values)[0];

        for (const year of YEARS) {
          const val = applyTrend(baseVal, trend, year, baseYear);

          if (demo.isMonthly && year === 2025) {
            for (const m of MONTHS) {
              const mVal = vary(val * SEASONAL_FACTORS[m], 10, `${demo.code}-continental-${year}-${m}`);
              await pool.query(UPSERT_SQL, [indicatorId, year, m, null, null, null, true, mVal]);
              totalInserted++;
            }
          } else if (demo.isQuarterly) {
            for (const q of QUARTERS) {
              const qVal = vary(val, 5, `${demo.code}-continental-${year}-Q${q}`);
              await pool.query(UPSERT_SQL, [indicatorId, year, null, q, null, null, true, qVal]);
              totalInserted++;
            }
          } else {
            // Annual only
            await pool.query(UPSERT_SQL, [indicatorId, year, null, null, null, null, true, Math.round(val * 100) / 100]);
            totalInserted++;
          }
        }

        console.log(`  [OK] ${demo.code} (continental)`);
        continue;
      }

      // -----------------------------------------------------------------
      // Per-country indicators
      // -----------------------------------------------------------------
      for (const cc of COUNTRIES) {
        const baseVal = demo.values[cc];
        if (baseVal === undefined) continue;
        const rec = COUNTRY_REC[cc];

        for (const year of YEARS) {
          const yearVal = applyTrend(baseVal, trend, year, baseYear);

          if (demo.isMonthly && year === 2025) {
            // Monthly: 12 months for 2025 only
            for (const m of MONTHS) {
              const mVal = vary(yearVal * SEASONAL_FACTORS[m], 10, `${demo.code}-${cc}-${year}-${m}`);
              await pool.query(UPSERT_SQL, [indicatorId, year, m, null, cc, rec, false, mVal]);
              totalInserted++;
            }
          } else if (demo.isMonthly && year < 2025) {
            // For prior years with monthly indicators, just insert annual value
            await pool.query(UPSERT_SQL, [indicatorId, year, null, null, cc, rec, false, Math.round(yearVal * 100) / 100]);
            totalInserted++;
          }

          if (demo.isQuarterly) {
            // Quarterly: 4 quarters for 2024 & 2025
            if (year >= 2024) {
              for (const q of QUARTERS) {
                const qVal = vary(yearVal, 5, `${demo.code}-${cc}-${year}-Q${q}`);
                await pool.query(UPSERT_SQL, [indicatorId, year, null, q, cc, rec, false, qVal]);
                totalInserted++;
              }
            } else {
              // 2023: annual only
              await pool.query(UPSERT_SQL, [indicatorId, year, null, null, cc, rec, false, Math.round(yearVal * 100) / 100]);
              totalInserted++;
            }
          }

          if (!demo.isMonthly && !demo.isQuarterly) {
            // Pure annual
            await pool.query(UPSERT_SQL, [indicatorId, year, null, null, cc, rec, false, Math.round(yearVal * 100) / 100]);
            totalInserted++;
          }
        }
      }

      console.log(`  [OK] ${demo.code}`);
    } catch (err: any) {
      errors++;
      console.log(`  [ERR] ${demo.code} -- ${err.message?.substring(0, 150)}`);
    }
  }

  // =========================================================================
  // Continental aggregation pass (SUM or AVG based on indicator's aggregation)
  // =========================================================================
  console.log('\n--- Continental aggregation from country values ---');
  try {
    const res = await pool.query(`
      INSERT INTO analytics.indicator_values
        (id, indicator_id, year, month, quarter, country_code, rec_code, is_continental, value, source, created_at, updated_at)
      SELECT gen_random_uuid(), iv.indicator_id, iv.year, iv.month, iv.quarter,
             NULL, NULL, true,
             CASE WHEN i.aggregation IN ('SUM','COUNT') THEN SUM(iv.value)
                  WHEN i.aggregation = 'AVERAGE' THEN AVG(iv.value)
                  WHEN i.aggregation = 'MAX' THEN MAX(iv.value)
                  WHEN i.aggregation = 'MIN' THEN MIN(iv.value)
                  WHEN i.aggregation = 'LATEST' THEN AVG(iv.value)
                  ELSE AVG(iv.value)
             END,
             'demo-seed-continental', NOW(), NOW()
      FROM analytics.indicator_values iv
      JOIN analytics.indicators i ON i.id = iv.indicator_id
      WHERE iv.country_code IS NOT NULL
        AND iv.is_continental = false
        AND iv.source LIKE 'demo-seed%'
      GROUP BY iv.indicator_id, iv.year, iv.month, iv.quarter, i.aggregation
      ON CONFLICT (indicator_id, year, COALESCE(month,-1), COALESCE(quarter,-1), COALESCE(country_code,''), COALESCE(rec_code,''), is_continental)
      DO UPDATE SET value = EXCLUDED.value, source = 'demo-seed-continental', updated_at = NOW()
    `);
    console.log(`  [OK] Continental aggregation: ${res.rowCount} rows`);
    totalInserted += res.rowCount ?? 0;
  } catch (err: any) {
    console.log(`  [ERR] Continental aggregation: ${err.message?.substring(0, 150)}`);
    errors++;
  }

  // =========================================================================
  // REC aggregation pass
  // =========================================================================
  console.log('\n--- REC aggregation from country values ---');
  try {
    const res = await pool.query(`
      INSERT INTO analytics.indicator_values
        (id, indicator_id, year, month, quarter, country_code, rec_code, is_continental, value, source, created_at, updated_at)
      SELECT gen_random_uuid(), iv.indicator_id, iv.year, iv.month, iv.quarter,
             NULL, iv.rec_code, false,
             CASE WHEN i.aggregation IN ('SUM','COUNT') THEN SUM(iv.value)
                  WHEN i.aggregation = 'AVERAGE' THEN AVG(iv.value)
                  WHEN i.aggregation = 'LATEST' THEN AVG(iv.value)
                  ELSE AVG(iv.value)
             END,
             'demo-seed-rec', NOW(), NOW()
      FROM analytics.indicator_values iv
      JOIN analytics.indicators i ON i.id = iv.indicator_id
      WHERE iv.country_code IS NOT NULL
        AND iv.rec_code IS NOT NULL
        AND iv.is_continental = false
        AND iv.source LIKE 'demo-seed%'
      GROUP BY iv.indicator_id, iv.year, iv.month, iv.quarter, iv.rec_code, i.aggregation
      ON CONFLICT (indicator_id, year, COALESCE(month,-1), COALESCE(quarter,-1), COALESCE(country_code,''), COALESCE(rec_code,''), is_continental)
      DO UPDATE SET value = EXCLUDED.value, source = 'demo-seed-rec', updated_at = NOW()
    `);
    console.log(`  [OK] REC aggregation: ${res.rowCount} rows`);
    totalInserted += res.rowCount ?? 0;
  } catch (err: any) {
    console.log(`  [ERR] REC aggregation: ${err.message?.substring(0, 150)}`);
    errors++;
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log(`\n=== Done ===`);
  console.log(`  Total values inserted/updated: ${totalInserted}`);
  console.log(`  Indicators processed: ${DEMO_DATA.length - skipped}`);
  console.log(`  Indicators skipped (not in DB): ${skipped}`);
  console.log(`  Errors: ${errors}`);

  await pool.end();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
