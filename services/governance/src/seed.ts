import { PrismaClient } from '@prisma/client';
import {
  TENANT_KE,
  USER_KE_ADMIN,
  domainId,
  PREFIX,
} from '../../../scripts/seed-constants';

const prisma = new PrismaClient();
const P = PREFIX.GOVERNANCE;

export async function seed(): Promise<void> {
  console.log('🏛️ Seeding governance...\n');

  // ── Legal Frameworks (5) ──
  console.log('  📜 Legal frameworks...');

  const legalFrameworks = [
    { id: domainId(P, 1), title: 'Veterinary Surgeons and Veterinary Para-Professionals Act', type: 'LAW', domain: 'ANIMAL_HEALTH', adoptionDate: new Date('2011-08-27'), status: 'IN_FORCE' },
    { id: domainId(P, 2), title: 'Animal Diseases Act (Cap 364)', type: 'LAW', domain: 'ANIMAL_HEALTH', adoptionDate: new Date('2012-01-01'), status: 'IN_FORCE' },
    { id: domainId(P, 3), title: 'Meat Control Act (Cap 356)', type: 'REGULATION', domain: 'FOOD_SAFETY', adoptionDate: new Date('2012-01-01'), status: 'IN_FORCE' },
    { id: domainId(P, 4), title: 'EAC SPS Protocol', type: 'POLICY', domain: 'TRADE', adoptionDate: new Date('2021-11-30'), status: 'ADOPTED' },
    { id: domainId(P, 5), title: 'National Livestock Policy 2030', type: 'GUIDELINE', domain: 'LIVESTOCK', adoptionDate: null, status: 'DRAFT' },
  ];

  for (const lf of legalFrameworks) {
    await prisma.legalFramework.upsert({
      where: { id: lf.id },
      update: {},
      create: {
        id: lf.id,
        tenantId: TENANT_KE,
        title: lf.title,
        type: lf.type,
        domain: lf.domain,
        adoptionDate: lf.adoptionDate,
        status: lf.status,
        dataClassification: 'PUBLIC',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${legalFrameworks.length} legal frameworks`);

  // ── Institutional Capacities (5) ──
  console.log('  🏢 Institutional capacities...');

  const capacities = [
    { seq: 101, year: 2022, organizationName: 'Directorate of Veterinary Services', staffCount: 1200, budgetUsd: 45000000, pvsSelfAssessmentScore: 68.0, oieStatus: 'MEMBER' },
    { seq: 102, year: 2023, organizationName: 'Directorate of Veterinary Services', staffCount: 1320, budgetUsd: 48000000, pvsSelfAssessmentScore: 70.0, oieStatus: 'MEMBER' },
    { seq: 103, year: 2024, organizationName: 'Directorate of Veterinary Services', staffCount: 1450, budgetUsd: 52000000, pvsSelfAssessmentScore: 72.0, oieStatus: 'MEMBER' },
    { seq: 104, year: 2023, organizationName: 'Kenya Wildlife Service', staffCount: 3200, budgetUsd: 85000000, pvsSelfAssessmentScore: null, oieStatus: null },
    { seq: 105, year: 2024, organizationName: 'Kenya Wildlife Service', staffCount: 3350, budgetUsd: 92000000, pvsSelfAssessmentScore: null, oieStatus: null },
  ];

  for (const cap of capacities) {
    await prisma.institutionalCapacity.upsert({
      where: { tenantId_year_organizationName: { tenantId: TENANT_KE, year: cap.year, organizationName: cap.organizationName } },
      update: {},
      create: {
        id: domainId(P, cap.seq),
        tenantId: TENANT_KE,
        year: cap.year,
        organizationName: cap.organizationName,
        staffCount: cap.staffCount,
        budgetUsd: cap.budgetUsd,
        pvsSelfAssessmentScore: cap.pvsSelfAssessmentScore,
        oieStatus: cap.oieStatus,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${capacities.length} institutional capacities`);

  // ── PVS Evaluations (3) ──
  console.log('  📊 PVS evaluations...');

  const pvsEvals = [
    {
      id: domainId(P, 201),
      evaluationType: 'PVS',
      evaluationDate: new Date('2020-09-15'),
      overallScore: 65.0,
      criticalCompetencies: {
        'I-1': { name: 'Professional and technical staffing', score: 3 },
        'I-2': { name: 'Competencies of veterinarians', score: 3 },
        'II-1': { name: 'Veterinary laboratory diagnostics', score: 2 },
        'II-5': { name: 'Epidemiological surveillance', score: 3 },
        'III-1': { name: 'Communication', score: 2 },
        'IV-1': { name: 'Preparation for emerging issues', score: 2 },
      },
      recommendations: [
        'Strengthen laboratory diagnostic capacity at regional level',
        'Enhance epidemiological surveillance network',
        'Increase staffing in border inspection posts',
        'Develop risk-based inspection systems',
      ],
    },
    {
      id: domainId(P, 202),
      evaluationType: 'PVS_GAP_ANALYSIS',
      evaluationDate: new Date('2022-03-20'),
      overallScore: 70.0,
      criticalCompetencies: {
        'I-1': { name: 'Professional and technical staffing', score: 3, gap: 'Moderate', investment: 2500000 },
        'II-1': { name: 'Veterinary laboratory diagnostics', score: 3, gap: 'Small', investment: 1800000 },
        'II-5': { name: 'Epidemiological surveillance', score: 3, gap: 'Small', investment: 1200000 },
        'III-1': { name: 'Communication', score: 3, gap: 'Moderate', investment: 800000 },
      },
      recommendations: [
        'Invest $2.5M in veterinary workforce development',
        'Upgrade 5 regional laboratories with PCR capacity',
        'Establish real-time disease reporting system',
        'Develop public communication strategy for disease outbreaks',
      ],
    },
    {
      id: domainId(P, 203),
      evaluationType: 'PVS_FOLLOW_UP',
      evaluationDate: new Date('2024-11-10'),
      overallScore: 75.0,
      criticalCompetencies: {
        'I-1': { name: 'Professional and technical staffing', score: 4, trend: 'IMPROVING' },
        'I-2': { name: 'Competencies of veterinarians', score: 3, trend: 'STABLE' },
        'II-1': { name: 'Veterinary laboratory diagnostics', score: 3, trend: 'IMPROVING' },
        'II-5': { name: 'Epidemiological surveillance', score: 4, trend: 'IMPROVING' },
        'III-1': { name: 'Communication', score: 3, trend: 'IMPROVING' },
        'IV-1': { name: 'Preparation for emerging issues', score: 3, trend: 'IMPROVING' },
      },
      recommendations: [
        'Continue investment in laboratory modernization',
        'Scale ARIS digital reporting to all 47 counties',
        'Strengthen cross-border coordination with IGAD member states',
      ],
    },
  ];

  for (const pvs of pvsEvals) {
    await prisma.pVSEvaluation.upsert({
      where: { id: pvs.id },
      update: {},
      create: {
        id: pvs.id,
        tenantId: TENANT_KE,
        evaluationType: pvs.evaluationType,
        evaluationDate: pvs.evaluationDate,
        overallScore: pvs.overallScore,
        criticalCompetencies: pvs.criticalCompetencies,
        recommendations: pvs.recommendations,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${pvsEvals.length} PVS evaluations`);

  // ── Stakeholder Registry (5) ──
  console.log('  👥 Stakeholder registry...');

  const stakeholders = [
    { id: domainId(P, 301), name: 'Directorate of Veterinary Services (DVS)', type: 'GOVERNMENT', contactPerson: 'Dr. Sarah Kimani', email: 'dvs@kilimo.go.ke', domains: ['ANIMAL_HEALTH', 'LIVESTOCK', 'TRADE'] },
    { id: domainId(P, 302), name: 'FAO Kenya Country Office', type: 'INTERNATIONAL', contactPerson: 'Dr. James Oduor', email: 'fao-ke@fao.org', domains: ['ANIMAL_HEALTH', 'LIVESTOCK', 'FISHERIES', 'CLIMATE'] },
    { id: domainId(P, 303), name: 'Kenya Veterinary Association (KVA)', type: 'NGO', contactPerson: 'Dr. Peter Muthui', email: 'info@kva.co.ke', domains: ['ANIMAL_HEALTH', 'GOVERNANCE'] },
    { id: domainId(P, 304), name: 'University of Nairobi - Faculty of Veterinary Medicine', type: 'ACADEMIC', contactPerson: 'Prof. Grace Wanjiku', email: 'vet@uonbi.ac.ke', domains: ['ANIMAL_HEALTH', 'WILDLIFE', 'KNOWLEDGE'] },
    { id: domainId(P, 305), name: 'Kenya Meat Commission (KMC)', type: 'PRIVATE', contactPerson: 'Mr. David Otieno', email: 'info@kenyameat.co.ke', domains: ['LIVESTOCK', 'TRADE', 'FOOD_SAFETY'] },
  ];

  for (const sh of stakeholders) {
    await prisma.stakeholderRegistry.upsert({
      where: { id: sh.id },
      update: {},
      create: {
        id: sh.id,
        tenantId: TENANT_KE,
        name: sh.name,
        type: sh.type,
        contactPerson: sh.contactPerson,
        email: sh.email,
        domains: sh.domains,
        dataClassification: 'PUBLIC',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${stakeholders.length} stakeholders`);

  console.log('\n✅ governance seed complete!');
}

async function main(): Promise<void> {
  await seed();
}

main()
  .catch((error) => {
    console.error('❌ governance seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
