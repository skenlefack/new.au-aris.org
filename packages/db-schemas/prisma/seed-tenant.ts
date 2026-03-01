import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient, TenantLevel } from '@prisma/client';

const prisma = new PrismaClient();

// Deterministic UUIDs for reproducible seeding
const TENANT_IDS = {
  AU_IBAR: '00000000-0000-4000-a000-000000000001',
  // RECs
  IGAD: '00000000-0000-4000-a000-000000000010',
  ECOWAS: '00000000-0000-4000-a000-000000000020',
  SADC: '00000000-0000-4000-a000-000000000030',
  EAC: '00000000-0000-4000-a000-000000000040',
  ECCAS: '00000000-0000-4000-a000-000000000050',
  UMA: '00000000-0000-4000-a000-000000000060',
  CEN_SAD: '00000000-0000-4000-a000-000000000070',
  COMESA: '00000000-0000-4000-a000-000000000080',
  // Pilot Member States
  KENYA: '00000000-0000-4000-a000-000000000101',
  ETHIOPIA: '00000000-0000-4000-a000-000000000102',
  NIGERIA: '00000000-0000-4000-a000-000000000201',
  SENEGAL: '00000000-0000-4000-a000-000000000202',
  SOUTH_AFRICA: '00000000-0000-4000-a000-000000000301',
} as const;

async function main(): Promise<void> {
  console.log('Seeding tenant hierarchy...');

  // ── Continental ──
  await prisma.tenant.upsert({
    where: { id: TENANT_IDS.AU_IBAR },
    update: {},
    create: {
      id: TENANT_IDS.AU_IBAR,
      name: 'African Union - Inter-African Bureau for Animal Resources',
      code: 'AU',
      level: TenantLevel.CONTINENTAL,
      parentId: null,
      countryCode: null,
      recCode: null,
      domain: 'au-aris.org',
      config: {},
      isActive: true,
    },
  });

  // ── RECs ──
  const recs = [
    { id: TENANT_IDS.IGAD, name: 'Intergovernmental Authority on Development', code: 'IGAD', domain: 'igad.au-aris.org' },
    { id: TENANT_IDS.ECOWAS, name: 'Economic Community of West African States', code: 'ECOWAS', domain: 'ecowas.au-aris.org' },
    { id: TENANT_IDS.SADC, name: 'Southern African Development Community', code: 'SADC', domain: 'sadc.au-aris.org' },
    { id: TENANT_IDS.EAC, name: 'East African Community', code: 'EAC', domain: 'eac.au-aris.org' },
    { id: TENANT_IDS.ECCAS, name: 'Economic Community of Central African States', code: 'ECCAS', domain: 'eccas.au-aris.org' },
    { id: TENANT_IDS.UMA, name: 'Arab Maghreb Union', code: 'UMA', domain: 'uma.au-aris.org' },
    { id: TENANT_IDS.CEN_SAD, name: 'Community of Sahel-Saharan States', code: 'CENSAD', domain: 'censad.au-aris.org' },
    { id: TENANT_IDS.COMESA, name: 'Common Market for Eastern and Southern Africa', code: 'COMESA', domain: 'comesa.au-aris.org' },
  ];

  for (const rec of recs) {
    await prisma.tenant.upsert({
      where: { id: rec.id },
      update: {},
      create: {
        id: rec.id,
        name: rec.name,
        code: rec.code,
        level: TenantLevel.REC,
        parentId: TENANT_IDS.AU_IBAR,
        countryCode: null,
        recCode: rec.code,
        domain: rec.domain,
        config: {},
        isActive: true,
      },
    });
  }

  // ── Pilot Member States ──
  const memberStates = [
    { id: TENANT_IDS.KENYA, name: 'Republic of Kenya', code: 'KE', countryCode: 'KE', recCode: 'IGAD', parentId: TENANT_IDS.IGAD, domain: 'ke.au-aris.org' },
    { id: TENANT_IDS.ETHIOPIA, name: 'Federal Democratic Republic of Ethiopia', code: 'ET', countryCode: 'ET', recCode: 'IGAD', parentId: TENANT_IDS.IGAD, domain: 'et.au-aris.org' },
    { id: TENANT_IDS.NIGERIA, name: 'Federal Republic of Nigeria', code: 'NG', countryCode: 'NG', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'ng.au-aris.org' },
    { id: TENANT_IDS.SENEGAL, name: 'Republic of Senegal', code: 'SN', countryCode: 'SN', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'sn.au-aris.org' },
    { id: TENANT_IDS.SOUTH_AFRICA, name: 'Republic of South Africa', code: 'ZA', countryCode: 'ZA', recCode: 'SADC', parentId: TENANT_IDS.SADC, domain: 'za.au-aris.org' },
  ];

  for (const ms of memberStates) {
    await prisma.tenant.upsert({
      where: { id: ms.id },
      update: {},
      create: {
        id: ms.id,
        name: ms.name,
        code: ms.code,
        level: TenantLevel.MEMBER_STATE,
        parentId: ms.parentId,
        countryCode: ms.countryCode,
        recCode: ms.recCode,
        domain: ms.domain,
        config: {},
        isActive: true,
      },
    });
  }

  console.log('Tenant hierarchy seeded:');
  console.log(`  1 Continental (AU-IBAR)`);
  console.log(`  ${recs.length} RECs`);
  console.log(`  ${memberStates.length} Pilot Member States`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
