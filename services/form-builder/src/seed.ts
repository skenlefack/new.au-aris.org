import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════
// FormBuilder Seed — 3 example forms with full no-code schema
// ═══════════════════════════════════════════════════════════════

function uuid() {
  return crypto.randomUUID();
}

// ──────────────────────────────────────────────────────────────
// 1. Outbreak Report (Animal Health)
// ──────────────────────────────────────────────────────────────
const OUTBREAK_REPORT_SCHEMA = {
  sections: [
    {
      id: uuid(),
      name: { en: 'General Information', fr: 'Informations Générales' },
      description: { en: 'Basic report identification', fr: 'Identification du rapport' },
      columns: 2,
      order: 0,
      isCollapsible: true,
      isCollapsed: false,
      isRepeatable: false,
      icon: 'Info',
      color: '#3B82F6',
      conditions: [],
      fields: [
        {
          id: uuid(), type: 'auto-id', code: 'report_id',
          label: { en: 'Report ID', fr: 'ID du Rapport' },
          column: 1, columnSpan: 1, order: 0,
          required: true, readOnly: true, hidden: false,
          validation: {},
          conditions: [],
          properties: { prefix: 'OB-', format: '{COUNTRY}-{YEAR}-{SEQ}' },
        },
        {
          id: uuid(), type: 'date', code: 'report_date',
          label: { en: 'Report Date', fr: 'Date du Rapport' },
          column: 2, columnSpan: 1, order: 1,
          required: true, readOnly: false, hidden: false,
          validation: { disableFuture: true },
          conditions: [],
          properties: {},
        },
        {
          id: uuid(), type: 'text', code: 'reporter_name',
          label: { en: 'Reporter Name', fr: 'Nom du Rapporteur' },
          placeholder: { en: 'Full name...', fr: 'Nom complet...' },
          column: 1, columnSpan: 1, order: 2,
          required: true, readOnly: false, hidden: false,
          validation: { minLength: 2, maxLength: 100 },
          conditions: [],
          properties: {},
        },
        {
          id: uuid(), type: 'phone', code: 'reporter_phone',
          label: { en: 'Phone', fr: 'Téléphone' },
          placeholder: { en: '+254...', fr: '+237...' },
          column: 2, columnSpan: 1, order: 3,
          required: false, readOnly: false, hidden: false,
          validation: {},
          conditions: [],
          properties: {},
        },
      ],
    },
    {
      id: uuid(),
      name: { en: 'Location', fr: 'Localisation' },
      description: { en: 'Where the outbreak occurred', fr: 'Lieu du foyer' },
      columns: 2,
      order: 1,
      isCollapsible: true,
      isCollapsed: false,
      isRepeatable: false,
      icon: 'MapPin',
      color: '#10B981',
      conditions: [],
      fields: [
        {
          id: uuid(), type: 'admin-location', code: 'admin_location',
          label: { en: 'Administrative Location', fr: 'Localisation Administrative' },
          column: 1, columnSpan: 2, order: 0,
          required: true, readOnly: false, hidden: false,
          validation: {},
          conditions: [],
          properties: { levels: [1, 2, 3], requiredLevels: [1, 2] },
        },
        {
          id: uuid(), type: 'geo-point', code: 'gps_location',
          label: { en: 'GPS Coordinates', fr: 'Coordonnées GPS' },
          helpText: { en: 'Mark the exact location of the outbreak', fr: 'Marquez la localisation exacte du foyer' },
          column: 1, columnSpan: 2, order: 1,
          required: false, readOnly: false, hidden: false,
          validation: {},
          conditions: [],
          properties: { autoDetect: true, allowManualEntry: true, showMap: true },
        },
      ],
    },
    {
      id: uuid(),
      name: { en: 'Species & Disease', fr: 'Espèce et Maladie' },
      description: { en: 'Identify affected species and suspected disease' },
      columns: 2,
      order: 2,
      isCollapsible: true,
      isCollapsed: false,
      isRepeatable: false,
      icon: 'HeartPulse',
      color: '#EF4444',
      conditions: [],
      fields: (() => {
        const speciesGroupId = uuid();
        const speciesId = uuid();
        const diseaseId = uuid();
        return [
          {
            id: speciesGroupId, type: 'master-data-select', code: 'species_group',
            label: { en: 'Species Group', fr: 'Groupe d\'Espèces' },
            column: 1, columnSpan: 1, order: 0,
            required: true, readOnly: false, hidden: false,
            validation: {},
            conditions: [],
            properties: {
              masterDataType: 'species-groups', displayField: 'name', valueField: 'id',
              multiple: false, searchable: true,
              cascadeTarget: speciesId, cascadeParam: 'groupId',
            },
          },
          {
            id: speciesId, type: 'master-data-select', code: 'species',
            label: { en: 'Species', fr: 'Espèce' },
            column: 2, columnSpan: 1, order: 1,
            required: true, readOnly: false, hidden: false,
            validation: {},
            conditions: [
              { id: uuid(), type: 'visibility', action: 'show', logic: 'all',
                rules: [{ field: speciesGroupId, operator: 'isNotEmpty', value: null }] },
            ],
            properties: {
              masterDataType: 'species', displayField: 'name', valueField: 'id',
              multiple: false, searchable: true,
              cascadeSource: speciesGroupId, cascadeParam: 'groupId',
            },
          },
          {
            id: diseaseId, type: 'master-data-select', code: 'disease',
            label: { en: 'Suspected Disease', fr: 'Maladie Suspectée' },
            column: 1, columnSpan: 2, order: 2,
            required: true, readOnly: false, hidden: false,
            validation: {},
            conditions: [],
            properties: {
              masterDataType: 'diseases', displayField: 'name', valueField: 'id',
              multiple: false, searchable: true,
            },
          },
          {
            id: uuid(), type: 'number', code: 'animals_sick',
            label: { en: 'Animals Sick', fr: 'Animaux Malades' },
            column: 1, columnSpan: 1, order: 3,
            required: true, readOnly: false, hidden: false,
            validation: { min: 0 },
            conditions: [],
            properties: { unit: 'heads' },
          },
          {
            id: uuid(), type: 'number', code: 'animals_dead',
            label: { en: 'Animals Dead', fr: 'Animaux Morts' },
            column: 2, columnSpan: 1, order: 4,
            required: true, readOnly: false, hidden: false,
            validation: { min: 0 },
            conditions: [],
            properties: { unit: 'heads' },
          },
          {
            id: uuid(), type: 'number', code: 'animals_at_risk',
            label: { en: 'Animals at Risk', fr: 'Animaux à Risque' },
            column: 1, columnSpan: 1, order: 5,
            required: false, readOnly: false, hidden: false,
            validation: { min: 0 },
            conditions: [],
            properties: { unit: 'heads' },
          },
          {
            id: uuid(), type: 'calculated', code: 'mortality_rate',
            label: { en: 'Mortality Rate (%)', fr: 'Taux de Mortalité (%)' },
            column: 2, columnSpan: 1, order: 6,
            required: false, readOnly: true, hidden: false,
            validation: {},
            conditions: [],
            properties: { formula: '{animals_dead} / ({animals_sick} + {animals_dead}) * 100' },
          },
        ];
      })(),
    },
    {
      id: uuid(),
      name: { en: 'Control Measures & Notes', fr: 'Mesures de Contrôle & Notes' },
      columns: 1,
      order: 3,
      isCollapsible: true,
      isCollapsed: false,
      isRepeatable: false,
      icon: 'Shield',
      color: '#8B5CF6',
      conditions: [],
      fields: [
        {
          id: uuid(), type: 'multi-select', code: 'control_measures',
          label: { en: 'Control Measures Applied', fr: 'Mesures de Contrôle Appliquées' },
          column: 1, columnSpan: 1, order: 0,
          required: false, readOnly: false, hidden: false,
          validation: {},
          conditions: [],
          properties: {
            options: [
              { label: { en: 'Quarantine' }, value: 'quarantine' },
              { label: { en: 'Movement Restriction' }, value: 'movement_restriction' },
              { label: { en: 'Ring Vaccination' }, value: 'ring_vaccination' },
              { label: { en: 'Culling' }, value: 'culling' },
              { label: { en: 'Disinfection' }, value: 'disinfection' },
              { label: { en: 'Treatment' }, value: 'treatment' },
              { label: { en: 'Surveillance Zone' }, value: 'surveillance_zone' },
            ],
          },
        },
        {
          id: uuid(), type: 'textarea', code: 'notes',
          label: { en: 'Additional Notes', fr: 'Notes Supplémentaires' },
          placeholder: { en: 'Any additional observations or context...' },
          column: 1, columnSpan: 1, order: 1,
          required: false, readOnly: false, hidden: false,
          validation: { maxLength: 2000 },
          conditions: [],
          properties: { rows: 4 },
        },
        {
          id: uuid(), type: 'image', code: 'photos',
          label: { en: 'Photos', fr: 'Photos' },
          helpText: { en: 'Attach field photos (clinical signs, environment)' },
          column: 1, columnSpan: 1, order: 2,
          required: false, readOnly: false, hidden: false,
          validation: { maxFiles: 10, maxSize: 5242880 },
          conditions: [],
          properties: { accept: 'image/*', allowCamera: true },
        },
      ],
    },
  ],
  settings: {
    allowDraft: true,
    allowAttachments: true,
    maxAttachments: 10,
    allowOffline: true,
    requireGeoLocation: true,
    autoSaveInterval: 30,
    submissionWorkflow: 'review_then_validate',
    notifyOnSubmit: ['supervisor'],
    duplicateDetection: { enabled: true, fields: ['species', 'admin_location', 'report_date'] },
  },
};

// ──────────────────────────────────────────────────────────────
// 2. Vaccination Campaign Report
// ──────────────────────────────────────────────────────────────
const VACCINATION_REPORT_SCHEMA = {
  sections: [
    {
      id: uuid(),
      name: { en: 'Campaign Information', fr: 'Informations Campagne' },
      columns: 2,
      order: 0,
      isCollapsible: true, isCollapsed: false, isRepeatable: false,
      color: '#059669', conditions: [],
      fields: [
        {
          id: uuid(), type: 'text', code: 'campaign_name',
          label: { en: 'Campaign Name', fr: 'Nom de la Campagne' },
          column: 1, columnSpan: 2, order: 0,
          required: true, readOnly: false, hidden: false,
          validation: { minLength: 3, maxLength: 200 },
          conditions: [], properties: {},
        },
        {
          id: uuid(), type: 'date-range', code: 'campaign_dates',
          label: { en: 'Campaign Period', fr: 'Période de la Campagne' },
          column: 1, columnSpan: 2, order: 1,
          required: true, readOnly: false, hidden: false,
          validation: {}, conditions: [], properties: {},
        },
        {
          id: uuid(), type: 'text', code: 'team_leader',
          label: { en: 'Team Leader', fr: 'Chef d\'Équipe' },
          column: 1, columnSpan: 1, order: 2,
          required: true, readOnly: false, hidden: false,
          validation: {}, conditions: [], properties: {},
        },
        {
          id: uuid(), type: 'number', code: 'team_size',
          label: { en: 'Team Size', fr: 'Taille de l\'Équipe' },
          column: 2, columnSpan: 1, order: 3,
          required: false, readOnly: false, hidden: false,
          validation: { min: 1, max: 50 },
          conditions: [], properties: {},
        },
      ],
    },
    {
      id: uuid(),
      name: { en: 'Location', fr: 'Localisation' },
      columns: 2, order: 1,
      isCollapsible: true, isCollapsed: false, isRepeatable: false,
      color: '#10B981', conditions: [],
      fields: [
        {
          id: uuid(), type: 'admin-location', code: 'vaccination_location',
          label: { en: 'Vaccination Area', fr: 'Zone de Vaccination' },
          column: 1, columnSpan: 2, order: 0,
          required: true, readOnly: false, hidden: false,
          validation: {}, conditions: [],
          properties: { levels: [1, 2, 3], requiredLevels: [1, 2] },
        },
        {
          id: uuid(), type: 'geo-point', code: 'vaccination_point',
          label: { en: 'GPS Point', fr: 'Point GPS' },
          column: 1, columnSpan: 2, order: 1,
          required: false, readOnly: false, hidden: false,
          validation: {}, conditions: [],
          properties: { autoDetect: true, showMap: true },
        },
      ],
    },
    {
      id: uuid(),
      name: { en: 'Vaccination Data', fr: 'Données de Vaccination' },
      columns: 2, order: 2,
      isCollapsible: true, isCollapsed: false, isRepeatable: false,
      color: '#6366F1', conditions: [],
      fields: [
        {
          id: uuid(), type: 'master-data-select', code: 'target_species',
          label: { en: 'Target Species', fr: 'Espèce Cible' },
          column: 1, columnSpan: 1, order: 0,
          required: true, readOnly: false, hidden: false,
          validation: {}, conditions: [],
          properties: { masterDataType: 'species', multiple: true, searchable: true },
        },
        {
          id: uuid(), type: 'master-data-select', code: 'vaccine_disease',
          label: { en: 'Disease Targeted', fr: 'Maladie Ciblée' },
          column: 2, columnSpan: 1, order: 1,
          required: true, readOnly: false, hidden: false,
          validation: {}, conditions: [],
          properties: { masterDataType: 'diseases', searchable: true },
        },
        {
          id: uuid(), type: 'number', code: 'total_vaccinated',
          label: { en: 'Total Animals Vaccinated', fr: 'Total Animaux Vaccinés' },
          column: 1, columnSpan: 1, order: 2,
          required: true, readOnly: false, hidden: false,
          validation: { min: 0 }, conditions: [],
          properties: { unit: 'heads' },
        },
        {
          id: uuid(), type: 'number', code: 'total_target',
          label: { en: 'Target Population', fr: 'Population Cible' },
          column: 2, columnSpan: 1, order: 3,
          required: true, readOnly: false, hidden: false,
          validation: { min: 0 }, conditions: [],
          properties: { unit: 'heads' },
        },
        {
          id: uuid(), type: 'calculated', code: 'coverage_rate',
          label: { en: 'Coverage Rate (%)', fr: 'Taux de Couverture (%)' },
          column: 1, columnSpan: 2, order: 4,
          required: false, readOnly: true, hidden: false,
          validation: {}, conditions: [],
          properties: { formula: '{total_vaccinated} / {total_target} * 100' },
        },
      ],
    },
    {
      id: uuid(),
      name: { en: 'Vaccine Stock', fr: 'Stock de Vaccins' },
      columns: 2, order: 3,
      isCollapsible: true, isCollapsed: false, isRepeatable: false,
      color: '#F59E0B', conditions: [],
      fields: [
        {
          id: uuid(), type: 'text', code: 'vaccine_name',
          label: { en: 'Vaccine Name', fr: 'Nom du Vaccin' },
          column: 1, columnSpan: 1, order: 0,
          required: true, readOnly: false, hidden: false,
          validation: {}, conditions: [], properties: {},
        },
        {
          id: uuid(), type: 'text', code: 'batch_number',
          label: { en: 'Batch Number', fr: 'Numéro de Lot' },
          column: 2, columnSpan: 1, order: 1,
          required: true, readOnly: false, hidden: false,
          validation: {}, conditions: [], properties: {},
        },
        {
          id: uuid(), type: 'number', code: 'doses_received',
          label: { en: 'Doses Received', fr: 'Doses Reçues' },
          column: 1, columnSpan: 1, order: 2,
          required: true, readOnly: false, hidden: false,
          validation: { min: 0 }, conditions: [],
          properties: { unit: 'doses' },
        },
        {
          id: uuid(), type: 'number', code: 'doses_used',
          label: { en: 'Doses Used', fr: 'Doses Utilisées' },
          column: 2, columnSpan: 1, order: 3,
          required: true, readOnly: false, hidden: false,
          validation: { min: 0 }, conditions: [],
          properties: { unit: 'doses' },
        },
        {
          id: uuid(), type: 'number', code: 'doses_wasted',
          label: { en: 'Doses Wasted', fr: 'Doses Gaspillées' },
          column: 1, columnSpan: 1, order: 4,
          required: false, readOnly: false, hidden: false,
          validation: { min: 0 }, conditions: [],
          properties: { unit: 'doses' },
        },
        {
          id: uuid(), type: 'textarea', code: 'stock_notes',
          label: { en: 'Notes', fr: 'Notes' },
          column: 1, columnSpan: 2, order: 5,
          required: false, readOnly: false, hidden: false,
          validation: {}, conditions: [],
          properties: { rows: 3 },
        },
      ],
    },
  ],
  settings: {
    allowDraft: true, allowAttachments: true, maxAttachments: 5,
    allowOffline: true, requireGeoLocation: false, autoSaveInterval: 30,
    submissionWorkflow: 'review_then_validate', notifyOnSubmit: ['supervisor'],
    duplicateDetection: { enabled: false, fields: [] },
  },
};

// ──────────────────────────────────────────────────────────────
// 3. Livestock Market Report (Trade & SPS)
// ──────────────────────────────────────────────────────────────
const MARKET_REPORT_SCHEMA = {
  sections: [
    {
      id: uuid(),
      name: { en: 'Market Information', fr: 'Informations du Marché' },
      columns: 2, order: 0,
      isCollapsible: true, isCollapsed: false, isRepeatable: false,
      color: '#F97316', conditions: [],
      fields: [
        {
          id: uuid(), type: 'text', code: 'market_name',
          label: { en: 'Market Name', fr: 'Nom du Marché' },
          column: 1, columnSpan: 1, order: 0,
          required: true, readOnly: false, hidden: false,
          validation: {}, conditions: [], properties: {},
        },
        {
          id: uuid(), type: 'date', code: 'market_date',
          label: { en: 'Market Date', fr: 'Date du Marché' },
          column: 2, columnSpan: 1, order: 1,
          required: true, readOnly: false, hidden: false,
          validation: { disableFuture: true }, conditions: [], properties: {},
        },
        {
          id: uuid(), type: 'admin-location', code: 'market_location',
          label: { en: 'Market Location', fr: 'Localisation du Marché' },
          column: 1, columnSpan: 2, order: 2,
          required: true, readOnly: false, hidden: false,
          validation: {}, conditions: [],
          properties: { levels: [1, 2], requiredLevels: [1] },
        },
      ],
    },
    {
      id: uuid(),
      name: { en: 'Animals Present', fr: 'Animaux Présents' },
      columns: 1, order: 1,
      isCollapsible: true, isCollapsed: false, isRepeatable: false,
      color: '#3B82F6', conditions: [],
      fields: [
        {
          id: uuid(), type: 'repeater', code: 'animals_data',
          label: { en: 'Animals by Species', fr: 'Animaux par Espèce' },
          column: 1, columnSpan: 1, order: 0,
          required: true, readOnly: false, hidden: false,
          validation: {}, conditions: [],
          properties: {
            minRows: 1, maxRows: 20,
            addLabel: { en: 'Add species', fr: 'Ajouter une espèce' },
            fields: [
              { type: 'master-data-select', code: 'species', label: { en: 'Species' }, properties: { masterDataType: 'species' } },
              { type: 'select', code: 'age_group', label: { en: 'Age Group' }, properties: { options: [
                { label: { en: 'Young' }, value: 'young' },
                { label: { en: 'Adult' }, value: 'adult' },
                { label: { en: 'Old' }, value: 'old' },
              ]}},
              { type: 'number', code: 'count', label: { en: 'Count' }, properties: { unit: 'heads' } },
              { type: 'number', code: 'avg_price', label: { en: 'Avg Price (USD)' }, properties: { unit: 'USD', decimals: 2 } },
            ],
          },
        },
      ],
    },
    {
      id: uuid(),
      name: { en: 'Health Observations', fr: 'Observations Sanitaires' },
      columns: 1, order: 2,
      isCollapsible: true, isCollapsed: false, isRepeatable: false,
      color: '#EF4444', conditions: [],
      fields: (() => {
        const toggleId = uuid();
        return [
          {
            id: toggleId, type: 'toggle', code: 'disease_signs_observed',
            label: { en: 'Disease Signs Observed?', fr: 'Signes de Maladie Observés ?' },
            column: 1, columnSpan: 1, order: 0,
            required: false, readOnly: false, hidden: false,
            validation: {}, conditions: [],
            properties: { labelOn: { en: 'Yes' }, labelOff: { en: 'No' } },
          },
          {
            id: uuid(), type: 'textarea', code: 'disease_details',
            label: { en: 'Disease Details', fr: 'Détails de la Maladie' },
            placeholder: { en: 'Describe the signs observed...' },
            column: 1, columnSpan: 1, order: 1,
            required: false, readOnly: false, hidden: false,
            validation: {}, properties: { rows: 4 },
            conditions: [
              { id: uuid(), type: 'visibility', action: 'show', logic: 'all',
                rules: [{ field: toggleId, operator: 'isTrue', value: null }] },
            ],
          },
        ];
      })(),
    },
    {
      id: uuid(),
      name: { en: 'Trade Volume', fr: 'Volume Commercial' },
      columns: 2, order: 3,
      isCollapsible: true, isCollapsed: false, isRepeatable: false,
      color: '#8B5CF6', conditions: [],
      fields: [
        {
          id: uuid(), type: 'number', code: 'total_transactions',
          label: { en: 'Total Transactions', fr: 'Transactions Totales' },
          column: 1, columnSpan: 1, order: 0,
          required: false, readOnly: false, hidden: false,
          validation: { min: 0 }, conditions: [], properties: {},
        },
        {
          id: uuid(), type: 'number', code: 'total_value',
          label: { en: 'Total Value (USD)', fr: 'Valeur Totale (USD)' },
          column: 2, columnSpan: 1, order: 1,
          required: false, readOnly: false, hidden: false,
          validation: { min: 0 }, conditions: [],
          properties: { unit: 'USD', decimals: 2 },
        },
        {
          id: uuid(), type: 'textarea', code: 'market_notes',
          label: { en: 'Market Notes', fr: 'Notes du Marché' },
          column: 1, columnSpan: 2, order: 2,
          required: false, readOnly: false, hidden: false,
          validation: {}, conditions: [], properties: { rows: 3 },
        },
      ],
    },
  ],
  settings: {
    allowDraft: true, allowAttachments: true, maxAttachments: 5,
    allowOffline: true, requireGeoLocation: false, autoSaveInterval: 30,
    submissionWorkflow: 'review_then_validate', notifyOnSubmit: [],
    duplicateDetection: { enabled: false, fields: [] },
  },
};

// ──────────────────────────────────────────────────────────────
// Seed function
// ──────────────────────────────────────────────────────────────
async function seed(): Promise<void> {
  console.log('Seeding form-builder with 3 example forms...');

  const auTenant = await prisma.tenant.findFirst({ where: { code: 'AU-IBAR' } });
  if (!auTenant) {
    console.warn('AU-IBAR tenant not found. Run tenant seed first. Using placeholder UUID.');
  }
  const tenantId = auTenant?.id ?? '00000000-0000-0000-0000-000000000001';

  const adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const createdBy = adminUser?.id ?? '00000000-0000-0000-0000-000000000001';

  const templates = [
    {
      name: 'Outbreak Report',
      domain: 'animal_health',
      schema: OUTBREAK_REPORT_SCHEMA,
      classification: 'RESTRICTED',
    },
    {
      name: 'Vaccination Campaign Report',
      domain: 'animal_health',
      schema: VACCINATION_REPORT_SCHEMA,
      classification: 'RESTRICTED',
    },
    {
      name: 'Livestock Market Report',
      domain: 'trade_sps',
      schema: MARKET_REPORT_SCHEMA,
      classification: 'PARTNER',
    },
  ];

  for (const t of templates) {
    try {
      await (prisma as any).formTemplate.upsert({
        where: {
          tenant_id_name_version: {
            tenant_id: tenantId,
            name: t.name,
            version: 1,
          },
        },
        update: {
          schema: t.schema as any,
          domain: t.domain,
        },
        create: {
          tenant_id: tenantId,
          name: t.name,
          domain: t.domain,
          version: 1,
          schema: t.schema as any,
          ui_schema: {},
          status: 'PUBLISHED',
          data_classification: t.classification,
          created_by: createdBy,
          published_at: new Date(),
        },
      });
      console.log(`  ✓ ${t.name} (${t.domain})`);
    } catch (err) {
      console.error(`  ✗ ${t.name}:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log('Form-builder seed completed.');
}

seed()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Form-builder seed failed:', error);
    return prisma.$disconnect().then(() => process.exit(1));
  });
