import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CAADEP_KPI_PRESETS = [
  {
    code: 'vaccination-coverage',
    name: { en: 'Vaccination Coverage', fr: 'Couverture vaccinale', pt: 'Cobertura Vacinal', ar: 'تغطية التطعيم' },
    description: { en: 'Percentage of target livestock population vaccinated against priority diseases', fr: 'Pourcentage du cheptel cible vacciné contre les maladies prioritaires' },
    domainCode: 'animal-health',
    icon: 'Syringe',
    color: '#1565C0',
    unit: 'percentage',
    targetValue: 100,
    thresholdGood: 75,
    thresholdWarn: 50,
    scope: 'both',
  },
  {
    code: 'disease-notification',
    name: { en: 'Disease Notification Timeliness', fr: 'Rapidité de notification des maladies', pt: 'Oportunidade de Notificação de Doenças', ar: 'توقيت الإخطار بالأمراض' },
    description: { en: 'Percentage of disease events notified within 24 hours of detection', fr: 'Pourcentage des événements sanitaires notifiés dans les 24 heures suivant la détection' },
    domainCode: 'animal-health',
    icon: 'HeartPulse',
    color: '#C62828',
    unit: 'percentage',
    targetValue: 100,
    thresholdGood: 80,
    thresholdWarn: 60,
    scope: 'both',
  },
  {
    code: 'livestock-census',
    name: { en: 'Livestock Census Completion', fr: 'Achèvement du recensement du bétail', pt: 'Conclusão do Censo Pecuário', ar: 'إتمام التعداد الحيواني' },
    description: { en: 'Percentage of administrative units with up-to-date livestock census data', fr: 'Pourcentage des unités administratives disposant de données de recensement à jour' },
    domainCode: 'livestock-prod',
    icon: 'Wheat',
    color: '#E65100',
    unit: 'percentage',
    targetValue: 100,
    thresholdGood: 75,
    thresholdWarn: 50,
    scope: 'both',
  },
  {
    code: 'trade-certification',
    name: { en: 'Trade Certification Rate', fr: 'Taux de certification commerciale', pt: 'Taxa de Certificação Comercial', ar: 'معدل شهادات التجارة' },
    description: { en: 'Percentage of livestock trade transactions with valid SPS certificates', fr: 'Pourcentage des transactions commerciales de bétail avec des certificats SPS valides' },
    domainCode: 'trade-sps',
    icon: 'TrendingUp',
    color: '#1565C0',
    unit: 'percentage',
    targetValue: 100,
    thresholdGood: 80,
    thresholdWarn: 60,
    scope: 'both',
  },
  {
    code: 'fisheries-monitoring',
    name: { en: 'Fisheries Monitoring Coverage', fr: 'Couverture de surveillance des pêches', pt: 'Cobertura de Monitorização das Pescas', ar: 'تغطية مراقبة المصايد' },
    description: { en: 'Percentage of fishing zones with active monitoring and data collection', fr: 'Pourcentage des zones de pêche avec une surveillance et une collecte de données actives' },
    domainCode: 'fisheries',
    icon: 'Fish',
    color: '#00838F',
    unit: 'percentage',
    targetValue: 100,
    thresholdGood: 70,
    thresholdWarn: 45,
    scope: 'both',
  },
  {
    code: 'wildlife-conservation',
    name: { en: 'Wildlife Conservation Index', fr: 'Indice de conservation de la faune', pt: 'Índice de Conservação da Vida Selvagem', ar: 'مؤشر الحفاظ على الحياة البرية' },
    description: { en: 'Composite index of protected area coverage, species monitoring, and anti-poaching effectiveness', fr: 'Indice composite de couverture des aires protégées, surveillance des espèces et efficacité anti-braconnage' },
    domainCode: 'wildlife',
    icon: 'TreePine',
    color: '#2E7D32',
    unit: 'percentage',
    targetValue: 100,
    thresholdGood: 70,
    thresholdWarn: 50,
    scope: 'both',
  },
];

export async function seedKpiPresets(): Promise<void> {
  console.log('📊 Seeding CAADEP KPI presets...\n');

  for (const kpi of CAADEP_KPI_PRESETS) {
    await (prisma as any).kpiDefinition.upsert({
      where: { code: kpi.code },
      update: {
        name: kpi.name,
        description: kpi.description,
        domainCode: kpi.domainCode,
        icon: kpi.icon,
        color: kpi.color,
        unit: kpi.unit,
        targetValue: kpi.targetValue,
        thresholdGood: kpi.thresholdGood,
        thresholdWarn: kpi.thresholdWarn,
        scope: kpi.scope,
        isPreset: true,
        isActive: true,
      },
      create: {
        code: kpi.code,
        name: kpi.name,
        description: kpi.description,
        domainCode: kpi.domainCode,
        icon: kpi.icon,
        color: kpi.color,
        unit: kpi.unit,
        targetValue: kpi.targetValue,
        thresholdGood: kpi.thresholdGood,
        thresholdWarn: kpi.thresholdWarn,
        scope: kpi.scope,
        isPreset: true,
        isActive: true,
        sortOrder: CAADEP_KPI_PRESETS.indexOf(kpi),
      },
    });
    console.log(`  ✓ ${kpi.code}`);
  }

  console.log(`\n✅ ${CAADEP_KPI_PRESETS.length} CAADEP KPI presets seeded.\n`);
}

// Allow direct execution
if (require.main === module) {
  seedKpiPresets()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error('❌ Seed failed:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
