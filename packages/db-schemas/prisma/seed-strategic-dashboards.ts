/**
 * seed-strategic-dashboards.ts — Master orchestrator for ALL strategic dashboards.
 *
 * Creates 29 dashboards across 9 domains + cross-domain views:
 *   - 7 Transversal (Executive, Data Quality, Food Security, One Health, REC, Country, Workflow)
 *   - 5 Animal Health (Surveillance, Vaccination, Lab, Aquatic, AMR)
 *   - 6 Livestock (Census, Red Meat, Dairy, Poultry, Small Ruminants, Pastoralism)
 *   - 6 Trade/Fish/Wildlife (Trade Intelligence, Markets, Capture, Aquaculture, Conservation, CITES)
 *   - 5 Governance/Climate/Apiculture (Vet Capacity, Legal, Climate Vulnerability, Water, Honey)
 *
 * Usage:
 *   DATABASE_URL="..." npx tsx packages/db-schemas/prisma/seed-strategic-dashboards.ts
 *
 * Idempotent: uses [CODE] markers in description to skip existing dashboards.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';

import { seedTransversalDashboards } from './seed-dashboards-transversal';
import { seedAnimalHealthDashboards } from './seed-dashboards-animal-health';
import { seedLivestockDashboards } from './seed-dashboards-livestock';
import { seedTradeFishWildlifeDashboards } from './seed-dashboards-trade-fish-wildlife';
import { seedGovClimateApiDashboards } from './seed-dashboards-gov-climate-api';

const prisma = new PrismaClient();

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   ARIS 4.0 — Strategic Dashboard Seed                   ║');
  console.log('║   29 Dashboards · 117 Sections · ~372 Widgets           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Ensure schema exists
  try {
    await (prisma as any).$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS dashboard_builder`);
  } catch { /* already exists */ }

  const t0 = Date.now();

  // ── Phase 1: Transversal (cross-domain) ────────────────────────────────
  console.log('\n── [1/5] Transversal Dashboards (7) ──────────────────────');
  await seedTransversalDashboards(prisma);

  // ── Phase 2: Animal Health ─────────────────────────────────────────────
  console.log('\n── [2/5] Animal Health Dashboards (5) ────────────────────');
  await seedAnimalHealthDashboards(prisma);

  // ── Phase 3: Livestock & Value Chains ──────────────────────────────────
  console.log('\n── [3/5] Livestock & Value Chain Dashboards (6) ──────────');
  await seedLivestockDashboards(prisma);

  // ── Phase 4: Trade, Fisheries, Wildlife ────────────────────────────────
  console.log('\n── [4/5] Trade, Fisheries & Wildlife Dashboards (6) ─────');
  await seedTradeFishWildlifeDashboards(prisma);

  // ── Phase 5: Governance, Climate, Apiculture ───────────────────────────
  console.log('\n── [5/5] Governance, Climate & Apiculture Dashboards (5) ─');
  await seedGovClimateApiDashboards(prisma);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✓ All strategic dashboards seeded in ${elapsed}s`);
}

main()
  .catch((err) => {
    console.error('[seed-strategic-dashboards] FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
