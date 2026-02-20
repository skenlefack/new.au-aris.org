import { PrismaClient } from '@prisma/client';
import {
  TENANT_KE,
  USER_KE_ADMIN,
  SPECIES,
  DISEASE,
  GEO,
  domainId,
  PREFIX,
  resolveMasterDataIds,
} from '../../../scripts/seed-constants';

const prisma = new PrismaClient();
const P = PREFIX.ANIMAL_HEALTH;

export async function seed(): Promise<void> {
  console.log('🏥 Seeding animal-health...\n');

  const { species, diseases, geoEntities } = await resolveMasterDataIds(prisma);

  // Helper to get ID or throw
  const sp = (code: string) => species.get(code)!;
  const ds = (code: string) => diseases.get(code)!;
  const geo = (code: string) => geoEntities.get(code)!;

  // ── Health Events (15) ──
  console.log('  📋 Health events...');

  const healthEvents = [
    // 5 FMD events
    { id: domainId(P, 1), diseaseId: ds(DISEASE.FMD), eventType: 'CONFIRMED', speciesIds: [sp(SPECIES.CATTLE_ZEBU)], dateSuspicion: new Date('2025-06-10'), dateConfirmation: new Date('2025-06-15'), geoEntityId: geo(GEO.NAKURU), latitude: -0.28, longitude: 36.07, holdingsAffected: 12, susceptible: 3500, cases: 180, deaths: 15, controlMeasures: ['QUARANTINE', 'MOVEMENT_CONTROL', 'RING_VACCINATION'], confidenceLevel: 'CONFIRMED' },
    { id: domainId(P, 2), diseaseId: ds(DISEASE.FMD), eventType: 'SUSPECT', speciesIds: [sp(SPECIES.CATTLE_TAURINE), sp(SPECIES.GOAT)], dateSuspicion: new Date('2025-07-02'), geoEntityId: geo(GEO.NAIROBI), latitude: -1.30, longitude: 36.85, holdingsAffected: 3, susceptible: 800, cases: 45, deaths: 2, controlMeasures: ['QUARANTINE'], confidenceLevel: 'VERIFIED' },
    { id: domainId(P, 3), diseaseId: ds(DISEASE.FMD), eventType: 'CONFIRMED', speciesIds: [sp(SPECIES.CATTLE_ZEBU)], dateSuspicion: new Date('2025-05-18'), dateConfirmation: new Date('2025-05-25'), dateClosure: new Date('2025-07-10'), geoEntityId: geo(GEO.KIAMBU), latitude: -1.17, longitude: 36.83, holdingsAffected: 8, susceptible: 2200, cases: 320, deaths: 28, controlMeasures: ['QUARANTINE', 'MOVEMENT_CONTROL', 'DISINFECTION'], confidenceLevel: 'CONFIRMED' },
    { id: domainId(P, 4), diseaseId: ds(DISEASE.FMD), eventType: 'RESOLVED', speciesIds: [sp(SPECIES.CATTLE_ZEBU), sp(SPECIES.SHEEP)], dateSuspicion: new Date('2025-03-05'), dateConfirmation: new Date('2025-03-10'), dateClosure: new Date('2025-05-20'), geoEntityId: geo(GEO.MOMBASA), latitude: -4.05, longitude: 39.67, holdingsAffected: 5, susceptible: 1200, cases: 95, deaths: 8, controlMeasures: ['QUARANTINE', 'RING_VACCINATION'], confidenceLevel: 'CONFIRMED' },
    { id: domainId(P, 5), diseaseId: ds(DISEASE.FMD), eventType: 'SUSPECT', speciesIds: [sp(SPECIES.GOAT)], dateSuspicion: new Date('2025-08-12'), geoEntityId: geo(GEO.KISUMU), latitude: -0.09, longitude: 34.77, holdingsAffected: 2, susceptible: 500, cases: 22, deaths: 0, controlMeasures: ['QUARANTINE'], confidenceLevel: 'RUMOR' },
    // 3 PPR events
    { id: domainId(P, 6), diseaseId: ds(DISEASE.PPR), eventType: 'CONFIRMED', speciesIds: [sp(SPECIES.GOAT)], dateSuspicion: new Date('2025-04-15'), dateConfirmation: new Date('2025-04-22'), geoEntityId: geo(GEO.GARISSA), latitude: -0.45, longitude: 39.65, holdingsAffected: 20, susceptible: 8000, cases: 500, deaths: 85, controlMeasures: ['QUARANTINE', 'VACCINATION'], confidenceLevel: 'CONFIRMED' },
    { id: domainId(P, 7), diseaseId: ds(DISEASE.PPR), eventType: 'SUSPECT', speciesIds: [sp(SPECIES.SHEEP), sp(SPECIES.GOAT)], dateSuspicion: new Date('2025-06-28'), geoEntityId: geo(GEO.MARSABIT), latitude: 2.33, longitude: 37.99, holdingsAffected: 15, susceptible: 5000, cases: 280, deaths: 42, controlMeasures: ['QUARANTINE', 'MOVEMENT_CONTROL'], confidenceLevel: 'VERIFIED' },
    { id: domainId(P, 8), diseaseId: ds(DISEASE.PPR), eventType: 'CONFIRMED', speciesIds: [sp(SPECIES.GOAT)], dateSuspicion: new Date('2025-02-10'), dateConfirmation: new Date('2025-02-18'), dateClosure: new Date('2025-04-30'), geoEntityId: geo(GEO.GARISSA), latitude: -0.50, longitude: 39.70, holdingsAffected: 10, susceptible: 3200, cases: 150, deaths: 25, controlMeasures: ['VACCINATION', 'QUARANTINE'], confidenceLevel: 'CONFIRMED' },
    // 2 RVF events
    { id: domainId(P, 9), diseaseId: ds(DISEASE.RVF), eventType: 'CONFIRMED', speciesIds: [sp(SPECIES.CATTLE_ZEBU), sp(SPECIES.SHEEP)], dateSuspicion: new Date('2025-11-05'), dateConfirmation: new Date('2025-11-12'), geoEntityId: geo(GEO.KILIFI), latitude: -3.51, longitude: 39.91, holdingsAffected: 25, susceptible: 12000, cases: 450, deaths: 120, controlMeasures: ['QUARANTINE', 'VECTOR_CONTROL', 'MOVEMENT_CONTROL'], confidenceLevel: 'CONFIRMED' },
    { id: domainId(P, 10), diseaseId: ds(DISEASE.RVF), eventType: 'SUSPECT', speciesIds: [sp(SPECIES.CATTLE_ZEBU), sp(SPECIES.GOAT)], dateSuspicion: new Date('2025-11-20'), geoEntityId: geo(GEO.GARISSA), latitude: -0.40, longitude: 39.60, holdingsAffected: 8, susceptible: 4000, cases: 85, deaths: 18, controlMeasures: ['QUARANTINE', 'VECTOR_CONTROL'], confidenceLevel: 'VERIFIED' },
    // 2 CBPP events
    { id: domainId(P, 11), diseaseId: ds(DISEASE.CBPP), eventType: 'CONFIRMED', speciesIds: [sp(SPECIES.CATTLE_ZEBU)], dateSuspicion: new Date('2025-05-01'), dateConfirmation: new Date('2025-05-10'), geoEntityId: geo(GEO.NAKURU), latitude: -0.35, longitude: 36.10, holdingsAffected: 6, susceptible: 1800, cases: 75, deaths: 12, controlMeasures: ['QUARANTINE', 'SLAUGHTER'], confidenceLevel: 'CONFIRMED' },
    { id: domainId(P, 12), diseaseId: ds(DISEASE.CBPP), eventType: 'SUSPECT', speciesIds: [sp(SPECIES.CATTLE_ZEBU)], dateSuspicion: new Date('2025-08-22'), geoEntityId: geo(GEO.NAIROBI), latitude: -1.35, longitude: 36.90, holdingsAffected: 3, susceptible: 600, cases: 18, deaths: 2, controlMeasures: ['QUARANTINE'], confidenceLevel: 'RUMOR' },
    // 3 ASF events
    { id: domainId(P, 13), diseaseId: ds(DISEASE.ASF), eventType: 'CONFIRMED', speciesIds: [sp(SPECIES.PIG)], dateSuspicion: new Date('2025-07-15'), dateConfirmation: new Date('2025-07-20'), geoEntityId: geo(GEO.KIAMBU), latitude: -1.15, longitude: 36.80, holdingsAffected: 4, susceptible: 350, cases: 120, deaths: 95, killed: 230, controlMeasures: ['QUARANTINE', 'SLAUGHTER', 'DISINFECTION'], confidenceLevel: 'CONFIRMED' },
    { id: domainId(P, 14), diseaseId: ds(DISEASE.ASF), eventType: 'CONFIRMED', speciesIds: [sp(SPECIES.PIG)], dateSuspicion: new Date('2025-08-01'), dateConfirmation: new Date('2025-08-08'), geoEntityId: geo(GEO.NAKURU), latitude: -0.32, longitude: 36.05, holdingsAffected: 2, susceptible: 180, cases: 55, deaths: 40, killed: 140, controlMeasures: ['QUARANTINE', 'SLAUGHTER'], confidenceLevel: 'CONFIRMED' },
    { id: domainId(P, 15), diseaseId: ds(DISEASE.ASF), eventType: 'SUSPECT', speciesIds: [sp(SPECIES.PIG)], dateSuspicion: new Date('2025-09-10'), geoEntityId: geo(GEO.KISUMU), latitude: -0.10, longitude: 34.78, holdingsAffected: 1, susceptible: 80, cases: 15, deaths: 10, controlMeasures: ['QUARANTINE'], confidenceLevel: 'VERIFIED' },
  ];

  for (const evt of healthEvents) {
    await prisma.healthEvent.upsert({
      where: { id: evt.id },
      update: {},
      create: {
        id: evt.id,
        tenantId: TENANT_KE,
        diseaseId: evt.diseaseId,
        eventType: evt.eventType,
        speciesIds: evt.speciesIds,
        dateSuspicion: evt.dateSuspicion,
        dateOnset: evt.dateSuspicion,
        dateConfirmation: evt.dateConfirmation ?? null,
        dateClosure: evt.dateClosure ?? null,
        geoEntityId: evt.geoEntityId,
        latitude: evt.latitude,
        longitude: evt.longitude,
        holdingsAffected: evt.holdingsAffected,
        susceptible: evt.susceptible,
        cases: evt.cases,
        deaths: evt.deaths,
        killed: evt.killed ?? 0,
        slaughtered: 0,
        controlMeasures: evt.controlMeasures,
        confidenceLevel: evt.confidenceLevel,
        dataClassification: 'RESTRICTED',
        wahisReady: evt.eventType === 'CONFIRMED',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${healthEvents.length} health events`);

  // ── Lab Results (10) ──
  console.log('  🔬 Lab results...');

  const labResults = [
    { id: domainId(P, 101), sampleId: 'KE-LAB-2025-001', sampleType: 'Epithelial tissue', dateCollected: new Date('2025-06-11'), dateReceived: new Date('2025-06-13'), testType: 'PCR', result: 'POSITIVE', turnaroundDays: 3, healthEventId: domainId(P, 1) },
    { id: domainId(P, 102), sampleId: 'KE-LAB-2025-002', sampleType: 'Serum', dateCollected: new Date('2025-07-03'), dateReceived: new Date('2025-07-05'), testType: 'ELISA', result: 'NEGATIVE', turnaroundDays: 5, healthEventId: domainId(P, 2) },
    { id: domainId(P, 103), sampleId: 'KE-LAB-2025-003', sampleType: 'Epithelial tissue', dateCollected: new Date('2025-05-19'), dateReceived: new Date('2025-05-21'), testType: 'PCR', result: 'POSITIVE', turnaroundDays: 4, healthEventId: domainId(P, 3) },
    { id: domainId(P, 104), sampleId: 'KE-LAB-2025-004', sampleType: 'Serum', dateCollected: new Date('2025-03-06'), dateReceived: new Date('2025-03-09'), testType: 'CFT', result: 'POSITIVE', turnaroundDays: 7, healthEventId: domainId(P, 4) },
    { id: domainId(P, 105), sampleId: 'KE-LAB-2025-005', sampleType: 'Nasal swab', dateCollected: new Date('2025-08-13'), dateReceived: new Date('2025-08-15'), testType: 'PCR', result: 'INCONCLUSIVE', turnaroundDays: 4, healthEventId: domainId(P, 5) },
    { id: domainId(P, 106), sampleId: 'KE-LAB-2025-006', sampleType: 'Nasal swab', dateCollected: new Date('2025-04-16'), dateReceived: new Date('2025-04-20'), testType: 'PCR', result: 'POSITIVE', turnaroundDays: 6, healthEventId: domainId(P, 6) },
    { id: domainId(P, 107), sampleId: 'KE-LAB-2025-007', sampleType: 'Serum', dateCollected: new Date('2025-06-29'), dateReceived: new Date('2025-07-03'), testType: 'ELISA', result: 'INCONCLUSIVE', turnaroundDays: 8, healthEventId: domainId(P, 7) },
    { id: domainId(P, 108), sampleId: 'KE-LAB-2025-008', sampleType: 'Whole blood', dateCollected: new Date('2025-02-11'), dateReceived: new Date('2025-02-14'), testType: 'PCR', result: 'NEGATIVE', turnaroundDays: 5, healthEventId: domainId(P, 8) },
    { id: domainId(P, 109), sampleId: 'KE-LAB-2025-009', sampleType: 'Serum', dateCollected: new Date('2025-11-06'), dateReceived: new Date('2025-11-10'), testType: 'ELISA', result: 'NEGATIVE', turnaroundDays: 6, healthEventId: domainId(P, 9) },
    { id: domainId(P, 110), sampleId: 'KE-LAB-2025-010', sampleType: 'Whole blood', dateCollected: new Date('2025-11-21'), dateReceived: new Date('2025-11-25'), testType: 'PCR', result: 'INCONCLUSIVE', turnaroundDays: 14, healthEventId: domainId(P, 10) },
  ];

  const labId = domainId(P, 900); // Central Veterinary Lab Kenya
  for (const lr of labResults) {
    await prisma.labResult.upsert({
      where: { id: lr.id },
      update: {},
      create: {
        id: lr.id,
        tenantId: TENANT_KE,
        sampleId: lr.sampleId,
        sampleType: lr.sampleType,
        dateCollected: lr.dateCollected,
        dateReceived: lr.dateReceived,
        testType: lr.testType,
        result: lr.result,
        labId,
        turnaroundDays: lr.turnaroundDays,
        eqaFlag: false,
        healthEventId: lr.healthEventId,
        dataClassification: 'RESTRICTED',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${labResults.length} lab results`);

  // ── Surveillance Activities (5) ──
  console.log('  🔎 Surveillance activities...');

  const surveillances = [
    { id: domainId(P, 201), type: 'PASSIVE', diseaseId: ds(DISEASE.FMD), sampleSize: 0, positivityRate: 2.5, periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30'), geoEntityId: geo(GEO.NAKURU) },
    { id: domainId(P, 202), type: 'PASSIVE', diseaseId: ds(DISEASE.PPR), sampleSize: 0, positivityRate: 1.8, periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30'), geoEntityId: geo(GEO.GARISSA) },
    { id: domainId(P, 203), type: 'ACTIVE', diseaseId: ds(DISEASE.FMD), designType: 'RISK_BASED', sampleSize: 2500, positivityRate: 4.2, periodStart: new Date('2025-03-01'), periodEnd: new Date('2025-05-31'), geoEntityId: geo(GEO.NAIROBI) },
    { id: domainId(P, 204), type: 'ACTIVE', diseaseId: ds(DISEASE.RVF), designType: 'RANDOM', sampleSize: 1800, positivityRate: 0.8, periodStart: new Date('2025-06-01'), periodEnd: new Date('2025-08-31'), geoEntityId: geo(GEO.KILIFI) },
    { id: domainId(P, 205), type: 'SENTINEL', diseaseId: ds(DISEASE.HPAI), designType: 'CLUSTER', sampleSize: 500, positivityRate: 0.0, periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-12-31'), geoEntityId: geo(GEO.KISUMU) },
  ];

  for (const s of surveillances) {
    await prisma.surveillanceActivity.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        tenantId: TENANT_KE,
        type: s.type,
        diseaseId: s.diseaseId,
        designType: s.designType ?? null,
        sampleSize: s.sampleSize,
        positivityRate: s.positivityRate,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        geoEntityId: s.geoEntityId,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${surveillances.length} surveillance activities`);

  // ── Vaccination Campaigns (3) ──
  console.log('  💉 Vaccination campaigns...');

  const vaccinations = [
    { id: domainId(P, 301), diseaseId: ds(DISEASE.FMD), speciesId: sp(SPECIES.CATTLE_ZEBU), vaccineType: 'FMD Trivalent (O, A, SAT2)', dosesDelivered: 2000000, dosesUsed: 1560000, targetPopulation: 2000000, coverageEstimate: 78.0, periodStart: new Date('2025-03-01'), periodEnd: new Date('2025-05-31'), geoEntityId: geo(GEO.KENYA) },
    { id: domainId(P, 302), diseaseId: ds(DISEASE.PPR), speciesId: sp(SPECIES.GOAT), vaccineType: 'PPR Homologous Live Attenuated', dosesDelivered: 1500000, dosesUsed: 1275000, targetPopulation: 1500000, coverageEstimate: 85.0, periodStart: new Date('2025-01-15'), periodEnd: new Date('2025-04-15'), geoEntityId: geo(GEO.KENYA) },
    { id: domainId(P, 303), diseaseId: ds(DISEASE.RVF), speciesId: sp(SPECIES.CATTLE_ZEBU), vaccineType: 'RVF Clone 13', dosesDelivered: 500000, dosesUsed: 310000, targetPopulation: 500000, coverageEstimate: 62.0, periodStart: new Date('2025-09-01'), periodEnd: new Date('2025-11-30'), geoEntityId: geo(GEO.KENYA) },
  ];

  for (const v of vaccinations) {
    await prisma.vaccinationCampaign.upsert({
      where: { id: v.id },
      update: {},
      create: {
        id: v.id,
        tenantId: TENANT_KE,
        diseaseId: v.diseaseId,
        speciesId: v.speciesId,
        vaccineType: v.vaccineType,
        dosesDelivered: v.dosesDelivered,
        dosesUsed: v.dosesUsed,
        targetPopulation: v.targetPopulation,
        coverageEstimate: v.coverageEstimate,
        pveSerologyDone: false,
        periodStart: v.periodStart,
        periodEnd: v.periodEnd,
        geoEntityId: v.geoEntityId,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${vaccinations.length} vaccination campaigns`);

  // ── SV Capacity (2) ──
  console.log('  🏛️ SV capacity...');

  const svCapacities = [
    { id: domainId(P, 401), year: 2023, epiStaff: 45, labStaff: 32, labTestsAvailable: ['PCR', 'ELISA', 'CFT', 'AGID', 'FAT', 'VI'], pvsScore: 68.0 },
    { id: domainId(P, 402), year: 2024, epiStaff: 52, labStaff: 38, labTestsAvailable: ['PCR', 'ELISA', 'CFT', 'AGID', 'FAT', 'VI', 'RT-PCR', 'LAMP'], pvsScore: 72.0 },
  ];

  for (const sv of svCapacities) {
    await prisma.sVCapacity.upsert({
      where: { tenantId_year: { tenantId: TENANT_KE, year: sv.year } },
      update: {},
      create: {
        id: sv.id,
        tenantId: TENANT_KE,
        year: sv.year,
        epiStaff: sv.epiStaff,
        labStaff: sv.labStaff,
        labTestsAvailable: sv.labTestsAvailable,
        pvsScore: sv.pvsScore,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${svCapacities.length} SV capacity records`);

  console.log('\n✅ animal-health seed complete!');
}

async function main(): Promise<void> {
  await seed();
}

main()
  .catch((error) => {
    console.error('❌ animal-health seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
