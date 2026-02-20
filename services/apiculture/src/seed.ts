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
const P = PREFIX.APICULTURE;

export async function seed(): Promise<void> {
  console.log('🐝 Seeding apiculture...\n');

  const { geoEntities } = await resolveMasterDataIds(prisma);
  const geo = (code: string) => geoEntities.get(code)!;

  // ── Apiaries (5) ──
  console.log('  🏡 Apiaries...');

  const apiaries = [
    { id: domainId(P, 1), name: 'Kitui Community Apiary', geoCode: GEO.NAIROBI, latitude: -1.37, longitude: 38.01, hiveCount: 80, hiveType: 'LANGSTROTH', ownerName: 'Kitui Beekeepers Cooperative' },
    { id: domainId(P, 2), name: 'Baringo Honey Farm', geoCode: GEO.NAKURU, latitude: 0.47, longitude: 35.97, hiveCount: 120, hiveType: 'KTB', ownerName: 'Baringo Bee Farmers Association' },
    { id: domainId(P, 3), name: 'Mwingi Top Bar Apiary', geoCode: GEO.NAIROBI, latitude: -0.93, longitude: 38.06, hiveCount: 60, hiveType: 'TOP_BAR', ownerName: 'Mwingi Rural Development Group' },
    { id: domainId(P, 4), name: 'West Pokot Traditional Apiary', geoCode: GEO.NAKURU, latitude: 1.24, longitude: 35.11, hiveCount: 45, hiveType: 'TRADITIONAL', ownerName: 'Pokot Pastoralist Beekeepers' },
    { id: domainId(P, 5), name: 'Meru Highland Apiary', geoCode: GEO.MERU, latitude: 0.05, longitude: 37.65, hiveCount: 100, hiveType: 'LANGSTROTH', ownerName: 'Meru Highlands Honey Company' },
  ];

  for (const a of apiaries) {
    await prisma.apiary.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        tenantId: TENANT_KE,
        name: a.name,
        geoEntityId: geo(a.geoCode),
        latitude: a.latitude,
        longitude: a.longitude,
        hiveCount: a.hiveCount,
        hiveType: a.hiveType,
        ownerName: a.ownerName,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${apiaries.length} apiaries`);

  // ── Honey Productions (5) ──
  console.log('  🍯 Honey production...');

  const honeyProductions = [
    { seq: 101, apiaryId: domainId(P, 1), harvestDate: new Date('2025-04-15'), quantity: 480, unit: 'KG', quality: 'GRADE_A', floralSource: 'Acacia' },
    { seq: 102, apiaryId: domainId(P, 2), harvestDate: new Date('2025-05-20'), quantity: 720, unit: 'KG', quality: 'GRADE_A', floralSource: 'Wildflower' },
    { seq: 103, apiaryId: domainId(P, 3), harvestDate: new Date('2025-06-10'), quantity: 280, unit: 'KG', quality: 'GRADE_B', floralSource: 'Acacia' },
    { seq: 104, apiaryId: domainId(P, 4), harvestDate: new Date('2025-07-05'), quantity: 200, unit: 'KG', quality: 'GRADE_B', floralSource: 'Eucalyptus' },
    { seq: 105, apiaryId: domainId(P, 5), harvestDate: new Date('2025-08-15'), quantity: 800, unit: 'KG', quality: 'GRADE_A', floralSource: 'Eucalyptus' },
  ];

  for (const hp of honeyProductions) {
    await prisma.honeyProduction.upsert({
      where: { id: domainId(P, hp.seq) },
      update: {},
      create: {
        id: domainId(P, hp.seq),
        tenantId: TENANT_KE,
        apiaryId: hp.apiaryId,
        harvestDate: hp.harvestDate,
        quantity: hp.quantity,
        unit: hp.unit,
        quality: hp.quality,
        floralSource: hp.floralSource,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${honeyProductions.length} honey productions`);

  // ── Colony Health (5) ──
  console.log('  🔍 Colony health inspections...');

  const colonyHealths = [
    { seq: 201, apiaryId: domainId(P, 1), inspectionDate: new Date('2025-03-10'), colonyStrength: 'STRONG', diseases: ['NONE'], treatments: [] },
    { seq: 202, apiaryId: domainId(P, 2), inspectionDate: new Date('2025-04-15'), colonyStrength: 'STRONG', diseases: ['NONE'], treatments: [] },
    { seq: 203, apiaryId: domainId(P, 3), inspectionDate: new Date('2025-05-20'), colonyStrength: 'MEDIUM', diseases: ['VARROA'], treatments: ['OXALIC_ACID'] },
    { seq: 204, apiaryId: domainId(P, 4), inspectionDate: new Date('2025-06-10'), colonyStrength: 'WEAK', diseases: ['NOSEMA'], treatments: ['FUMAGILLIN'] },
    { seq: 205, apiaryId: domainId(P, 5), inspectionDate: new Date('2025-07-25'), colonyStrength: 'MEDIUM', diseases: ['VARROA'], treatments: ['FORMIC_ACID'] },
  ];

  for (const ch of colonyHealths) {
    await prisma.colonyHealth.upsert({
      where: { id: domainId(P, ch.seq) },
      update: {},
      create: {
        id: domainId(P, ch.seq),
        tenantId: TENANT_KE,
        apiaryId: ch.apiaryId,
        inspectionDate: ch.inspectionDate,
        colonyStrength: ch.colonyStrength,
        diseases: ch.diseases,
        treatments: ch.treatments,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${colonyHealths.length} colony health inspections`);

  // ── Beekeeper Trainings (5) ──
  console.log('  🎓 Beekeeper trainings...');

  const trainings = [
    { seq: 301, beekeeperId: domainId(P, 801), trainingType: 'BASIC', completedDate: new Date('2024-06-15'), certificationNumber: 'KE-BKT-2024-001' },
    { seq: 302, beekeeperId: domainId(P, 802), trainingType: 'BASIC', completedDate: new Date('2024-08-20'), certificationNumber: 'KE-BKT-2024-002' },
    { seq: 303, beekeeperId: domainId(P, 803), trainingType: 'ADVANCED', completedDate: new Date('2025-01-10'), certificationNumber: 'KE-BKT-2025-001' },
    { seq: 304, beekeeperId: domainId(P, 804), trainingType: 'BASIC', completedDate: new Date('2025-03-05'), certificationNumber: 'KE-BKT-2025-002' },
    { seq: 305, beekeeperId: domainId(P, 805), trainingType: 'ADVANCED', completedDate: new Date('2025-05-20'), certificationNumber: 'KE-BKT-2025-003' },
  ];

  for (const t of trainings) {
    await prisma.beekeeperTraining.upsert({
      where: { id: domainId(P, t.seq) },
      update: {},
      create: {
        id: domainId(P, t.seq),
        tenantId: TENANT_KE,
        beekeeperId: t.beekeeperId,
        trainingType: t.trainingType,
        completedDate: t.completedDate,
        certificationNumber: t.certificationNumber,
        dataClassification: 'PUBLIC',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${trainings.length} beekeeper trainings`);

  console.log('\n✅ apiculture seed complete!');
}

async function main(): Promise<void> {
  await seed();
}

main()
  .catch((error) => {
    console.error('❌ apiculture seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
