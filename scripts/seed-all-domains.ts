/**
 * ARIS 3.0 — Domain Services Seed Orchestrator
 *
 * Seeds all 8 domain services with Kenya pilot data.
 * Runs AFTER: tenant, credential, master-data seeds (prerequisite).
 *
 * Usage:
 *   npx tsx scripts/seed-all-domains.ts
 */

import { execSync } from 'child_process';
import { resolve, join } from 'path';

const ROOT_DIR = resolve(__dirname, '..');

interface DomainSeed {
  name: string;
  script: string;
  cwd: string;
}

const DOMAIN_SEEDS: DomainSeed[] = [
  { name: 'animal-health', script: 'npx tsx src/seed.ts', cwd: join(ROOT_DIR, 'services/animal-health') },
  { name: 'livestock-prod', script: 'npx tsx src/seed.ts', cwd: join(ROOT_DIR, 'services/livestock-prod') },
  { name: 'fisheries', script: 'npx tsx src/seed.ts', cwd: join(ROOT_DIR, 'services/fisheries') },
  { name: 'wildlife', script: 'npx tsx src/seed.ts', cwd: join(ROOT_DIR, 'services/wildlife') },
  { name: 'trade-sps', script: 'npx tsx src/seed.ts', cwd: join(ROOT_DIR, 'services/trade-sps') },
  { name: 'apiculture', script: 'npx tsx src/seed.ts', cwd: join(ROOT_DIR, 'services/apiculture') },
  { name: 'governance', script: 'npx tsx src/seed.ts', cwd: join(ROOT_DIR, 'services/governance') },
  { name: 'climate-env', script: 'npx tsx src/seed.ts', cwd: join(ROOT_DIR, 'services/climate-env') },
];

const DIVIDER = '═'.repeat(60);
const THIN = '─'.repeat(60);

async function main(): Promise<void> {
  console.log(`\n${DIVIDER}`);
  console.log('  ARIS 3.0 — Domain Services Seeder (Kenya Pilot)');
  console.log(`  Services: ${DOMAIN_SEEDS.length} | Mode: idempotent (upsert)`);
  console.log(`${DIVIDER}`);

  const startTime = Date.now();
  const results: { name: string; success: boolean; error?: string }[] = [];

  for (let i = 0; i < DOMAIN_SEEDS.length; i++) {
    const seed = DOMAIN_SEEDS[i];
    const label = `[${i + 1}/${DOMAIN_SEEDS.length}] ${seed.name}`;

    console.log(`\n${THIN}`);
    console.log(`🔄  ${label}`);

    try {
      execSync(seed.script, {
        cwd: seed.cwd,
        stdio: 'inherit',
        env: { ...process.env },
        timeout: 60_000,
      });
      results.push({ name: seed.name, success: true });
      console.log(`✅  ${label}: Done`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.push({ name: seed.name, success: false, error: msg });
      console.error(`❌  ${label}: Failed — continuing to next service`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\n${DIVIDER}`);
  console.log('  Domain Seed Summary');
  console.log(`${DIVIDER}`);

  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}${r.error ? ` — ${r.error.slice(0, 80)}` : ''}`);
  }

  console.log(`\n  Total: ${DOMAIN_SEEDS.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`  Time:  ${elapsed}s`);
  console.log(`${DIVIDER}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Domain seed runner failed:', error);
  process.exit(1);
});
