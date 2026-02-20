import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Base template: "Animal Disease Event Report"
 * Created at AU-IBAR (CONTINENTAL) level so all RECs and MS can inherit from it.
 *
 * Fields: country, admin1, admin2, disease, species, date_onset,
 *         date_suspicion, cases, deaths, control_measures, gps_location, photos
 */
const ANIMAL_DISEASE_EVENT_REPORT_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Animal Disease Event Report',
  description:
    'Base template for reporting animal disease events across AU Member States. Aligned with WAHIS notification requirements.',
  type: 'object',
  required: [
    'country',
    'admin1',
    'disease',
    'species',
    'date_suspicion',
    'cases',
    'deaths',
  ],
  properties: {
    country: {
      type: 'string',
      title: 'Country',
      description: 'ISO 3166-1 alpha-2 country code',
      'x-aris-component': 'admin-cascader',
      'x-aris-ref': 'master-data/geo',
      'x-aris-level': 'country',
    },
    admin1: {
      type: 'string',
      title: 'Admin Level 1 (Province/Region)',
      description: 'First-level administrative division',
      'x-aris-component': 'admin-cascader',
      'x-aris-ref': 'master-data/geo',
      'x-aris-level': 'admin1',
      'x-aris-depends-on': 'country',
    },
    admin2: {
      type: 'string',
      title: 'Admin Level 2 (District/County)',
      description: 'Second-level administrative division',
      'x-aris-component': 'admin-cascader',
      'x-aris-ref': 'master-data/geo',
      'x-aris-level': 'admin2',
      'x-aris-depends-on': 'admin1',
    },
    disease: {
      type: 'string',
      title: 'Disease',
      description: 'Disease from WOAH-aligned Master Data referential',
      'x-aris-component': 'disease-selector',
      'x-aris-ref': 'master-data/diseases',
    },
    species: {
      type: 'string',
      title: 'Species Affected',
      description: 'Species from WOAH/FAO-aligned Master Data referential',
      'x-aris-component': 'species-selector',
      'x-aris-ref': 'master-data/species',
    },
    date_onset: {
      type: 'string',
      format: 'date',
      title: 'Date of Onset',
      description: 'Date when first clinical signs were observed',
    },
    date_suspicion: {
      type: 'string',
      format: 'date',
      title: 'Date of Suspicion',
      description: 'Date when disease was first suspected by veterinary authority',
    },
    cases: {
      type: 'integer',
      title: 'Number of Cases',
      description: 'Total animals showing clinical signs',
      minimum: 0,
    },
    deaths: {
      type: 'integer',
      title: 'Number of Deaths',
      description: 'Total animal deaths attributed to this event',
      minimum: 0,
    },
    control_measures: {
      type: 'string',
      title: 'Control Measures Applied',
      description:
        'Description of control measures (quarantine, movement restriction, culling, vaccination ring, etc.)',
    },
    gps_location: {
      type: 'object',
      title: 'GPS Location',
      description: 'Precise location of the event epicenter',
      'x-aris-component': 'geo-picker',
      properties: {
        lat: { type: 'number', minimum: -90, maximum: 90 },
        lng: { type: 'number', minimum: -180, maximum: 180 },
        accuracy: { type: 'number', minimum: 0, description: 'Accuracy in meters' },
      },
      required: ['lat', 'lng'],
    },
    photos: {
      type: 'array',
      title: 'Photos',
      description: 'Field photos with GPS EXIF metadata',
      'x-aris-component': 'photo-capture',
      items: {
        type: 'object',
        properties: {
          file_id: { type: 'string', description: 'Reference to Drive service file' },
          caption: { type: 'string' },
          taken_at: { type: 'string', format: 'date-time' },
        },
        required: ['file_id'],
      },
    },
  },
};

const ANIMAL_DISEASE_EVENT_REPORT_UI_SCHEMA = {
  'ui:order': [
    'country',
    'admin1',
    'admin2',
    'disease',
    'species',
    'date_onset',
    'date_suspicion',
    'cases',
    'deaths',
    'control_measures',
    'gps_location',
    'photos',
  ],
  country: { 'ui:widget': 'admin-cascader', 'ui:placeholder': 'Select country' },
  admin1: { 'ui:widget': 'admin-cascader', 'ui:placeholder': 'Select province/region' },
  admin2: { 'ui:widget': 'admin-cascader', 'ui:placeholder': 'Select district/county' },
  disease: { 'ui:widget': 'disease-selector', 'ui:placeholder': 'Search diseases...' },
  species: { 'ui:widget': 'species-selector', 'ui:placeholder': 'Search species...' },
  control_measures: { 'ui:widget': 'textarea', 'ui:options': { rows: 4 } },
  gps_location: { 'ui:widget': 'geo-picker' },
  photos: { 'ui:widget': 'photo-capture', 'ui:options': { maxFiles: 10, maxSizeMB: 5 } },
};

async function seed(): Promise<void> {
  console.log('Seeding form-builder...');

  // AU-IBAR tenant ID from seed-tenant.ts
  const auTenant = await prisma.tenant.findFirst({
    where: { code: 'AU-IBAR' },
  });

  if (!auTenant) {
    console.warn(
      'AU-IBAR tenant not found. Run tenant seed first. Using placeholder UUID.',
    );
  }

  const tenantId = auTenant?.id ?? '00000000-0000-0000-0000-000000000001';

  // Find SUPER_ADMIN user for createdBy
  const adminUser = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  const createdBy = adminUser?.id ?? '00000000-0000-0000-0000-000000000001';

  await prisma.formTemplate.upsert({
    where: {
      tenant_id_name_version: {
        tenant_id: tenantId,
        name: 'Animal Disease Event Report',
        version: 1,
      },
    },
    update: {
      schema: ANIMAL_DISEASE_EVENT_REPORT_SCHEMA,
      ui_schema: ANIMAL_DISEASE_EVENT_REPORT_UI_SCHEMA,
    },
    create: {
      tenant_id: tenantId,
      name: 'Animal Disease Event Report',
      domain: 'health',
      version: 1,
      schema: ANIMAL_DISEASE_EVENT_REPORT_SCHEMA,
      ui_schema: ANIMAL_DISEASE_EVENT_REPORT_UI_SCHEMA,
      status: 'PUBLISHED',
      data_classification: 'RESTRICTED',
      created_by: createdBy,
      published_at: new Date(),
    },
  });

  console.log('Seeded: "Animal Disease Event Report" base template (AU-IBAR, PUBLISHED)');
}

seed()
  .then(() => {
    console.log('Form-builder seed completed.');
    return prisma.$disconnect();
  })
  .catch((error) => {
    console.error('Form-builder seed failed:', error);
    return prisma.$disconnect().then(() => process.exit(1));
  });
