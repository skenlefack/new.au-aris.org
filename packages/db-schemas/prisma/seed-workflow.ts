import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Known user IDs from seed-credential.ts
const USER_IDS = {
  SUPER_ADMIN: '10000000-0000-4000-a000-000000000001',
  KE_ADMIN: '10000000-0000-4000-a000-000000000101',
  NG_ADMIN: '10000000-0000-4000-a000-000000000201',
};

// Deterministic IDs for workflow entities
const WORKFLOW_IDS = {
  KE_WORKFLOW: '20000000-0000-4000-a000-000000000001',
  CM_WORKFLOW: '20000000-0000-4000-a000-000000000002',
  NG_WORKFLOW: '20000000-0000-4000-a000-000000000003',
  CAMPAIGN_Q1: '30000000-0000-4000-a000-000000000001',
};

async function main(): Promise<void> {
  console.log('Seeding workflow definitions...');

  // ── Find countries ──
  const kenya = await (prisma as any).country.findUnique({ where: { code: 'KE' } });
  const cameroon = await (prisma as any).country.findUnique({ where: { code: 'CM' } });
  const nigeria = await (prisma as any).country.findUnique({ where: { code: 'NG' } });

  if (!kenya) {
    console.log('Country KE not found — skipping Kenya workflow. Run seed-settings first.');
  }
  if (!cameroon) {
    console.log('Country CM not found — skipping Cameroon workflow.');
  }
  if (!nigeria) {
    console.log('Country NG not found — skipping Nigeria workflow.');
  }

  // ── Kenya Workflow (5 admin levels + national) ──
  if (kenya) {
    const keWf = await (prisma as any).collecteWorkflow.upsert({
      where: { countryId: kenya.id },
      update: {},
      create: {
        id: WORKFLOW_IDS.KE_WORKFLOW,
        countryId: kenya.id,
        name: { en: 'Kenya Validation Workflow', fr: 'Workflow de validation Kenya' },
        description: {
          en: 'Full 5-level validation from Sub-Location to National CVO',
          fr: 'Validation complète à 5 niveaux du sous-emplacement au CVO national',
        },
        startLevel: 5,
        endLevel: 0,
        defaultTransmitDelay: 72,
        defaultValidationDelay: 48,
        autoTransmitEnabled: true,
        autoValidateEnabled: false,
        requireComment: false,
        allowReject: true,
        allowReturnForCorrection: true,
        createdBy: USER_IDS.KE_ADMIN,
      },
    });

    // Kenya steps
    const keSteps = [
      {
        stepOrder: 0,
        levelType: 'admin5',
        adminLevel: 5,
        name: { en: 'Sub-Location Collection', fr: 'Collecte Sous-Emplacement' },
        canEdit: true,
        canValidate: false,
      },
      {
        stepOrder: 1,
        levelType: 'admin4',
        adminLevel: 4,
        name: { en: 'Location Review', fr: 'Revue Emplacement' },
        transmitDelayHours: 48,
      },
      {
        stepOrder: 2,
        levelType: 'admin3',
        adminLevel: 3,
        name: { en: 'Ward Validation', fr: 'Validation Ward' },
      },
      {
        stepOrder: 3,
        levelType: 'admin2',
        adminLevel: 2,
        name: { en: 'Sub-County Validation', fr: 'Validation Sous-Comté' },
      },
      {
        stepOrder: 4,
        levelType: 'admin1',
        adminLevel: 1,
        name: { en: 'County Validation', fr: 'Validation Comté' },
      },
      {
        stepOrder: 5,
        levelType: 'national',
        adminLevel: null,
        name: { en: 'National Validation (CVO)', fr: 'Validation Nationale (CVO)' },
      },
    ];

    for (const step of keSteps) {
      await (prisma as any).collecteWorkflowStep.upsert({
        where: {
          workflowId_stepOrder: {
            workflowId: keWf.id,
            stepOrder: step.stepOrder,
          },
        },
        update: {},
        create: {
          workflowId: keWf.id,
          stepOrder: step.stepOrder,
          levelType: step.levelType,
          adminLevel: step.adminLevel,
          name: step.name,
          canEdit: step.canEdit ?? false,
          canValidate: step.canValidate ?? true,
          transmitDelayHours: step.transmitDelayHours ?? null,
        },
      });
    }

    console.log(`  Kenya workflow created with ${keSteps.length} steps`);
  }

  // ── Cameroon Workflow (4 admin levels + national) ──
  if (cameroon) {
    const cmWf = await (prisma as any).collecteWorkflow.upsert({
      where: { countryId: cameroon.id },
      update: {},
      create: {
        id: WORKFLOW_IDS.CM_WORKFLOW,
        countryId: cameroon.id,
        name: { en: 'Cameroon Validation Workflow', fr: 'Workflow de Validation Cameroun' },
        description: {
          en: 'Validation from CZV to National DSV',
          fr: 'Validation du CZV au DSV national',
        },
        startLevel: 4,
        endLevel: 0,
        defaultTransmitDelay: 72,
        defaultValidationDelay: 48,
        autoTransmitEnabled: true,
        autoValidateEnabled: false,
        createdBy: USER_IDS.SUPER_ADMIN,
      },
    });

    const cmSteps = [
      {
        stepOrder: 0,
        levelType: 'admin4',
        adminLevel: 4,
        name: { en: 'CZV Collection', fr: 'Collecte CZV' },
        canEdit: true,
        canValidate: false,
      },
      {
        stepOrder: 1,
        levelType: 'admin3',
        adminLevel: 3,
        name: { en: 'Arrondissement Validation', fr: 'Validation Arrondissement' },
      },
      {
        stepOrder: 2,
        levelType: 'admin2',
        adminLevel: 2,
        name: { en: 'Department Validation', fr: 'Validation Département' },
      },
      {
        stepOrder: 3,
        levelType: 'admin1',
        adminLevel: 1,
        name: { en: 'Region Validation', fr: 'Validation Région' },
      },
      {
        stepOrder: 4,
        levelType: 'national',
        adminLevel: null,
        name: { en: 'National Validation (DSV)', fr: 'Validation Nationale (DSV)' },
      },
    ];

    for (const step of cmSteps) {
      await (prisma as any).collecteWorkflowStep.upsert({
        where: {
          workflowId_stepOrder: {
            workflowId: cmWf.id,
            stepOrder: step.stepOrder,
          },
        },
        update: {},
        create: {
          workflowId: cmWf.id,
          stepOrder: step.stepOrder,
          levelType: step.levelType,
          adminLevel: step.adminLevel,
          name: step.name,
          canEdit: step.canEdit ?? false,
          canValidate: step.canValidate ?? true,
        },
      });
    }

    console.log(`  Cameroon workflow created with ${cmSteps.length} steps`);
  }

  // ── Nigeria Workflow (3 admin levels + national) ──
  if (nigeria) {
    const ngWf = await (prisma as any).collecteWorkflow.upsert({
      where: { countryId: nigeria.id },
      update: {},
      create: {
        id: WORKFLOW_IDS.NG_WORKFLOW,
        countryId: nigeria.id,
        name: { en: 'Nigeria Validation Workflow', fr: 'Workflow de Validation Nigeria' },
        description: {
          en: 'Validation from Ward to Federal level',
          fr: 'Validation du quartier au niveau fédéral',
        },
        startLevel: 3,
        endLevel: 0,
        defaultTransmitDelay: 72,
        defaultValidationDelay: 48,
        autoTransmitEnabled: true,
        autoValidateEnabled: false,
        createdBy: USER_IDS.NG_ADMIN,
      },
    });

    const ngSteps = [
      {
        stepOrder: 0,
        levelType: 'admin3',
        adminLevel: 3,
        name: { en: 'Ward Collection', fr: 'Collecte Ward' },
        canEdit: true,
        canValidate: false,
      },
      {
        stepOrder: 1,
        levelType: 'admin2',
        adminLevel: 2,
        name: { en: 'LGA Validation', fr: 'Validation LGA' },
      },
      {
        stepOrder: 2,
        levelType: 'admin1',
        adminLevel: 1,
        name: { en: 'State Validation', fr: 'Validation État' },
      },
      {
        stepOrder: 3,
        levelType: 'national',
        adminLevel: null,
        name: { en: 'Federal Validation', fr: 'Validation Fédérale' },
      },
    ];

    for (const step of ngSteps) {
      await (prisma as any).collecteWorkflowStep.upsert({
        where: {
          workflowId_stepOrder: {
            workflowId: ngWf.id,
            stepOrder: step.stepOrder,
          },
        },
        update: {},
        create: {
          workflowId: ngWf.id,
          stepOrder: step.stepOrder,
          levelType: step.levelType,
          adminLevel: step.adminLevel,
          name: step.name,
          canEdit: step.canEdit ?? false,
          canValidate: step.canValidate ?? true,
        },
      });
    }

    console.log(`  Nigeria workflow created with ${ngSteps.length} steps`);
  }

  // ── Validation Chains ──
  console.log('Seeding validation chains...');

  // Kenya: admin@ke → super admin (simplified chain for demo)
  const keAdmin = await (prisma as any).user.findUnique({ where: { id: USER_IDS.KE_ADMIN } });
  const superAdmin = await (prisma as any).user.findUnique({ where: { id: USER_IDS.SUPER_ADMIN } });

  if (keAdmin && superAdmin) {
    await (prisma as any).collecteValidationChain.upsert({
      where: {
        userId_validatorId: {
          userId: keAdmin.id,
          validatorId: superAdmin.id,
        },
      },
      update: {},
      create: {
        userId: keAdmin.id,
        validatorId: superAdmin.id,
        priority: 1,
        levelType: 'national',
        createdBy: USER_IDS.SUPER_ADMIN,
      },
    });
    console.log('  Validation chain: KE Admin → Super Admin');
  }

  // Nigeria: admin@ng → super admin
  const ngAdmin = await (prisma as any).user.findUnique({ where: { id: USER_IDS.NG_ADMIN } });
  if (ngAdmin && superAdmin) {
    await (prisma as any).collecteValidationChain.upsert({
      where: {
        userId_validatorId: {
          userId: ngAdmin.id,
          validatorId: superAdmin.id,
        },
      },
      update: {},
      create: {
        userId: ngAdmin.id,
        validatorId: superAdmin.id,
        priority: 1,
        levelType: 'national',
        createdBy: USER_IDS.SUPER_ADMIN,
      },
    });
    console.log('  Validation chain: NG Admin → Super Admin');
  }

  // ── Collection Campaign ──
  console.log('Seeding collection campaigns...');

  // Find a published form template to link
  const template = await (prisma as any).formTemplate.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { created_at: 'asc' },
  });

  if (template) {
    await (prisma as any).collectionCampaign.upsert({
      where: {
        code_scope_ownerId: {
          code: 'Q1_2025_SURVEILLANCE',
          scope: 'continental',
          ownerId: USER_IDS.SUPER_ADMIN,
        },
      },
      update: {},
      create: {
        id: WORKFLOW_IDS.CAMPAIGN_Q1,
        code: 'Q1_2025_SURVEILLANCE',
        name: {
          en: 'Q1 2025 Routine Surveillance',
          fr: 'Surveillance de routine T1 2025',
        },
        description: {
          en: 'Quarterly animal health surveillance data collection across pilot countries',
          fr: 'Collecte de données de surveillance sanitaire animale trimestrielle dans les pays pilotes',
        },
        domain: 'animal_health',
        formTemplateId: template.id,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        targetCountries: ['KE', 'CM', 'NG'],
        targetSubmissions: 500,
        targetPerAgent: 10,
        frequency: 'monthly',
        status: 'ACTIVE',
        scope: 'continental',
        ownerId: USER_IDS.SUPER_ADMIN,
        ownerType: 'continental',
        sendReminders: true,
        reminderDaysBefore: 3,
        createdBy: USER_IDS.SUPER_ADMIN,
      },
    });

    // Add assignments
    if (keAdmin) {
      await (prisma as any).campaignAssignment.upsert({
        where: {
          campaignId_userId: {
            campaignId: WORKFLOW_IDS.CAMPAIGN_Q1,
            userId: keAdmin.id,
          },
        },
        update: {},
        create: {
          campaignId: WORKFLOW_IDS.CAMPAIGN_Q1,
          userId: keAdmin.id,
          countryCode: 'KE',
          targetSubmissions: 50,
          dueDate: new Date('2025-03-31'),
        },
      });
    }

    if (ngAdmin) {
      await (prisma as any).campaignAssignment.upsert({
        where: {
          campaignId_userId: {
            campaignId: WORKFLOW_IDS.CAMPAIGN_Q1,
            userId: ngAdmin.id,
          },
        },
        update: {},
        create: {
          campaignId: WORKFLOW_IDS.CAMPAIGN_Q1,
          userId: ngAdmin.id,
          countryCode: 'NG',
          targetSubmissions: 50,
          dueDate: new Date('2025-03-31'),
        },
      });
    }

    console.log('  Campaign Q1_2025_SURVEILLANCE created with assignments');
  } else {
    console.log('  No published FormTemplate found — skipping campaign seed. Run form-builder seed first.');
  }

  console.log('Workflow seed complete!');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Workflow seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
