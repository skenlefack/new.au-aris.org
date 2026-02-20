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
const P = PREFIX.WILDLIFE;

export async function seed(): Promise<void> {
  console.log('🦁 Seeding wildlife...\n');

  const { species, geoEntities } = await resolveMasterDataIds(prisma);
  const sp = (code: string) => species.get(code)!;
  const geo = (code: string) => geoEntities.get(code)!;

  // ── Protected Areas (5) ──
  console.log('  🏞️ Protected areas...');

  const protectedAreas = [
    { id: domainId(P, 1), name: 'Masai Mara National Reserve', wdpaId: '872', iucnCategory: 'II', geoCode: GEO.NAKURU, areaKm2: 1510.0, designationDate: new Date('1961-01-01'), managingAuthority: 'Narok County Government', coordinates: { lat: -1.50, lng: 35.15 } },
    { id: domainId(P, 2), name: 'Amboseli National Park', wdpaId: '858', iucnCategory: 'II', geoCode: GEO.NAIROBI, areaKm2: 392.0, designationDate: new Date('1974-01-01'), managingAuthority: 'Kenya Wildlife Service', coordinates: { lat: -2.65, lng: 37.25 } },
    { id: domainId(P, 3), name: 'Tsavo East National Park', wdpaId: '884', iucnCategory: 'II', geoCode: GEO.KILIFI, areaKm2: 13747.0, designationDate: new Date('1948-04-01'), managingAuthority: 'Kenya Wildlife Service', coordinates: { lat: -2.98, lng: 38.75 } },
    { id: domainId(P, 4), name: 'Tsavo West National Park', wdpaId: '885', iucnCategory: 'IV', geoCode: GEO.KILIFI, areaKm2: 9065.0, designationDate: new Date('1948-04-01'), managingAuthority: 'Kenya Wildlife Service', coordinates: { lat: -3.05, lng: 38.15 } },
    { id: domainId(P, 5), name: 'Lake Nakuru National Park', wdpaId: '870', iucnCategory: 'II', geoCode: GEO.NAKURU, areaKm2: 188.0, designationDate: new Date('1961-01-01'), managingAuthority: 'Kenya Wildlife Service', coordinates: { lat: -0.37, lng: 36.09 } },
  ];

  for (const pa of protectedAreas) {
    await prisma.protectedArea.upsert({
      where: { id: pa.id },
      update: {},
      create: {
        id: pa.id,
        tenantId: TENANT_KE,
        name: pa.name,
        wdpaId: pa.wdpaId,
        iucnCategory: pa.iucnCategory,
        geoEntityId: geo(pa.geoCode),
        areaKm2: pa.areaKm2,
        designationDate: pa.designationDate,
        managingAuthority: pa.managingAuthority,
        coordinates: pa.coordinates,
        isActive: true,
        dataClassification: 'PUBLIC',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${protectedAreas.length} protected areas`);

  // ── Wildlife Inventories (10) ──
  console.log('  📋 Wildlife inventories...');

  const inventories = [
    { seq: 101, speciesCode: SPECIES.ELEPHANT, paId: domainId(P, 2), geoCode: GEO.NAIROBI, surveyDate: new Date('2025-06-15'), populationEstimate: 1600, methodology: 'AERIAL_SURVEY', confidenceInterval: '±12%', conservationStatus: 'ENDANGERED', threatLevel: 'HIGH' },
    { seq: 102, speciesCode: SPECIES.ELEPHANT, paId: domainId(P, 3), geoCode: GEO.KILIFI, surveyDate: new Date('2025-06-20'), populationEstimate: 12000, methodology: 'AERIAL_SURVEY', confidenceInterval: '±8%', conservationStatus: 'ENDANGERED', threatLevel: 'HIGH' },
    { seq: 103, speciesCode: SPECIES.RHINO_BLACK, paId: domainId(P, 5), geoCode: GEO.NAKURU, surveyDate: new Date('2025-07-10'), populationEstimate: 70, methodology: 'GROUND_COUNT', confidenceInterval: '±5%', conservationStatus: 'CRITICALLY_ENDANGERED', threatLevel: 'CRITICAL' },
    { seq: 104, speciesCode: SPECIES.RHINO_WHITE, paId: domainId(P, 3), geoCode: GEO.KILIFI, surveyDate: new Date('2025-07-12'), populationEstimate: 100, methodology: 'GROUND_COUNT', confidenceInterval: '±8%', conservationStatus: 'NEAR_THREATENED', threatLevel: 'HIGH' },
    { seq: 105, speciesCode: SPECIES.LION, paId: domainId(P, 1), geoCode: GEO.NAKURU, surveyDate: new Date('2025-08-01'), populationEstimate: 850, methodology: 'CAMERA_TRAP', confidenceInterval: '±10%', conservationStatus: 'VULNERABLE', threatLevel: 'HIGH' },
    { seq: 106, speciesCode: SPECIES.LION, paId: domainId(P, 2), geoCode: GEO.NAIROBI, surveyDate: new Date('2025-08-05'), populationEstimate: 200, methodology: 'CAMERA_TRAP', confidenceInterval: '±15%', conservationStatus: 'VULNERABLE', threatLevel: 'HIGH' },
    { seq: 107, speciesCode: SPECIES.BUFFALO, paId: domainId(P, 1), geoCode: GEO.NAKURU, surveyDate: new Date('2025-09-01'), populationEstimate: 20000, methodology: 'AERIAL_SURVEY', confidenceInterval: '±10%', conservationStatus: 'NEAR_THREATENED', threatLevel: 'MEDIUM' },
    { seq: 108, speciesCode: SPECIES.WILDEBEEST, paId: domainId(P, 1), geoCode: GEO.NAKURU, surveyDate: new Date('2025-09-15'), populationEstimate: 1500000, methodology: 'AERIAL_SURVEY', confidenceInterval: '±15%', conservationStatus: 'LEAST_CONCERN', threatLevel: 'LOW' },
    { seq: 109, speciesCode: SPECIES.GIRAFFE, paId: domainId(P, 3), geoCode: GEO.KILIFI, surveyDate: new Date('2025-10-01'), populationEstimate: 2000, methodology: 'GROUND_COUNT', confidenceInterval: '±12%', conservationStatus: 'VULNERABLE', threatLevel: 'MEDIUM' },
    { seq: 110, speciesCode: SPECIES.HIPPO, paId: domainId(P, 5), geoCode: GEO.NAKURU, surveyDate: new Date('2025-10-10'), populationEstimate: 4000, methodology: 'AERIAL_SURVEY', confidenceInterval: '±8%', conservationStatus: 'VULNERABLE', threatLevel: 'MEDIUM' },
  ];

  for (const inv of inventories) {
    await prisma.wildlifeInventory.upsert({
      where: { id: domainId(P, inv.seq) },
      update: {},
      create: {
        id: domainId(P, inv.seq),
        tenantId: TENANT_KE,
        speciesId: sp(inv.speciesCode),
        geoEntityId: geo(inv.geoCode),
        protectedAreaId: inv.paId,
        surveyDate: inv.surveyDate,
        populationEstimate: inv.populationEstimate,
        methodology: inv.methodology,
        confidenceInterval: inv.confidenceInterval,
        conservationStatus: inv.conservationStatus,
        threatLevel: inv.threatLevel,
        dataClassification: 'RESTRICTED',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${inventories.length} wildlife inventories`);

  // ── CITES Permits (3) ──
  console.log('  📜 CITES permits...');

  const citesPermits = [
    { id: domainId(P, 201), permitNumber: 'KE-CITES-2025-001', permitType: 'EXPORT', speciesCode: SPECIES.ELEPHANT, quantity: 5, unit: 'KG', purpose: 'SCIENTIFIC_RESEARCH', applicant: 'National Museums of Kenya', exportCountry: 'KE', importCountry: 'US', issueDate: new Date('2025-02-01'), expiryDate: new Date('2025-08-01'), status: 'ISSUED' },
    { id: domainId(P, 202), permitNumber: 'KE-CITES-2025-002', permitType: 'IMPORT', speciesCode: SPECIES.RHINO_WHITE, quantity: 2, unit: 'HEAD', purpose: 'ZOO_BREEDING', applicant: 'Nairobi National Park', exportCountry: 'ZA', importCountry: 'KE', issueDate: new Date('2025-04-15'), expiryDate: new Date('2025-10-15'), status: 'ISSUED' },
    { id: domainId(P, 203), permitNumber: 'KE-CITES-2025-003', permitType: 'RE_EXPORT', speciesCode: SPECIES.LION, quantity: 1, unit: 'HEAD', purpose: 'TROPHY', applicant: 'Safari Export Ltd', exportCountry: 'KE', importCountry: 'AE', issueDate: new Date('2025-01-10'), expiryDate: new Date('2025-07-10'), status: 'EXPIRED' },
  ];

  for (const cp of citesPermits) {
    await prisma.citesPermit.upsert({
      where: { id: cp.id },
      update: {},
      create: {
        id: cp.id,
        tenantId: TENANT_KE,
        permitNumber: cp.permitNumber,
        permitType: cp.permitType,
        speciesId: sp(cp.speciesCode),
        quantity: cp.quantity,
        unit: cp.unit,
        purpose: cp.purpose,
        applicant: cp.applicant,
        exportCountry: cp.exportCountry,
        importCountry: cp.importCountry,
        issueDate: cp.issueDate,
        expiryDate: cp.expiryDate,
        status: cp.status,
        dataClassification: 'RESTRICTED',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${citesPermits.length} CITES permits`);

  // ── Wildlife Crimes (2) ──
  console.log('  🚨 Wildlife crimes...');

  const crimes = [
    {
      id: domainId(P, 301),
      incidentDate: new Date('2025-05-18'),
      geoCode: GEO.KILIFI,
      coordinates: { lat: -2.95, lng: 38.80 },
      crimeType: 'POACHING',
      speciesCodes: [SPECIES.ELEPHANT],
      description: 'Three suspects intercepted with 4 elephant tusks weighing approximately 45 kg total near Tsavo East boundary. Suspects arrested by KWS rangers during night patrol.',
      suspectsCount: 3,
      seizureDescription: '4 raw elephant ivory tusks, 2 machetes, 1 firearm',
      seizureQuantity: 45.0,
      seizureUnit: 'KG',
      status: 'INVESTIGATED',
      reportingAgency: 'Kenya Wildlife Service',
    },
    {
      id: domainId(P, 302),
      incidentDate: new Date('2025-08-22'),
      geoCode: GEO.NAIROBI,
      coordinates: { lat: -1.28, lng: 36.82 },
      crimeType: 'BUSHMEAT_TRAFFICKING',
      speciesCodes: [SPECIES.BUFFALO, SPECIES.WILDEBEEST],
      description: 'Bushmeat smuggling operation intercepted at Nairobi roadblock. Vehicle contained 12 wildlife carcasses including buffalo and wildebeest parts destined for urban markets.',
      suspectsCount: 2,
      seizureDescription: '12 partially butchered wildlife carcasses, 1 vehicle',
      seizureQuantity: 850.0,
      seizureUnit: 'KG',
      status: 'REPORTED',
      reportingAgency: 'Kenya Police Service',
    },
  ];

  for (const crime of crimes) {
    const resolvedSpeciesIds = crime.speciesCodes.map((code) => sp(code));

    await prisma.wildlifeCrime.upsert({
      where: { id: crime.id },
      update: {},
      create: {
        id: crime.id,
        tenantId: TENANT_KE,
        incidentDate: crime.incidentDate,
        geoEntityId: geo(crime.geoCode),
        coordinates: crime.coordinates,
        crimeType: crime.crimeType,
        speciesIds: resolvedSpeciesIds,
        description: crime.description,
        suspectsCount: crime.suspectsCount,
        seizureDescription: crime.seizureDescription,
        seizureQuantity: crime.seizureQuantity,
        seizureUnit: crime.seizureUnit,
        status: crime.status,
        reportingAgency: crime.reportingAgency,
        dataClassification: 'RESTRICTED',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${crimes.length} wildlife crimes`);

  console.log('\n✅ wildlife seed complete!');
}

async function main(): Promise<void> {
  await seed();
}

main()
  .catch((error) => {
    console.error('❌ wildlife seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
