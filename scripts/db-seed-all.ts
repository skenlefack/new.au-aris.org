/**
 * ARIS 4.0 — Unified Database Seeder
 *
 * Executes all service seeds in dependency order:
 *   1. tenant        — Multi-tenant hierarchy (AU-IBAR, RECs, pilot MS)
 *   2. credential    — Default users (SUPER_ADMIN, NATIONAL_ADMINs)
 *   3. master-data   — Geography, species, diseases, units, denominators
 *   4. form-builder  — Base form templates
 *   5. data-contract — Sample data contracts
 *   6. collecte      — Sample campaign
 *   7–14. domain services — Kenya pilot data (animal-health → climate-env)
 *
 * All seeds are idempotent (upsert pattern). Safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/db-seed-all.ts
 *   pnpm --filter @aris/db-schemas db:seed:all
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, join } from 'path';

const ROOT_DIR = resolve(__dirname, '..');

// ── Seed registry (dependency order) ──────────────────────────────────────

interface SeedStep {
  name: string;
  description: string;
  script: string;
  cwd: string;
  optional?: boolean;
}

const SEED_STEPS: SeedStep[] = [
  {
    name: 'tenant',
    description: 'Multi-tenant hierarchy (1 AU-IBAR, 8 RECs, 5 pilot MS)',
    script: 'npx tsx prisma/seed-tenant.ts',
    cwd: join(ROOT_DIR, 'packages/db-schemas'),
  },
  {
    name: 'credential',
    description: 'Default users (1 SUPER_ADMIN, 5 NATIONAL_ADMINs)',
    script: 'npx tsx prisma/seed-credential.ts',
    cwd: join(ROOT_DIR, 'packages/db-schemas'),
  },
  {
    name: 'master-data',
    description: 'Geography, species, diseases, units, denominators',
    script: 'npx tsx src/seed/run-seed.ts',
    cwd: join(ROOT_DIR, 'services/master-data'),
  },
  {
    name: 'form-builder',
    description: 'Animal Disease Event Report template',
    script: 'npx tsx src/seed.ts',
    cwd: join(ROOT_DIR, 'services/form-builder'),
  },
  {
    name: 'data-contract',
    description: 'Kenya health event + vaccination contracts',
    script: 'npx tsx src/seed.ts',
    cwd: join(ROOT_DIR, 'services/data-contract'),
  },
  {
    name: 'collecte',
    description: 'Kenya FMD Surveillance campaign',
    script: 'npx tsx src/seed/run-seed.ts',
    cwd: join(ROOT_DIR, 'services/collecte'),
  },
  // ── Domain services (Kenya pilot data, optional) ──
  {
    name: 'animal-health',
    description: 'Health events, lab results, surveillance, vaccinations',
    script: 'npx tsx src/seed.ts',
    cwd: join(ROOT_DIR, 'services/animal-health'),
    optional: true,
  },
  {
    name: 'livestock-prod',
    description: 'Census, production, slaughter, transhumance',
    script: 'npx tsx src/seed.ts',
    cwd: join(ROOT_DIR, 'services/livestock-prod'),
    optional: true,
  },
  {
    name: 'fisheries',
    description: 'Captures, vessels, aquaculture farms & production',
    script: 'npx tsx src/seed.ts',
    cwd: join(ROOT_DIR, 'services/fisheries'),
    optional: true,
  },
  {
    name: 'wildlife',
    description: 'Protected areas, inventories, CITES permits, crimes',
    script: 'npx tsx src/seed.ts',
    cwd: join(ROOT_DIR, 'services/wildlife'),
    optional: true,
  },
  {
    name: 'trade-sps',
    description: 'Trade flows, SPS certificates, market prices',
    script: 'npx tsx src/seed.ts',
    cwd: join(ROOT_DIR, 'services/trade-sps'),
    optional: true,
  },
  {
    name: 'apiculture',
    description: 'Apiaries, honey production, colony health, training',
    script: 'npx tsx src/seed.ts',
    cwd: join(ROOT_DIR, 'services/apiculture'),
    optional: true,
  },
  {
    name: 'governance',
    description: 'Legal frameworks, capacities, PVS, stakeholders',
    script: 'npx tsx src/seed.ts',
    cwd: join(ROOT_DIR, 'services/governance'),
    optional: true,
  },
  {
    name: 'climate-env',
    description: 'Water stress, rangeland, hotspots, climate data',
    script: 'npx tsx src/seed.ts',
    cwd: join(ROOT_DIR, 'services/climate-env'),
    optional: true,
  },
];

// ── Execution ─────────────────────────────────────────────────────────────

const DIVIDER = '═'.repeat(60);
const THIN_DIVIDER = '─'.repeat(60);

function log(emoji: string, msg: string): void {
  console.log(`${emoji}  ${msg}`);
}

async function runSeed(step: SeedStep, index: number): Promise<boolean> {
  const label = `[${index + 1}/${SEED_STEPS.length}] ${step.name}`;

  console.log(`\n${THIN_DIVIDER}`);
  log('🔄', `${label}: ${step.description}`);

  // Check if seed directory exists
  if (!existsSync(step.cwd)) {
    if (step.optional) {
      log('⏭️', `${label}: Directory not found (optional, skipping)`);
      return true;
    }
    log('❌', `${label}: Directory not found: ${step.cwd}`);
    return false;
  }

  try {
    execSync(step.script, {
      cwd: step.cwd,
      stdio: 'inherit',
      env: { ...process.env },
      timeout: 60_000, // 60 seconds per seed
    });
    log('✅', `${label}: Done`);
    return true;
  } catch (error) {
    if (step.optional) {
      log('⚠️', `${label}: Failed (optional, continuing)`);
      return true;
    }
    log('❌', `${label}: Failed`);
    if (error instanceof Error) {
      console.error(`    ${error.message}`);
    }
    return false;
  }
}

async function main(): Promise<void> {
  console.log(`\n${DIVIDER}`);
  console.log('  ARIS 4.0 — Unified Database Seeder');
  console.log(`  Steps: ${SEED_STEPS.length} | Mode: idempotent (upsert)`);
  console.log(`${DIVIDER}`);

  const startTime = Date.now();
  const results: { name: string; success: boolean }[] = [];

  for (let i = 0; i < SEED_STEPS.length; i++) {
    const step = SEED_STEPS[i];
    const success = await runSeed(step, i);
    results.push({ name: step.name, success });

    if (!success) {
      log('🛑', `Stopping: ${step.name} failed (downstream seeds depend on it)`);
      break;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\n${DIVIDER}`);
  console.log('  Seed Summary');
  console.log(`${DIVIDER}`);

  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}`);
  }

  console.log(`\n  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`  Time:  ${elapsed}s`);
  console.log(`${DIVIDER}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Seed runner failed:', error);
  process.exit(1);
});
