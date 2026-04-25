import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Indicator Types ────────────────────────────────────────────────────────

interface IndicatorTypeSeed {
  code: string;
  labelFr: string;
  labelEn: string;
  labelAr: string;
  labelPt: string;
  description: string;
  color: string;
  iconName: string | null;
  externalRef: string | null;
  displayOrder: number;
}

const INDICATOR_TYPES: IndicatorTypeSeed[] = [
  {
    code: 'OMD',
    labelFr: 'Objectifs du Mill\u00e9naire pour le D\u00e9veloppement',
    labelEn: 'Millennium Development Goals',
    labelAr: '\u0623\u0647\u062f\u0627\u0641 \u0627\u0644\u0623\u0644\u0641\u064a\u0629 \u0644\u0644\u062a\u0646\u0645\u064a\u0629',
    labelPt: 'Objetivos de Desenvolvimento do Mil\u00e9nio',
    description: 'UN Millennium Development Goals indicators for animal resources sector',
    color: '#1F4E79',
    iconName: 'Target',
    externalRef: 'UN-MDG',
    displayOrder: 1,
  },
  {
    code: 'CAADP',
    labelFr: 'CAADP \u2014 Programme PDDAA',
    labelEn: 'CAADP \u2014 Comprehensive Africa Agriculture Development Programme',
    labelAr: 'CAADP \u2014 \u0628\u0631\u0646\u0627\u0645\u062c \u0627\u0644\u062a\u0646\u0645\u064a\u0629 \u0627\u0644\u0632\u0631\u0627\u0639\u064a\u0629 \u0627\u0644\u0634\u0627\u0645\u0644\u0629 \u0641\u064a \u0623\u0641\u0631\u064a\u0642\u064a\u0627',
    labelPt: 'CAADP \u2014 Programa Abrangente de Desenvolvimento da Agricultura em \u00c1frica',
    description: 'AU CAADP framework indicators aligned with Malabo Declaration commitments',
    color: '#548235',
    iconName: 'Wheat',
    externalRef: 'AU-CAADP-MALABO',
    displayOrder: 2,
  },
  {
    code: 'IBAR',
    labelFr: 'IBAR \u2014 Indicateurs propres',
    labelEn: 'IBAR \u2014 Internal indicators',
    labelAr: 'IBAR \u2014 \u0645\u0624\u0634\u0631\u0627\u062a \u062f\u0627\u062e\u0644\u064a\u0629',
    labelPt: 'IBAR \u2014 Indicadores internos',
    description: 'AU-IBAR strategic plan internal performance indicators',
    color: '#C9A227',
    iconName: 'BarChart3',
    externalRef: null,
    displayOrder: 3,
  },
  {
    code: 'FAO',
    labelFr: 'FAO \u2014 Indicateurs FAO',
    labelEn: 'FAO \u2014 FAO indicators',
    labelAr: 'FAO \u2014 \u0645\u0624\u0634\u0631\u0627\u062a \u0627\u0644\u0641\u0627\u0648',
    labelPt: 'FAO \u2014 Indicadores FAO',
    description: 'FAO statistical indicators for food and agriculture (FAOSTAT, FishStatJ)',
    color: '#3A7D7B',
    iconName: 'Globe',
    externalRef: 'FAO-FAOSTAT',
    displayOrder: 4,
  },
  {
    code: 'OMSA',
    labelFr: 'OMSA \u2014 Indicateurs OMSA',
    labelEn: 'WOAH \u2014 WOAH indicators',
    labelAr: 'WOAH \u2014 \u0645\u0624\u0634\u0631\u0627\u062a \u0627\u0644\u0645\u0646\u0638\u0645\u0629 \u0627\u0644\u0639\u0627\u0644\u0645\u064a\u0629 \u0644\u0635\u062d\u0629 \u0627\u0644\u062d\u064a\u0648\u0627\u0646',
    labelPt: 'WOAH \u2014 Indicadores WOAH',
    description: 'WOAH (ex-OIE) animal health performance indicators including PVS pathway',
    color: '#8B6F47',
    iconName: 'Shield',
    externalRef: 'WOAH-PVS',
    displayOrder: 5,
  },
  {
    code: 'CUSTOM',
    labelFr: 'Indicateur personnalis\u00e9',
    labelEn: 'Custom indicator',
    labelAr: '\u0645\u0624\u0634\u0631 \u0645\u062e\u0635\u0635',
    labelPt: 'Indicador personalizado',
    description: 'User-defined indicators created by national or regional administrators',
    color: '#595959',
    iconName: 'Settings',
    externalRef: null,
    displayOrder: 99,
  },
];

// ─── Seed Function ──────────────────────────────────────────────────────────

async function seedIndicatorTypes() {
  console.log('Seeding indicator types...');

  for (const t of INDICATOR_TYPES) {
    await prisma.indicatorType.upsert({
      where: { code: t.code },
      update: {
        labelFr: t.labelFr,
        labelEn: t.labelEn,
        labelAr: t.labelAr,
        labelPt: t.labelPt,
        description: t.description,
        color: t.color,
        iconName: t.iconName,
        externalRef: t.externalRef,
        displayOrder: t.displayOrder,
      },
      create: {
        code: t.code,
        labelFr: t.labelFr,
        labelEn: t.labelEn,
        labelAr: t.labelAr,
        labelPt: t.labelPt,
        description: t.description,
        color: t.color,
        iconName: t.iconName,
        externalRef: t.externalRef,
        displayOrder: t.displayOrder,
      },
    });
    console.log(`  [OK] ${t.code} — ${t.labelEn}`);
  }

  console.log(`\nSeeded ${INDICATOR_TYPES.length} indicator types.`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  try {
    await seedIndicatorTypes();
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
