import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'Aris2024!';

// Tenant IDs — must match seed-tenant.ts
const T = {
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
  // Member States
  KE: '00000000-0000-4000-a000-000000000101',
  ET: '00000000-0000-4000-a000-000000000102',
  UG: '00000000-0000-4000-a000-000000000103',
  SO: '00000000-0000-4000-a000-000000000104',
  DJ: '00000000-0000-4000-a000-000000000105',
  ER: '00000000-0000-4000-a000-000000000106',
  SD: '00000000-0000-4000-a000-000000000107',
  SS: '00000000-0000-4000-a000-000000000108',
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
  TZ: '00000000-0000-4000-a000-000000000401',
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
  DZ: '00000000-0000-4000-a000-000000000601',
  LY: '00000000-0000-4000-a000-000000000602',
  MR: '00000000-0000-4000-a000-000000000603',
  MA: '00000000-0000-4000-a000-000000000604',
  TN: '00000000-0000-4000-a000-000000000605',
  EG: '00000000-0000-4000-a000-000000000801',
} as const;

// ── User UUIDs ──
// Pattern: 10000000-0000-4000-a000-00000000XXXX (mirrors tenant suffix)
const U = {
  // Super Admin
  SUPER_ADMIN: '10000000-0000-4000-a000-000000000001',
  // REC Admins (mirrors REC tenant suffix)
  IGAD_ADMIN:    '10000000-0000-4000-a000-000000000010',
  ECOWAS_ADMIN:  '10000000-0000-4000-a000-000000000020',
  SADC_ADMIN:    '10000000-0000-4000-a000-000000000030',
  EAC_ADMIN:     '10000000-0000-4000-a000-000000000040',
  ECCAS_ADMIN:   '10000000-0000-4000-a000-000000000050',
  UMA_ADMIN:     '10000000-0000-4000-a000-000000000060',
  CEN_SAD_ADMIN: '10000000-0000-4000-a000-000000000070',
  COMESA_ADMIN:  '10000000-0000-4000-a000-000000000080',
  // Country Admins (mirrors country tenant suffix)
  KE_ADMIN: '10000000-0000-4000-a000-000000000101',
  ET_ADMIN: '10000000-0000-4000-a000-000000000102',
  UG_ADMIN: '10000000-0000-4000-a000-000000000103',
  SO_ADMIN: '10000000-0000-4000-a000-000000000104',
  DJ_ADMIN: '10000000-0000-4000-a000-000000000105',
  ER_ADMIN: '10000000-0000-4000-a000-000000000106',
  SD_ADMIN: '10000000-0000-4000-a000-000000000107',
  SS_ADMIN: '10000000-0000-4000-a000-000000000108',
  NG_ADMIN: '10000000-0000-4000-a000-000000000201',
  SN_ADMIN: '10000000-0000-4000-a000-000000000202',
  BJ_ADMIN: '10000000-0000-4000-a000-000000000203',
  BF_ADMIN: '10000000-0000-4000-a000-000000000204',
  CV_ADMIN: '10000000-0000-4000-a000-000000000205',
  CI_ADMIN: '10000000-0000-4000-a000-000000000206',
  GM_ADMIN: '10000000-0000-4000-a000-000000000207',
  GH_ADMIN: '10000000-0000-4000-a000-000000000208',
  GN_ADMIN: '10000000-0000-4000-a000-000000000209',
  GW_ADMIN: '10000000-0000-4000-a000-00000000020a',
  LR_ADMIN: '10000000-0000-4000-a000-00000000020b',
  ML_ADMIN: '10000000-0000-4000-a000-00000000020c',
  NE_ADMIN: '10000000-0000-4000-a000-00000000020d',
  SL_ADMIN: '10000000-0000-4000-a000-00000000020e',
  TG_ADMIN: '10000000-0000-4000-a000-00000000020f',
  ZA_ADMIN: '10000000-0000-4000-a000-000000000301',
  BW_ADMIN: '10000000-0000-4000-a000-000000000302',
  KM_ADMIN: '10000000-0000-4000-a000-000000000303',
  SZ_ADMIN: '10000000-0000-4000-a000-000000000304',
  LS_ADMIN: '10000000-0000-4000-a000-000000000305',
  MG_ADMIN: '10000000-0000-4000-a000-000000000306',
  MW_ADMIN: '10000000-0000-4000-a000-000000000307',
  MU_ADMIN: '10000000-0000-4000-a000-000000000308',
  MZ_ADMIN: '10000000-0000-4000-a000-000000000309',
  NA_ADMIN: '10000000-0000-4000-a000-00000000030a',
  SC_ADMIN: '10000000-0000-4000-a000-00000000030b',
  ZM_ADMIN: '10000000-0000-4000-a000-00000000030c',
  ZW_ADMIN: '10000000-0000-4000-a000-00000000030d',
  TZ_ADMIN: '10000000-0000-4000-a000-000000000401',
  AO_ADMIN: '10000000-0000-4000-a000-000000000501',
  BI_ADMIN: '10000000-0000-4000-a000-000000000502',
  CM_ADMIN: '10000000-0000-4000-a000-000000000503',
  CF_ADMIN: '10000000-0000-4000-a000-000000000504',
  TD_ADMIN: '10000000-0000-4000-a000-000000000505',
  CG_ADMIN: '10000000-0000-4000-a000-000000000506',
  CD_ADMIN: '10000000-0000-4000-a000-000000000507',
  GQ_ADMIN: '10000000-0000-4000-a000-000000000508',
  GA_ADMIN: '10000000-0000-4000-a000-000000000509',
  RW_ADMIN: '10000000-0000-4000-a000-00000000050a',
  ST_ADMIN: '10000000-0000-4000-a000-00000000050b',
  DZ_ADMIN: '10000000-0000-4000-a000-000000000601',
  LY_ADMIN: '10000000-0000-4000-a000-000000000602',
  MR_ADMIN: '10000000-0000-4000-a000-000000000603',
  MA_ADMIN: '10000000-0000-4000-a000-000000000604',
  TN_ADMIN: '10000000-0000-4000-a000-000000000605',
  EG_ADMIN: '10000000-0000-4000-a000-000000000801',
} as const;

// ── Data Stewards & Continental Admin UUIDs ──
// Prefix 11 = CONTINENTAL_ADMIN, 12 = DATA_STEWARD (mirrors tenant suffix)
const DS = {
  // Continental Data Admin
  CONTINENTAL_ADMIN: '11000000-0000-4000-a000-000000000001',
  // REC Data Stewards
  IGAD_STEWARD:    '12000000-0000-4000-a000-000000000010',
  ECOWAS_STEWARD:  '12000000-0000-4000-a000-000000000020',
  SADC_STEWARD:    '12000000-0000-4000-a000-000000000030',
  EAC_STEWARD:     '12000000-0000-4000-a000-000000000040',
  ECCAS_STEWARD:   '12000000-0000-4000-a000-000000000050',
  UMA_STEWARD:     '12000000-0000-4000-a000-000000000060',
  CEN_SAD_STEWARD: '12000000-0000-4000-a000-000000000070',
  COMESA_STEWARD:  '12000000-0000-4000-a000-000000000080',
  // National Data Stewards (one per country)
  KE_STEWARD: '12000000-0000-4000-a000-000000000101',
  ET_STEWARD: '12000000-0000-4000-a000-000000000102',
  UG_STEWARD: '12000000-0000-4000-a000-000000000103',
  SO_STEWARD: '12000000-0000-4000-a000-000000000104',
  DJ_STEWARD: '12000000-0000-4000-a000-000000000105',
  ER_STEWARD: '12000000-0000-4000-a000-000000000106',
  SD_STEWARD: '12000000-0000-4000-a000-000000000107',
  SS_STEWARD: '12000000-0000-4000-a000-000000000108',
  NG_STEWARD: '12000000-0000-4000-a000-000000000201',
  SN_STEWARD: '12000000-0000-4000-a000-000000000202',
  BJ_STEWARD: '12000000-0000-4000-a000-000000000203',
  BF_STEWARD: '12000000-0000-4000-a000-000000000204',
  CV_STEWARD: '12000000-0000-4000-a000-000000000205',
  CI_STEWARD: '12000000-0000-4000-a000-000000000206',
  GM_STEWARD: '12000000-0000-4000-a000-000000000207',
  GH_STEWARD: '12000000-0000-4000-a000-000000000208',
  GN_STEWARD: '12000000-0000-4000-a000-000000000209',
  GW_STEWARD: '12000000-0000-4000-a000-00000000020a',
  LR_STEWARD: '12000000-0000-4000-a000-00000000020b',
  ML_STEWARD: '12000000-0000-4000-a000-00000000020c',
  NE_STEWARD: '12000000-0000-4000-a000-00000000020d',
  SL_STEWARD: '12000000-0000-4000-a000-00000000020e',
  TG_STEWARD: '12000000-0000-4000-a000-00000000020f',
  ZA_STEWARD: '12000000-0000-4000-a000-000000000301',
  BW_STEWARD: '12000000-0000-4000-a000-000000000302',
  KM_STEWARD: '12000000-0000-4000-a000-000000000303',
  SZ_STEWARD: '12000000-0000-4000-a000-000000000304',
  LS_STEWARD: '12000000-0000-4000-a000-000000000305',
  MG_STEWARD: '12000000-0000-4000-a000-000000000306',
  MW_STEWARD: '12000000-0000-4000-a000-000000000307',
  MU_STEWARD: '12000000-0000-4000-a000-000000000308',
  MZ_STEWARD: '12000000-0000-4000-a000-000000000309',
  NA_STEWARD: '12000000-0000-4000-a000-00000000030a',
  SC_STEWARD: '12000000-0000-4000-a000-00000000030b',
  ZM_STEWARD: '12000000-0000-4000-a000-00000000030c',
  ZW_STEWARD: '12000000-0000-4000-a000-00000000030d',
  TZ_STEWARD: '12000000-0000-4000-a000-000000000401',
  AO_STEWARD: '12000000-0000-4000-a000-000000000501',
  BI_STEWARD: '12000000-0000-4000-a000-000000000502',
  CM_STEWARD: '12000000-0000-4000-a000-000000000503',
  CF_STEWARD: '12000000-0000-4000-a000-000000000504',
  TD_STEWARD: '12000000-0000-4000-a000-000000000505',
  CG_STEWARD: '12000000-0000-4000-a000-000000000506',
  CD_STEWARD: '12000000-0000-4000-a000-000000000507',
  GQ_STEWARD: '12000000-0000-4000-a000-000000000508',
  GA_STEWARD: '12000000-0000-4000-a000-000000000509',
  RW_STEWARD: '12000000-0000-4000-a000-00000000050a',
  ST_STEWARD: '12000000-0000-4000-a000-00000000050b',
  DZ_STEWARD: '12000000-0000-4000-a000-000000000601',
  LY_STEWARD: '12000000-0000-4000-a000-000000000602',
  MR_STEWARD: '12000000-0000-4000-a000-000000000603',
  MA_STEWARD: '12000000-0000-4000-a000-000000000604',
  TN_STEWARD: '12000000-0000-4000-a000-000000000605',
  EG_STEWARD: '12000000-0000-4000-a000-000000000801',
} as const;

async function main(): Promise<void> {
  console.log('Seeding credential users...');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  // ═══════════════════════════════════════════════════════════════════════
  // 1. SUPER_ADMIN for AU-IBAR
  // ═══════════════════════════════════════════════════════════════════════
  await prisma.user.upsert({
    where: { id: U.SUPER_ADMIN },
    update: {},
    create: {
      id: U.SUPER_ADMIN,
      tenantId: T.AU_IBAR,
      email: 'admin@au-aris.org',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      role: UserRole.SUPER_ADMIN,
      mfaEnabled: false,
      isActive: true,
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. REC_ADMINs — one per REC
  //    Email: admin@{rec-domain}  (e.g. admin@igad.au-aris.org)
  // ═══════════════════════════════════════════════════════════════════════
  const recAdmins = [
    { id: U.IGAD_ADMIN,    tenantId: T.IGAD,    email: 'admin@igad.au-aris.org',    firstName: 'IGAD',    lastName: 'Coordinator' },
    { id: U.ECOWAS_ADMIN,  tenantId: T.ECOWAS,  email: 'admin@ecowas.au-aris.org',  firstName: 'ECOWAS',  lastName: 'Coordinator' },
    { id: U.SADC_ADMIN,    tenantId: T.SADC,    email: 'admin@sadc.au-aris.org',    firstName: 'SADC',    lastName: 'Coordinator' },
    { id: U.EAC_ADMIN,     tenantId: T.EAC,     email: 'admin@eac.au-aris.org',     firstName: 'EAC',     lastName: 'Coordinator' },
    { id: U.ECCAS_ADMIN,   tenantId: T.ECCAS,   email: 'admin@eccas.au-aris.org',   firstName: 'ECCAS',   lastName: 'Coordinator' },
    { id: U.UMA_ADMIN,     tenantId: T.UMA,     email: 'admin@uma.au-aris.org',     firstName: 'UMA',     lastName: 'Coordinator' },
    { id: U.CEN_SAD_ADMIN, tenantId: T.CEN_SAD, email: 'admin@censad.au-aris.org',  firstName: 'CEN-SAD', lastName: 'Coordinator' },
    { id: U.COMESA_ADMIN,  tenantId: T.COMESA,  email: 'admin@comesa.au-aris.org',  firstName: 'COMESA',  lastName: 'Coordinator' },
  ];

  for (const admin of recAdmins) {
    await prisma.user.upsert({
      where: { id: admin.id },
      update: {},
      create: {
        id: admin.id,
        tenantId: admin.tenantId,
        email: admin.email,
        passwordHash,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: UserRole.REC_ADMIN,
        mfaEnabled: false,
        isActive: true,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. NATIONAL_ADMINs — one per Member State
  //    Email: admin@{cc}.au-aris.org  (e.g. admin@ke.au-aris.org)
  // ═══════════════════════════════════════════════════════════════════════
  const nationalAdmins = [
    // IGAD (8)
    { id: U.KE_ADMIN, tenantId: T.KE, email: 'admin@ke.au-aris.org', firstName: 'Kenya',       lastName: 'Administrator' },
    { id: U.ET_ADMIN, tenantId: T.ET, email: 'admin@et.au-aris.org', firstName: 'Ethiopia',     lastName: 'Administrator' },
    { id: U.UG_ADMIN, tenantId: T.UG, email: 'admin@ug.au-aris.org', firstName: 'Uganda',       lastName: 'Administrator' },
    { id: U.SO_ADMIN, tenantId: T.SO, email: 'admin@so.au-aris.org', firstName: 'Somalia',      lastName: 'Administrator' },
    { id: U.DJ_ADMIN, tenantId: T.DJ, email: 'admin@dj.au-aris.org', firstName: 'Djibouti',     lastName: 'Administrator' },
    { id: U.ER_ADMIN, tenantId: T.ER, email: 'admin@er.au-aris.org', firstName: 'Eritrea',      lastName: 'Administrator' },
    { id: U.SD_ADMIN, tenantId: T.SD, email: 'admin@sd.au-aris.org', firstName: 'Sudan',        lastName: 'Administrator' },
    { id: U.SS_ADMIN, tenantId: T.SS, email: 'admin@ss.au-aris.org', firstName: 'South Sudan',  lastName: 'Administrator' },
    // ECOWAS (15)
    { id: U.NG_ADMIN, tenantId: T.NG, email: 'admin@ng.au-aris.org', firstName: 'Nigeria',       lastName: 'Administrator' },
    { id: U.SN_ADMIN, tenantId: T.SN, email: 'admin@sn.au-aris.org', firstName: 'Senegal',       lastName: 'Administrator' },
    { id: U.BJ_ADMIN, tenantId: T.BJ, email: 'admin@bj.au-aris.org', firstName: 'Benin',         lastName: 'Administrator' },
    { id: U.BF_ADMIN, tenantId: T.BF, email: 'admin@bf.au-aris.org', firstName: 'Burkina Faso',  lastName: 'Administrator' },
    { id: U.CV_ADMIN, tenantId: T.CV, email: 'admin@cv.au-aris.org', firstName: 'Cabo Verde',    lastName: 'Administrator' },
    { id: U.CI_ADMIN, tenantId: T.CI, email: 'admin@ci.au-aris.org', firstName: "Côte d'Ivoire", lastName: 'Administrator' },
    { id: U.GM_ADMIN, tenantId: T.GM, email: 'admin@gm.au-aris.org', firstName: 'Gambia',        lastName: 'Administrator' },
    { id: U.GH_ADMIN, tenantId: T.GH, email: 'admin@gh.au-aris.org', firstName: 'Ghana',         lastName: 'Administrator' },
    { id: U.GN_ADMIN, tenantId: T.GN, email: 'admin@gn.au-aris.org', firstName: 'Guinea',        lastName: 'Administrator' },
    { id: U.GW_ADMIN, tenantId: T.GW, email: 'admin@gw.au-aris.org', firstName: 'Guinea-Bissau', lastName: 'Administrator' },
    { id: U.LR_ADMIN, tenantId: T.LR, email: 'admin@lr.au-aris.org', firstName: 'Liberia',       lastName: 'Administrator' },
    { id: U.ML_ADMIN, tenantId: T.ML, email: 'admin@ml.au-aris.org', firstName: 'Mali',          lastName: 'Administrator' },
    { id: U.NE_ADMIN, tenantId: T.NE, email: 'admin@ne.au-aris.org', firstName: 'Niger',         lastName: 'Administrator' },
    { id: U.SL_ADMIN, tenantId: T.SL, email: 'admin@sl.au-aris.org', firstName: 'Sierra Leone',  lastName: 'Administrator' },
    { id: U.TG_ADMIN, tenantId: T.TG, email: 'admin@tg.au-aris.org', firstName: 'Togo',          lastName: 'Administrator' },
    // SADC (13)
    { id: U.ZA_ADMIN, tenantId: T.ZA, email: 'admin@za.au-aris.org', firstName: 'South Africa', lastName: 'Administrator' },
    { id: U.BW_ADMIN, tenantId: T.BW, email: 'admin@bw.au-aris.org', firstName: 'Botswana',     lastName: 'Administrator' },
    { id: U.KM_ADMIN, tenantId: T.KM, email: 'admin@km.au-aris.org', firstName: 'Comoros',      lastName: 'Administrator' },
    { id: U.SZ_ADMIN, tenantId: T.SZ, email: 'admin@sz.au-aris.org', firstName: 'Eswatini',     lastName: 'Administrator' },
    { id: U.LS_ADMIN, tenantId: T.LS, email: 'admin@ls.au-aris.org', firstName: 'Lesotho',      lastName: 'Administrator' },
    { id: U.MG_ADMIN, tenantId: T.MG, email: 'admin@mg.au-aris.org', firstName: 'Madagascar',   lastName: 'Administrator' },
    { id: U.MW_ADMIN, tenantId: T.MW, email: 'admin@mw.au-aris.org', firstName: 'Malawi',       lastName: 'Administrator' },
    { id: U.MU_ADMIN, tenantId: T.MU, email: 'admin@mu.au-aris.org', firstName: 'Mauritius',    lastName: 'Administrator' },
    { id: U.MZ_ADMIN, tenantId: T.MZ, email: 'admin@mz.au-aris.org', firstName: 'Mozambique',   lastName: 'Administrator' },
    { id: U.NA_ADMIN, tenantId: T.NA, email: 'admin@na.au-aris.org', firstName: 'Namibia',      lastName: 'Administrator' },
    { id: U.SC_ADMIN, tenantId: T.SC, email: 'admin@sc.au-aris.org', firstName: 'Seychelles',   lastName: 'Administrator' },
    { id: U.ZM_ADMIN, tenantId: T.ZM, email: 'admin@zm.au-aris.org', firstName: 'Zambia',       lastName: 'Administrator' },
    { id: U.ZW_ADMIN, tenantId: T.ZW, email: 'admin@zw.au-aris.org', firstName: 'Zimbabwe',     lastName: 'Administrator' },
    // EAC (1)
    { id: U.TZ_ADMIN, tenantId: T.TZ, email: 'admin@tz.au-aris.org', firstName: 'Tanzania',     lastName: 'Administrator' },
    // ECCAS (11)
    { id: U.AO_ADMIN, tenantId: T.AO, email: 'admin@ao.au-aris.org', firstName: 'Angola',               lastName: 'Administrator' },
    { id: U.BI_ADMIN, tenantId: T.BI, email: 'admin@bi.au-aris.org', firstName: 'Burundi',              lastName: 'Administrator' },
    { id: U.CM_ADMIN, tenantId: T.CM, email: 'admin@cm.au-aris.org', firstName: 'Cameroon',             lastName: 'Administrator' },
    { id: U.CF_ADMIN, tenantId: T.CF, email: 'admin@cf.au-aris.org', firstName: 'Central African Rep.', lastName: 'Administrator' },
    { id: U.TD_ADMIN, tenantId: T.TD, email: 'admin@td.au-aris.org', firstName: 'Chad',                 lastName: 'Administrator' },
    { id: U.CG_ADMIN, tenantId: T.CG, email: 'admin@cg.au-aris.org', firstName: 'Congo',                lastName: 'Administrator' },
    { id: U.CD_ADMIN, tenantId: T.CD, email: 'admin@cd.au-aris.org', firstName: 'DR Congo',             lastName: 'Administrator' },
    { id: U.GQ_ADMIN, tenantId: T.GQ, email: 'admin@gq.au-aris.org', firstName: 'Equatorial Guinea',    lastName: 'Administrator' },
    { id: U.GA_ADMIN, tenantId: T.GA, email: 'admin@ga.au-aris.org', firstName: 'Gabon',                lastName: 'Administrator' },
    { id: U.RW_ADMIN, tenantId: T.RW, email: 'admin@rw.au-aris.org', firstName: 'Rwanda',               lastName: 'Administrator' },
    { id: U.ST_ADMIN, tenantId: T.ST, email: 'admin@st.au-aris.org', firstName: 'São Tomé',             lastName: 'Administrator' },
    // UMA (5)
    { id: U.DZ_ADMIN, tenantId: T.DZ, email: 'admin@dz.au-aris.org', firstName: 'Algeria',     lastName: 'Administrator' },
    { id: U.LY_ADMIN, tenantId: T.LY, email: 'admin@ly.au-aris.org', firstName: 'Libya',       lastName: 'Administrator' },
    { id: U.MR_ADMIN, tenantId: T.MR, email: 'admin@mr.au-aris.org', firstName: 'Mauritania',  lastName: 'Administrator' },
    { id: U.MA_ADMIN, tenantId: T.MA, email: 'admin@ma.au-aris.org', firstName: 'Morocco',     lastName: 'Administrator' },
    { id: U.TN_ADMIN, tenantId: T.TN, email: 'admin@tn.au-aris.org', firstName: 'Tunisia',     lastName: 'Administrator' },
    // COMESA (1)
    { id: U.EG_ADMIN, tenantId: T.EG, email: 'admin@eg.au-aris.org', firstName: 'Egypt',       lastName: 'Administrator' },
  ];

  for (const admin of nationalAdmins) {
    await prisma.user.upsert({
      where: { id: admin.id },
      update: {},
      create: {
        id: admin.id,
        tenantId: admin.tenantId,
        email: admin.email,
        passwordHash,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: UserRole.NATIONAL_ADMIN,
        mfaEnabled: false,
        isActive: true,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. CONTINENTAL_ADMIN — AU-IBAR data publication officer
  // ═══════════════════════════════════════════════════════════════════════
  await prisma.user.upsert({
    where: { id: DS.CONTINENTAL_ADMIN },
    update: {},
    create: {
      id: DS.CONTINENTAL_ADMIN,
      tenantId: T.AU_IBAR,
      email: 'continental@au-aris.org',
      passwordHash,
      firstName: 'Continental',
      lastName: 'Data Officer',
      role: UserRole.CONTINENTAL_ADMIN,
      mfaEnabled: false,
      isActive: true,
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. REC DATA_STEWARDs — one per REC
  //    Email: steward@{rec-domain}  (e.g. steward@igad.au-aris.org)
  // ═══════════════════════════════════════════════════════════════════════
  const recStewards = [
    { id: DS.IGAD_STEWARD,    tenantId: T.IGAD,    email: 'steward@igad.au-aris.org',    firstName: 'IGAD',    lastName: 'Data Steward' },
    { id: DS.ECOWAS_STEWARD,  tenantId: T.ECOWAS,  email: 'steward@ecowas.au-aris.org',  firstName: 'ECOWAS',  lastName: 'Data Steward' },
    { id: DS.SADC_STEWARD,    tenantId: T.SADC,    email: 'steward@sadc.au-aris.org',    firstName: 'SADC',    lastName: 'Data Steward' },
    { id: DS.EAC_STEWARD,     tenantId: T.EAC,     email: 'steward@eac.au-aris.org',     firstName: 'EAC',     lastName: 'Data Steward' },
    { id: DS.ECCAS_STEWARD,   tenantId: T.ECCAS,   email: 'steward@eccas.au-aris.org',   firstName: 'ECCAS',   lastName: 'Data Steward' },
    { id: DS.UMA_STEWARD,     tenantId: T.UMA,     email: 'steward@uma.au-aris.org',     firstName: 'UMA',     lastName: 'Data Steward' },
    { id: DS.CEN_SAD_STEWARD, tenantId: T.CEN_SAD, email: 'steward@censad.au-aris.org',  firstName: 'CEN-SAD', lastName: 'Data Steward' },
    { id: DS.COMESA_STEWARD,  tenantId: T.COMESA,  email: 'steward@comesa.au-aris.org',  firstName: 'COMESA',  lastName: 'Data Steward' },
  ];

  for (const steward of recStewards) {
    await prisma.user.upsert({
      where: { id: steward.id },
      update: {},
      create: {
        id: steward.id,
        tenantId: steward.tenantId,
        email: steward.email,
        passwordHash,
        firstName: steward.firstName,
        lastName: steward.lastName,
        role: UserRole.DATA_STEWARD,
        mfaEnabled: false,
        isActive: true,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. NATIONAL DATA_STEWARDs — one per Member State
  //    Email: steward@{cc}.au-aris.org  (e.g. steward@ke.au-aris.org)
  // ═══════════════════════════════════════════════════════════════════════
  const nationalStewards = [
    // IGAD (8)
    { id: DS.KE_STEWARD, tenantId: T.KE, email: 'steward@ke.au-aris.org', firstName: 'Kenya',       lastName: 'Data Steward' },
    { id: DS.ET_STEWARD, tenantId: T.ET, email: 'steward@et.au-aris.org', firstName: 'Ethiopia',     lastName: 'Data Steward' },
    { id: DS.UG_STEWARD, tenantId: T.UG, email: 'steward@ug.au-aris.org', firstName: 'Uganda',       lastName: 'Data Steward' },
    { id: DS.SO_STEWARD, tenantId: T.SO, email: 'steward@so.au-aris.org', firstName: 'Somalia',      lastName: 'Data Steward' },
    { id: DS.DJ_STEWARD, tenantId: T.DJ, email: 'steward@dj.au-aris.org', firstName: 'Djibouti',     lastName: 'Data Steward' },
    { id: DS.ER_STEWARD, tenantId: T.ER, email: 'steward@er.au-aris.org', firstName: 'Eritrea',      lastName: 'Data Steward' },
    { id: DS.SD_STEWARD, tenantId: T.SD, email: 'steward@sd.au-aris.org', firstName: 'Sudan',        lastName: 'Data Steward' },
    { id: DS.SS_STEWARD, tenantId: T.SS, email: 'steward@ss.au-aris.org', firstName: 'South Sudan',  lastName: 'Data Steward' },
    // ECOWAS (15)
    { id: DS.NG_STEWARD, tenantId: T.NG, email: 'steward@ng.au-aris.org', firstName: 'Nigeria',       lastName: 'Data Steward' },
    { id: DS.SN_STEWARD, tenantId: T.SN, email: 'steward@sn.au-aris.org', firstName: 'Senegal',       lastName: 'Data Steward' },
    { id: DS.BJ_STEWARD, tenantId: T.BJ, email: 'steward@bj.au-aris.org', firstName: 'Benin',         lastName: 'Data Steward' },
    { id: DS.BF_STEWARD, tenantId: T.BF, email: 'steward@bf.au-aris.org', firstName: 'Burkina Faso',  lastName: 'Data Steward' },
    { id: DS.CV_STEWARD, tenantId: T.CV, email: 'steward@cv.au-aris.org', firstName: 'Cabo Verde',    lastName: 'Data Steward' },
    { id: DS.CI_STEWARD, tenantId: T.CI, email: 'steward@ci.au-aris.org', firstName: "Cote d'Ivoire", lastName: 'Data Steward' },
    { id: DS.GM_STEWARD, tenantId: T.GM, email: 'steward@gm.au-aris.org', firstName: 'Gambia',        lastName: 'Data Steward' },
    { id: DS.GH_STEWARD, tenantId: T.GH, email: 'steward@gh.au-aris.org', firstName: 'Ghana',         lastName: 'Data Steward' },
    { id: DS.GN_STEWARD, tenantId: T.GN, email: 'steward@gn.au-aris.org', firstName: 'Guinea',        lastName: 'Data Steward' },
    { id: DS.GW_STEWARD, tenantId: T.GW, email: 'steward@gw.au-aris.org', firstName: 'Guinea-Bissau', lastName: 'Data Steward' },
    { id: DS.LR_STEWARD, tenantId: T.LR, email: 'steward@lr.au-aris.org', firstName: 'Liberia',       lastName: 'Data Steward' },
    { id: DS.ML_STEWARD, tenantId: T.ML, email: 'steward@ml.au-aris.org', firstName: 'Mali',          lastName: 'Data Steward' },
    { id: DS.NE_STEWARD, tenantId: T.NE, email: 'steward@ne.au-aris.org', firstName: 'Niger',         lastName: 'Data Steward' },
    { id: DS.SL_STEWARD, tenantId: T.SL, email: 'steward@sl.au-aris.org', firstName: 'Sierra Leone',  lastName: 'Data Steward' },
    { id: DS.TG_STEWARD, tenantId: T.TG, email: 'steward@tg.au-aris.org', firstName: 'Togo',          lastName: 'Data Steward' },
    // SADC (13)
    { id: DS.ZA_STEWARD, tenantId: T.ZA, email: 'steward@za.au-aris.org', firstName: 'South Africa', lastName: 'Data Steward' },
    { id: DS.BW_STEWARD, tenantId: T.BW, email: 'steward@bw.au-aris.org', firstName: 'Botswana',     lastName: 'Data Steward' },
    { id: DS.KM_STEWARD, tenantId: T.KM, email: 'steward@km.au-aris.org', firstName: 'Comoros',      lastName: 'Data Steward' },
    { id: DS.SZ_STEWARD, tenantId: T.SZ, email: 'steward@sz.au-aris.org', firstName: 'Eswatini',     lastName: 'Data Steward' },
    { id: DS.LS_STEWARD, tenantId: T.LS, email: 'steward@ls.au-aris.org', firstName: 'Lesotho',      lastName: 'Data Steward' },
    { id: DS.MG_STEWARD, tenantId: T.MG, email: 'steward@mg.au-aris.org', firstName: 'Madagascar',   lastName: 'Data Steward' },
    { id: DS.MW_STEWARD, tenantId: T.MW, email: 'steward@mw.au-aris.org', firstName: 'Malawi',       lastName: 'Data Steward' },
    { id: DS.MU_STEWARD, tenantId: T.MU, email: 'steward@mu.au-aris.org', firstName: 'Mauritius',    lastName: 'Data Steward' },
    { id: DS.MZ_STEWARD, tenantId: T.MZ, email: 'steward@mz.au-aris.org', firstName: 'Mozambique',   lastName: 'Data Steward' },
    { id: DS.NA_STEWARD, tenantId: T.NA, email: 'steward@na.au-aris.org', firstName: 'Namibia',      lastName: 'Data Steward' },
    { id: DS.SC_STEWARD, tenantId: T.SC, email: 'steward@sc.au-aris.org', firstName: 'Seychelles',   lastName: 'Data Steward' },
    { id: DS.ZM_STEWARD, tenantId: T.ZM, email: 'steward@zm.au-aris.org', firstName: 'Zambia',       lastName: 'Data Steward' },
    { id: DS.ZW_STEWARD, tenantId: T.ZW, email: 'steward@zw.au-aris.org', firstName: 'Zimbabwe',     lastName: 'Data Steward' },
    // EAC (1)
    { id: DS.TZ_STEWARD, tenantId: T.TZ, email: 'steward@tz.au-aris.org', firstName: 'Tanzania',     lastName: 'Data Steward' },
    // ECCAS (11)
    { id: DS.AO_STEWARD, tenantId: T.AO, email: 'steward@ao.au-aris.org', firstName: 'Angola',               lastName: 'Data Steward' },
    { id: DS.BI_STEWARD, tenantId: T.BI, email: 'steward@bi.au-aris.org', firstName: 'Burundi',              lastName: 'Data Steward' },
    { id: DS.CM_STEWARD, tenantId: T.CM, email: 'steward@cm.au-aris.org', firstName: 'Cameroon',             lastName: 'Data Steward' },
    { id: DS.CF_STEWARD, tenantId: T.CF, email: 'steward@cf.au-aris.org', firstName: 'Central African Rep.', lastName: 'Data Steward' },
    { id: DS.TD_STEWARD, tenantId: T.TD, email: 'steward@td.au-aris.org', firstName: 'Chad',                 lastName: 'Data Steward' },
    { id: DS.CG_STEWARD, tenantId: T.CG, email: 'steward@cg.au-aris.org', firstName: 'Congo',                lastName: 'Data Steward' },
    { id: DS.CD_STEWARD, tenantId: T.CD, email: 'steward@cd.au-aris.org', firstName: 'DR Congo',             lastName: 'Data Steward' },
    { id: DS.GQ_STEWARD, tenantId: T.GQ, email: 'steward@gq.au-aris.org', firstName: 'Equatorial Guinea',    lastName: 'Data Steward' },
    { id: DS.GA_STEWARD, tenantId: T.GA, email: 'steward@ga.au-aris.org', firstName: 'Gabon',                lastName: 'Data Steward' },
    { id: DS.RW_STEWARD, tenantId: T.RW, email: 'steward@rw.au-aris.org', firstName: 'Rwanda',               lastName: 'Data Steward' },
    { id: DS.ST_STEWARD, tenantId: T.ST, email: 'steward@st.au-aris.org', firstName: 'Sao Tome',             lastName: 'Data Steward' },
    // UMA (5)
    { id: DS.DZ_STEWARD, tenantId: T.DZ, email: 'steward@dz.au-aris.org', firstName: 'Algeria',     lastName: 'Data Steward' },
    { id: DS.LY_STEWARD, tenantId: T.LY, email: 'steward@ly.au-aris.org', firstName: 'Libya',       lastName: 'Data Steward' },
    { id: DS.MR_STEWARD, tenantId: T.MR, email: 'steward@mr.au-aris.org', firstName: 'Mauritania',  lastName: 'Data Steward' },
    { id: DS.MA_STEWARD, tenantId: T.MA, email: 'steward@ma.au-aris.org', firstName: 'Morocco',     lastName: 'Data Steward' },
    { id: DS.TN_STEWARD, tenantId: T.TN, email: 'steward@tn.au-aris.org', firstName: 'Tunisia',     lastName: 'Data Steward' },
    // COMESA (1)
    { id: DS.EG_STEWARD, tenantId: T.EG, email: 'steward@eg.au-aris.org', firstName: 'Egypt',       lastName: 'Data Steward' },
  ];

  for (const steward of nationalStewards) {
    await prisma.user.upsert({
      where: { id: steward.id },
      update: {},
      create: {
        id: steward.id,
        tenantId: steward.tenantId,
        email: steward.email,
        passwordHash,
        firstName: steward.firstName,
        lastName: steward.lastName,
        role: UserRole.DATA_STEWARD,
        mfaEnabled: false,
        isActive: true,
      },
    });
  }

  console.log('Credential users seeded:');
  console.log('  1 SUPER_ADMIN          (admin@au-aris.org)');
  console.log('  1 CONTINENTAL_ADMIN    (continental@au-aris.org)');
  console.log(`  ${recAdmins.length} REC_ADMINs           (admin@{rec}.au-aris.org)`);
  console.log(`  ${recStewards.length} REC DATA_STEWARDs    (steward@{rec}.au-aris.org)`);
  console.log(`  ${nationalAdmins.length} NATIONAL_ADMINs     (admin@{cc}.au-aris.org)`);
  console.log(`  ${nationalStewards.length} NATIONAL DATA_STEWARDs (steward@{cc}.au-aris.org)`);
  console.log(`  Total: ${2 + recAdmins.length + recStewards.length + nationalAdmins.length + nationalStewards.length} users`);
  console.log(`  Default password: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
