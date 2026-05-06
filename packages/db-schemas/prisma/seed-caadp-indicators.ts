/**
 * seed-caadp-indicators.ts
 *
 * Seeds the 13 CAADP/Malabo Biennial Review indicators related to animal resources,
 * plus ~20 additional ARIS/LiDeSA indicators covering all 5 active domains.
 *
 * NO historical values are imported — only indicator definitions + composite formulas.
 *
 * Usage (from container):
 *   cd /app/packages/db-schemas && npx tsx prisma/seed-caadp-indicators.ts
 *
 * Usage (local dev):
 *   cd packages/db-schemas && npx tsx prisma/seed-caadp-indicators.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { Pool } from 'pg';

const pool = new Pool({
  connectionString:
    process.env['DIRECT_DATABASE_URL'] ||
    process.env['DATABASE_URL'] ||
    'postgresql://aris:aris@localhost:5432/aris',
  max: 3,
});

// ═══════════════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════════════

interface IndicatorSeed {
  code: string;
  typeCode: string;                        // 'CAADP' | 'IBAR' | 'FAO' etc.
  nameFr: string;
  nameEn: string;
  nameAr?: string;
  namePt?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  domainCode?: string;                     // resolved to UUID at runtime
  scope: 'CONTINENTAL' | 'REGIONAL' | 'NATIONAL' | 'SUB_NATIONAL' | 'CROSS_CUTTING';
  measurementMode: 'MANUAL_ENTRY' | 'AUTO_FROM_FORM' | 'AUTO_FROM_KPI_SOURCE' | 'COMPOSITE_FORMULA';
  aggregation: string;
  periodicity: string;
  externalSource?: string;
  unit: string;
  decimalPlaces: number;
  targetValue?: number;
  thresholds?: { good: number; warn: number };
  betterIsHigher: boolean;
  externalFrameworkReference?: string;
  notes?: string;
  formula?: string;                        // for COMPOSITE_FORMULA mode
  category: 'direct' | 'indirect' | 'aris';
}

// ═══════════════════════════════════════════════════════════════════════════
//  CAADP DIRECT Indicators (6)
// ═══════════════════════════════════════════════════════════════════════════

const CAADP_DIRECT: IndicatorSeed[] = [
  {
    code: 'CAADP_3_1_III',
    typeCode: 'CAADP',
    nameFr: 'Taux de croissance du ratio intrants agricoles de qualité fournis / besoins nationaux (semences, races, alevins)',
    nameEn: 'Growth rate of the ratio of supplied quality agriculture inputs (seed, breed, fingerlings) to total national requirements',
    nameAr: 'معدل نمو نسبة المدخلات الزراعية ذات الجودة الموردة إلى إجمالي الاحتياجات الوطنية',
    namePt: 'Taxa de crescimento da proporção de insumos agrícolas de qualidade fornecidos em relação às necessidades nacionais totais',
    descriptionFr: 'Indicateur CAADP 3.1iii — Mesure l\'adéquation entre l\'offre d\'intrants de qualité (semences animales, races améliorées, alevins) et les besoins nationaux.',
    descriptionEn: 'CAADP indicator 3.1iii — Measures the adequacy between supply of quality inputs (animal seed, improved breeds, fingerlings) and national requirements.',
    domainCode: 'livestock-prod',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 2,
    betterIsHigher: true,
    externalFrameworkReference: 'CAADP-Malabo-3.1iii',
    notes: 'ţAgI — Biennial Review indicator. Covers livestock breeds and fisheries fingerlings.',
    category: 'direct',
  },
  {
    code: 'CAADP_3_1_VII',
    typeCode: 'CAADP',
    nameFr: 'Pourcentage d\'augmentation des semences animales évaluées et certifiées localement adaptées (par espèce/race/écotype)',
    nameEn: 'Percentage increase in the proportion of evaluated and certified locally adapted livestock seed, by species/breed/ecotypes annually used',
    nameAr: 'النسبة المئوية للزيادة في نسبة البذور الحيوانية المحلية المقيمة والمعتمدة حسب النوع/السلالة/النمط البيئي',
    namePt: 'Percentagem de aumento na proporção de sementes animais avaliadas e certificadas localmente adaptadas',
    descriptionFr: 'Indicateur CAADP 3.1vii (pLCSU) — Pourcentage d\'augmentation annuelle des semences animales (races/écotypes) évaluées, certifiées et utilisées au niveau national.',
    descriptionEn: 'CAADP indicator 3.1vii (pLCSU) — Annual percentage increase in locally adapted livestock seed (breeds/ecotypes) that are evaluated, certified and used nationally.',
    domainCode: 'livestock-prod',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 2,
    betterIsHigher: true,
    externalFrameworkReference: 'CAADP-Malabo-3.1vii',
    notes: 'pLCSU — Livestock Seed indicator. Key for genetic improvement tracking.',
    category: 'direct',
  },
  {
    code: 'CAADP_3_6_I_SPSI',
    typeCode: 'CAADP',
    nameFr: 'Indice des Systèmes Sanitaires et Phytosanitaires (SPSI)',
    nameEn: 'Sanitary and Phytosanitary Systems Index (SPSI)',
    nameAr: 'مؤشر أنظمة الصحة والصحة النباتية (SPSI)',
    namePt: 'Índice dos Sistemas Sanitários e Fitossanitários (SPSI)',
    descriptionFr: 'Indicateur CAADP 3.6i — Indice composite combinant l\'indice de santé SPS (SHI) et l\'indice de commerce SPS (STI).',
    descriptionEn: 'CAADP indicator 3.6i — Composite index combining the SPS Health Index (SHI) and SPS Trade Index (STI).',
    domainCode: 'trade-sps',
    scope: 'NATIONAL',
    measurementMode: 'COMPOSITE_FORMULA',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 2,
    targetValue: 100,
    thresholds: { good: 70, warn: 40 },
    betterIsHigher: true,
    externalFrameworkReference: 'CAADP-Malabo-3.6i',
    notes: 'SPSI = (SHI + STI) / 2. Composite of 3.6ii and 3.6iii.',
    formula: '({{indicator:CAADP_3_6_II_SHI}} + {{indicator:CAADP_3_6_III_STI}}) / 2',
    category: 'direct',
  },
  {
    code: 'CAADP_3_6_II_SHI',
    typeCode: 'CAADP',
    nameFr: 'Indice de Santé SPS (SHI)',
    nameEn: 'SPS Health Index (SHI)',
    nameAr: 'مؤشر الصحة SPS (SHI)',
    namePt: 'Índice de Saúde SPS (SHI)',
    descriptionFr: 'Indicateur CAADP 3.6ii — Évalue la capacité du système sanitaire national (surveillance, diagnostic, contrôle des maladies, services vétérinaires).',
    descriptionEn: 'CAADP indicator 3.6ii — Evaluates national sanitary system capacity (surveillance, diagnostics, disease control, veterinary services).',
    domainCode: 'trade-sps',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 2,
    targetValue: 100,
    thresholds: { good: 70, warn: 40 },
    betterIsHigher: true,
    externalFrameworkReference: 'CAADP-Malabo-3.6ii',
    notes: 'SHI — Component of SPSI. Data from WOAH PVS evaluations and national assessments.',
    category: 'direct',
  },
  {
    code: 'CAADP_3_6_III_STI',
    typeCode: 'CAADP',
    nameFr: 'Indice de Commerce SPS (STI)',
    nameEn: 'SPS Trade Index (STI)',
    nameAr: 'مؤشر التجارة SPS (STI)',
    namePt: 'Índice de Comércio SPS (STI)',
    descriptionFr: 'Indicateur CAADP 3.6iii — Évalue la capacité du système phytosanitaire et de certification commerciale pour les produits animaux.',
    descriptionEn: 'CAADP indicator 3.6iii — Evaluates phytosanitary and trade certification capacity for animal products.',
    domainCode: 'trade-sps',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 2,
    targetValue: 100,
    thresholds: { good: 70, warn: 40 },
    betterIsHigher: true,
    externalFrameworkReference: 'CAADP-Malabo-3.6iii',
    notes: 'STI — Component of SPSI. Measures trade facilitation and SPS certification systems.',
    category: 'direct',
  },
  {
    code: 'CAADP_6_3_GHG',
    typeCode: 'CAADP',
    nameFr: 'Émissions totales de gaz à effet de serre (GES) provenant de l\'agriculture',
    nameEn: 'Total Greenhouse Gas (GHG) emissions from agriculture',
    nameAr: 'إجمالي انبعاثات غازات الاحتباس الحراري من الزراعة',
    namePt: 'Total de emissões de gases de efeito estufa (GEE) da agricultura',
    descriptionFr: 'Indicateur CAADP 6.3 — Émissions totales de GES du secteur agricole y compris élevage (fermentation entérique, gestion du fumier). Source: FAOSTAT ou inventaires nationaux.',
    descriptionEn: 'CAADP indicator 6.3 — Total agricultural GHG emissions including livestock (enteric fermentation, manure management). Source: FAOSTAT or national inventories.',
    domainCode: 'climate-env',
    scope: 'NATIONAL',
    measurementMode: 'AUTO_FROM_KPI_SOURCE',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    externalSource: 'FAOSTAT',
    unit: 'Mt CO2eq',
    decimalPlaces: 2,
    betterIsHigher: false,
    externalFrameworkReference: 'CAADP-Malabo-6.3',
    notes: 'Data available from FAOSTAT Emissions database. Includes enteric fermentation, manure management, pasture.',
    category: 'direct',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  CAADP INDIRECT Indicators (8)
// ═══════════════════════════════════════════════════════════════════════════

const CAADP_INDIRECT: IndicatorSeed[] = [
  {
    code: 'CAADP_2_1_I_GAE',
    typeCode: 'CAADP',
    nameFr: 'Dépenses agricoles gouvernementales en % des dépenses totales',
    nameEn: 'Government agriculture expenditure as % of total government expenditure',
    nameAr: 'الإنفاق الحكومي الزراعي كنسبة مئوية من إجمالي الإنفاق الحكومي',
    namePt: 'Despesa agrícola governamental como % da despesa total do governo',
    descriptionFr: 'Indicateur CAADP 2.1i (ţGAE) — Engagement de Maputo/Malabo : au moins 10% du budget national alloué à l\'agriculture.',
    descriptionEn: 'CAADP indicator 2.1i (ţGAE) — Maputo/Malabo commitment: at least 10% of national budget allocated to agriculture.',
    domainCode: 'governance',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 2,
    targetValue: 10,
    thresholds: { good: 10, warn: 5 },
    betterIsHigher: true,
    externalFrameworkReference: 'CAADP-Malabo-2.1i',
    notes: 'ţGAE — Maputo Declaration target: 10%. Key political commitment indicator.',
    category: 'indirect',
  },
  {
    code: 'CAADP_2_1_II_GAE_AGVA',
    typeCode: 'CAADP',
    nameFr: 'Dépenses agricoles gouvernementales en % de la valeur ajoutée agricole',
    nameEn: 'Government agriculture expenditure as % of agriculture value added',
    nameAr: 'الإنفاق الحكومي الزراعي كنسبة مئوية من القيمة المضافة الزراعية',
    namePt: 'Despesa agrícola governamental como % do valor acrescentado agrícola',
    descriptionFr: 'Indicateur CAADP 2.1ii (GAEAgVA) — Ratio dépenses publiques agricoles / valeur ajoutée agricole.',
    descriptionEn: 'CAADP indicator 2.1ii (GAEAgVA) — Ratio of public agriculture expenditure to agricultural value added.',
    domainCode: 'governance',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 2,
    betterIsHigher: true,
    externalFrameworkReference: 'CAADP-Malabo-2.1ii',
    notes: 'GAEAgVA — Measures intensity of public spending relative to agricultural output.',
    category: 'indirect',
  },
  {
    code: 'CAADP_3_2_I_AGW',
    typeCode: 'CAADP',
    nameFr: 'Taux de croissance de la VA agricole par travailleur agricole (USD constant)',
    nameEn: 'Growth rate of agriculture value added per agricultural worker (constant US$)',
    nameAr: 'معدل نمو القيمة المضافة الزراعية لكل عامل زراعي (بالدولار الأمريكي الثابت)',
    namePt: 'Taxa de crescimento do valor acrescentado agrícola por trabalhador agrícola (US$ constante)',
    descriptionFr: 'Indicateur CAADP 3.2i (ţAgW) — Productivité du travail agricole. Cible Malabo : doublement d\'ici 2025.',
    descriptionEn: 'CAADP indicator 3.2i (ţAgW) — Agricultural labor productivity. Malabo target: doubling by 2025.',
    domainCode: 'livestock-prod',
    scope: 'NATIONAL',
    measurementMode: 'AUTO_FROM_KPI_SOURCE',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    externalSource: 'FAOSTAT',
    unit: 'percent',
    decimalPlaces: 2,
    betterIsHigher: true,
    externalFrameworkReference: 'CAADP-Malabo-3.2i',
    notes: 'ţAgW — Source: FAOSTAT or World Bank WDI. Growth rate year-on-year.',
    category: 'indirect',
  },
  {
    code: 'CAADP_3_2_II_AGL',
    typeCode: 'CAADP',
    nameFr: 'Taux de croissance de la VA agricole par hectare de terre agricole (USD constant)',
    nameEn: 'Growth rate of agriculture value added per hectare of agricultural land (constant US$)',
    nameAr: 'معدل نمو القيمة المضافة الزراعية لكل هكتار من الأراضي الزراعية (بالدولار الأمريكي الثابت)',
    namePt: 'Taxa de crescimento do valor acrescentado agrícola por hectare de terra agrícola (US$ constante)',
    descriptionFr: 'Indicateur CAADP 3.2ii (ţAgL) — Productivité de la terre agricole.',
    descriptionEn: 'CAADP indicator 3.2ii (ţAgL) — Agricultural land productivity.',
    domainCode: 'livestock-prod',
    scope: 'NATIONAL',
    measurementMode: 'AUTO_FROM_KPI_SOURCE',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    externalSource: 'FAOSTAT',
    unit: 'percent',
    decimalPlaces: 2,
    betterIsHigher: true,
    externalFrameworkReference: 'CAADP-Malabo-3.2ii',
    notes: 'ţAgL — Source: FAOSTAT. Growth rate year-on-year.',
    category: 'indirect',
  },
  {
    code: 'CAADP_3_2_III_YIELD',
    typeCode: 'CAADP',
    nameFr: 'Taux de croissance des rendements pour les 5 produits prioritaires nationaux',
    nameEn: 'Growth rate of yields for 5 national priority commodities (and AU 11 priority commodities)',
    nameAr: 'معدل نمو الإنتاجية لأهم 5 سلع وطنية ذات أولوية',
    namePt: 'Taxa de crescimento dos rendimentos para os 5 produtos prioritários nacionais',
    descriptionFr: 'Indicateur CAADP 3.2iii (ţY) — Taux de croissance des rendements des produits animaux prioritaires (viande, lait, oeufs, poisson, miel).',
    descriptionEn: 'CAADP indicator 3.2iii (ţY) — Yield growth rate for priority animal products (meat, milk, eggs, fish, honey).',
    domainCode: 'livestock-prod',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 2,
    betterIsHigher: true,
    externalFrameworkReference: 'CAADP-Malabo-3.2iii',
    notes: 'ţY — Covers livestock commodities among the 5 national and 11 AU priority commodities.',
    category: 'indirect',
  },
  {
    code: 'CAADP_3_3_PHL',
    typeCode: 'CAADP',
    nameFr: 'Taux de réduction des pertes post-récolte pour les 5 produits prioritaires nationaux',
    nameEn: 'Reduction rate of Post-Harvest Losses for 5 national priority commodities',
    nameAr: 'معدل الحد من خسائر ما بعد الحصاد لأهم 5 سلع وطنية ذات أولوية',
    namePt: 'Taxa de redução das perdas pós-colheita para os 5 produtos prioritários nacionais',
    descriptionFr: 'Indicateur CAADP 3.3 (ţPHL) — Réduction des pertes post-production pour les produits animaux (viande, lait, poisson). Cible Malabo : réduire de moitié.',
    descriptionEn: 'CAADP indicator 3.3 (ţPHL) — Post-production loss reduction for animal products (meat, milk, fish). Malabo target: halve losses.',
    domainCode: 'trade-sps',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 2,
    betterIsHigher: true,
    externalFrameworkReference: 'CAADP-Malabo-3.3',
    notes: 'ţPHL — Includes meat spoilage, milk loss, fish post-catch loss. Halving target from 2015 baseline.',
    category: 'indirect',
  },
  {
    code: 'CAADP_6_1_I_RESILIENCE',
    typeCode: 'CAADP',
    nameFr: 'Pourcentage de ménages agricoles/pastoraux/pêcheurs résilients aux chocs climatiques',
    nameEn: 'Percentage of farm, pastoral, and fisher households resilient to climate and weather related shocks',
    nameAr: 'النسبة المئوية للأسر الزراعية/الرعوية/الصيادين المرنة في مواجهة الصدمات المناخية',
    namePt: 'Percentagem de famílias agrícolas/pastoris/pescadoras resilientes a choques climáticos',
    descriptionFr: 'Indicateur CAADP 6.1i (ţRAgHh) — Résilience des ménages pastoraux et de pêcheurs face aux chocs climatiques et météorologiques.',
    descriptionEn: 'CAADP indicator 6.1i (ţRAgHh) — Resilience of pastoral and fisher households to climate and weather related shocks.',
    domainCode: 'climate-env',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 2,
    targetValue: 30,
    thresholds: { good: 30, warn: 15 },
    betterIsHigher: true,
    externalFrameworkReference: 'CAADP-Malabo-6.1i',
    notes: 'ţRAgHh — Includes pastoral and fisher households specifically. Linked to climate-env domain.',
    category: 'indirect',
  },
  {
    code: 'CAADP_7_1_ASCI',
    typeCode: 'CAADP',
    nameFr: 'Indice de capacité à générer et utiliser les données statistiques agricoles (ASCI)',
    nameEn: 'Index of capacity to generate and use agriculture statistical data and information (ASCI)',
    nameAr: 'مؤشر القدرة على إنتاج واستخدام البيانات والمعلومات الإحصائية الزراعية (ASCI)',
    namePt: 'Índice de capacidade para gerar e usar dados e informações estatísticas agrícolas (ASCI)',
    descriptionFr: 'Indicateur CAADP 7.1 (ASCI) — Capacité statistique agricole du pays : collecte, traitement, diffusion des données, incluant les statistiques animales.',
    descriptionEn: 'CAADP indicator 7.1 (ASCI) — Country agricultural statistical capacity: collection, processing, dissemination of data, including animal resource statistics.',
    domainCode: 'governance',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'index',
    decimalPlaces: 2,
    targetValue: 100,
    thresholds: { good: 60, warn: 30 },
    betterIsHigher: true,
    externalFrameworkReference: 'CAADP-Malabo-7.1',
    notes: 'ASCI — Directly relevant to ARIS: measures national capacity to produce animal resource data.',
    category: 'indirect',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  Additional ARIS / LiDeSA / IBAR Indicators (~20)
// ═══════════════════════════════════════════════════════════════════════════

const ARIS_ADDITIONAL: IndicatorSeed[] = [
  // ─── Animal Health ────────────────────────────────────────────────────
  {
    code: 'ARIS_AH_VAX_COVERAGE',
    typeCode: 'IBAR',
    nameFr: 'Couverture vaccinale animale (%)',
    nameEn: 'Animal vaccination coverage (%)',
    nameAr: 'تغطية التطعيم الحيواني (%)',
    namePt: 'Cobertura vacinal animal (%)',
    descriptionFr: 'Pourcentage du cheptel cible vacciné contre les maladies prioritaires (PPR, PPCB, FA, etc.).',
    descriptionEn: 'Percentage of target livestock population vaccinated against priority diseases (PPR, CBPP, FMD, etc.).',
    domainCode: 'animal-health',
    scope: 'NATIONAL',
    measurementMode: 'AUTO_FROM_FORM',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 2,
    targetValue: 80,
    thresholds: { good: 80, warn: 50 },
    betterIsHigher: true,
    externalFrameworkReference: 'LiDeSA-vaccination',
    notes: 'Core LiDeSA indicator. Can be auto-computed from ARIS vaccination campaign forms.',
    category: 'aris',
  },
  {
    code: 'ARIS_AH_NOTIF_24H',
    typeCode: 'IBAR',
    nameFr: 'Taux de notification des maladies dans les 24h (%)',
    nameEn: 'Disease notification timeliness within 24h (%)',
    nameAr: 'معدل الإخطار بالأمراض خلال 24 ساعة (%)',
    namePt: 'Taxa de notificação de doenças em 24h (%)',
    descriptionFr: 'Pourcentage des événements sanitaires notifiés dans les 24 heures suivant la détection.',
    descriptionEn: 'Percentage of disease events notified within 24 hours of detection.',
    domainCode: 'animal-health',
    scope: 'NATIONAL',
    measurementMode: 'AUTO_FROM_FORM',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 1,
    targetValue: 100,
    thresholds: { good: 80, warn: 60 },
    betterIsHigher: true,
    externalFrameworkReference: 'WOAH-notification-timeliness',
    notes: 'Aligned with WOAH reporting obligations. Auto-computed from ARIS outbreak notification timestamps.',
    category: 'aris',
  },
  {
    code: 'ARIS_AH_LAB_CONFIRM',
    typeCode: 'IBAR',
    nameFr: 'Taux de confirmation laboratoire (%)',
    nameEn: 'Laboratory confirmation rate (%)',
    nameAr: 'معدل التأكيد المخبري (%)',
    namePt: 'Taxa de confirmação laboratorial (%)',
    descriptionFr: 'Pourcentage des cas suspects ayant reçu une confirmation laboratoire.',
    descriptionEn: 'Percentage of suspected cases with laboratory confirmation.',
    domainCode: 'animal-health',
    scope: 'NATIONAL',
    measurementMode: 'AUTO_FROM_FORM',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 1,
    targetValue: 80,
    thresholds: { good: 70, warn: 40 },
    betterIsHigher: true,
    notes: 'Measures diagnostic capacity. Auto-computed from outbreak + lab result forms.',
    category: 'aris',
  },
  {
    code: 'ARIS_AH_ACTIVE_OUTBREAKS',
    typeCode: 'IBAR',
    nameFr: 'Nombre de foyers de maladie actifs',
    nameEn: 'Number of active disease outbreaks',
    nameAr: 'عدد بؤر الأمراض النشطة',
    namePt: 'Número de surtos de doenças ativos',
    descriptionFr: 'Nombre de foyers de maladies animales actuellement actifs (non résolus).',
    descriptionEn: 'Number of currently active (unresolved) animal disease outbreaks.',
    domainCode: 'animal-health',
    scope: 'NATIONAL',
    measurementMode: 'AUTO_FROM_FORM',
    aggregation: 'COUNT',
    periodicity: 'MONTHLY',
    unit: 'count',
    decimalPlaces: 0,
    betterIsHigher: false,
    notes: 'Real-time indicator. Auto-computed from ARIS outbreak events with status = ACTIVE.',
    category: 'aris',
  },

  // ─── Livestock Production ─────────────────────────────────────────────
  {
    code: 'ARIS_LP_LIVESTOCK_POP',
    typeCode: 'IBAR',
    nameFr: 'Effectif du cheptel national (têtes)',
    nameEn: 'National livestock population (heads)',
    nameAr: 'إجمالي الثروة الحيوانية الوطنية (رؤوس)',
    namePt: 'Efetivo pecuário nacional (cabeças)',
    descriptionFr: 'Effectif total du cheptel national (bovins, ovins, caprins, camelins, équins, porcins, volaille).',
    descriptionEn: 'Total national livestock population (cattle, sheep, goats, camels, equines, pigs, poultry).',
    domainCode: 'livestock-prod',
    scope: 'NATIONAL',
    measurementMode: 'AUTO_FROM_FORM',
    aggregation: 'SUM',
    periodicity: 'ANNUAL',
    unit: 'heads',
    decimalPlaces: 0,
    betterIsHigher: true,
    externalFrameworkReference: 'FAOSTAT-livestock-population',
    notes: 'Baseline denominator for many other indicators. Auto-computed from ARIS census forms.',
    category: 'aris',
  },
  {
    code: 'ARIS_LP_MEAT_PROD',
    typeCode: 'FAO',
    nameFr: 'Production de viande (tonnes)',
    nameEn: 'Meat production (tonnes)',
    nameAr: 'إنتاج اللحوم (أطنان)',
    namePt: 'Produção de carne (toneladas)',
    descriptionFr: 'Production totale de viande (bovine, ovine, caprine, porcine, volaille).',
    descriptionEn: 'Total meat production (beef, sheep, goat, pork, poultry).',
    domainCode: 'livestock-prod',
    scope: 'NATIONAL',
    measurementMode: 'AUTO_FROM_KPI_SOURCE',
    aggregation: 'SUM',
    periodicity: 'ANNUAL',
    externalSource: 'FAOSTAT',
    unit: 'tonnes',
    decimalPlaces: 0,
    betterIsHigher: true,
    notes: 'Source: FAOSTAT Production domain. Includes all major livestock species.',
    category: 'aris',
  },
  {
    code: 'ARIS_LP_MILK_PROD',
    typeCode: 'FAO',
    nameFr: 'Production laitière (tonnes)',
    nameEn: 'Milk production (tonnes)',
    nameAr: 'إنتاج الحليب (أطنان)',
    namePt: 'Produção de leite (toneladas)',
    descriptionFr: 'Production totale de lait (tous types de lait).',
    descriptionEn: 'Total milk production (all milk types).',
    domainCode: 'livestock-prod',
    scope: 'NATIONAL',
    measurementMode: 'AUTO_FROM_KPI_SOURCE',
    aggregation: 'SUM',
    periodicity: 'ANNUAL',
    externalSource: 'FAOSTAT',
    unit: 'tonnes',
    decimalPlaces: 0,
    betterIsHigher: true,
    notes: 'Source: FAOSTAT Production domain.',
    category: 'aris',
  },
  {
    code: 'ARIS_LP_GDP_CONTRIB',
    typeCode: 'IBAR',
    nameFr: 'Contribution de l\'élevage au PIB agricole (%)',
    nameEn: 'Livestock contribution to agricultural GDP (%)',
    nameAr: 'مساهمة الثروة الحيوانية في الناتج المحلي الإجمالي الزراعي (%)',
    namePt: 'Contribuição da pecuária para o PIB agrícola (%)',
    descriptionFr: 'Part de l\'élevage dans la valeur ajoutée agricole nationale.',
    descriptionEn: 'Share of livestock in national agricultural value added.',
    domainCode: 'livestock-prod',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 2,
    betterIsHigher: true,
    externalFrameworkReference: 'LiDeSA-GDP-contribution',
    notes: 'Key LiDeSA indicator. National statistical offices are primary source.',
    category: 'aris',
  },
  {
    code: 'ARIS_LP_PASTORAL_MOBILITY',
    typeCode: 'IBAR',
    nameFr: 'Indice de mobilité pastorale sécurisée',
    nameEn: 'Secured pastoral mobility index',
    nameAr: 'مؤشر التنقل الرعوي المؤمن',
    namePt: 'Índice de mobilidade pastoral segura',
    descriptionFr: 'Évalue la sécurisation des corridors de transhumance et la mobilité pastorale (cadres juridiques, accords transfrontaliers).',
    descriptionEn: 'Evaluates securing of transhumance corridors and pastoral mobility (legal frameworks, cross-border agreements).',
    domainCode: 'livestock-prod',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'index',
    decimalPlaces: 1,
    targetValue: 100,
    thresholds: { good: 60, warn: 30 },
    betterIsHigher: true,
    externalFrameworkReference: 'LiDeSA-pastoral-mobility',
    notes: 'LiDeSA priority. Composite of legal, infrastructure, and cross-border dimensions.',
    category: 'aris',
  },

  // ─── Trade & SPS ──────────────────────────────────────────────────────
  {
    code: 'ARIS_TS_INTRA_AFRICA',
    typeCode: 'IBAR',
    nameFr: 'Part du commerce intra-africain de produits animaux (%)',
    nameEn: 'Intra-African trade share of animal products (%)',
    nameAr: 'حصة التجارة البينية الأفريقية في المنتجات الحيوانية (%)',
    namePt: 'Quota de comércio intra-africano de produtos animais (%)',
    descriptionFr: 'Part des exportations/importations de produits animaux réalisées entre pays africains (AfCFTA).',
    descriptionEn: 'Share of animal product exports/imports conducted between African countries (AfCFTA).',
    domainCode: 'trade-sps',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 2,
    betterIsHigher: true,
    externalFrameworkReference: 'CAADP-Malabo-5-AfCFTA',
    notes: 'Malabo goal 5: Boosting intra-African trade. Linked to AfCFTA objectives.',
    category: 'aris',
  },
  {
    code: 'ARIS_TS_SPS_CERT_RATE',
    typeCode: 'IBAR',
    nameFr: 'Taux de certification SPS des transactions (%)',
    nameEn: 'SPS certification rate of trade transactions (%)',
    nameAr: 'معدل شهادات SPS للمعاملات التجارية (%)',
    namePt: 'Taxa de certificação SPS das transações comerciais (%)',
    descriptionFr: 'Pourcentage des transactions de produits animaux avec certificats SPS valides.',
    descriptionEn: 'Percentage of animal product trade transactions with valid SPS certificates.',
    domainCode: 'trade-sps',
    scope: 'NATIONAL',
    measurementMode: 'AUTO_FROM_FORM',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 1,
    targetValue: 100,
    thresholds: { good: 80, warn: 60 },
    betterIsHigher: true,
    notes: 'Auto-computed from ARIS trade/SPS certificate forms.',
    category: 'aris',
  },
  {
    code: 'ARIS_TS_TRADE_BALANCE',
    typeCode: 'IBAR',
    nameFr: 'Balance commerciale des produits animaux (millions USD)',
    nameEn: 'Animal products trade balance (million US$)',
    nameAr: 'الميزان التجاري للمنتجات الحيوانية (مليون دولار أمريكي)',
    namePt: 'Balança comercial de produtos animais (milhões US$)',
    descriptionFr: 'Différence entre les exportations et importations de produits animaux.',
    descriptionEn: 'Difference between animal product exports and imports.',
    domainCode: 'trade-sps',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'M USD',
    decimalPlaces: 2,
    betterIsHigher: true,
    notes: 'Positive = trade surplus. Sources: national customs data, COMTRADE.',
    category: 'aris',
  },

  // ─── Fisheries & Aquaculture ──────────────────────────────────────────
  {
    code: 'ARIS_FI_CAPTURE',
    typeCode: 'FAO',
    nameFr: 'Captures totales (tonnes)',
    nameEn: 'Total fish captures (tonnes)',
    nameAr: 'إجمالي المصيد السمكي (أطنان)',
    namePt: 'Capturas totais de pesca (toneladas)',
    descriptionFr: 'Production totale de la pêche de capture (eaux intérieures + maritimes).',
    descriptionEn: 'Total capture fisheries production (inland + marine).',
    domainCode: 'fisheries',
    scope: 'NATIONAL',
    measurementMode: 'AUTO_FROM_FORM',
    aggregation: 'SUM',
    periodicity: 'ANNUAL',
    unit: 'tonnes',
    decimalPlaces: 0,
    betterIsHigher: true,
    externalFrameworkReference: 'FAO-FishStatJ-capture',
    notes: 'Source: ARIS capture forms or FAO FishStatJ. Reported to FAO annually.',
    category: 'aris',
  },
  {
    code: 'ARIS_FI_AQUA_PROD',
    typeCode: 'FAO',
    nameFr: 'Production aquacole (tonnes)',
    nameEn: 'Aquaculture production (tonnes)',
    nameAr: 'إنتاج تربية الأحياء المائية (أطنان)',
    namePt: 'Produção aquícola (toneladas)',
    descriptionFr: 'Production totale de l\'aquaculture (poissons, crustacés, mollusques).',
    descriptionEn: 'Total aquaculture production (fish, crustaceans, molluscs).',
    domainCode: 'fisheries',
    scope: 'NATIONAL',
    measurementMode: 'AUTO_FROM_FORM',
    aggregation: 'SUM',
    periodicity: 'ANNUAL',
    unit: 'tonnes',
    decimalPlaces: 0,
    betterIsHigher: true,
    externalFrameworkReference: 'FAO-FishStatJ-aquaculture',
    notes: 'Source: ARIS aquaculture forms or FAO FishStatJ.',
    category: 'aris',
  },
  {
    code: 'ARIS_FI_PER_CAPITA',
    typeCode: 'IBAR',
    nameFr: 'Consommation de poisson par habitant (kg/an)',
    nameEn: 'Fish consumption per capita (kg/year)',
    nameAr: 'استهلاك الأسماك للفرد (كجم/سنة)',
    namePt: 'Consumo de peixe per capita (kg/ano)',
    descriptionFr: 'Consommation moyenne de poisson par habitant et par an.',
    descriptionEn: 'Average fish consumption per person per year.',
    domainCode: 'fisheries',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'kg/cap/yr',
    decimalPlaces: 1,
    betterIsHigher: true,
    externalFrameworkReference: 'FAO-food-balance',
    notes: 'Source: FAO Food Balance Sheets or national food consumption surveys.',
    category: 'aris',
  },

  // ─── Governance ───────────────────────────────────────────────────────
  {
    code: 'ARIS_GOV_VET_SERVICES',
    typeCode: 'OMSA',
    nameFr: 'Performance des services vétérinaires (indice)',
    nameEn: 'Veterinary services performance (index)',
    nameAr: 'أداء الخدمات البيطرية (مؤشر)',
    namePt: 'Desempenho dos serviços veterinários (índice)',
    descriptionFr: 'Indice de performance des services vétérinaires nationaux basé sur les évaluations WOAH.',
    descriptionEn: 'National veterinary services performance index based on WOAH evaluations.',
    domainCode: 'governance',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'index',
    decimalPlaces: 2,
    targetValue: 5,
    thresholds: { good: 3.5, warn: 2 },
    betterIsHigher: true,
    externalFrameworkReference: 'WOAH-PVS-pathway',
    notes: 'Scale 1-5 aligned with WOAH PVS pathway. Replaces former PVS label.',
    category: 'aris',
  },
  {
    code: 'ARIS_GOV_WAHIS_COMPLIANCE',
    typeCode: 'OMSA',
    nameFr: 'Conformité au rapportage WAHIS (%)',
    nameEn: 'WAHIS reporting compliance (%)',
    nameAr: 'الامتثال لتقارير WAHIS (%)',
    namePt: 'Conformidade com relatórios WAHIS (%)',
    descriptionFr: 'Pourcentage de conformité aux obligations de rapportage WAHIS (notifications immédiates, semestrielles, annuelles).',
    descriptionEn: 'Percentage compliance with WAHIS reporting obligations (immediate, six-monthly, annual notifications).',
    domainCode: 'governance',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 1,
    targetValue: 100,
    thresholds: { good: 80, warn: 50 },
    betterIsHigher: true,
    externalFrameworkReference: 'WOAH-WAHIS-compliance',
    notes: 'Source: WOAH WAHIS compliance reports.',
    category: 'aris',
  },
  {
    code: 'ARIS_GOV_DATA_REPORTING',
    typeCode: 'IBAR',
    nameFr: 'Taux de rapportage ARIS (%)',
    nameEn: 'ARIS data reporting rate (%)',
    nameAr: 'معدل التقارير في ARIS (%)',
    namePt: 'Taxa de reporte de dados ARIS (%)',
    descriptionFr: 'Pourcentage des rapports attendus effectivement soumis dans ARIS par le pays dans les délais.',
    descriptionEn: 'Percentage of expected reports actually submitted on time in ARIS by the country.',
    domainCode: 'governance',
    scope: 'NATIONAL',
    measurementMode: 'AUTO_FROM_FORM',
    aggregation: 'LATEST',
    periodicity: 'QUARTERLY',
    unit: 'percent',
    decimalPlaces: 1,
    targetValue: 100,
    thresholds: { good: 80, warn: 50 },
    betterIsHigher: true,
    notes: 'Auto-computed by ARIS from campaign submission rates vs expected submissions.',
    category: 'aris',
  },
  {
    code: 'ARIS_GOV_POLICY_ALIGNMENT',
    typeCode: 'IBAR',
    nameFr: 'Alignement politique LiDeSA (%)',
    nameEn: 'LiDeSA policy alignment (%)',
    nameAr: 'التوافق مع سياسة LiDeSA (%)',
    namePt: 'Alinhamento político LiDeSA (%)',
    descriptionFr: 'Degré d\'alignement des politiques nationales d\'élevage avec la Stratégie LiDeSA de l\'UA.',
    descriptionEn: 'Degree of alignment of national livestock policies with the AU LiDeSA strategy.',
    domainCode: 'governance',
    scope: 'NATIONAL',
    measurementMode: 'MANUAL_ENTRY',
    aggregation: 'LATEST',
    periodicity: 'ANNUAL',
    unit: 'percent',
    decimalPlaces: 0,
    targetValue: 100,
    thresholds: { good: 70, warn: 40 },
    betterIsHigher: true,
    externalFrameworkReference: 'LiDeSA-policy-alignment',
    notes: 'Self-assessment by national authorities. Validated at REC level.',
    category: 'aris',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  Seed Logic
// ═══════════════════════════════════════════════════════════════════════════

const ALL_INDICATORS = [...CAADP_DIRECT, ...CAADP_INDIRECT, ...ARIS_ADDITIONAL];

async function resolveDomainIds(): Promise<Map<string, string>> {
  const { rows } = await pool.query(
    `SELECT id, code FROM governance.domains WHERE is_active = true`,
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(r.code, r.id);
  }
  return map;
}

async function seedIndicators() {
  console.log('=== ARIS CAADP & KPI Indicator Seed ===\n');

  // 1. Resolve domain IDs
  const domainMap = await resolveDomainIds();
  console.log(`Resolved ${domainMap.size} domains: ${[...domainMap.keys()].join(', ')}\n`);

  // 2. Verify indicator types exist
  const { rows: types } = await pool.query(
    `SELECT code FROM analytics.indicator_types WHERE active = true`,
  );
  const typeCodes = new Set(types.map((t: { code: string }) => t.code));
  console.log(`Available indicator types: ${[...typeCodes].join(', ')}\n`);

  const needed = new Set(ALL_INDICATORS.map(i => i.typeCode));
  for (const t of needed) {
    if (!typeCodes.has(t)) {
      console.error(`ERROR: Indicator type '${t}' does not exist. Run seed-indicator-types.ts first.`);
      process.exit(1);
    }
  }

  // 3. Upsert each indicator
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const ind of ALL_INDICATORS) {
    const domainId = ind.domainCode ? domainMap.get(ind.domainCode) || null : null;
    if (ind.domainCode && !domainId) {
      console.warn(`  WARN: Domain '${ind.domainCode}' not found for ${ind.code} — setting domain_id = NULL`);
    }

    const thresholdsJson = ind.thresholds ? JSON.stringify(ind.thresholds) : null;

    // Check if indicator already exists
    const { rows: existing } = await pool.query(
      `SELECT id FROM analytics.indicators WHERE code = $1`,
      [ind.code],
    );

    if (existing.length > 0) {
      // Update existing
      await pool.query(
        `UPDATE analytics.indicators SET
          type_code = $2, name_fr = $3, name_en = $4, name_ar = $5, name_pt = $6,
          description_fr = $7, description_en = $8,
          domain_id = $9, scope = $10, measurement_mode = $11,
          aggregation = $12, periodicity = $13, external_source = $14,
          unit = $15, decimal_places = $16, target_value = $17,
          thresholds = $18, better_is_higher = $19,
          external_framework_reference = $20, notes = $21,
          active = true, is_public = true, updated_at = NOW()
        WHERE code = $1`,
        [
          ind.code, ind.typeCode, ind.nameFr, ind.nameEn,
          ind.nameAr || null, ind.namePt || null,
          ind.descriptionFr || null, ind.descriptionEn || null,
          domainId, ind.scope, ind.measurementMode,
          ind.aggregation, ind.periodicity, ind.externalSource || null,
          ind.unit, ind.decimalPlaces, ind.targetValue ?? null,
          thresholdsJson, ind.betterIsHigher,
          ind.externalFrameworkReference || null, ind.notes || null,
        ],
      );
      updated++;
      console.log(`  ~ ${ind.code} (updated)`);
    } else {
      // Create new
      await pool.query(
        `INSERT INTO analytics.indicators (
          id, code, type_code, name_fr, name_en, name_ar, name_pt,
          description_fr, description_en,
          domain_id, scope, measurement_mode,
          aggregation, periodicity, external_source,
          unit, decimal_places, target_value,
          thresholds, better_is_higher,
          active, is_public, external_framework_reference, notes,
          updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6,
          $7, $8,
          $9, $10, $11,
          $12, $13, $14,
          $15, $16, $17,
          $18, $19,
          true, true, $20, $21,
          NOW()
        )`,
        [
          ind.code, ind.typeCode, ind.nameFr, ind.nameEn,
          ind.nameAr || null, ind.namePt || null,
          ind.descriptionFr || null, ind.descriptionEn || null,
          domainId, ind.scope, ind.measurementMode,
          ind.aggregation, ind.periodicity, ind.externalSource || null,
          ind.unit, ind.decimalPlaces, ind.targetValue ?? null,
          thresholdsJson, ind.betterIsHigher,
          ind.externalFrameworkReference || null, ind.notes || null,
        ],
      );
      created++;
      console.log(`  + ${ind.code} (created)`);
    }
  }

  console.log(`\nIndicators: ${created} created, ${updated} updated, ${skipped} skipped\n`);

  // 4. Set up composite formulas
  console.log('--- Composite Formulas ---\n');

  const composites = ALL_INDICATORS.filter(i => i.formula);
  let formulasSet = 0;

  for (const comp of composites) {
    // Get the indicator ID
    const { rows: [ind] } = await pool.query(
      `SELECT id FROM analytics.indicators WHERE code = $1`,
      [comp.code],
    );
    if (!ind) {
      console.warn(`  WARN: Indicator ${comp.code} not found — skipping formula`);
      continue;
    }

    // Extract dependency codes from formula
    const refRegex = /\{\{indicator:([A-Z0-9_]+)\}\}/g;
    const depCodes = [...comp.formula!.matchAll(refRegex)].map(m => m[1]);

    // Verify all dependencies exist
    let allDepsExist = true;
    for (const depCode of depCodes) {
      const { rows: [dep] } = await pool.query(
        `SELECT id FROM analytics.indicators WHERE code = $1`,
        [depCode],
      );
      if (!dep) {
        console.warn(`  WARN: Dependency ${depCode} not found for ${comp.code} — skipping formula`);
        allDepsExist = false;
        break;
      }
    }
    if (!allDepsExist) continue;

    // Upsert formula
    const { rows: existingFormula } = await pool.query(
      `SELECT id FROM analytics.indicator_formulas WHERE indicator_id = $1`,
      [ind.id],
    );

    if (existingFormula.length > 0) {
      await pool.query(
        `UPDATE analytics.indicator_formulas SET expression = $2, updated_at = NOW() WHERE indicator_id = $1`,
        [ind.id, comp.formula],
      );
    } else {
      await pool.query(
        `INSERT INTO analytics.indicator_formulas (id, indicator_id, expression, is_validated, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())`,
        [ind.id, comp.formula],
      );
    }

    // Upsert dependencies
    await pool.query(
      `DELETE FROM analytics.indicator_formula_dependencies WHERE formula_id = (
        SELECT id FROM analytics.indicator_formulas WHERE indicator_id = $1
      )`,
      [ind.id],
    );

    const { rows: [formula] } = await pool.query(
      `SELECT id FROM analytics.indicator_formulas WHERE indicator_id = $1`,
      [ind.id],
    );

    for (const depCode of depCodes) {
      const { rows: [dep] } = await pool.query(
        `SELECT id FROM analytics.indicators WHERE code = $1`,
        [depCode],
      );
      await pool.query(
        `INSERT INTO analytics.indicator_formula_dependencies (id, formula_id, referenced_indicator_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT (formula_id, referenced_indicator_id) DO NOTHING`,
        [formula.id, dep.id],
      );
    }

    formulasSet++;
    console.log(`  + ${comp.code}: ${comp.formula}`);
  }

  console.log(`\nFormulas: ${formulasSet} set\n`);

  // 5. Summary
  const { rows: [counts] } = await pool.query(`
    SELECT
      (SELECT count(*) FROM analytics.indicators WHERE active = true) AS total_indicators,
      (SELECT count(*) FROM analytics.indicators WHERE type_code = 'CAADP') AS caadp_count,
      (SELECT count(*) FROM analytics.indicators WHERE type_code = 'IBAR') AS ibar_count,
      (SELECT count(*) FROM analytics.indicators WHERE type_code = 'FAO') AS fao_count,
      (SELECT count(*) FROM analytics.indicators WHERE type_code = 'OMSA') AS omsa_count,
      (SELECT count(*) FROM analytics.indicator_formulas) AS formula_count,
      (SELECT count(*) FROM analytics.indicator_values) AS value_count
  `);

  console.log('=== Summary ===');
  console.log(`Total active indicators: ${counts.total_indicators}`);
  console.log(`  CAADP: ${counts.caadp_count}`);
  console.log(`  IBAR:  ${counts.ibar_count}`);
  console.log(`  FAO:   ${counts.fao_count}`);
  console.log(`  OMSA:  ${counts.omsa_count}`);
  console.log(`Formulas: ${counts.formula_count}`);
  console.log(`Values:   ${counts.value_count} (no values imported — seed only)`);
  console.log('\nDone.\n');
}

// ═══════════════════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════════════════

seedIndicators()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await pool.end();
    process.exit(1);
  });
