import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient, TenantLevel } from '@prisma/client';

const prisma = new PrismaClient();

// Deterministic UUIDs for reproducible seeding
// Pattern: 00000000-0000-4000-a000-00000000XXYY
//   XX = REC prefix (01=IGAD, 02=ECOWAS, 03=SADC, 04=EAC, 05=ECCAS, 06=UMA, 07=CENSAD, 08=COMESA)
//   YY = sequential country number (hex)
export const TENANT_IDS = {
  // Continental
  AU_IBAR: '00000000-0000-4000-a000-000000000001',

  // RECs
  IGAD:    '00000000-0000-4000-a000-000000000010',
  ECOWAS:  '00000000-0000-4000-a000-000000000020',
  SADC:    '00000000-0000-4000-a000-000000000030',
  EAC:     '00000000-0000-4000-a000-000000000040',
  ECCAS:   '00000000-0000-4000-a000-000000000050',
  UMA:     '00000000-0000-4000-a000-000000000060',
  CEN_SAD: '00000000-0000-4000-a000-000000000070',
  COMESA:  '00000000-0000-4000-a000-000000000080',

  // ── IGAD Member States (01xx) ──
  KE: '00000000-0000-4000-a000-000000000101',
  ET: '00000000-0000-4000-a000-000000000102',
  UG: '00000000-0000-4000-a000-000000000103',
  SO: '00000000-0000-4000-a000-000000000104',
  DJ: '00000000-0000-4000-a000-000000000105',
  ER: '00000000-0000-4000-a000-000000000106',
  SD: '00000000-0000-4000-a000-000000000107',
  SS: '00000000-0000-4000-a000-000000000108',

  // ── ECOWAS Member States (02xx) ──
  NG: '00000000-0000-4000-a000-000000000201',
  SN: '00000000-0000-4000-a000-000000000202',
  BJ: '00000000-0000-4000-a000-000000000203',
  BF: '00000000-0000-4000-a000-000000000204',
  CV: '00000000-0000-4000-a000-000000000205',
  CI: '00000000-0000-4000-a000-000000000206',
  GM: '00000000-0000-4000-a000-000000000207',
  GH: '00000000-0000-4000-a000-000000000208',
  GN: '00000000-0000-4000-a000-000000000209',
  GW: '00000000-0000-4000-a000-00000000020a',
  LR: '00000000-0000-4000-a000-00000000020b',
  ML: '00000000-0000-4000-a000-00000000020c',
  NE: '00000000-0000-4000-a000-00000000020d',
  SL: '00000000-0000-4000-a000-00000000020e',
  TG: '00000000-0000-4000-a000-00000000020f',

  // ── SADC Member States (03xx) ──
  ZA: '00000000-0000-4000-a000-000000000301',
  BW: '00000000-0000-4000-a000-000000000302',
  KM: '00000000-0000-4000-a000-000000000303',
  SZ: '00000000-0000-4000-a000-000000000304',
  LS: '00000000-0000-4000-a000-000000000305',
  MG: '00000000-0000-4000-a000-000000000306',
  MW: '00000000-0000-4000-a000-000000000307',
  MU: '00000000-0000-4000-a000-000000000308',
  MZ: '00000000-0000-4000-a000-000000000309',
  NA: '00000000-0000-4000-a000-00000000030a',
  SC: '00000000-0000-4000-a000-00000000030b',
  ZM: '00000000-0000-4000-a000-00000000030c',
  ZW: '00000000-0000-4000-a000-00000000030d',

  // ── EAC Member States (04xx) ──
  TZ: '00000000-0000-4000-a000-000000000401',

  // ── ECCAS Member States (05xx) ──
  AO: '00000000-0000-4000-a000-000000000501',
  BI: '00000000-0000-4000-a000-000000000502',
  CM: '00000000-0000-4000-a000-000000000503',
  CF: '00000000-0000-4000-a000-000000000504',
  TD: '00000000-0000-4000-a000-000000000505',
  CG: '00000000-0000-4000-a000-000000000506',
  CD: '00000000-0000-4000-a000-000000000507',
  GQ: '00000000-0000-4000-a000-000000000508',
  GA: '00000000-0000-4000-a000-000000000509',
  RW: '00000000-0000-4000-a000-00000000050a',
  ST: '00000000-0000-4000-a000-00000000050b',

  // ── UMA Member States (06xx) ──
  DZ: '00000000-0000-4000-a000-000000000601',
  LY: '00000000-0000-4000-a000-000000000602',
  MR: '00000000-0000-4000-a000-000000000603',
  MA: '00000000-0000-4000-a000-000000000604',
  TN: '00000000-0000-4000-a000-000000000605',

  // ── COMESA Member States (08xx) ──
  EG: '00000000-0000-4000-a000-000000000801',
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

  // ── All 54 Member States ──
  // Each country's parentId is its primary REC (first in recs-config.ts)
  const memberStates: Array<{
    id: string; name: string; code: string; countryCode: string;
    recCode: string; parentId: string; domain: string;
  }> = [
    // IGAD (8)
    { id: TENANT_IDS.KE, name: 'Republic of Kenya', code: 'KE', countryCode: 'KE', recCode: 'IGAD', parentId: TENANT_IDS.IGAD, domain: 'ke.au-aris.org' },
    { id: TENANT_IDS.ET, name: 'Federal Democratic Republic of Ethiopia', code: 'ET', countryCode: 'ET', recCode: 'IGAD', parentId: TENANT_IDS.IGAD, domain: 'et.au-aris.org' },
    { id: TENANT_IDS.UG, name: 'Republic of Uganda', code: 'UG', countryCode: 'UG', recCode: 'IGAD', parentId: TENANT_IDS.IGAD, domain: 'ug.au-aris.org' },
    { id: TENANT_IDS.SO, name: 'Federal Republic of Somalia', code: 'SO', countryCode: 'SO', recCode: 'IGAD', parentId: TENANT_IDS.IGAD, domain: 'so.au-aris.org' },
    { id: TENANT_IDS.DJ, name: 'Republic of Djibouti', code: 'DJ', countryCode: 'DJ', recCode: 'IGAD', parentId: TENANT_IDS.IGAD, domain: 'dj.au-aris.org' },
    { id: TENANT_IDS.ER, name: 'State of Eritrea', code: 'ER', countryCode: 'ER', recCode: 'IGAD', parentId: TENANT_IDS.IGAD, domain: 'er.au-aris.org' },
    { id: TENANT_IDS.SD, name: 'Republic of the Sudan', code: 'SD', countryCode: 'SD', recCode: 'IGAD', parentId: TENANT_IDS.IGAD, domain: 'sd.au-aris.org' },
    { id: TENANT_IDS.SS, name: 'Republic of South Sudan', code: 'SS', countryCode: 'SS', recCode: 'IGAD', parentId: TENANT_IDS.IGAD, domain: 'ss.au-aris.org' },

    // ECOWAS (15)
    { id: TENANT_IDS.NG, name: 'Federal Republic of Nigeria', code: 'NG', countryCode: 'NG', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'ng.au-aris.org' },
    { id: TENANT_IDS.SN, name: 'Republic of Senegal', code: 'SN', countryCode: 'SN', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'sn.au-aris.org' },
    { id: TENANT_IDS.BJ, name: 'Republic of Benin', code: 'BJ', countryCode: 'BJ', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'bj.au-aris.org' },
    { id: TENANT_IDS.BF, name: 'Burkina Faso', code: 'BF', countryCode: 'BF', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'bf.au-aris.org' },
    { id: TENANT_IDS.CV, name: 'Republic of Cabo Verde', code: 'CV', countryCode: 'CV', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'cv.au-aris.org' },
    { id: TENANT_IDS.CI, name: "Republic of Côte d'Ivoire", code: 'CI', countryCode: 'CI', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'ci.au-aris.org' },
    { id: TENANT_IDS.GM, name: 'Republic of The Gambia', code: 'GM', countryCode: 'GM', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'gm.au-aris.org' },
    { id: TENANT_IDS.GH, name: 'Republic of Ghana', code: 'GH', countryCode: 'GH', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'gh.au-aris.org' },
    { id: TENANT_IDS.GN, name: 'Republic of Guinea', code: 'GN', countryCode: 'GN', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'gn.au-aris.org' },
    { id: TENANT_IDS.GW, name: 'Republic of Guinea-Bissau', code: 'GW', countryCode: 'GW', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'gw.au-aris.org' },
    { id: TENANT_IDS.LR, name: 'Republic of Liberia', code: 'LR', countryCode: 'LR', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'lr.au-aris.org' },
    { id: TENANT_IDS.ML, name: 'Republic of Mali', code: 'ML', countryCode: 'ML', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'ml.au-aris.org' },
    { id: TENANT_IDS.NE, name: 'Republic of Niger', code: 'NE', countryCode: 'NE', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'ne.au-aris.org' },
    { id: TENANT_IDS.SL, name: 'Republic of Sierra Leone', code: 'SL', countryCode: 'SL', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'sl.au-aris.org' },
    { id: TENANT_IDS.TG, name: 'Togolese Republic', code: 'TG', countryCode: 'TG', recCode: 'ECOWAS', parentId: TENANT_IDS.ECOWAS, domain: 'tg.au-aris.org' },

    // SADC (13)
    { id: TENANT_IDS.ZA, name: 'Republic of South Africa', code: 'ZA', countryCode: 'ZA', recCode: 'SADC', parentId: TENANT_IDS.SADC, domain: 'za.au-aris.org' },
    { id: TENANT_IDS.BW, name: 'Republic of Botswana', code: 'BW', countryCode: 'BW', recCode: 'SADC', parentId: TENANT_IDS.SADC, domain: 'bw.au-aris.org' },
    { id: TENANT_IDS.KM, name: 'Union of the Comoros', code: 'KM', countryCode: 'KM', recCode: 'SADC', parentId: TENANT_IDS.SADC, domain: 'km.au-aris.org' },
    { id: TENANT_IDS.SZ, name: 'Kingdom of Eswatini', code: 'SZ', countryCode: 'SZ', recCode: 'SADC', parentId: TENANT_IDS.SADC, domain: 'sz.au-aris.org' },
    { id: TENANT_IDS.LS, name: 'Kingdom of Lesotho', code: 'LS', countryCode: 'LS', recCode: 'SADC', parentId: TENANT_IDS.SADC, domain: 'ls.au-aris.org' },
    { id: TENANT_IDS.MG, name: 'Republic of Madagascar', code: 'MG', countryCode: 'MG', recCode: 'SADC', parentId: TENANT_IDS.SADC, domain: 'mg.au-aris.org' },
    { id: TENANT_IDS.MW, name: 'Republic of Malawi', code: 'MW', countryCode: 'MW', recCode: 'SADC', parentId: TENANT_IDS.SADC, domain: 'mw.au-aris.org' },
    { id: TENANT_IDS.MU, name: 'Republic of Mauritius', code: 'MU', countryCode: 'MU', recCode: 'SADC', parentId: TENANT_IDS.SADC, domain: 'mu.au-aris.org' },
    { id: TENANT_IDS.MZ, name: 'Republic of Mozambique', code: 'MZ', countryCode: 'MZ', recCode: 'SADC', parentId: TENANT_IDS.SADC, domain: 'mz.au-aris.org' },
    { id: TENANT_IDS.NA, name: 'Republic of Namibia', code: 'NA', countryCode: 'NA', recCode: 'SADC', parentId: TENANT_IDS.SADC, domain: 'na.au-aris.org' },
    { id: TENANT_IDS.SC, name: 'Republic of Seychelles', code: 'SC', countryCode: 'SC', recCode: 'SADC', parentId: TENANT_IDS.SADC, domain: 'sc.au-aris.org' },
    { id: TENANT_IDS.ZM, name: 'Republic of Zambia', code: 'ZM', countryCode: 'ZM', recCode: 'SADC', parentId: TENANT_IDS.SADC, domain: 'zm.au-aris.org' },
    { id: TENANT_IDS.ZW, name: 'Republic of Zimbabwe', code: 'ZW', countryCode: 'ZW', recCode: 'SADC', parentId: TENANT_IDS.SADC, domain: 'zw.au-aris.org' },

    // EAC (1 — Tanzania's primary REC)
    { id: TENANT_IDS.TZ, name: 'United Republic of Tanzania', code: 'TZ', countryCode: 'TZ', recCode: 'EAC', parentId: TENANT_IDS.EAC, domain: 'tz.au-aris.org' },

    // ECCAS (11)
    { id: TENANT_IDS.AO, name: 'Republic of Angola', code: 'AO', countryCode: 'AO', recCode: 'ECCAS', parentId: TENANT_IDS.ECCAS, domain: 'ao.au-aris.org' },
    { id: TENANT_IDS.BI, name: 'Republic of Burundi', code: 'BI', countryCode: 'BI', recCode: 'ECCAS', parentId: TENANT_IDS.ECCAS, domain: 'bi.au-aris.org' },
    { id: TENANT_IDS.CM, name: 'Republic of Cameroon', code: 'CM', countryCode: 'CM', recCode: 'ECCAS', parentId: TENANT_IDS.ECCAS, domain: 'cm.au-aris.org' },
    { id: TENANT_IDS.CF, name: 'Central African Republic', code: 'CF', countryCode: 'CF', recCode: 'ECCAS', parentId: TENANT_IDS.ECCAS, domain: 'cf.au-aris.org' },
    { id: TENANT_IDS.TD, name: 'Republic of Chad', code: 'TD', countryCode: 'TD', recCode: 'ECCAS', parentId: TENANT_IDS.ECCAS, domain: 'td.au-aris.org' },
    { id: TENANT_IDS.CG, name: 'Republic of the Congo', code: 'CG', countryCode: 'CG', recCode: 'ECCAS', parentId: TENANT_IDS.ECCAS, domain: 'cg.au-aris.org' },
    { id: TENANT_IDS.CD, name: 'Democratic Republic of the Congo', code: 'CD', countryCode: 'CD', recCode: 'ECCAS', parentId: TENANT_IDS.ECCAS, domain: 'cd.au-aris.org' },
    { id: TENANT_IDS.GQ, name: 'Republic of Equatorial Guinea', code: 'GQ', countryCode: 'GQ', recCode: 'ECCAS', parentId: TENANT_IDS.ECCAS, domain: 'gq.au-aris.org' },
    { id: TENANT_IDS.GA, name: 'Gabonese Republic', code: 'GA', countryCode: 'GA', recCode: 'ECCAS', parentId: TENANT_IDS.ECCAS, domain: 'ga.au-aris.org' },
    { id: TENANT_IDS.RW, name: 'Republic of Rwanda', code: 'RW', countryCode: 'RW', recCode: 'ECCAS', parentId: TENANT_IDS.ECCAS, domain: 'rw.au-aris.org' },
    { id: TENANT_IDS.ST, name: 'Democratic Republic of São Tomé and Príncipe', code: 'ST', countryCode: 'ST', recCode: 'ECCAS', parentId: TENANT_IDS.ECCAS, domain: 'st.au-aris.org' },

    // UMA (5)
    { id: TENANT_IDS.DZ, name: "People's Democratic Republic of Algeria", code: 'DZ', countryCode: 'DZ', recCode: 'UMA', parentId: TENANT_IDS.UMA, domain: 'dz.au-aris.org' },
    { id: TENANT_IDS.LY, name: 'State of Libya', code: 'LY', countryCode: 'LY', recCode: 'UMA', parentId: TENANT_IDS.UMA, domain: 'ly.au-aris.org' },
    { id: TENANT_IDS.MR, name: 'Islamic Republic of Mauritania', code: 'MR', countryCode: 'MR', recCode: 'UMA', parentId: TENANT_IDS.UMA, domain: 'mr.au-aris.org' },
    { id: TENANT_IDS.MA, name: 'Kingdom of Morocco', code: 'MA', countryCode: 'MA', recCode: 'UMA', parentId: TENANT_IDS.UMA, domain: 'ma.au-aris.org' },
    { id: TENANT_IDS.TN, name: 'Republic of Tunisia', code: 'TN', countryCode: 'TN', recCode: 'UMA', parentId: TENANT_IDS.UMA, domain: 'tn.au-aris.org' },

    // COMESA (1 — Egypt's primary REC)
    { id: TENANT_IDS.EG, name: 'Arab Republic of Egypt', code: 'EG', countryCode: 'EG', recCode: 'COMESA', parentId: TENANT_IDS.COMESA, domain: 'eg.au-aris.org' },
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
  console.log(`  ${memberStates.length} Member States`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
