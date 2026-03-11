import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// Known user IDs from seed-credential.ts
// ═══════════════════════════════════════════════════════════════════════════════

const SUPER_ADMIN = '10000000-0000-4000-a000-000000000001';
const CONTINENTAL_ADMIN = '11000000-0000-4000-a000-000000000001';

// REC Admins (prefix 10)
const REC_ADMINS = {
  IGAD:    '10000000-0000-4000-a000-000000000010',
  ECOWAS:  '10000000-0000-4000-a000-000000000020',
  SADC:    '10000000-0000-4000-a000-000000000030',
  EAC:     '10000000-0000-4000-a000-000000000040',
  ECCAS:   '10000000-0000-4000-a000-000000000050',
  UMA:     '10000000-0000-4000-a000-000000000060',
  CEN_SAD: '10000000-0000-4000-a000-000000000070',
  COMESA:  '10000000-0000-4000-a000-000000000080',
} as const;

// REC Data Stewards (prefix 12)
const REC_STEWARDS = {
  IGAD:    '12000000-0000-4000-a000-000000000010',
  ECOWAS:  '12000000-0000-4000-a000-000000000020',
  SADC:    '12000000-0000-4000-a000-000000000030',
  EAC:     '12000000-0000-4000-a000-000000000040',
  ECCAS:   '12000000-0000-4000-a000-000000000050',
  UMA:     '12000000-0000-4000-a000-000000000060',
  CEN_SAD: '12000000-0000-4000-a000-000000000070',
  COMESA:  '12000000-0000-4000-a000-000000000080',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Country → Admin ID / Steward ID / REC mapping
// Admin prefix: 10, Steward prefix: 12 (mirrors tenant suffix)
// ═══════════════════════════════════════════════════════════════════════════════

type RecKey = keyof typeof REC_ADMINS;

interface CountryEntry {
  code: string;
  nameEn: string;
  nameFr: string;
  rec: RecKey;
  adminId: string;
  stewardId: string;
}

const COUNTRIES: CountryEntry[] = [
  // IGAD (8)
  { code: 'KE', nameEn: 'Kenya',        nameFr: 'Kenya',           rec: 'IGAD', adminId: '10000000-0000-4000-a000-000000000101', stewardId: '12000000-0000-4000-a000-000000000101' },
  { code: 'ET', nameEn: 'Ethiopia',      nameFr: 'Ethiopie',        rec: 'IGAD', adminId: '10000000-0000-4000-a000-000000000102', stewardId: '12000000-0000-4000-a000-000000000102' },
  { code: 'UG', nameEn: 'Uganda',        nameFr: 'Ouganda',         rec: 'IGAD', adminId: '10000000-0000-4000-a000-000000000103', stewardId: '12000000-0000-4000-a000-000000000103' },
  { code: 'SO', nameEn: 'Somalia',       nameFr: 'Somalie',         rec: 'IGAD', adminId: '10000000-0000-4000-a000-000000000104', stewardId: '12000000-0000-4000-a000-000000000104' },
  { code: 'DJ', nameEn: 'Djibouti',      nameFr: 'Djibouti',        rec: 'IGAD', adminId: '10000000-0000-4000-a000-000000000105', stewardId: '12000000-0000-4000-a000-000000000105' },
  { code: 'ER', nameEn: 'Eritrea',       nameFr: 'Erythree',        rec: 'IGAD', adminId: '10000000-0000-4000-a000-000000000106', stewardId: '12000000-0000-4000-a000-000000000106' },
  { code: 'SD', nameEn: 'Sudan',         nameFr: 'Soudan',          rec: 'IGAD', adminId: '10000000-0000-4000-a000-000000000107', stewardId: '12000000-0000-4000-a000-000000000107' },
  { code: 'SS', nameEn: 'South Sudan',   nameFr: 'Soudan du Sud',   rec: 'IGAD', adminId: '10000000-0000-4000-a000-000000000108', stewardId: '12000000-0000-4000-a000-000000000108' },
  // ECOWAS (15)
  { code: 'NG', nameEn: 'Nigeria',        nameFr: 'Nigeria',          rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-000000000201', stewardId: '12000000-0000-4000-a000-000000000201' },
  { code: 'SN', nameEn: 'Senegal',        nameFr: 'Senegal',          rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-000000000202', stewardId: '12000000-0000-4000-a000-000000000202' },
  { code: 'BJ', nameEn: 'Benin',          nameFr: 'Benin',            rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-000000000203', stewardId: '12000000-0000-4000-a000-000000000203' },
  { code: 'BF', nameEn: 'Burkina Faso',   nameFr: 'Burkina Faso',     rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-000000000204', stewardId: '12000000-0000-4000-a000-000000000204' },
  { code: 'CV', nameEn: 'Cabo Verde',     nameFr: 'Cap-Vert',         rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-000000000205', stewardId: '12000000-0000-4000-a000-000000000205' },
  { code: 'CI', nameEn: "Cote d'Ivoire",  nameFr: "Cote d'Ivoire",    rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-000000000206', stewardId: '12000000-0000-4000-a000-000000000206' },
  { code: 'GM', nameEn: 'Gambia',         nameFr: 'Gambie',           rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-000000000207', stewardId: '12000000-0000-4000-a000-000000000207' },
  { code: 'GH', nameEn: 'Ghana',          nameFr: 'Ghana',            rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-000000000208', stewardId: '12000000-0000-4000-a000-000000000208' },
  { code: 'GN', nameEn: 'Guinea',         nameFr: 'Guinee',           rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-000000000209', stewardId: '12000000-0000-4000-a000-000000000209' },
  { code: 'GW', nameEn: 'Guinea-Bissau',  nameFr: 'Guinee-Bissau',    rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-00000000020a', stewardId: '12000000-0000-4000-a000-00000000020a' },
  { code: 'LR', nameEn: 'Liberia',        nameFr: 'Liberia',          rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-00000000020b', stewardId: '12000000-0000-4000-a000-00000000020b' },
  { code: 'ML', nameEn: 'Mali',           nameFr: 'Mali',             rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-00000000020c', stewardId: '12000000-0000-4000-a000-00000000020c' },
  { code: 'NE', nameEn: 'Niger',          nameFr: 'Niger',            rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-00000000020d', stewardId: '12000000-0000-4000-a000-00000000020d' },
  { code: 'SL', nameEn: 'Sierra Leone',   nameFr: 'Sierra Leone',     rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-00000000020e', stewardId: '12000000-0000-4000-a000-00000000020e' },
  { code: 'TG', nameEn: 'Togo',           nameFr: 'Togo',             rec: 'ECOWAS', adminId: '10000000-0000-4000-a000-00000000020f', stewardId: '12000000-0000-4000-a000-00000000020f' },
  // SADC (13)
  { code: 'ZA', nameEn: 'South Africa',   nameFr: 'Afrique du Sud',   rec: 'SADC', adminId: '10000000-0000-4000-a000-000000000301', stewardId: '12000000-0000-4000-a000-000000000301' },
  { code: 'BW', nameEn: 'Botswana',       nameFr: 'Botswana',         rec: 'SADC', adminId: '10000000-0000-4000-a000-000000000302', stewardId: '12000000-0000-4000-a000-000000000302' },
  { code: 'KM', nameEn: 'Comoros',        nameFr: 'Comores',          rec: 'SADC', adminId: '10000000-0000-4000-a000-000000000303', stewardId: '12000000-0000-4000-a000-000000000303' },
  { code: 'SZ', nameEn: 'Eswatini',       nameFr: 'Eswatini',         rec: 'SADC', adminId: '10000000-0000-4000-a000-000000000304', stewardId: '12000000-0000-4000-a000-000000000304' },
  { code: 'LS', nameEn: 'Lesotho',        nameFr: 'Lesotho',          rec: 'SADC', adminId: '10000000-0000-4000-a000-000000000305', stewardId: '12000000-0000-4000-a000-000000000305' },
  { code: 'MG', nameEn: 'Madagascar',     nameFr: 'Madagascar',       rec: 'SADC', adminId: '10000000-0000-4000-a000-000000000306', stewardId: '12000000-0000-4000-a000-000000000306' },
  { code: 'MW', nameEn: 'Malawi',         nameFr: 'Malawi',           rec: 'SADC', adminId: '10000000-0000-4000-a000-000000000307', stewardId: '12000000-0000-4000-a000-000000000307' },
  { code: 'MU', nameEn: 'Mauritius',      nameFr: 'Maurice',          rec: 'SADC', adminId: '10000000-0000-4000-a000-000000000308', stewardId: '12000000-0000-4000-a000-000000000308' },
  { code: 'MZ', nameEn: 'Mozambique',     nameFr: 'Mozambique',       rec: 'SADC', adminId: '10000000-0000-4000-a000-000000000309', stewardId: '12000000-0000-4000-a000-000000000309' },
  { code: 'NA', nameEn: 'Namibia',        nameFr: 'Namibie',          rec: 'SADC', adminId: '10000000-0000-4000-a000-00000000030a', stewardId: '12000000-0000-4000-a000-00000000030a' },
  { code: 'SC', nameEn: 'Seychelles',     nameFr: 'Seychelles',       rec: 'SADC', adminId: '10000000-0000-4000-a000-00000000030b', stewardId: '12000000-0000-4000-a000-00000000030b' },
  { code: 'ZM', nameEn: 'Zambia',         nameFr: 'Zambie',           rec: 'SADC', adminId: '10000000-0000-4000-a000-00000000030c', stewardId: '12000000-0000-4000-a000-00000000030c' },
  { code: 'ZW', nameEn: 'Zimbabwe',       nameFr: 'Zimbabwe',         rec: 'SADC', adminId: '10000000-0000-4000-a000-00000000030d', stewardId: '12000000-0000-4000-a000-00000000030d' },
  // EAC (1)
  { code: 'TZ', nameEn: 'Tanzania',       nameFr: 'Tanzanie',         rec: 'EAC',  adminId: '10000000-0000-4000-a000-000000000401', stewardId: '12000000-0000-4000-a000-000000000401' },
  // ECCAS (11)
  { code: 'AO', nameEn: 'Angola',              nameFr: 'Angola',                    rec: 'ECCAS', adminId: '10000000-0000-4000-a000-000000000501', stewardId: '12000000-0000-4000-a000-000000000501' },
  { code: 'BI', nameEn: 'Burundi',             nameFr: 'Burundi',                   rec: 'ECCAS', adminId: '10000000-0000-4000-a000-000000000502', stewardId: '12000000-0000-4000-a000-000000000502' },
  { code: 'CM', nameEn: 'Cameroon',            nameFr: 'Cameroun',                  rec: 'ECCAS', adminId: '10000000-0000-4000-a000-000000000503', stewardId: '12000000-0000-4000-a000-000000000503' },
  { code: 'CF', nameEn: 'Central African Rep.',nameFr: 'Rep. Centrafricaine',        rec: 'ECCAS', adminId: '10000000-0000-4000-a000-000000000504', stewardId: '12000000-0000-4000-a000-000000000504' },
  { code: 'TD', nameEn: 'Chad',                nameFr: 'Tchad',                     rec: 'ECCAS', adminId: '10000000-0000-4000-a000-000000000505', stewardId: '12000000-0000-4000-a000-000000000505' },
  { code: 'CG', nameEn: 'Congo',               nameFr: 'Congo',                     rec: 'ECCAS', adminId: '10000000-0000-4000-a000-000000000506', stewardId: '12000000-0000-4000-a000-000000000506' },
  { code: 'CD', nameEn: 'DR Congo',            nameFr: 'RD Congo',                  rec: 'ECCAS', adminId: '10000000-0000-4000-a000-000000000507', stewardId: '12000000-0000-4000-a000-000000000507' },
  { code: 'GQ', nameEn: 'Equatorial Guinea',   nameFr: 'Guinee Equatoriale',         rec: 'ECCAS', adminId: '10000000-0000-4000-a000-000000000508', stewardId: '12000000-0000-4000-a000-000000000508' },
  { code: 'GA', nameEn: 'Gabon',               nameFr: 'Gabon',                     rec: 'ECCAS', adminId: '10000000-0000-4000-a000-000000000509', stewardId: '12000000-0000-4000-a000-000000000509' },
  { code: 'RW', nameEn: 'Rwanda',              nameFr: 'Rwanda',                    rec: 'ECCAS', adminId: '10000000-0000-4000-a000-00000000050a', stewardId: '12000000-0000-4000-a000-00000000050a' },
  { code: 'ST', nameEn: 'Sao Tome',            nameFr: 'Sao Tome-et-Principe',      rec: 'ECCAS', adminId: '10000000-0000-4000-a000-00000000050b', stewardId: '12000000-0000-4000-a000-00000000050b' },
  // UMA (5)
  { code: 'DZ', nameEn: 'Algeria',        nameFr: 'Algerie',         rec: 'UMA', adminId: '10000000-0000-4000-a000-000000000601', stewardId: '12000000-0000-4000-a000-000000000601' },
  { code: 'LY', nameEn: 'Libya',          nameFr: 'Libye',           rec: 'UMA', adminId: '10000000-0000-4000-a000-000000000602', stewardId: '12000000-0000-4000-a000-000000000602' },
  { code: 'MR', nameEn: 'Mauritania',     nameFr: 'Mauritanie',      rec: 'UMA', adminId: '10000000-0000-4000-a000-000000000603', stewardId: '12000000-0000-4000-a000-000000000603' },
  { code: 'MA', nameEn: 'Morocco',        nameFr: 'Maroc',           rec: 'UMA', adminId: '10000000-0000-4000-a000-000000000604', stewardId: '12000000-0000-4000-a000-000000000604' },
  { code: 'TN', nameEn: 'Tunisia',        nameFr: 'Tunisie',         rec: 'UMA', adminId: '10000000-0000-4000-a000-000000000605', stewardId: '12000000-0000-4000-a000-000000000605' },
  // COMESA (1)
  { code: 'EG', nameEn: 'Egypt',          nameFr: 'Egypte',          rec: 'COMESA', adminId: '10000000-0000-4000-a000-000000000801', stewardId: '12000000-0000-4000-a000-000000000801' },
];

// Campaign ID (kept from previous seed)
const CAMPAIGN_Q1 = '30000000-0000-4000-a000-000000000001';

// ═══════════════════════════════════════════════════════════════════════════════
// The 4 standard steps for every country workflow
// Aligned with CLAUDE.md Annex B §B4.1 — 4-Level Validation
// ═══════════════════════════════════════════════════════════════════════════════

const STANDARD_STEPS = [
  {
    stepOrder: 0,
    levelType: 'national',
    adminLevel: null,
    name: {
      en: 'National Technical Validation',
      fr: 'Validation Technique Nationale',
    },
    description: {
      en: 'Data Steward verifies completeness, quality gates, and consistency',
      fr: "Le Data Steward verifie la completude, les controles qualite et la coherence",
    },
    canEdit: true,
    canValidate: true,
  },
  {
    stepOrder: 1,
    levelType: 'national',
    adminLevel: null,
    name: {
      en: 'National Official Approval',
      fr: 'Approbation Officielle Nationale',
    },
    description: {
      en: 'CVO / National Admin officially approves data (WAHIS-ready after this step)',
      fr: "Le CVO / Administrateur national approuve officiellement les donnees (pret pour WAHIS apres cette etape)",
    },
    canEdit: false,
    canValidate: true,
  },
  {
    stepOrder: 2,
    levelType: 'regional',
    adminLevel: null,
    name: {
      en: 'REC Harmonization',
      fr: 'Harmonisation CER',
    },
    description: {
      en: 'REC Data Steward checks cross-border consistency and regional harmonization',
      fr: "Le Data Steward CER verifie la coherence transfrontaliere et l'harmonisation regionale",
    },
    canEdit: false,
    canValidate: true,
  },
  {
    stepOrder: 3,
    levelType: 'continental',
    adminLevel: null,
    name: {
      en: 'Continental Publication',
      fr: 'Publication Continentale',
    },
    description: {
      en: 'AU-IBAR Continental Admin validates for dashboards, analytics, and official briefs',
      fr: "L'Administrateur continental UA-BIRA valide pour les tableaux de bord, analyses et rapports officiels",
    },
    canEdit: false,
    canValidate: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ARIS 4.0 — Workflow & Validation Chain Seed');
  console.log('═══════════════════════════════════════════════════════');

  // ── 1. Create WorkflowDefinitions (one per country) ────────────────────────
  console.log('\n1. Seeding workflow definitions (54 countries)...');

  let wfCreated = 0;
  let wfSkipped = 0;

  for (const c of COUNTRIES) {
    const country = await (prisma as any).country.findUnique({
      where: { code: c.code },
    });

    if (!country) {
      console.log(`   [SKIP] Country ${c.code} not found — run seed-settings first`);
      wfSkipped++;
      continue;
    }

    // Upsert the workflow definition (unique on countryId)
    const wf = await (prisma as any).collecteWorkflow.upsert({
      where: { countryId: country.id },
      update: {
        name: {
          en: `ARIS ${c.nameEn} Data Validation and Transmission`,
          fr: `ARIS ${c.nameFr} Validation et Transmission des Donnees`,
        },
        description: {
          en: `4-level validation pipeline: Data Steward → CVO → REC (${c.rec}) → AU-IBAR`,
          fr: `Pipeline de validation a 4 niveaux : Data Steward → CVO → CER (${c.rec}) → UA-BIRA`,
        },
        startLevel: 4,
        endLevel: 0,
      },
      create: {
        countryId: country.id,
        name: {
          en: `ARIS ${c.nameEn} Data Validation and Transmission`,
          fr: `ARIS ${c.nameFr} Validation et Transmission des Donnees`,
        },
        description: {
          en: `4-level validation pipeline: Data Steward → CVO → REC (${c.rec}) → AU-IBAR`,
          fr: `Pipeline de validation a 4 niveaux : Data Steward → CVO → CER (${c.rec}) → UA-BIRA`,
        },
        startLevel: 4,
        endLevel: 0,
        defaultTransmitDelay: 72,
        defaultValidationDelay: 48,
        autoTransmitEnabled: true,
        autoValidateEnabled: false,
        requireComment: false,
        allowReject: true,
        allowReturnForCorrection: true,
        createdBy: SUPER_ADMIN,
      },
    });

    // Upsert the 4 standard steps
    for (const step of STANDARD_STEPS) {
      await (prisma as any).collecteWorkflowStep.upsert({
        where: {
          workflowId_stepOrder: {
            workflowId: wf.id,
            stepOrder: step.stepOrder,
          },
        },
        update: {
          name: step.name,
          description: step.description,
          levelType: step.levelType,
        },
        create: {
          workflowId: wf.id,
          stepOrder: step.stepOrder,
          levelType: step.levelType,
          adminLevel: step.adminLevel,
          name: step.name,
          description: step.description,
          canEdit: step.canEdit,
          canValidate: step.canValidate,
        },
      });
    }

    wfCreated++;
  }

  console.log(`   ${wfCreated} workflows created/updated, ${wfSkipped} skipped`);

  // ── 2. Validation Chains ───────────────────────────────────────────────────
  console.log('\n2. Seeding validation chains...');

  let chainCount = 0;

  // 2a. National level: DATA_STEWARD → NATIONAL_ADMIN (per country)
  //     "Data Steward submits, National Admin (CVO) validates"
  console.log('   Level 1 (national): DATA_STEWARD → NATIONAL_ADMIN...');

  for (const c of COUNTRIES) {
    const stewardExists = await (prisma as any).user.findUnique({ where: { id: c.stewardId } });
    const adminExists = await (prisma as any).user.findUnique({ where: { id: c.adminId } });
    if (!stewardExists || !adminExists) continue;

    await (prisma as any).collecteValidationChain.upsert({
      where: {
        userId_validatorId: {
          userId: c.stewardId,
          validatorId: c.adminId,
        },
      },
      update: {},
      create: {
        userId: c.stewardId,
        validatorId: c.adminId,
        backupValidatorId: SUPER_ADMIN,
        priority: 1,
        levelType: 'national',
        isAutoAssigned: true,
        metadata: { step: 'national_technical', country: c.code },
        createdBy: SUPER_ADMIN,
      },
    });
    chainCount++;
  }

  // 2b. Regional level: NATIONAL_ADMIN → REC_DATA_STEWARD (per country)
  //     "National Admin forwards to REC Data Steward for harmonization"
  console.log('   Level 2 (regional): NATIONAL_ADMIN → REC DATA_STEWARD...');

  for (const c of COUNTRIES) {
    const adminExists = await (prisma as any).user.findUnique({ where: { id: c.adminId } });
    const recStewardId = REC_STEWARDS[c.rec];
    const recStewardExists = await (prisma as any).user.findUnique({ where: { id: recStewardId } });
    if (!adminExists || !recStewardExists) continue;

    await (prisma as any).collecteValidationChain.upsert({
      where: {
        userId_validatorId: {
          userId: c.adminId,
          validatorId: recStewardId,
        },
      },
      update: {},
      create: {
        userId: c.adminId,
        validatorId: recStewardId,
        backupValidatorId: REC_ADMINS[c.rec],
        priority: 1,
        levelType: 'regional',
        isAutoAssigned: true,
        metadata: { step: 'rec_harmonization', country: c.code, rec: c.rec },
        createdBy: SUPER_ADMIN,
      },
    });
    chainCount++;
  }

  // 2c. Continental level: REC_DATA_STEWARD → CONTINENTAL_ADMIN (per REC)
  //     "REC Data Steward forwards to Continental Admin for publication"
  console.log('   Level 3 (continental): REC DATA_STEWARD → CONTINENTAL_ADMIN...');

  for (const [recKey, recStewardId] of Object.entries(REC_STEWARDS)) {
    const recStewardExists = await (prisma as any).user.findUnique({ where: { id: recStewardId } });
    const continentalExists = await (prisma as any).user.findUnique({ where: { id: CONTINENTAL_ADMIN } });
    if (!recStewardExists || !continentalExists) continue;

    await (prisma as any).collecteValidationChain.upsert({
      where: {
        userId_validatorId: {
          userId: recStewardId,
          validatorId: CONTINENTAL_ADMIN,
        },
      },
      update: {},
      create: {
        userId: recStewardId,
        validatorId: CONTINENTAL_ADMIN,
        backupValidatorId: SUPER_ADMIN,
        priority: 1,
        levelType: 'continental',
        isAutoAssigned: true,
        metadata: { step: 'continental_publication', rec: recKey },
        createdBy: SUPER_ADMIN,
      },
    });
    chainCount++;
  }

  console.log(`   ${chainCount} validation chains created`);

  // ── 3. Collection Campaign (kept from previous seed) ───────────────────────
  console.log('\n3. Seeding collection campaigns...');

  const template = await (prisma as any).formTemplate.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { created_at: 'asc' },
  });

  if (template) {
    await (prisma as any).collectionCampaign.upsert({
      where: {
        code_scope_ownerId: {
          code: 'Q1_2025_SURVEILLANCE',
          scope: 'continental',
          ownerId: SUPER_ADMIN,
        },
      },
      update: {},
      create: {
        id: CAMPAIGN_Q1,
        code: 'Q1_2025_SURVEILLANCE',
        name: {
          en: 'Q1 2025 Routine Surveillance',
          fr: 'Surveillance de routine T1 2025',
        },
        description: {
          en: 'Quarterly animal health surveillance data collection across pilot countries',
          fr: 'Collecte de donnees de surveillance sanitaire animale trimestrielle dans les pays pilotes',
        },
        domain: 'animal_health',
        formTemplateId: template.id,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        targetCountries: ['KE', 'CM', 'NG'],
        targetSubmissions: 500,
        targetPerAgent: 10,
        frequency: 'monthly',
        status: 'ACTIVE',
        scope: 'continental',
        ownerId: SUPER_ADMIN,
        ownerType: 'continental',
        sendReminders: true,
        reminderDaysBefore: 3,
        createdBy: SUPER_ADMIN,
      },
    });

    // Campaign assignments for KE and NG admins
    const keAdminId = COUNTRIES.find((c) => c.code === 'KE')!.adminId;
    const ngAdminId = COUNTRIES.find((c) => c.code === 'NG')!.adminId;

    for (const { userId, cc } of [
      { userId: keAdminId, cc: 'KE' },
      { userId: ngAdminId, cc: 'NG' },
    ]) {
      const userExists = await (prisma as any).user.findUnique({ where: { id: userId } });
      if (!userExists) continue;

      await (prisma as any).campaignAssignment.upsert({
        where: {
          campaignId_userId: {
            campaignId: CAMPAIGN_Q1,
            userId,
          },
        },
        update: {},
        create: {
          campaignId: CAMPAIGN_Q1,
          userId,
          countryCode: cc,
          targetSubmissions: 50,
          dueDate: new Date('2025-03-31'),
        },
      });
    }

    console.log('   Campaign Q1_2025_SURVEILLANCE created with assignments');
  } else {
    console.log('   [SKIP] No published FormTemplate — run form-builder seed first');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Workflow seed complete!');
  console.log(`  ${wfCreated} workflow definitions (4 steps each)`);
  console.log(`  ${chainCount} validation chains`);
  console.log('');
  console.log('  Validation pipeline per country:');
  console.log('    DATA_STEWARD (steward@{cc}) ──[national]──▶');
  console.log('    NATIONAL_ADMIN (admin@{cc}) ──[regional]──▶');
  console.log('    REC DATA_STEWARD (steward@{rec}) ──[continental]──▶');
  console.log('    CONTINENTAL_ADMIN (continental@au-aris.org)');
  console.log('═══════════════════════════════════════════════════════');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Workflow seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
