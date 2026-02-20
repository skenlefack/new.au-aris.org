import { PrismaClient } from '@prisma/client';
import {
  TENANT_KE,
  USER_KE_ADMIN,
  SPECIES,
  GEO,
  domainId,
  PREFIX,
  resolveMasterDataIds,
} from '../../../scripts/seed-constants';

const prisma = new PrismaClient();
const P = PREFIX.FISHERIES;

export async function seed(): Promise<void> {
  console.log('🐟 Seeding fisheries...\n');

  const { species, geoEntities } = await resolveMasterDataIds(prisma);
  const sp = (code: string) => species.get(code)!;
  const geo = (code: string) => geoEntities.get(code)!;

  // ── Fishing Vessels (5) ──
  console.log('  🚢 Fishing vessels...');

  const vessels = [
    { id: domainId(P, 1), name: 'Nyanza Star', registrationNumber: 'KE-LV-2021-001', flagState: 'KE', vesselType: 'ARTISANAL', lengthMeters: 6.5, tonnageGt: 1.2, homePort: 'Kisumu', licenseNumber: 'KE-FIS-LV-001', licenseExpiry: new Date('2026-06-30') },
    { id: domainId(P, 2), name: 'Lake Pioneer', registrationNumber: 'KE-LV-2022-015', flagState: 'KE', vesselType: 'ARTISANAL', lengthMeters: 8.0, tonnageGt: 2.5, homePort: 'Homa Bay', licenseNumber: 'KE-FIS-LV-015', licenseExpiry: new Date('2026-03-31') },
    { id: domainId(P, 3), name: 'Indian Ocean Trawler I', registrationNumber: 'KE-IO-2020-042', flagState: 'KE', vesselType: 'TRAWLER', lengthMeters: 24.0, tonnageGt: 85.0, homePort: 'Mombasa', licenseNumber: 'KE-FIS-IO-042', licenseExpiry: new Date('2026-12-31') },
    { id: domainId(P, 4), name: 'Pwani Purser', registrationNumber: 'KE-IO-2019-028', flagState: 'KE', vesselType: 'PURSE_SEINER', lengthMeters: 32.0, tonnageGt: 150.0, homePort: 'Mombasa', licenseNumber: 'KE-FIS-IO-028', licenseExpiry: new Date('2026-09-30') },
    { id: domainId(P, 5), name: 'Deep Blue Liner', registrationNumber: 'KE-IO-2023-055', flagState: 'KE', vesselType: 'LONGLINER', lengthMeters: 18.0, tonnageGt: 45.0, homePort: 'Malindi', licenseNumber: 'KE-FIS-IO-055', licenseExpiry: new Date('2027-01-31') },
  ];

  for (const v of vessels) {
    await prisma.fishingVessel.upsert({
      where: { id: v.id },
      update: {},
      create: {
        id: v.id,
        tenantId: TENANT_KE,
        name: v.name,
        registrationNumber: v.registrationNumber,
        flagState: v.flagState,
        vesselType: v.vesselType,
        lengthMeters: v.lengthMeters,
        tonnageGt: v.tonnageGt,
        homePort: v.homePort,
        licenseNumber: v.licenseNumber,
        licenseExpiry: v.licenseExpiry,
        isActive: true,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${vessels.length} fishing vessels`);

  // ── Fish Captures (15) ──
  console.log('  🎣 Fish captures...');

  const captures = [
    // Lake Victoria (8)
    { seq: 101, speciesCode: SPECIES.TILAPIA, faoAreaCode: '04.3', vesselId: domainId(P, 1), captureDate: new Date('2025-03-15'), quantityKg: 2500, gearType: 'GILLNET', landingSite: 'Kisumu', geoCode: GEO.KISUMU },
    { seq: 102, speciesCode: SPECIES.TILAPIA, faoAreaCode: '04.3', vesselId: domainId(P, 1), captureDate: new Date('2025-04-20'), quantityKg: 3200, gearType: 'GILLNET', landingSite: 'Kisumu', geoCode: GEO.KISUMU },
    { seq: 103, speciesCode: SPECIES.NILE_PERCH, faoAreaCode: '04.3', vesselId: domainId(P, 2), captureDate: new Date('2025-03-22'), quantityKg: 5800, gearType: 'GILLNET', landingSite: 'Homa Bay', geoCode: GEO.KISUMU },
    { seq: 104, speciesCode: SPECIES.NILE_PERCH, faoAreaCode: '04.3', vesselId: domainId(P, 2), captureDate: new Date('2025-05-10'), quantityKg: 4500, gearType: 'SEINE', landingSite: 'Homa Bay', geoCode: GEO.KISUMU },
    { seq: 105, speciesCode: SPECIES.TILAPIA, faoAreaCode: '04.3', vesselId: domainId(P, 1), captureDate: new Date('2025-06-05'), quantityKg: 1800, gearType: 'GILLNET', landingSite: 'Kisumu', geoCode: GEO.KISUMU },
    { seq: 106, speciesCode: SPECIES.CATFISH, faoAreaCode: '04.3', vesselId: null, captureDate: new Date('2025-04-12'), quantityKg: 900, gearType: 'LONGLINE', landingSite: 'Kisumu', geoCode: GEO.KISUMU },
    { seq: 107, speciesCode: SPECIES.NILE_PERCH, faoAreaCode: '04.3', vesselId: domainId(P, 2), captureDate: new Date('2025-07-18'), quantityKg: 6200, gearType: 'GILLNET', landingSite: 'Homa Bay', geoCode: GEO.KISUMU },
    { seq: 108, speciesCode: SPECIES.TILAPIA, faoAreaCode: '04.3', vesselId: null, captureDate: new Date('2025-08-01'), quantityKg: 1400, gearType: 'SEINE', landingSite: 'Kisumu', geoCode: GEO.KISUMU },
    // Indian Ocean (7)
    { seq: 109, speciesCode: SPECIES.TUNA, faoAreaCode: '51', vesselId: domainId(P, 5), captureDate: new Date('2025-02-20'), quantityKg: 12000, gearType: 'LONGLINE', landingSite: 'Malindi', geoCode: GEO.KILIFI },
    { seq: 110, speciesCode: SPECIES.PRAWN, faoAreaCode: '51', vesselId: domainId(P, 3), captureDate: new Date('2025-03-08'), quantityKg: 850, gearType: 'TRAWL', landingSite: 'Mombasa', geoCode: GEO.MOMBASA },
    { seq: 111, speciesCode: SPECIES.TUNA, faoAreaCode: '51', vesselId: domainId(P, 4), captureDate: new Date('2025-04-15'), quantityKg: 18500, gearType: 'SEINE', landingSite: 'Mombasa', geoCode: GEO.MOMBASA },
    { seq: 112, speciesCode: SPECIES.PRAWN, faoAreaCode: '51', vesselId: domainId(P, 3), captureDate: new Date('2025-05-22'), quantityKg: 1200, gearType: 'TRAWL', landingSite: 'Mombasa', geoCode: GEO.MOMBASA },
    { seq: 113, speciesCode: SPECIES.TUNA, faoAreaCode: '51', vesselId: domainId(P, 5), captureDate: new Date('2025-06-30'), quantityKg: 9800, gearType: 'LONGLINE', landingSite: 'Malindi', geoCode: GEO.KILIFI },
    { seq: 114, speciesCode: SPECIES.NILE_PERCH, faoAreaCode: '51', vesselId: domainId(P, 4), captureDate: new Date('2025-07-12'), quantityKg: 3500, gearType: 'SEINE', landingSite: 'Mombasa', geoCode: GEO.MOMBASA },
    { seq: 115, speciesCode: SPECIES.PRAWN, faoAreaCode: '51', vesselId: domainId(P, 3), captureDate: new Date('2025-08-25'), quantityKg: 1500, gearType: 'TRAWL', landingSite: 'Mombasa', geoCode: GEO.MOMBASA },
  ];

  for (const c of captures) {
    await prisma.fishCapture.upsert({
      where: { id: domainId(P, c.seq) },
      update: {},
      create: {
        id: domainId(P, c.seq),
        tenantId: TENANT_KE,
        geoEntityId: geo(c.geoCode),
        speciesId: sp(c.speciesCode),
        faoAreaCode: c.faoAreaCode,
        vesselId: c.vesselId,
        captureDate: c.captureDate,
        quantityKg: c.quantityKg,
        gearType: c.gearType,
        landingSite: c.landingSite,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${captures.length} fish captures`);

  // ── Aquaculture Farms (3) ──
  console.log('  🏞️ Aquaculture farms...');

  const farms = [
    { id: domainId(P, 201), name: 'Sagana Trout Farm', geoCode: GEO.MERU, coordinates: { lat: -0.67, lng: 37.21 }, farmType: 'POND', waterSource: 'FRESHWATER', areaHectares: 12.5, speciesCodes: [SPECIES.TILAPIA], productionCapacityTonnes: 150 },
    { id: domainId(P, 202), name: 'Kisumu Cage Farm', geoCode: GEO.KISUMU, coordinates: { lat: -0.10, lng: 34.75 }, farmType: 'CAGE', waterSource: 'FRESHWATER', areaHectares: 5.0, speciesCodes: [SPECIES.TILAPIA, SPECIES.CATFISH], productionCapacityTonnes: 80 },
    { id: domainId(P, 203), name: 'Mombasa Prawn Farm', geoCode: GEO.MOMBASA, coordinates: { lat: -4.03, lng: 39.62 }, farmType: 'POND', waterSource: 'BRACKISH', areaHectares: 25.0, speciesCodes: [SPECIES.PRAWN], productionCapacityTonnes: 200 },
  ];

  for (const f of farms) {
    await prisma.aquacultureFarm.upsert({
      where: { id: f.id },
      update: {},
      create: {
        id: f.id,
        tenantId: TENANT_KE,
        name: f.name,
        geoEntityId: geo(f.geoCode),
        coordinates: f.coordinates,
        farmType: f.farmType,
        waterSource: f.waterSource,
        areaHectares: f.areaHectares,
        speciesIds: f.speciesCodes.map((c) => sp(c)),
        productionCapacityTonnes: f.productionCapacityTonnes,
        isActive: true,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${farms.length} aquaculture farms`);

  // ── Aquaculture Production (5) ──
  console.log('  📈 Aquaculture production...');

  const aquaProduction = [
    { seq: 301, farmId: domainId(P, 201), speciesCode: SPECIES.TILAPIA, harvestDate: new Date('2025-03-15'), quantityKg: 12500, methodOfCulture: 'POND_CULTURE', feedUsedKg: 18750, fcr: 1.5, batchId: 'SAG-2025-Q1' },
    { seq: 302, farmId: domainId(P, 201), speciesCode: SPECIES.TILAPIA, harvestDate: new Date('2025-06-20'), quantityKg: 15000, methodOfCulture: 'POND_CULTURE', feedUsedKg: 21000, fcr: 1.4, batchId: 'SAG-2025-Q2' },
    { seq: 303, farmId: domainId(P, 202), speciesCode: SPECIES.TILAPIA, harvestDate: new Date('2025-04-10'), quantityKg: 8000, methodOfCulture: 'CAGE_CULTURE', feedUsedKg: 13600, fcr: 1.7, batchId: 'KIS-2025-Q1' },
    { seq: 304, farmId: domainId(P, 202), speciesCode: SPECIES.CATFISH, harvestDate: new Date('2025-07-25'), quantityKg: 5500, methodOfCulture: 'CAGE_CULTURE', feedUsedKg: 8250, fcr: 1.5, batchId: 'KIS-2025-Q2' },
    { seq: 305, farmId: domainId(P, 203), speciesCode: SPECIES.PRAWN, harvestDate: new Date('2025-05-30'), quantityKg: 18000, methodOfCulture: 'POND_CULTURE', feedUsedKg: 32400, fcr: 1.8, batchId: 'MBS-2025-Q2' },
  ];

  for (const ap of aquaProduction) {
    await prisma.aquacultureProduction.upsert({
      where: { id: domainId(P, ap.seq) },
      update: {},
      create: {
        id: domainId(P, ap.seq),
        tenantId: TENANT_KE,
        farmId: ap.farmId,
        speciesId: sp(ap.speciesCode),
        harvestDate: ap.harvestDate,
        quantityKg: ap.quantityKg,
        methodOfCulture: ap.methodOfCulture,
        feedUsedKg: ap.feedUsedKg,
        fcr: ap.fcr,
        batchId: ap.batchId,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${aquaProduction.length} aquaculture productions`);

  console.log('\n✅ fisheries seed complete!');
}

async function main(): Promise<void> {
  await seed();
}

main()
  .catch((error) => {
    console.error('❌ fisheries seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
