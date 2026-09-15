/**
 * Seed system workflow templates.
 *
 * Run: node dist/seed/seed-templates.js
 * Or import and call seedWorkflowTemplates(prisma) from another seed script.
 */

import type { PrismaClient } from '@prisma/client';

interface TemplateData {
  category: string;
  name: Record<string, string>;
  description: Record<string, string>;
  graph_snapshot: any;
  is_system: boolean;
  tags: string[];
}

// ── 1. Standard 4-Level Validation ──
const STANDARD_4_LEVEL: TemplateData = {
  category: 'standard',
  name: {
    en: 'Standard 4-Level Validation',
    fr: 'Validation standard a 4 niveaux',
  },
  description: {
    en: 'Start, National Technical, National Official, REC Harmonization, Continental Publication, End. Includes parallel WAHIS notification branch.',
    fr: 'Debut, Technique nationale, Officielle nationale, Harmonisation CER, Publication continentale, Fin. Inclut une branche de notification WAHIS parallele.',
  },
  is_system: true,
  tags: ['standard', 'wahis', '4-level'],
  graph_snapshot: {
    graphVersion: 1,
    steps: [
      { stepKey: 'START', stepOrder: 0, nodeType: 'start', levelType: 'start', name: { en: 'Start', fr: 'Debut' }, canEdit: false, canValidate: false, mergeStrategy: 'ALL', positionX: 400, positionY: 50 },
      { stepKey: 'NATIONAL_TECHNICAL', stepOrder: 1, nodeType: 'step', levelType: 'NATIONAL_TECHNICAL', name: { en: 'National Technical', fr: 'Technique nationale' }, canEdit: true, canValidate: true, allowedRoles: ['DATA_STEWARD', 'NATIONAL_ADMIN'], mergeStrategy: 'ALL', positionX: 400, positionY: 180 },
      { stepKey: 'NATIONAL_OFFICIAL', stepOrder: 2, nodeType: 'step', levelType: 'NATIONAL_OFFICIAL', name: { en: 'National Official', fr: 'Officielle nationale' }, canEdit: false, canValidate: true, allowedRoles: ['NATIONAL_ADMIN'], mergeStrategy: 'ALL', positionX: 400, positionY: 310 },
      { stepKey: 'FORK_WAHIS', stepOrder: 3, nodeType: 'fork', levelType: 'fork', name: { en: 'Fork WAHIS', fr: 'Fork WAHIS' }, canEdit: false, canValidate: false, mergeStrategy: 'ALL', positionX: 400, positionY: 440 },
      { stepKey: 'WAHIS_NOTIFICATION', stepOrder: 4, nodeType: 'notification', levelType: 'notification', name: { en: 'WAHIS Notification', fr: 'Notification WAHIS' }, canEdit: false, canValidate: false, allowedRoles: ['WAHIS_FOCAL_POINT'], mergeStrategy: 'ALL', positionX: 620, positionY: 520 },
      { stepKey: 'REC_HARMONIZATION', stepOrder: 5, nodeType: 'step', levelType: 'REC_HARMONIZATION', name: { en: 'REC Harmonization', fr: 'Harmonisation CER' }, canEdit: false, canValidate: true, allowedRoles: ['REC_ADMIN', 'DATA_STEWARD'], mergeStrategy: 'ALL', positionX: 400, positionY: 570 },
      { stepKey: 'JOIN_WAHIS', stepOrder: 6, nodeType: 'join', levelType: 'join', name: { en: 'Join', fr: 'Jointure' }, canEdit: false, canValidate: false, mergeStrategy: 'ALL', positionX: 400, positionY: 700 },
      { stepKey: 'CONTINENTAL_PUBLICATION', stepOrder: 7, nodeType: 'step', levelType: 'CONTINENTAL_PUBLICATION', name: { en: 'Continental Publication', fr: 'Publication continentale' }, canEdit: false, canValidate: true, allowedRoles: ['CONTINENTAL_ADMIN', 'SUPER_ADMIN'], mergeStrategy: 'ALL', positionX: 400, positionY: 830 },
      { stepKey: 'END_1', stepOrder: 8, nodeType: 'end', levelType: 'end', name: { en: 'End', fr: 'Fin' }, canEdit: false, canValidate: false, mergeStrategy: 'ALL', positionX: 400, positionY: 960 },
    ],
    edges: [
      { sourceStepKey: 'START', targetStepKey: 'NATIONAL_TECHNICAL', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'NATIONAL_TECHNICAL', targetStepKey: 'NATIONAL_OFFICIAL', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'NATIONAL_OFFICIAL', targetStepKey: 'FORK_WAHIS', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'FORK_WAHIS', targetStepKey: 'REC_HARMONIZATION', edgeType: 'PARALLEL', sortOrder: 0 },
      { sourceStepKey: 'FORK_WAHIS', targetStepKey: 'WAHIS_NOTIFICATION', edgeType: 'PARALLEL', sortOrder: 1 },
      { sourceStepKey: 'REC_HARMONIZATION', targetStepKey: 'JOIN_WAHIS', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'WAHIS_NOTIFICATION', targetStepKey: 'JOIN_WAHIS', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'JOIN_WAHIS', targetStepKey: 'CONTINENTAL_PUBLICATION', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'CONTINENTAL_PUBLICATION', targetStepKey: 'END_1', edgeType: 'SEQUENTIAL', sortOrder: 0 },
    ],
  },
};

// ── 2. Simple 2-Level ──
const SIMPLE_2_LEVEL: TemplateData = {
  category: 'standard',
  name: {
    en: 'Simple 2-Level',
    fr: 'Simple a 2 niveaux',
  },
  description: {
    en: 'Start, National Validation, Continental Review, End. Minimal workflow for simple data flows.',
    fr: 'Debut, Validation nationale, Revue continentale, Fin. Workflow minimal pour des flux de donnees simples.',
  },
  is_system: true,
  tags: ['standard', 'simple', '2-level'],
  graph_snapshot: {
    graphVersion: 1,
    steps: [
      { stepKey: 'START', stepOrder: 0, nodeType: 'start', levelType: 'start', name: { en: 'Start', fr: 'Debut' }, canEdit: false, canValidate: false, mergeStrategy: 'ALL', positionX: 400, positionY: 50 },
      { stepKey: 'NATIONAL_VALIDATION', stepOrder: 1, nodeType: 'step', levelType: 'NATIONAL_TECHNICAL', name: { en: 'National Validation', fr: 'Validation nationale' }, canEdit: true, canValidate: true, allowedRoles: ['DATA_STEWARD', 'NATIONAL_ADMIN'], mergeStrategy: 'ALL', positionX: 400, positionY: 200 },
      { stepKey: 'CONTINENTAL_REVIEW', stepOrder: 2, nodeType: 'step', levelType: 'CONTINENTAL_PUBLICATION', name: { en: 'Continental Review', fr: 'Revue continentale' }, canEdit: false, canValidate: true, allowedRoles: ['CONTINENTAL_ADMIN', 'SUPER_ADMIN'], mergeStrategy: 'ALL', positionX: 400, positionY: 350 },
      { stepKey: 'END_1', stepOrder: 3, nodeType: 'end', levelType: 'end', name: { en: 'End', fr: 'Fin' }, canEdit: false, canValidate: false, mergeStrategy: 'ALL', positionX: 400, positionY: 500 },
    ],
    edges: [
      { sourceStepKey: 'START', targetStepKey: 'NATIONAL_VALIDATION', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'NATIONAL_VALIDATION', targetStepKey: 'CONTINENTAL_REVIEW', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'CONTINENTAL_REVIEW', targetStepKey: 'END_1', edgeType: 'SEQUENTIAL', sortOrder: 0 },
    ],
  },
};

// ── 3. PPR Sero-surveillance ──
const PPR_SERO_SURVEILLANCE: TemplateData = {
  category: 'surveillance',
  name: {
    en: 'PPR Sero-surveillance',
    fr: 'Sero-surveillance PPR',
  },
  description: {
    en: 'Field Collection, Lab Analysis (parallel National Lab + Regional Lab), National Review, REC Review, End.',
    fr: 'Collecte terrain, Analyse labo (parallele Labo national + Labo regional), Revue nationale, Revue CER, Fin.',
  },
  is_system: true,
  tags: ['surveillance', 'ppr', 'lab', 'parallel'],
  graph_snapshot: {
    graphVersion: 1,
    steps: [
      { stepKey: 'START', stepOrder: 0, nodeType: 'start', levelType: 'start', name: { en: 'Start', fr: 'Debut' }, canEdit: false, canValidate: false, mergeStrategy: 'ALL', positionX: 400, positionY: 50 },
      { stepKey: 'FIELD_COLLECTION', stepOrder: 1, nodeType: 'step', levelType: 'NATIONAL_TECHNICAL', name: { en: 'Field Collection', fr: 'Collecte terrain' }, canEdit: true, canValidate: true, allowedRoles: ['FIELD_AGENT', 'DATA_STEWARD'], mergeStrategy: 'ALL', positionX: 400, positionY: 180 },
      { stepKey: 'FORK_LAB', stepOrder: 2, nodeType: 'fork', levelType: 'fork', name: { en: 'Lab Analysis Fork', fr: 'Fork Analyse labo' }, canEdit: false, canValidate: false, mergeStrategy: 'ALL', positionX: 400, positionY: 310 },
      { stepKey: 'NATIONAL_LAB', stepOrder: 3, nodeType: 'step', levelType: 'NATIONAL_TECHNICAL', name: { en: 'National Lab', fr: 'Laboratoire national' }, canEdit: true, canValidate: true, allowedRoles: ['DATA_STEWARD', 'NATIONAL_ADMIN'], mergeStrategy: 'ALL', positionX: 250, positionY: 440 },
      { stepKey: 'REGIONAL_LAB', stepOrder: 4, nodeType: 'step', levelType: 'REC_HARMONIZATION', name: { en: 'Regional Lab', fr: 'Laboratoire regional' }, canEdit: true, canValidate: true, allowedRoles: ['REC_ADMIN', 'DATA_STEWARD'], mergeStrategy: 'ALL', positionX: 550, positionY: 440 },
      { stepKey: 'JOIN_LAB', stepOrder: 5, nodeType: 'join', levelType: 'join', name: { en: 'Join Lab Results', fr: 'Jointure resultats labo' }, canEdit: false, canValidate: false, mergeStrategy: 'ALL', positionX: 400, positionY: 570 },
      { stepKey: 'NATIONAL_REVIEW', stepOrder: 6, nodeType: 'step', levelType: 'NATIONAL_OFFICIAL', name: { en: 'National Review', fr: 'Revue nationale' }, canEdit: false, canValidate: true, allowedRoles: ['NATIONAL_ADMIN'], mergeStrategy: 'ALL', positionX: 400, positionY: 700 },
      { stepKey: 'REC_REVIEW', stepOrder: 7, nodeType: 'step', levelType: 'REC_HARMONIZATION', name: { en: 'REC Review', fr: 'Revue CER' }, canEdit: false, canValidate: true, allowedRoles: ['REC_ADMIN'], mergeStrategy: 'ALL', positionX: 400, positionY: 830 },
      { stepKey: 'END_1', stepOrder: 8, nodeType: 'end', levelType: 'end', name: { en: 'End', fr: 'Fin' }, canEdit: false, canValidate: false, mergeStrategy: 'ALL', positionX: 400, positionY: 960 },
    ],
    edges: [
      { sourceStepKey: 'START', targetStepKey: 'FIELD_COLLECTION', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'FIELD_COLLECTION', targetStepKey: 'FORK_LAB', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'FORK_LAB', targetStepKey: 'NATIONAL_LAB', edgeType: 'PARALLEL', sortOrder: 0 },
      { sourceStepKey: 'FORK_LAB', targetStepKey: 'REGIONAL_LAB', edgeType: 'PARALLEL', sortOrder: 1 },
      { sourceStepKey: 'NATIONAL_LAB', targetStepKey: 'JOIN_LAB', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'REGIONAL_LAB', targetStepKey: 'JOIN_LAB', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'JOIN_LAB', targetStepKey: 'NATIONAL_REVIEW', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'NATIONAL_REVIEW', targetStepKey: 'REC_REVIEW', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'REC_REVIEW', targetStepKey: 'END_1', edgeType: 'SEQUENTIAL', sortOrder: 0 },
    ],
  },
};

// ── 4. WAHIS Export Pipeline ──
const WAHIS_EXPORT_PIPELINE: TemplateData = {
  category: 'export',
  name: {
    en: 'WAHIS Export Pipeline',
    fr: 'Pipeline d\'export WAHIS',
  },
  description: {
    en: 'Data Preparation, Quality Check, WAHIS Formatting (notification), Official Approval, Export, End.',
    fr: 'Preparation des donnees, Controle qualite, Formatage WAHIS (notification), Approbation officielle, Export, Fin.',
  },
  is_system: true,
  tags: ['export', 'wahis', 'interop'],
  graph_snapshot: {
    graphVersion: 1,
    steps: [
      { stepKey: 'START', stepOrder: 0, nodeType: 'start', levelType: 'start', name: { en: 'Start', fr: 'Debut' }, canEdit: false, canValidate: false, mergeStrategy: 'ALL', positionX: 400, positionY: 50 },
      { stepKey: 'DATA_PREPARATION', stepOrder: 1, nodeType: 'step', levelType: 'NATIONAL_TECHNICAL', name: { en: 'Data Preparation', fr: 'Preparation des donnees' }, canEdit: true, canValidate: true, allowedRoles: ['DATA_STEWARD'], mergeStrategy: 'ALL', positionX: 400, positionY: 180 },
      { stepKey: 'QUALITY_CHECK', stepOrder: 2, nodeType: 'step', levelType: 'NATIONAL_TECHNICAL', name: { en: 'Quality Check', fr: 'Controle qualite' }, canEdit: false, canValidate: true, allowedRoles: ['DATA_STEWARD', 'NATIONAL_ADMIN'], mergeStrategy: 'ALL', positionX: 400, positionY: 310 },
      { stepKey: 'WAHIS_FORMATTING', stepOrder: 3, nodeType: 'notification', levelType: 'notification', name: { en: 'WAHIS Formatting', fr: 'Formatage WAHIS' }, canEdit: false, canValidate: false, allowedRoles: ['WAHIS_FOCAL_POINT'], mergeStrategy: 'ALL', positionX: 400, positionY: 440 },
      { stepKey: 'OFFICIAL_APPROVAL', stepOrder: 4, nodeType: 'step', levelType: 'NATIONAL_OFFICIAL', name: { en: 'Official Approval', fr: 'Approbation officielle' }, canEdit: false, canValidate: true, allowedRoles: ['NATIONAL_ADMIN'], mergeStrategy: 'ALL', positionX: 400, positionY: 570 },
      { stepKey: 'EXPORT', stepOrder: 5, nodeType: 'step', levelType: 'CONTINENTAL_PUBLICATION', name: { en: 'Export', fr: 'Export' }, canEdit: false, canValidate: true, allowedRoles: ['WAHIS_FOCAL_POINT', 'CONTINENTAL_ADMIN'], mergeStrategy: 'ALL', positionX: 400, positionY: 700 },
      { stepKey: 'END_1', stepOrder: 6, nodeType: 'end', levelType: 'end', name: { en: 'End', fr: 'Fin' }, canEdit: false, canValidate: false, mergeStrategy: 'ALL', positionX: 400, positionY: 830 },
    ],
    edges: [
      { sourceStepKey: 'START', targetStepKey: 'DATA_PREPARATION', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'DATA_PREPARATION', targetStepKey: 'QUALITY_CHECK', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'QUALITY_CHECK', targetStepKey: 'WAHIS_FORMATTING', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'WAHIS_FORMATTING', targetStepKey: 'OFFICIAL_APPROVAL', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'OFFICIAL_APPROVAL', targetStepKey: 'EXPORT', edgeType: 'SEQUENTIAL', sortOrder: 0 },
      { sourceStepKey: 'EXPORT', targetStepKey: 'END_1', edgeType: 'SEQUENTIAL', sortOrder: 0 },
    ],
  },
};

const SYSTEM_TEMPLATES: TemplateData[] = [
  STANDARD_4_LEVEL,
  SIMPLE_2_LEVEL,
  PPR_SERO_SURVEILLANCE,
  WAHIS_EXPORT_PIPELINE,
];

export async function seedWorkflowTemplates(prisma: PrismaClient): Promise<void> {
  console.log('[seed-templates] Seeding system workflow templates...');

  for (const tpl of SYSTEM_TEMPLATES) {
    // Check if already exists by name (en)
    const existing = await (prisma as any).$queryRawUnsafe(
      `SELECT id FROM workflow.workflow_templates WHERE is_system = true AND name->>'en' = $1 LIMIT 1`,
      tpl.name.en,
    );

    if (Array.isArray(existing) && existing.length > 0) {
      // Update existing
      await (prisma as any).$executeRawUnsafe(
        `UPDATE workflow.workflow_templates SET
          category = $1, name = $2::jsonb, description = $3::jsonb,
          graph_snapshot = $4::jsonb, tags = $5::jsonb, updated_at = NOW()
         WHERE id = $6::uuid`,
        tpl.category,
        JSON.stringify(tpl.name),
        JSON.stringify(tpl.description),
        JSON.stringify(tpl.graph_snapshot),
        JSON.stringify(tpl.tags),
        existing[0].id,
      );
      console.log(`  [update] ${tpl.name.en}`);
    } else {
      // Create new
      await (prisma as any).$executeRawUnsafe(
        `INSERT INTO workflow.workflow_templates
          (id, tenant_id, category, name, description, graph_snapshot, is_system, tags, usage_count, created_at, updated_at)
         VALUES (gen_random_uuid(), NULL, $1, $2::jsonb, $3::jsonb, $4::jsonb, true, $5::jsonb, 0, NOW(), NOW())`,
        tpl.category,
        JSON.stringify(tpl.name),
        JSON.stringify(tpl.description),
        JSON.stringify(tpl.graph_snapshot),
        JSON.stringify(tpl.tags),
      );
      console.log(`  [create] ${tpl.name.en}`);
    }
  }

  console.log(`[seed-templates] Done: ${SYSTEM_TEMPLATES.length} system templates seeded.`);
}

// Allow running as standalone script
if (process.argv[1]?.endsWith('seed-templates.js')) {
  import('@prisma/client').then(async ({ PrismaClient }) => {
    const prisma = new PrismaClient();
    try {
      await seedWorkflowTemplates(prisma);
    } finally {
      await prisma.$disconnect();
    }
  }).catch(console.error);
}
