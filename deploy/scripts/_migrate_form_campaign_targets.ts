/**
 * ARIS 4.0 — Migration: Populate form_targets and campaign_targets
 *
 * Reads existing FormTemplate.domain and CollectionCampaign.domain fields
 * and creates corresponding FormTarget / CampaignTarget rows
 * with isPrimary = true (single legacy domain becomes the primary target).
 *
 * Usage:
 *   npx tsx deploy/scripts/_migrate_form_campaign_targets.ts          # dry-run
 *   npx tsx deploy/scripts/_migrate_form_campaign_targets.ts --commit # execute
 *
 * Idempotent: skips rows that already exist (unique constraint check).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMMIT = process.argv.includes('--commit');

async function migrateFormTargets(): Promise<number> {
  const forms = await prisma.formTemplate.findMany({
    where: {
      domain: { not: '' },
    },
    select: {
      id: true,
      name: true,
      domain: true,
    },
  });

  console.log(`\n[FormTarget] Found ${forms.length} form templates with a domain value.`);

  let created = 0;
  let skipped = 0;

  for (const form of forms) {
    // Check if a target already exists for this form + domain (nullable sub_domain_code)
    const existing = await prisma.formTarget.findFirst({
      where: {
        form_id: form.id,
        domain_code: form.domain,
        sub_domain_code: null,
      },
    });

    if (existing) {
      skipped++;
      console.log(`  SKIP  "${form.name}" — target already exists for domain="${form.domain}"`);
      continue;
    }

    if (COMMIT) {
      await prisma.formTarget.create({
        data: {
          form_id: form.id,
          domain_code: form.domain,
          sub_domain_code: null,
          is_primary: true,
        },
      });
    }
    created++;
    console.log(`  ${COMMIT ? 'CREATE' : 'WOULD CREATE'}  "${form.name}" → domain="${form.domain}" (primary)`);
  }

  console.log(`[FormTarget] ${COMMIT ? 'Created' : 'Would create'}: ${created}, Skipped: ${skipped}`);
  return created;
}

async function migrateCampaignTargets(): Promise<number> {
  const campaigns = await prisma.collectionCampaign.findMany({
    where: {
      domain: { not: '' },
    },
    select: {
      id: true,
      code: true,
      name: true,
      domain: true,
    },
  });

  console.log(`\n[CampaignTarget] Found ${campaigns.length} campaigns with a domain value.`);

  let created = 0;
  let skipped = 0;

  for (const campaign of campaigns) {
    const existing = await (prisma.campaignTarget as any).findFirst({
      where: {
        campaignId: campaign.id,
        domainCode: campaign.domain,
        subDomainCode: null,
      },
    });

    if (existing) {
      skipped++;
      console.log(`  SKIP  "${campaign.code}" — target already exists for domain="${campaign.domain}"`);
      continue;
    }

    if (COMMIT) {
      await prisma.campaignTarget.create({
        data: {
          campaignId: campaign.id,
          domainCode: campaign.domain,
          subDomainCode: null,
          isPrimary: true,
        },
      });
    }
    created++;
    const label = typeof campaign.name === 'object' && campaign.name !== null
      ? (campaign.name as any).en || campaign.code
      : campaign.code;
    console.log(`  ${COMMIT ? 'CREATE' : 'WOULD CREATE'}  "${label}" → domain="${campaign.domain}" (primary)`);
  }

  console.log(`[CampaignTarget] ${COMMIT ? 'Created' : 'Would create'}: ${created}, Skipped: ${skipped}`);
  return created;
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  ARIS 4.0 — Migrate domain → form/campaign targets');
  console.log(`  Mode: ${COMMIT ? 'COMMIT (writing to DB)' : 'DRY-RUN (no changes)'}`);
  console.log('═══════════════════════════════════════════════════');

  const formCount = await migrateFormTargets();
  const campaignCount = await migrateCampaignTargets();

  console.log('\n───────────────────────────────────────────────────');
  console.log(`  Total: ${formCount + campaignCount} targets ${COMMIT ? 'created' : 'would be created'}`);
  if (!COMMIT) {
    console.log('  Run with --commit to execute the migration.');
  }
  console.log('───────────────────────────────────────────────────');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Migration failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
