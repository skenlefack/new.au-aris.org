import { PrismaClient } from '@prisma/client';
import {
  TENANT_KE,
  USER_KE_ADMIN,
  SPECIES,
  GEO,
  domainId,
  PREFIX,
  FACILITY_DAGORETTI,
  FACILITY_ATHI_RIVER,
  resolveMasterDataIds,
} from '../../../scripts/seed-constants';

const prisma = new PrismaClient();
const P = PREFIX.LIVESTOCK;

export async function seed(): Promise<void> {
  console.log('🐄 Seeding livestock-prod...\n');

  const { species, geoEntities } = await resolveMasterDataIds(prisma);
  const sp = (code: string) => species.get(code)!;
  const geo = (code: string) => geoEntities.get(code)!;

  // ── Livestock Census (15): 5 species × 3 years ──
  console.log('  📊 Livestock census...');

  const censusData = [
    // Cattle
    { seq: 1, speciesCode: SPECIES.CATTLE_ZEBU, year: 2022, population: 17500000, methodology: 'ENUMERATION', source: 'KNBS Livestock Census 2022' },
    { seq: 2, speciesCode: SPECIES.CATTLE_ZEBU, year: 2023, population: 18100000, methodology: 'ENUMERATION', source: 'KNBS Livestock Census 2023' },
    { seq: 3, speciesCode: SPECIES.CATTLE_ZEBU, year: 2024, population: 18400000, methodology: 'SAMPLING', source: 'DVS Sample Survey 2024' },
    // Sheep
    { seq: 4, speciesCode: SPECIES.SHEEP, year: 2022, population: 16800000, methodology: 'ENUMERATION', source: 'KNBS Livestock Census 2022' },
    { seq: 5, speciesCode: SPECIES.SHEEP, year: 2023, population: 17100000, methodology: 'ENUMERATION', source: 'KNBS Livestock Census 2023' },
    { seq: 6, speciesCode: SPECIES.SHEEP, year: 2024, population: 17300000, methodology: 'SAMPLING', source: 'DVS Sample Survey 2024' },
    // Goats
    { seq: 7, speciesCode: SPECIES.GOAT, year: 2022, population: 26500000, methodology: 'ENUMERATION', source: 'KNBS Livestock Census 2022' },
    { seq: 8, speciesCode: SPECIES.GOAT, year: 2023, population: 27200000, methodology: 'ENUMERATION', source: 'KNBS Livestock Census 2023' },
    { seq: 9, speciesCode: SPECIES.GOAT, year: 2024, population: 27800000, methodology: 'SAMPLING', source: 'DVS Sample Survey 2024' },
    // Camels
    { seq: 10, speciesCode: SPECIES.CAMEL, year: 2022, population: 2900000, methodology: 'ENUMERATION', source: 'KNBS Livestock Census 2022' },
    { seq: 11, speciesCode: SPECIES.CAMEL, year: 2023, population: 3100000, methodology: 'ENUMERATION', source: 'KNBS Livestock Census 2023' },
    { seq: 12, speciesCode: SPECIES.CAMEL, year: 2024, population: 3200000, methodology: 'SAMPLING', source: 'DVS Sample Survey 2024' },
    // Poultry
    { seq: 13, speciesCode: SPECIES.CHICKEN, year: 2022, population: 31000000, methodology: 'ENUMERATION', source: 'KNBS Livestock Census 2022' },
    { seq: 14, speciesCode: SPECIES.CHICKEN, year: 2023, population: 32000000, methodology: 'ENUMERATION', source: 'KNBS Livestock Census 2023' },
    { seq: 15, speciesCode: SPECIES.CHICKEN, year: 2024, population: 32500000, methodology: 'SAMPLING', source: 'DVS Sample Survey 2024' },
  ];

  for (const c of censusData) {
    const speciesId = sp(c.speciesCode);
    const geoEntityId = geo(GEO.KENYA);
    await prisma.livestockCensus.upsert({
      where: { tenantId_geoEntityId_speciesId_year: { tenantId: TENANT_KE, geoEntityId, speciesId, year: c.year } },
      update: {},
      create: {
        id: domainId(P, c.seq),
        tenantId: TENANT_KE,
        geoEntityId,
        speciesId,
        year: c.year,
        population: c.population,
        methodology: c.methodology,
        source: c.source,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${censusData.length} livestock census records`);

  // ── Production Records (20) ──
  console.log('  📦 Production records...');

  const quarters = [
    { label: 'Q1', start: new Date('2025-01-01'), end: new Date('2025-03-31') },
    { label: 'Q2', start: new Date('2025-04-01'), end: new Date('2025-06-30') },
    { label: 'Q3', start: new Date('2025-07-01'), end: new Date('2025-09-30') },
    { label: 'Q4', start: new Date('2025-10-01'), end: new Date('2025-12-31') },
  ];

  const productionData = [
    // Meat production
    { seq: 101, speciesCode: SPECIES.CATTLE_ZEBU, productType: 'MEAT', quantity: 162500, unit: 'T', q: 0 },
    { seq: 102, speciesCode: SPECIES.CATTLE_ZEBU, productType: 'MEAT', quantity: 165000, unit: 'T', q: 1 },
    { seq: 103, speciesCode: SPECIES.SHEEP, productType: 'MEAT', quantity: 22500, unit: 'T', q: 0 },
    { seq: 104, speciesCode: SPECIES.SHEEP, productType: 'MEAT', quantity: 23000, unit: 'T', q: 1 },
    { seq: 105, speciesCode: SPECIES.GOAT, productType: 'MEAT', quantity: 27500, unit: 'T', q: 0 },
    { seq: 106, speciesCode: SPECIES.GOAT, productType: 'MEAT', quantity: 28000, unit: 'T', q: 1 },
    { seq: 107, speciesCode: SPECIES.CHICKEN, productType: 'MEAT', quantity: 8750, unit: 'T', q: 0 },
    { seq: 108, speciesCode: SPECIES.CHICKEN, productType: 'MEAT', quantity: 9000, unit: 'T', q: 1 },
    // Milk production
    { seq: 109, speciesCode: SPECIES.CATTLE_ZEBU, productType: 'MILK', quantity: 1300000000, unit: 'L', q: 0 },
    { seq: 110, speciesCode: SPECIES.CATTLE_ZEBU, productType: 'MILK', quantity: 1350000000, unit: 'L', q: 1 },
    { seq: 111, speciesCode: SPECIES.GOAT, productType: 'MILK', quantity: 45000000, unit: 'L', q: 0 },
    { seq: 112, speciesCode: SPECIES.GOAT, productType: 'MILK', quantity: 46000000, unit: 'L', q: 1 },
    { seq: 113, speciesCode: SPECIES.CAMEL, productType: 'MILK', quantity: 225000000, unit: 'L', q: 0 },
    { seq: 114, speciesCode: SPECIES.CAMEL, productType: 'MILK', quantity: 230000000, unit: 'L', q: 1 },
    // Eggs
    { seq: 115, speciesCode: SPECIES.CHICKEN, productType: 'EGGS', quantity: 350000000, unit: 'HEAD', q: 0 },
    { seq: 116, speciesCode: SPECIES.CHICKEN, productType: 'EGGS', quantity: 360000000, unit: 'HEAD', q: 1 },
    // Wool
    { seq: 117, speciesCode: SPECIES.SHEEP, productType: 'WOOL', quantity: 1250, unit: 'T', q: 0 },
    { seq: 118, speciesCode: SPECIES.SHEEP, productType: 'WOOL', quantity: 1300, unit: 'T', q: 1 },
    // Hides
    { seq: 119, speciesCode: SPECIES.CATTLE_ZEBU, productType: 'HIDE', quantity: 3000, unit: 'T', q: 0 },
    { seq: 120, speciesCode: SPECIES.CATTLE_ZEBU, productType: 'HIDE', quantity: 3100, unit: 'T', q: 1 },
  ];

  for (const p of productionData) {
    const q = quarters[p.q];
    await prisma.productionRecord.upsert({
      where: { id: domainId(P, p.seq) },
      update: {},
      create: {
        id: domainId(P, p.seq),
        tenantId: TENANT_KE,
        speciesId: sp(p.speciesCode),
        productType: p.productType,
        quantity: p.quantity,
        unit: p.unit,
        periodStart: q.start,
        periodEnd: q.end,
        geoEntityId: geo(GEO.KENYA),
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${productionData.length} production records`);

  // ── Slaughter Records (10): 5 species × 2 periods ──
  console.log('  🔪 Slaughter records...');

  const slaughterData = [
    { seq: 201, speciesCode: SPECIES.CATTLE_ZEBU, facilityId: FACILITY_DAGORETTI, count: 185000, condemnations: 1200, periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30') },
    { seq: 202, speciesCode: SPECIES.CATTLE_ZEBU, facilityId: FACILITY_ATHI_RIVER, count: 195000, condemnations: 1350, periodStart: new Date('2025-07-01'), periodEnd: new Date('2025-12-31') },
    { seq: 203, speciesCode: SPECIES.SHEEP, facilityId: FACILITY_DAGORETTI, count: 120000, condemnations: 450, periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30') },
    { seq: 204, speciesCode: SPECIES.SHEEP, facilityId: FACILITY_ATHI_RIVER, count: 125000, condemnations: 480, periodStart: new Date('2025-07-01'), periodEnd: new Date('2025-12-31') },
    { seq: 205, speciesCode: SPECIES.GOAT, facilityId: FACILITY_DAGORETTI, count: 230000, condemnations: 890, periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30') },
    { seq: 206, speciesCode: SPECIES.GOAT, facilityId: FACILITY_ATHI_RIVER, count: 240000, condemnations: 920, periodStart: new Date('2025-07-01'), periodEnd: new Date('2025-12-31') },
    { seq: 207, speciesCode: SPECIES.PIG, facilityId: FACILITY_DAGORETTI, count: 45000, condemnations: 200, periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30') },
    { seq: 208, speciesCode: SPECIES.PIG, facilityId: FACILITY_ATHI_RIVER, count: 48000, condemnations: 220, periodStart: new Date('2025-07-01'), periodEnd: new Date('2025-12-31') },
    { seq: 209, speciesCode: SPECIES.CHICKEN, facilityId: FACILITY_DAGORETTI, count: 3200000, condemnations: 15000, periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30') },
    { seq: 210, speciesCode: SPECIES.CHICKEN, facilityId: FACILITY_ATHI_RIVER, count: 3400000, condemnations: 16000, periodStart: new Date('2025-07-01'), periodEnd: new Date('2025-12-31') },
  ];

  for (const s of slaughterData) {
    await prisma.slaughterRecord.upsert({
      where: { id: domainId(P, s.seq) },
      update: {},
      create: {
        id: domainId(P, s.seq),
        tenantId: TENANT_KE,
        speciesId: sp(s.speciesCode),
        facilityId: s.facilityId,
        count: s.count,
        condemnations: s.condemnations,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        geoEntityId: geo(GEO.NAIROBI),
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${slaughterData.length} slaughter records`);

  // ── Transhumance Corridors (3) ──
  console.log('  🐪 Transhumance corridors...');

  const corridors = [
    {
      seq: 301,
      name: 'Kenya-Somalia Pastoral Corridor',
      speciesCode: SPECIES.CAMEL,
      seasonality: 'DRY_SEASON',
      crossBorder: true,
      route: { type: 'LineString', coordinates: [[39.65, -0.45], [40.50, 0.00], [41.20, 0.50], [42.00, 1.00], [43.50, 2.00]] },
    },
    {
      seq: 302,
      name: 'Kenya-Tanzania Maasai Corridor',
      speciesCode: SPECIES.CATTLE_ZEBU,
      seasonality: 'WET_SEASON',
      crossBorder: true,
      route: { type: 'LineString', coordinates: [[36.08, -0.30], [36.20, -1.00], [36.50, -1.50], [36.80, -2.00], [37.00, -2.50]] },
    },
    {
      seq: 303,
      name: 'Laikipia-Samburu Seasonal Route',
      speciesCode: SPECIES.CATTLE_ZEBU,
      seasonality: 'DRY_SEASON',
      crossBorder: false,
      route: { type: 'LineString', coordinates: [[36.90, 0.00], [37.00, 0.30], [37.10, 0.60], [37.20, 0.90], [37.30, 1.20]] },
    },
  ];

  for (const c of corridors) {
    await prisma.transhumanceCorridor.upsert({
      where: { id: domainId(P, c.seq) },
      update: {},
      create: {
        id: domainId(P, c.seq),
        tenantId: TENANT_KE,
        name: c.name,
        route: c.route,
        speciesId: sp(c.speciesCode),
        seasonality: c.seasonality,
        crossBorder: c.crossBorder,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${corridors.length} transhumance corridors`);

  console.log('\n✅ livestock-prod seed complete!');
}

async function main(): Promise<void> {
  await seed();
}

main()
  .catch((error) => {
    console.error('❌ livestock-prod seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
