/**
 * ARIS 4.0 — Programme Monitoring seed
 * Seeds the PPR Phase 2 programme with real structure from the Directrice's template
 *
 * Usage: tsx src/seed.ts (or node dist/seed.js in containers)
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Deterministic UUIDs for seeding
function sid(n: number): string {
  return `00000000-0000-4000-a000-pm${String(n).padStart(10, '0')}`;
}

const AU_TENANT_ID = '00000000-0000-4000-a000-000000000001'; // AU-IBAR continental
const ADMIN_USER_ID = '00000000-0000-4000-a000-000000000099';

async function main() {
  console.log('Seeding Programme Monitoring...');

  // ── Programme: PPR Phase 2 ──
  const programme = await (prisma as any).programme.upsert({
    where: { id: sid(1) },
    update: {},
    create: {
      id: sid(1),
      tenantId: AU_TENANT_ID,
      code: 'PPR-P2',
      name: {
        en: 'Pan-African PPR Eradication Programme - Phase 2',
        fr: 'Programme Panafricain d\'Eradication de la PPR - Phase 2',
      },
      description: {
        en: 'EU-funded programme to eradicate Peste des Petits Ruminants across Africa by 2030',
        fr: 'Programme financé par l\'UE pour éradiquer la PPR en Afrique d\'ici 2030',
      },
      donorName: 'European Union',
      donorReference: 'FED/2024/PPR-P2',
      currency: 'EUR',
      totalBudget: 2809240,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'ACTIVE',
      logframeType: 'LOGFRAME',
      reportingFrequency: 'WEEKLY',
      level: 'CONTINENTAL',
      geoScope: [],
      dataClassification: 'PARTNER',
      createdBy: ADMIN_USER_ID,
      updatedBy: ADMIN_USER_ID,
    },
  });

  console.log(`  Programme: ${programme.code} (${programme.id})`);

  // ── Components (Outcomes) ──
  const components = [
    { id: sid(10), code: '1', name: { en: 'Governance & Coordination', fr: 'Gouvernance et Coordination' }, color: '#2563eb' },
    { id: sid(11), code: '2', name: { en: 'Institutional Capacity & Planning', fr: 'Capacité Institutionnelle et Planification' }, color: '#0891b2' },
    { id: sid(12), code: '3', name: { en: 'Technical Operations', fr: 'Opérations Techniques' }, color: '#16a34a' },
  ];

  for (let i = 0; i < components.length; i++) {
    const c = components[i];
    await (prisma as any).programmeComponent.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, programmeId: programme.id, sortOrder: i },
    });
  }

  // ── Outputs (matching the PDF dashboard) ──
  const outputs = [
    { id: sid(100), componentId: sid(10), code: '1.1', name: { en: 'Stakeholder platforms', fr: 'Plateformes des parties prenantes' }, approvedBudget: 211000 },
    { id: sid(101), componentId: sid(10), code: '1.2', name: { en: 'AU-PANVAC capacity', fr: 'Capacité AU-PANVAC' }, approvedBudget: 0 },
    { id: sid(102), componentId: sid(11), code: '2.1', name: { en: 'Institutional capacity', fr: 'Capacité institutionnelle' }, approvedBudget: 232640 },
    { id: sid(103), componentId: sid(11), code: '2.2', name: { en: 'Planning tools / NSPs', fr: 'Outils de planification / PSN' }, approvedBudget: 570000 },
    { id: sid(104), componentId: sid(12), code: '3.1', name: { en: 'Surveillance & data', fr: 'Surveillance et données' }, approvedBudget: 1260600 },
    { id: sid(105), componentId: sid(12), code: '3.2', name: { en: 'Vaccination delivery', fr: 'Livraison des vaccins' }, approvedBudget: 463000 },
    { id: sid(106), componentId: sid(12), code: '3.3', name: { en: 'Other programmatic', fr: 'Autres activités programmatiques' }, approvedBudget: 72000 },
  ];

  for (let i = 0; i < outputs.length; i++) {
    const o = outputs[i];
    await (prisma as any).programmeOutput.upsert({
      where: { id: o.id },
      update: {},
      create: { ...o, sortOrder: i },
    });
  }

  // ── Activities (sample from the tracker) ──
  const activities = [
    // Output 1.1 — Stakeholder platforms
    { id: sid(200), outputId: sid(100), code: 'ACT-1.1.1', name: { en: 'Organize CAG/TAG meetings', fr: 'Organiser les réunions CAG/TAG' }, unit: 'PAPS', status: 'IN_PROGRESS', start: '2026-08-01', end: '2026-11-30', pct: 60, budget: 76444 },
    { id: sid(201), outputId: sid(100), code: 'ACT-1.1.2', name: { en: 'RECs coordination meetings', fr: 'Réunions de coordination avec les CER' }, unit: 'PAPS', status: 'COMPLETED', start: '2026-08-01', end: '2026-10-15', pct: 100, budget: 45000 },
    { id: sid(202), outputId: sid(100), code: 'ACT-1.1.3', name: { en: 'Partner engagement workshops', fr: 'Ateliers d\'engagement des partenaires' }, unit: 'PAPS', status: 'NOT_STARTED', start: '2026-10-01', end: '2026-12-31', pct: 0, budget: 89556 },

    // Output 2.1 — Institutional capacity
    { id: sid(210), outputId: sid(102), code: 'ACT-2.1.1', name: { en: 'Training of trainers workshops', fr: 'Ateliers de formation des formateurs' }, unit: 'PAPS', status: 'IN_PROGRESS', start: '2026-08-01', end: '2026-11-30', pct: 45, budget: 46461 },
    { id: sid(211), outputId: sid(102), code: 'ACT-2.1.2', name: { en: 'ARIS advanced user training', fr: 'Formation utilisateur avancé ARIS' }, unit: 'IT', status: 'COMPLETED', start: '2026-09-01', end: '2026-10-30', pct: 100, budget: 86179 },
    { id: sid(212), outputId: sid(102), code: 'ACT-2.1.3', name: { en: 'Capacity needs assessment', fr: 'Évaluation des besoins en capacité' }, unit: 'PAPS', status: 'NOT_STARTED', start: '2026-11-01', end: '2026-12-31', pct: 0, budget: 100000 },

    // Output 2.2 — Planning tools / NSPs
    { id: sid(220), outputId: sid(103), code: 'ACT-2.2.1', name: { en: 'Review and update NSPs for 15 countries', fr: 'Réviser et mettre à jour les PSN pour 15 pays' }, unit: 'PAPS', status: 'IN_PROGRESS', start: '2026-08-01', end: '2026-12-31', pct: 25, budget: 27986 },
    { id: sid(221), outputId: sid(103), code: 'ACT-2.2.2', name: { en: 'Develop M&E framework for PAPS', fr: 'Développer le cadre S&E pour le PAPS' }, unit: 'M&E', status: 'NOT_STARTED', start: '2026-10-01', end: '2026-12-31', pct: 0, budget: 200000 },
    { id: sid(222), outputId: sid(103), code: 'ACT-2.2.3', name: { en: 'PPR pathway assessment tool development', fr: 'Développement de l\'outil d\'évaluation du parcours PPR' }, unit: 'PAPS', status: 'DELAYED', start: '2026-08-01', end: '2026-10-31', pct: 10, budget: 342014 },

    // Output 3.1 — Surveillance & data
    { id: sid(230), outputId: sid(104), code: 'ACT-3.1.1', name: { en: 'PPR serosurveillance campaigns (10 countries)', fr: 'Campagnes de sérosurveillance PPR (10 pays)' }, unit: 'PAPS', status: 'IN_PROGRESS', start: '2026-08-01', end: '2026-12-31', pct: 35, budget: 469029 },
    { id: sid(231), outputId: sid(104), code: 'ACT-3.1.2', name: { en: 'Lab strengthening & quality assurance', fr: 'Renforcement des laboratoires et assurance qualité' }, unit: 'AU-PANVAC', status: 'IN_PROGRESS', start: '2026-08-01', end: '2026-12-31', pct: 40, budget: 300000 },
    { id: sid(232), outputId: sid(104), code: 'ACT-3.1.3', name: { en: 'ARIS deployment for PPR data collection', fr: 'Déploiement ARIS pour la collecte de données PPR' }, unit: 'IT', status: 'IN_PROGRESS', start: '2026-08-01', end: '2026-11-30', pct: 70, budget: 150000 },
    { id: sid(233), outputId: sid(104), code: 'ACT-3.1.4', name: { en: 'Disease notification system integration', fr: 'Intégration du système de notification des maladies' }, unit: 'IT', status: 'NOT_STARTED', start: '2026-10-01', end: '2026-12-31', pct: 0, budget: 341571 },

    // Output 3.2 — Vaccination delivery
    { id: sid(240), outputId: sid(105), code: 'ACT-3.2.1', name: { en: 'Vaccine procurement & distribution', fr: 'Achat et distribution de vaccins' }, unit: 'AU-PANVAC', status: 'IN_PROGRESS', start: '2026-08-01', end: '2026-12-31', pct: 30, budget: 76792 },
    { id: sid(241), outputId: sid(105), code: 'ACT-3.2.2', name: { en: 'Vaccination campaign support (8 countries)', fr: 'Appui aux campagnes de vaccination (8 pays)' }, unit: 'PAPS', status: 'NOT_STARTED', start: '2026-09-01', end: '2026-12-31', pct: 0, budget: 200000 },
    { id: sid(242), outputId: sid(105), code: 'ACT-3.2.3', name: { en: 'Post-vaccination evaluation (PVE)', fr: 'Évaluation post-vaccinale (EPV)' }, unit: 'PAPS', status: 'NOT_STARTED', start: '2026-11-01', end: '2026-12-31', pct: 0, budget: 186208 },

    // Output 3.3 — Other programmatic
    { id: sid(250), outputId: sid(106), code: 'ACT-3.3.1', name: { en: 'Communication & visibility materials', fr: 'Matériels de communication et visibilité' }, unit: 'COMM', status: 'IN_PROGRESS', start: '2026-08-01', end: '2026-12-31', pct: 50, budget: 45429 },
    { id: sid(251), outputId: sid(106), code: 'ACT-3.3.2', name: { en: 'Project audit & evaluation', fr: 'Audit et évaluation du projet' }, unit: 'FIN', status: 'NOT_STARTED', start: '2026-11-01', end: '2026-12-31', pct: 0, budget: 26571 },
  ];

  for (const act of activities) {
    const ragStatus = act.status === 'COMPLETED' ? 'GREEN'
      : act.status === 'DELAYED' ? 'RED'
      : act.status === 'NOT_STARTED' ? 'GREY'
      : 'GREEN';

    await (prisma as any).activity.upsert({
      where: { id: act.id },
      update: {},
      create: {
        id: act.id,
        outputId: act.outputId,
        code: act.code,
        name: act.name,
        responsibleUnit: act.unit,
        responsibleLevel: 'CONTINENTAL',
        plannedStartDate: new Date(act.start),
        plannedEndDate: new Date(act.end),
        actualStartDate: act.status !== 'NOT_STARTED' ? new Date(act.start) : null,
        actualEndDate: act.status === 'COMPLETED' ? new Date(act.end) : null,
        status: act.status,
        priorityLevel: act.status === 'DELAYED' ? 'HIGH' : 'MEDIUM',
        completionPercent: act.pct,
        ragStatus,
        createdBy: ADMIN_USER_ID,
        updatedBy: ADMIN_USER_ID,
      },
    });

    // Create matching budget line
    await (prisma as any).activityBudget.upsert({
      where: { id: `${act.id.slice(0, -1)}b` },
      update: {},
      create: {
        id: `${act.id.slice(0, -1)}b`,
        activityId: act.id,
        budgetLineCode: act.code.replace('ACT-', 'BL-'),
        description: (act.name as any).en,
        fundingSource: 'EU-PPR2',
        approvedAmount: act.budget,
        executedAmount: Math.round(act.budget * act.pct / 100),
        committedAmount: Math.round(act.budget * Math.min(act.pct + 10, 100) / 100),
        currency: 'EUR',
        period: '2026-H2',
        createdBy: ADMIN_USER_ID,
        updatedBy: ADMIN_USER_ID,
      },
    });
  }

  // ── Indicators ──
  const indicators = [
    { id: sid(300), outputId: sid(104), code: 'IND-3.1.1', name: { en: 'Countries with active serosurveillance' }, unit: 'countries', target: 15, baseline: 3 },
    { id: sid(301), outputId: sid(104), code: 'IND-3.1.2', name: { en: 'Laboratories with PPR diagnostic capacity' }, unit: 'labs', target: 25, baseline: 12 },
    { id: sid(302), outputId: sid(105), code: 'IND-3.2.1', name: { en: 'Vaccination coverage rate (target pop.)' }, unit: '%', target: 80, baseline: 0 },
    { id: sid(303), outputId: sid(103), code: 'IND-2.2.1', name: { en: 'Countries with updated NSPs' }, unit: 'countries', target: 30, baseline: 8 },
    { id: sid(304), outputId: sid(100), code: 'IND-1.1.1', name: { en: 'CAG/TAG meetings conducted' }, unit: 'meetings', target: 6, baseline: 0 },
  ];

  for (const ind of indicators) {
    await (prisma as any).outputIndicator.upsert({
      where: { id: ind.id },
      update: {},
      create: {
        ...ind,
        direction: 'INCREASE',
        baselineValue: ind.baseline,
        baselineDate: new Date('2024-01-01'),
        targetValue: ind.target,
        dataSource: 'Manual',
        collectionMethod: 'MANUAL',
        disaggregationBy: ['region'],
      },
    });
  }

  // ── Risks ──
  const risks = [
    { id: sid(400), code: 'RISK-001', desc: { en: 'Insufficient funding disbursement from donor', fr: 'Décaissement insuffisant des fonds du bailleur' }, cat: 'FINANCIAL', lik: 'HIGH', imp: 'CRITICAL' },
    { id: sid(401), code: 'RISK-002', desc: { en: 'Limited country technical capacity for surveillance', fr: 'Capacité technique limitée des pays pour la surveillance' }, cat: 'TECHNICAL', lik: 'MEDIUM', imp: 'HIGH' },
    { id: sid(402), code: 'RISK-003', desc: { en: 'Security concerns limiting field access', fr: 'Préoccupations sécuritaires limitant l\'accès au terrain' }, cat: 'SECURITY', lik: 'MEDIUM', imp: 'HIGH' },
    { id: sid(403), code: 'RISK-004', desc: { en: 'Vaccine supply chain disruption', fr: 'Perturbation de la chaîne d\'approvisionnement en vaccins' }, cat: 'OPERATIONAL', lik: 'LOW', imp: 'CRITICAL' },
  ];

  for (const r of risks) {
    const lScore: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, VERY_HIGH: 4 };
    const iScore: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

    await (prisma as any).programmeRisk.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        programmeId: programme.id,
        code: r.code,
        description: r.desc,
        category: r.cat,
        likelihood: r.lik,
        impact: r.imp,
        riskScore: lScore[r.lik] * iScore[r.imp],
        status: 'OPEN',
        createdBy: ADMIN_USER_ID,
        updatedBy: ADMIN_USER_ID,
      },
    });
  }

  console.log(`  Seeded: ${components.length} components, ${outputs.length} outputs, ${activities.length} activities, ${indicators.length} indicators, ${risks.length} risks`);
  console.log('Programme Monitoring seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
