/**
 * ARIS Interoperability Hub v3 — Seed Data
 *
 * Seeds: connections, pipelines, referential mappings, agreements, schedules
 * Run: docker exec -w /app/services/interop-hub -e DATABASE_URL="..." <container> node dist/hub/seed-hub.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Tenant IDs (from tenant seed) ────────────────────────────────────
const AU_IBAR_TENANT = '00000000-0000-0000-0000-000000000001'; // Continental
const IGAD_TENANT    = '00000000-0000-0000-0000-000000000010'; // REC
const ECOWAS_TENANT  = '00000000-0000-0000-0000-000000000020'; // REC
const KENYA_TENANT   = '00000000-0000-0000-0000-000000000101'; // MS
const ETHIOPIA_TENANT = '00000000-0000-0000-0000-000000000102'; // MS
const NIGERIA_TENANT = '00000000-0000-0000-0000-000000000201'; // MS
const SENEGAL_TENANT = '00000000-0000-0000-0000-000000000202'; // MS

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

const db = prisma as any;

async function seed() {
  console.log('🌱 Seeding Interop Hub v3...');

  // ── 1. Create schema if needed ──
  await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS interop');

  // ── 2. OUTBOUND Connections (ARIS → International Systems) ──
  const wahisConnection = await db.hubConnection.upsert({
    where: { tenant_id_name: { tenant_id: AU_IBAR_TENANT, name: 'WAHIS (WOAH)' } },
    update: {},
    create: {
      tenant_id: AU_IBAR_TENANT,
      name: 'WAHIS (WOAH)',
      description: 'World Animal Health Information System — Official disease reporting to WOAH',
      system_type: 'WAHIS',
      system_name: 'WAHIS+',
      system_version: '2.0',
      organization: 'World Organisation for Animal Health (WOAH)',
      base_url: 'https://wahis.woah.org/api',
      auth_type: 'BEARER_TOKEN',
      credentials: {},
      headers: {},
      direction: 'OUTBOUND',
      domains: ['animal-health'],
      status: 'DRAFT',
      focal_technical: { name: 'WAHIS Focal Point', email: 'wahis@woah.org' },
      config: { reportTypes: ['immediate', '6monthly', 'annual'] },
      created_by: SYSTEM_USER_ID,
    },
  });

  const empresConnection = await db.hubConnection.upsert({
    where: { tenant_id_name: { tenant_id: AU_IBAR_TENANT, name: 'EMPRES (FAO)' } },
    update: {},
    create: {
      tenant_id: AU_IBAR_TENANT,
      name: 'EMPRES (FAO)',
      description: 'Emergency Prevention System — FAO early warning signals',
      system_type: 'REST_API',
      system_name: 'EMPRES-i',
      organization: 'Food and Agriculture Organization (FAO)',
      base_url: 'https://empres-i.fao.org/api',
      auth_type: 'API_KEY',
      credentials: {},
      direction: 'OUTBOUND',
      domains: ['animal-health'],
      status: 'DRAFT',
      focal_technical: { name: 'EMPRES Desk', email: 'empres@fao.org' },
      config: { signalTypes: ['outbreak', 'rumor', 'confirmed'] },
      created_by: SYSTEM_USER_ID,
    },
  });

  const faostatConnection = await db.hubConnection.upsert({
    where: { tenant_id_name: { tenant_id: AU_IBAR_TENANT, name: 'FAOSTAT (FAO)' } },
    update: {},
    create: {
      tenant_id: AU_IBAR_TENANT,
      name: 'FAOSTAT (FAO)',
      description: 'FAO Statistical Database — Livestock denominators & production data',
      system_type: 'REST_API',
      system_name: 'FAOSTAT',
      organization: 'Food and Agriculture Organization (FAO)',
      base_url: 'https://fenixservices.fao.org/faostat/api/v1',
      auth_type: 'NONE',
      credentials: {},
      direction: 'OUTBOUND',
      domains: ['livestock-prod'],
      status: 'DRAFT',
      config: { datasets: ['QCL', 'QV'] },
      created_by: SYSTEM_USER_ID,
    },
  });

  const fishstatjConnection = await db.hubConnection.upsert({
    where: { tenant_id_name: { tenant_id: AU_IBAR_TENANT, name: 'FishStatJ (FAO)' } },
    update: {},
    create: {
      tenant_id: AU_IBAR_TENANT,
      name: 'FishStatJ (FAO)',
      description: 'FAO Fisheries & Aquaculture Statistics — Capture & aquaculture production',
      system_type: 'REST_API',
      system_name: 'FishStatJ',
      organization: 'Food and Agriculture Organization (FAO)',
      direction: 'OUTBOUND',
      domains: ['fisheries'],
      status: 'DRAFT',
      config: { productionSources: ['capture', 'aquaculture'] },
      created_by: SYSTEM_USER_ID,
    },
  });

  const citesConnection = await db.hubConnection.upsert({
    where: { tenant_id_name: { tenant_id: AU_IBAR_TENANT, name: 'CITES Trade Database' } },
    update: {},
    create: {
      tenant_id: AU_IBAR_TENANT,
      name: 'CITES Trade Database',
      description: 'Convention on International Trade in Endangered Species — Annual reporting',
      system_type: 'REST_API',
      system_name: 'CITES',
      organization: 'CITES Secretariat (UNEP)',
      base_url: 'https://trade.cites.org/api',
      auth_type: 'API_KEY',
      credentials: {},
      direction: 'OUTBOUND',
      domains: ['wildlife'],
      status: 'DRAFT',
      config: {},
      created_by: SYSTEM_USER_ID,
    },
  });

  // ── 3. INBOUND Connections (Countries → ARIS) ──
  const kenyaDhis2 = await db.hubConnection.upsert({
    where: { tenant_id_name: { tenant_id: KENYA_TENANT, name: 'KLHIS (Kenya DHIS2)' } },
    update: {},
    create: {
      tenant_id: KENYA_TENANT,
      name: 'KLHIS (Kenya DHIS2)',
      description: 'Kenya Livestock Health Information System — DHIS2 instance for animal health data',
      system_type: 'DHIS2',
      system_name: 'KLHIS',
      system_version: '2.40',
      country_code: 'KE',
      country_name: 'Kenya',
      organization: 'Kenya Ministry of Agriculture, Livestock, Fisheries and Cooperatives',
      base_url: 'https://klhis.kilimo.go.ke/api',
      auth_type: 'BASIC',
      credentials: {},
      direction: 'INBOUND',
      domains: ['animal-health', 'livestock-prod'],
      status: 'DRAFT',
      focal_technical: { name: 'Dr. James Ouma', email: 'j.ouma@kilimo.go.ke', phone: '+254700000001' },
      focal_data_owner: { name: 'CVO Office Kenya', email: 'cvo@kilimo.go.ke' },
      config: { orgUnitLevel: 3, programs: ['livestock_surveillance'] },
      created_by: SYSTEM_USER_ID,
    },
  });

  const ethiopiaNadis = await db.hubConnection.upsert({
    where: { tenant_id_name: { tenant_id: ETHIOPIA_TENANT, name: 'NADIS (Ethiopia)' } },
    update: {},
    create: {
      tenant_id: ETHIOPIA_TENANT,
      name: 'NADIS (Ethiopia)',
      description: 'National Animal Disease Information System — REST API for disease reporting',
      system_type: 'REST_API',
      system_name: 'NADIS',
      country_code: 'ET',
      country_name: 'Ethiopia',
      organization: 'Ethiopia Ministry of Agriculture',
      base_url: 'https://nadis.moa.gov.et/api/v1',
      auth_type: 'API_KEY',
      credentials: {},
      direction: 'INBOUND',
      domains: ['animal-health'],
      status: 'DRAFT',
      focal_technical: { name: 'Dr. Abebe Bekele', email: 'a.bekele@moa.gov.et' },
      config: {},
      created_by: SYSTEM_USER_ID,
    },
  });

  const nigeriaFileUpload = await db.hubConnection.upsert({
    where: { tenant_id_name: { tenant_id: NIGERIA_TENANT, name: 'Nigeria Manual Upload' } },
    update: {},
    create: {
      tenant_id: NIGERIA_TENANT,
      name: 'Nigeria Manual Upload',
      description: 'Manual CSV/Excel file upload for Nigerian livestock data',
      system_type: 'FILE_UPLOAD',
      country_code: 'NG',
      country_name: 'Nigeria',
      organization: 'Federal Ministry of Agriculture and Rural Development',
      direction: 'INBOUND',
      domains: ['animal-health', 'livestock-prod', 'fisheries'],
      status: 'DRAFT',
      focal_technical: { name: 'Dr. Musa Ibrahim', email: 'm.ibrahim@fmard.gov.ng' },
      config: { acceptedFormats: ['csv', 'json', 'xlsx'] },
      created_by: SYSTEM_USER_ID,
    },
  });

  console.log(`  ✓ ${8} connections created`);

  // ── 4. Pipelines ──
  // WAHIS outbound pipeline
  const wahisPipeline = await db.hubPipeline.upsert({
    where: { connection_id_domain_direction: { connection_id: wahisConnection.id, domain: 'animal-health', direction: 'OUTBOUND' } },
    update: {},
    create: {
      connection_id: wahisConnection.id,
      tenant_id: AU_IBAR_TENANT,
      name: 'WAHIS Animal Health Export',
      description: 'Export validated health events to WAHIS in WOAH XML/JSON format',
      direction: 'OUTBOUND',
      domain: 'animal-health',
      entity_type: 'health_events',
      mode: 'MANUAL',
      status: 'DRAFT',
      export_format: 'WOAH_XML',
      quality_gates_enabled: true,
      min_quality_score: 0.9,
      reject_on_quality_fail: true,
      created_by: SYSTEM_USER_ID,
    },
  });

  // Create WAHIS pipeline steps
  const wahisSteps = [
    { step_order: 1, step_type: 'RECEIVE', name: 'Receive validated events', config: {} },
    { step_order: 2, step_type: 'ENRICH', name: 'Enrich with master data', config: { enrichTypes: ['diseases', 'species', 'geo'] } },
    { step_order: 3, step_type: 'REFERENTIAL_MAP', name: 'Map to WOAH codes', config: { mappingTypes: ['DISEASE', 'SPECIES', 'GEO_COUNTRY'] } },
    { step_order: 4, step_type: 'FIELD_TRANSFORM', name: 'Transform to WAHIS fields', config: {} },
    { step_order: 5, step_type: 'FORMAT_BUILD', name: 'Build WOAH XML package', config: { format: 'WOAH_XML', includeMetadata: true } },
    { step_order: 6, step_type: 'NOTIFY', name: 'Notify INTEROP_MANAGER for review', config: { channels: ['in_app', 'email'] } },
    { step_order: 7, step_type: 'DELIVER', name: 'Deliver to WAHIS', config: { method: 'POST', timeout: 60000 } },
  ];

  for (const step of wahisSteps) {
    await db.hubPipelineStep.upsert({
      where: { pipeline_id_step_order: { pipeline_id: wahisPipeline.id, step_order: step.step_order } },
      update: {},
      create: {
        pipeline_id: wahisPipeline.id,
        ...step,
      },
    });
  }

  // Kenya DHIS2 inbound pipeline
  const kenyaPipeline = await db.hubPipeline.upsert({
    where: { connection_id_domain_direction: { connection_id: kenyaDhis2.id, domain: 'animal-health', direction: 'INBOUND' } },
    update: {},
    create: {
      connection_id: kenyaDhis2.id,
      tenant_id: KENYA_TENANT,
      name: 'Kenya KLHIS → ARIS Animal Health',
      description: 'Import animal health data from Kenya DHIS2 into ARIS campaigns',
      direction: 'INBOUND',
      domain: 'animal-health',
      entity_type: 'health_events',
      mode: 'AUTOMATIC',
      status: 'DRAFT',
      quality_gates_enabled: true,
      min_quality_score: 0.7,
      reject_on_quality_fail: false,
      created_by: SYSTEM_USER_ID,
    },
  });

  const kenyaSteps = [
    { step_order: 1, step_type: 'RECEIVE', name: 'Receive DHIS2 data', config: {} },
    { step_order: 2, step_type: 'REFERENTIAL_MAP', name: 'Map Kenya codes to ARIS', config: { mappingTypes: ['DISEASE', 'SPECIES', 'GEO_ADMIN'] } },
    { step_order: 3, step_type: 'FIELD_TRANSFORM', name: 'Transform DHIS2 fields', config: {} },
    { step_order: 4, step_type: 'SCHEMA_VALIDATE', name: 'Validate against form schema', config: {} },
    { step_order: 5, step_type: 'QUALITY_GATE', name: 'Run quality gates', config: { gates: ['COMPLETENESS', 'TEMPORAL_CONSISTENCY', 'GEOGRAPHIC_CONSISTENCY', 'AUDITABILITY'] } },
    { step_order: 6, step_type: 'ROUTE', name: 'Load into campaign', config: {} },
  ];

  for (const step of kenyaSteps) {
    await db.hubPipelineStep.upsert({
      where: { pipeline_id_step_order: { pipeline_id: kenyaPipeline.id, step_order: step.step_order } },
      update: {},
      create: {
        pipeline_id: kenyaPipeline.id,
        ...step,
      },
    });
  }

  console.log(`  ✓ 2 pipelines with ${wahisSteps.length + kenyaSteps.length} steps created`);

  // ── 5. Sample referential mappings (Kenya) ──
  const kenyaMappings = [
    // Disease mappings (Kenya code → ARIS/WOAH code)
    { referential_type: 'DISEASE', source_code: 'FMD', source_label: 'Foot and Mouth Disease', target_code: 'A010', target_label: 'Foot and mouth disease', is_verified: true },
    { referential_type: 'DISEASE', source_code: 'RVF', source_label: 'Rift Valley Fever', target_code: 'A080', target_label: 'Rift Valley fever', is_verified: true },
    { referential_type: 'DISEASE', source_code: 'CBPP', source_label: 'Contagious Bovine Pleuropneumonia', target_code: 'A030', target_label: 'Contagious bovine pleuropneumonia', is_verified: true },
    { referential_type: 'DISEASE', source_code: 'PPR', source_label: 'Peste des Petits Ruminants', target_code: 'A050', target_label: 'Peste des petits ruminants', is_verified: true },
    { referential_type: 'DISEASE', source_code: 'ASF', source_label: 'African Swine Fever', target_code: 'A020', target_label: 'African swine fever', is_verified: true },
    // Species mappings
    { referential_type: 'SPECIES', source_code: 'BOV', source_label: 'Bovine', target_code: 'CATTLE', target_label: 'Cattle (Bos taurus)', is_verified: true },
    { referential_type: 'SPECIES', source_code: 'OVI', source_label: 'Ovine', target_code: 'SHEEP', target_label: 'Sheep (Ovis aries)', is_verified: true },
    { referential_type: 'SPECIES', source_code: 'CAP', source_label: 'Caprine', target_code: 'GOAT', target_label: 'Goat (Capra aegagrus hircus)', is_verified: true },
    { referential_type: 'SPECIES', source_code: 'SUI', source_label: 'Swine', target_code: 'PIG', target_label: 'Pig (Sus scrofa domesticus)', is_verified: true },
    // Geo mappings
    { referential_type: 'GEO_ADMIN', source_code: 'NAI', source_label: 'Nairobi', target_code: 'KE-30', target_label: 'Nairobi County', is_verified: true },
    { referential_type: 'GEO_ADMIN', source_code: 'MOM', source_label: 'Mombasa', target_code: 'KE-01', target_label: 'Mombasa County', is_verified: true },
    { referential_type: 'GEO_ADMIN', source_code: 'KIS', source_label: 'Kisumu', target_code: 'KE-42', target_label: 'Kisumu County', is_verified: true },
  ];

  for (const m of kenyaMappings) {
    await db.hubReferentialMapping.upsert({
      where: {
        connection_id_referential_type_direction_source_code: {
          connection_id: kenyaDhis2.id,
          referential_type: m.referential_type,
          direction: 'INBOUND',
          source_code: m.source_code,
        },
      },
      update: {},
      create: {
        connection_id: kenyaDhis2.id,
        direction: 'INBOUND',
        ...m,
      },
    });
  }

  console.log(`  ✓ ${kenyaMappings.length} referential mappings created for Kenya`);

  // ── 6. WAHIS outbound referential mappings ──
  const wahisMappings = [
    { referential_type: 'DISEASE', source_code: 'A010', source_label: 'Foot and mouth disease', target_code: '10', target_label: 'FMD (WOAH)', is_verified: true },
    { referential_type: 'DISEASE', source_code: 'A020', source_label: 'African swine fever', target_code: '50', target_label: 'ASF (WOAH)', is_verified: true },
    { referential_type: 'DISEASE', source_code: 'A030', source_label: 'CBPP', target_code: '60', target_label: 'CBPP (WOAH)', is_verified: true },
    { referential_type: 'DISEASE', source_code: 'A050', source_label: 'PPR', target_code: '70', target_label: 'PPR (WOAH)', is_verified: true },
    { referential_type: 'DISEASE', source_code: 'A080', source_label: 'Rift Valley fever', target_code: '100', target_label: 'RVF (WOAH)', is_verified: true },
    { referential_type: 'GEO_COUNTRY', source_code: 'KE', source_label: 'Kenya', target_code: 'KEN', target_label: 'Kenya (WOAH)', is_verified: true },
    { referential_type: 'GEO_COUNTRY', source_code: 'ET', source_label: 'Ethiopia', target_code: 'ETH', target_label: 'Ethiopia (WOAH)', is_verified: true },
    { referential_type: 'GEO_COUNTRY', source_code: 'NG', source_label: 'Nigeria', target_code: 'NGA', target_label: 'Nigeria (WOAH)', is_verified: true },
    { referential_type: 'GEO_COUNTRY', source_code: 'SN', source_label: 'Senegal', target_code: 'SEN', target_label: 'Senegal (WOAH)', is_verified: true },
  ];

  for (const m of wahisMappings) {
    await db.hubReferentialMapping.upsert({
      where: {
        connection_id_referential_type_direction_source_code: {
          connection_id: wahisConnection.id,
          referential_type: m.referential_type,
          direction: 'OUTBOUND',
          source_code: m.source_code,
        },
      },
      update: {},
      create: {
        connection_id: wahisConnection.id,
        direction: 'OUTBOUND',
        ...m,
      },
    });
  }

  console.log(`  ✓ ${wahisMappings.length} referential mappings created for WAHIS`);

  // ── 7. Agreements ──
  await db.hubAgreement.upsert({
    where: { reference: 'HUB-2026-00001' },
    update: {},
    create: {
      connection_id: wahisConnection.id,
      reference: 'HUB-2026-00001',
      tenant_id: AU_IBAR_TENANT,
      owner_tenant_id: AU_IBAR_TENANT,
      owner_name: 'AU-IBAR',
      partner_name: 'World Organisation for Animal Health (WOAH)',
      title: 'ARIS-WAHIS Data Exchange Agreement',
      description: 'Agreement for automatic transmission of validated animal health events from ARIS to WAHIS for all 55 African Union Member States.',
      purpose: 'Near-real-time disease reporting to WAHIS',
      legal_basis: 'AU-IBAR Mandate + WOAH Terrestrial Code Chapter 1.1',
      domains: ['animal-health'],
      direction: 'OUTBOUND',
      data_scope: { entities: ['health_events'], fields: { include: ['disease', 'species', 'country', 'cases', 'deaths', 'coordinates'] } },
      data_classification: 'PARTNER',
      frequency: 'REALTIME',
      timeliness_sla_hours: 24,
      quality_min_score: 0.9,
      status: 'DRAFT',
      valid_from: new Date('2026-01-01'),
      valid_until: new Date('2028-12-31'),
      created_by: SYSTEM_USER_ID,
    },
  });

  await db.hubAgreement.upsert({
    where: { reference: 'HUB-2026-00002' },
    update: {},
    create: {
      connection_id: kenyaDhis2.id,
      reference: 'HUB-2026-00002',
      tenant_id: KENYA_TENANT,
      owner_tenant_id: KENYA_TENANT,
      owner_name: 'Kenya Ministry of Agriculture',
      partner_tenant_id: AU_IBAR_TENANT,
      partner_name: 'AU-IBAR',
      title: 'Kenya KLHIS → ARIS Data Exchange',
      description: 'Agreement for Kenya to share animal health and livestock data from KLHIS (DHIS2) with ARIS.',
      purpose: 'Continental surveillance and reporting',
      legal_basis: 'AU-IBAR Data Sharing Policy 2024',
      domains: ['animal-health', 'livestock-prod'],
      direction: 'INBOUND',
      data_scope: { entities: ['health_events', 'livestock_census'] },
      data_classification: 'PARTNER',
      frequency: 'WEEKLY',
      timeliness_sla_hours: 168,
      quality_min_score: 0.7,
      status: 'DRAFT',
      valid_from: new Date('2026-01-01'),
      valid_until: new Date('2027-12-31'),
      created_by: SYSTEM_USER_ID,
    },
  });

  console.log('  ✓ 2 agreements created');

  // ── 8. Schedules ──
  await db.hubSchedule.upsert({
    where: { id: '00000000-0000-0000-0000-000000000901' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000901',
      connection_id: wahisConnection.id,
      pipeline_id: wahisPipeline.id,
      tenant_id: AU_IBAR_TENANT,
      frequency: 'QUARTERLY',
      timezone: 'UTC',
      window_start: '02:00',
      window_end: '04:00',
      period_type: 'previous_quarter',
      is_active: false,
    },
  });

  await db.hubSchedule.upsert({
    where: { id: '00000000-0000-0000-0000-000000000902' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000902',
      connection_id: kenyaDhis2.id,
      pipeline_id: kenyaPipeline.id,
      tenant_id: KENYA_TENANT,
      frequency: 'WEEKLY',
      timezone: 'Africa/Nairobi',
      window_start: '03:00',
      window_end: '05:00',
      period_type: 'previous_week',
      is_active: false,
    },
  });

  console.log('  ✓ 2 schedules created');

  console.log('\n✅ Interop Hub v3 seed complete!');
  console.log('   8 connections, 2 pipelines, 13 steps, 21 mappings, 2 agreements, 2 schedules');
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
