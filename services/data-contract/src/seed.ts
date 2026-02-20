import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed two data contracts for Kenya:
 * 1. "Animal Health Events (Kenya)" — REALTIME, OFFICIAL
 * 2. "Vaccination Campaigns (Kenya)" — MONTHLY, OFFICIAL
 */
async function seed(): Promise<void> {
  console.log('Seeding data-contract...');

  // Find Kenya tenant
  const kenyaTenant = await prisma.tenant.findFirst({
    where: { code: 'KE' },
  });

  if (!kenyaTenant) {
    console.warn(
      'Kenya tenant not found. Run tenant seed first. Using placeholder UUID.',
    );
  }

  const tenantId = kenyaTenant?.id ?? '00000000-0000-0000-0000-000000000003';

  // Find SUPER_ADMIN for approvedBy
  const adminUser = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  const approvedBy = adminUser?.id ?? '00000000-0000-0000-0000-000000000001';
  const createdBy = approvedBy;

  // Contract 1: Animal Health Events (Kenya)
  await prisma.dataContract.upsert({
    where: {
      tenant_id_name_version: {
        tenant_id: tenantId,
        name: 'Animal Health Events (Kenya)',
        version: 1,
      },
    },
    update: {},
    create: {
      tenant_id: tenantId,
      name: 'Animal Health Events (Kenya)',
      domain: 'health',
      data_owner: 'Kenya Directorate of Veterinary Services',
      data_steward: 'DVS Data Quality Unit',
      purpose:
        'Real-time reporting of animal disease events including outbreaks, lab confirmations, and control measures. Supports WAHIS near-real-time notifications and AU-IBAR continental surveillance.',
      officiality_level: 'OFFICIAL',
      schema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: 'Animal Health Event',
        type: 'object',
        required: ['country', 'disease', 'species', 'date_suspicion', 'cases', 'deaths'],
        properties: {
          country: { type: 'string' },
          admin1: { type: 'string' },
          admin2: { type: 'string' },
          disease: { type: 'string' },
          species: { type: 'string' },
          date_onset: { type: 'string', format: 'date' },
          date_suspicion: { type: 'string', format: 'date' },
          cases: { type: 'integer', minimum: 0 },
          deaths: { type: 'integer', minimum: 0 },
          control_measures: { type: 'string' },
          gps_location: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lng: { type: 'number' },
            },
          },
        },
      },
      frequency: 'REALTIME',
      timeliness_sla: 24, // 24 hours from event to submission
      quality_sla: {
        correctionDeadline: 48,
        escalationDeadline: 72,
        minPassRate: 0.85,
      },
      classification: 'RESTRICTED',
      exchange_mechanism: 'KAFKA',
      version: 1,
      status: 'ACTIVE',
      valid_from: new Date('2024-01-01'),
      approved_by: approvedBy,
      created_by: createdBy,
    },
  });

  console.log('Seeded: "Animal Health Events (Kenya)" contract');

  // Contract 2: Vaccination Campaigns (Kenya)
  await prisma.dataContract.upsert({
    where: {
      tenant_id_name_version: {
        tenant_id: tenantId,
        name: 'Vaccination Campaigns (Kenya)',
        version: 1,
      },
    },
    update: {},
    create: {
      tenant_id: tenantId,
      name: 'Vaccination Campaigns (Kenya)',
      domain: 'health',
      data_owner: 'Kenya Directorate of Veterinary Services',
      data_steward: 'DVS Vaccination Unit',
      purpose:
        'Monthly reporting of vaccination campaign results including doses administered, coverage rates, and adverse reactions. Supports national and continental vaccination monitoring.',
      officiality_level: 'OFFICIAL',
      schema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: 'Vaccination Campaign Report',
        type: 'object',
        required: ['country', 'disease', 'species', 'campaign_name', 'doses_administered'],
        properties: {
          country: { type: 'string' },
          admin1: { type: 'string' },
          disease: { type: 'string' },
          species: { type: 'string' },
          campaign_name: { type: 'string' },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
          target_population: { type: 'integer', minimum: 0 },
          doses_administered: { type: 'integer', minimum: 0 },
          coverage_rate: { type: 'number', minimum: 0, maximum: 1 },
          adverse_reactions: { type: 'integer', minimum: 0 },
        },
      },
      frequency: 'MONTHLY',
      timeliness_sla: 168, // 7 days (168 hours) after month end
      quality_sla: {
        correctionDeadline: 72,
        escalationDeadline: 168,
        minPassRate: 0.90,
      },
      classification: 'RESTRICTED',
      exchange_mechanism: 'API',
      version: 1,
      status: 'ACTIVE',
      valid_from: new Date('2024-01-01'),
      approved_by: approvedBy,
      created_by: createdBy,
    },
  });

  console.log('Seeded: "Vaccination Campaigns (Kenya)" contract');
}

seed()
  .then(() => {
    console.log('Data-contract seed completed.');
    return prisma.$disconnect();
  })
  .catch((error) => {
    console.error('Data-contract seed failed:', error);
    return prisma.$disconnect().then(() => process.exit(1));
  });
