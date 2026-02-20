import { PrismaClient } from '@prisma/client';
import {
  TENANT_KE,
  USER_KE_ADMIN,
  GEO,
  domainId,
  PREFIX,
  resolveMasterDataIds,
} from '../../../scripts/seed-constants';

const prisma = new PrismaClient();
const P = PREFIX.CLIMATE;

export async function seed(): Promise<void> {
  console.log('🌍 Seeding climate-env...\n');

  const { geoEntities } = await resolveMasterDataIds(prisma);
  const geo = (code: string) => geoEntities.get(code)!;

  // ── Water Stress Indexes (5) ──
  console.log('  💧 Water stress indexes...');

  const waterStress = [
    { seq: 1, geoCode: GEO.GARISSA, period: '2025-Q4', index: 78.0, waterAvailability: 'SCARCE', irrigatedAreaPct: 2.5, source: 'WRI Aqueduct' },
    { seq: 2, geoCode: GEO.MARSABIT, period: '2025-Q4', index: 72.0, waterAvailability: 'SCARCE', irrigatedAreaPct: 1.8, source: 'WRI Aqueduct' },
    { seq: 3, geoCode: GEO.NAKURU, period: '2025-Q4', index: 45.0, waterAvailability: 'MODERATE', irrigatedAreaPct: 12.5, source: 'WRI Aqueduct' },
    { seq: 4, geoCode: GEO.KIAMBU, period: '2025-Q4', index: 25.0, waterAvailability: 'ADEQUATE', irrigatedAreaPct: 22.0, source: 'WRI Aqueduct' },
    { seq: 5, geoCode: GEO.MOMBASA, period: '2025-Q4', index: 38.0, waterAvailability: 'MODERATE', irrigatedAreaPct: 8.0, source: 'WRI Aqueduct' },
  ];

  for (const ws of waterStress) {
    const geoEntityId = geo(ws.geoCode);
    await prisma.waterStressIndex.upsert({
      where: { tenantId_geoEntityId_period: { tenantId: TENANT_KE, geoEntityId, period: ws.period } },
      update: {},
      create: {
        id: domainId(P, ws.seq),
        tenantId: TENANT_KE,
        geoEntityId,
        period: ws.period,
        index: ws.index,
        waterAvailability: ws.waterAvailability,
        irrigatedAreaPct: ws.irrigatedAreaPct,
        source: ws.source,
        dataClassification: 'PUBLIC',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${waterStress.length} water stress indexes`);

  // ── Rangeland Conditions (5) ──
  console.log('  🌾 Rangeland conditions...');

  const rangelandConditions = [
    { seq: 101, geoCode: GEO.NAKURU, assessmentDate: new Date('2025-10-15'), ndviIndex: 0.45, biomassTonsPerHa: 2.8, degradationLevel: 'LIGHT', carryingCapacity: 4.5 },
    { seq: 102, geoCode: GEO.NAIROBI, assessmentDate: new Date('2025-10-15'), ndviIndex: 0.32, biomassTonsPerHa: 1.5, degradationLevel: 'MODERATE', carryingCapacity: 2.0 },
    { seq: 103, geoCode: GEO.MARSABIT, assessmentDate: new Date('2025-10-15'), ndviIndex: 0.28, biomassTonsPerHa: 1.0, degradationLevel: 'SEVERE', carryingCapacity: 1.2 },
    { seq: 104, geoCode: GEO.NAKURU, assessmentDate: new Date('2025-07-15'), ndviIndex: 0.55, biomassTonsPerHa: 3.5, degradationLevel: 'NONE', carryingCapacity: 6.0 },
    { seq: 105, geoCode: GEO.GARISSA, assessmentDate: new Date('2025-10-15'), ndviIndex: 0.22, biomassTonsPerHa: 0.8, degradationLevel: 'SEVERE', carryingCapacity: 0.8 },
  ];

  for (const rc of rangelandConditions) {
    await prisma.rangelandCondition.upsert({
      where: { id: domainId(P, rc.seq) },
      update: {},
      create: {
        id: domainId(P, rc.seq),
        tenantId: TENANT_KE,
        geoEntityId: geo(rc.geoCode),
        assessmentDate: rc.assessmentDate,
        ndviIndex: rc.ndviIndex,
        biomassTonsPerHa: rc.biomassTonsPerHa,
        degradationLevel: rc.degradationLevel,
        carryingCapacity: rc.carryingCapacity,
        dataClassification: 'PUBLIC',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${rangelandConditions.length} rangeland conditions`);

  // ── Environmental Hotspots (5) ──
  console.log('  🔥 Environmental hotspots...');

  const hotspots = [
    { seq: 201, geoCode: GEO.NAKURU, type: 'DEFORESTATION', severity: 'HIGH', detectedDate: new Date('2025-06-01'), satelliteSource: 'Sentinel-2', affectedSpecies: ['BOS-TAU', 'CAP-HIR'] },
    { seq: 202, geoCode: GEO.GARISSA, type: 'DROUGHT', severity: 'CRITICAL', detectedDate: new Date('2025-09-15'), satelliteSource: 'CHIRPS', affectedSpecies: ['CAM-DRO', 'CAP-HIR', 'OVI-ARI'] },
    { seq: 203, geoCode: GEO.KILIFI, type: 'FLOODING', severity: 'MEDIUM', detectedDate: new Date('2025-11-20'), satelliteSource: 'Sentinel-1', affectedSpecies: ['BOS-IND', 'OVI-ARI'] },
    { seq: 204, geoCode: GEO.NAKURU, type: 'POLLUTION', severity: 'MEDIUM', detectedDate: new Date('2025-08-10'), satelliteSource: 'Landsat-9', affectedSpecies: ['ORE-NIL', 'HIP-AMP'] },
    { seq: 205, geoCode: GEO.MARSABIT, type: 'DESERTIFICATION', severity: 'HIGH', detectedDate: new Date('2025-07-01'), satelliteSource: 'MODIS', affectedSpecies: ['CAM-DRO', 'BOS-IND', 'CAP-HIR'] },
  ];

  for (const hs of hotspots) {
    await prisma.environmentalHotspot.upsert({
      where: { id: domainId(P, hs.seq) },
      update: {},
      create: {
        id: domainId(P, hs.seq),
        tenantId: TENANT_KE,
        geoEntityId: geo(hs.geoCode),
        type: hs.type,
        severity: hs.severity,
        detectedDate: hs.detectedDate,
        satelliteSource: hs.satelliteSource,
        affectedSpecies: hs.affectedSpecies,
        dataClassification: 'PUBLIC',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${hotspots.length} environmental hotspots`);

  // ── Climate Data Points (10): 5 stations × 2 months ──
  console.log('  🌡️ Climate data points...');

  const stations = [
    { geoCode: GEO.NAIROBI, name: 'Nairobi' },
    { geoCode: GEO.MOMBASA, name: 'Mombasa' },
    { geoCode: GEO.KISUMU, name: 'Kisumu' },
    { geoCode: GEO.GARISSA, name: 'Garissa' },
    { geoCode: GEO.MARSABIT, name: 'Lodwar' },
  ];

  // January 2026 data
  const janData = [
    { temp: 20.5, rainfall: 45.0, humidity: 65.0, windSpeed: 8.2 },   // Nairobi
    { temp: 28.8, rainfall: 12.0, humidity: 78.0, windSpeed: 12.5 },  // Mombasa
    { temp: 24.2, rainfall: 85.0, humidity: 72.0, windSpeed: 6.8 },   // Kisumu
    { temp: 32.5, rainfall: 2.0, humidity: 35.0, windSpeed: 15.0 },   // Garissa
    { temp: 35.2, rainfall: 0.5, humidity: 22.0, windSpeed: 18.5 },   // Lodwar
  ];

  // February 2026 data
  const febData = [
    { temp: 21.2, rainfall: 38.0, humidity: 62.0, windSpeed: 7.8 },   // Nairobi
    { temp: 29.5, rainfall: 8.0, humidity: 75.0, windSpeed: 11.0 },   // Mombasa
    { temp: 25.0, rainfall: 95.0, humidity: 75.0, windSpeed: 7.2 },   // Kisumu
    { temp: 33.8, rainfall: 0.0, humidity: 30.0, windSpeed: 16.5 },   // Garissa
    { temp: 36.0, rainfall: 0.0, humidity: 18.0, windSpeed: 20.0 },   // Lodwar
  ];

  let cdpSeq = 301;
  for (let s = 0; s < stations.length; s++) {
    // January
    await prisma.climateDataPoint.upsert({
      where: { id: domainId(P, cdpSeq) },
      update: {},
      create: {
        id: domainId(P, cdpSeq),
        tenantId: TENANT_KE,
        geoEntityId: geo(stations[s].geoCode),
        date: new Date('2026-01-15'),
        temperature: janData[s].temp,
        rainfall: janData[s].rainfall,
        humidity: janData[s].humidity,
        windSpeed: janData[s].windSpeed,
        source: 'CHIRPS/NOAA',
        dataClassification: 'PUBLIC',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
    cdpSeq++;

    // February
    await prisma.climateDataPoint.upsert({
      where: { id: domainId(P, cdpSeq) },
      update: {},
      create: {
        id: domainId(P, cdpSeq),
        tenantId: TENANT_KE,
        geoEntityId: geo(stations[s].geoCode),
        date: new Date('2026-02-15'),
        temperature: febData[s].temp,
        rainfall: febData[s].rainfall,
        humidity: febData[s].humidity,
        windSpeed: febData[s].windSpeed,
        source: 'CHIRPS/NOAA',
        dataClassification: 'PUBLIC',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
    cdpSeq++;
  }
  console.log(`  ✓ 10 climate data points`);

  console.log('\n✅ climate-env seed complete!');
}

async function main(): Promise<void> {
  await seed();
}

main()
  .catch((error) => {
    console.error('❌ climate-env seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
