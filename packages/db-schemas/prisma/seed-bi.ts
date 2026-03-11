import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── BI Tool Config UUIDs ───────────────────────────────────────────────────

const BI_TOOL_IDS = {
  SUPERSET: 'a0000000-0000-4000-b000-000000000001',
  METABASE: 'a0000000-0000-4000-b000-000000000002',
  GRAFANA: 'a0000000-0000-4000-b000-000000000003',
} as const;

// ─── Seed Data ──────────────────────────────────────────────────────────────

async function seedBiTools() {
  console.log('Seeding BI tool configurations...');

  // Upsert tool configs
  const tools = [
    {
      id: BI_TOOL_IDS.SUPERSET,
      tool: 'superset',
      baseUrl: process.env.SUPERSET_URL || 'http://localhost:8088',
      displayName: {
        en: 'Apache Superset',
        fr: 'Apache Superset',
        pt: 'Apache Superset',
        ar: 'Apache Superset',
      },
      description: {
        en: 'Advanced analytics and data exploration platform with SQL Lab, custom dashboards, and 40+ visualization types',
        fr: "Plateforme d'analyses avancées et d'exploration de données avec SQL Lab, tableaux de bord personnalisés et 40+ types de visualisation",
        pt: 'Plataforma avançada de análise e exploração de dados',
        ar: 'منصة تحليلات متقدمة واستكشاف بيانات',
      },
      icon: 'Layers',
      status: 'active',
      embedMode: 'guest_token',
      sortOrder: 1,
    },
    {
      id: BI_TOOL_IDS.METABASE,
      tool: 'metabase',
      baseUrl: process.env.METABASE_URL || 'http://localhost:3035',
      displayName: {
        en: 'Metabase',
        fr: 'Metabase',
        pt: 'Metabase',
        ar: 'Metabase',
      },
      description: {
        en: 'Simple and intuitive business intelligence tool with drag-and-drop dashboards and automated insights',
        fr: 'Outil de BI simple et intuitif avec tableaux de bord glisser-déposer et analyses automatisées',
        pt: 'Ferramenta de BI simples e intuitiva',
        ar: 'أداة ذكاء أعمال بسيطة وبديهية',
      },
      icon: 'PieChart',
      status: 'active',
      embedMode: 'iframe',
      sortOrder: 2,
    },
    {
      id: BI_TOOL_IDS.GRAFANA,
      tool: 'grafana',
      baseUrl: process.env.GRAFANA_URL || 'http://localhost:3200',
      displayName: {
        en: 'Grafana',
        fr: 'Grafana',
        pt: 'Grafana',
        ar: 'Grafana',
      },
      description: {
        en: 'Dashboard builder with PostgreSQL queries, template variables, drill-down, and alerting',
        fr: 'Constructeur de tableaux de bord avec requêtes PostgreSQL, variables, drill-down et alertes',
        pt: 'Construtor de dashboards com consultas PostgreSQL, variáveis e alertas',
        ar: 'أداة بناء لوحات المعلومات مع استعلامات PostgreSQL والمتغيرات والتنبيهات',
      },
      icon: 'BarChart2',
      status: 'active',
      embedMode: 'iframe',
      sortOrder: 3,
    },
  ];

  for (const t of tools) {
    await prisma.biToolConfig.upsert({
      where: { tool: t.tool },
      update: {
        displayName: t.displayName,
        description: t.description,
        status: t.status,
        baseUrl: t.baseUrl,
      },
      create: t,
    });
  }
  console.log(`  ✓ ${tools.length} BI tool configs seeded`);

  // Default access rules per role per tool
  const ROLES = [
    'SUPER_ADMIN',
    'CONTINENTAL_ADMIN',
    'REC_ADMIN',
    'NATIONAL_ADMIN',
    'DATA_STEWARD',
    'ANALYST',
    'WAHIS_FOCAL_POINT',
  ];

  const SENSITIVE_TABLES = ['User', 'Session', 'RefreshToken'];
  const AUDIT_TABLES = [...SENSITIVE_TABLES, 'AuditLog'];

  const activeTools = [BI_TOOL_IDS.SUPERSET, BI_TOOL_IDS.METABASE, BI_TOOL_IDS.GRAFANA];
  let ruleCount = 0;

  for (const toolId of activeTools) {
    for (const role of ROLES) {
      const isAdmin = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN'].includes(role);
      const isManager = ['REC_ADMIN', 'NATIONAL_ADMIN'].includes(role);

      const rule = {
        biToolConfigId: toolId,
        roleLevel: role,
        allowedSchemas:
          isAdmin
            ? ['public', 'historical', 'governance']
            : ['public', 'historical'],
        allowedTables: ['*'],
        excludedTables:
          role === 'SUPER_ADMIN' ? SENSITIVE_TABLES : AUDIT_TABLES,
        canCreateDashboard: isAdmin || isManager,
        canExportData: role !== 'WAHIS_FOCAL_POINT',
        canUseSqlLab:
          role === 'SUPER_ADMIN' ||
          (role === 'CONTINENTAL_ADMIN' && toolId === BI_TOOL_IDS.SUPERSET),
      };

      // Use raw SQL for upsert since compound unique is complex
      await prisma.$executeRawUnsafe(
        `INSERT INTO governance.bi_data_access_rules
          (id, bi_tool_config_id, role_level, allowed_schemas, allowed_tables, excluded_tables, can_create_dashboard, can_export_data, can_use_sql_lab)
         VALUES (gen_random_uuid(), $1::uuid, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8)
         ON CONFLICT (bi_tool_config_id, role_level, entity_type, entity_id) DO UPDATE SET
           allowed_schemas = EXCLUDED.allowed_schemas,
           allowed_tables = EXCLUDED.allowed_tables,
           excluded_tables = EXCLUDED.excluded_tables,
           can_create_dashboard = EXCLUDED.can_create_dashboard,
           can_export_data = EXCLUDED.can_export_data,
           can_use_sql_lab = EXCLUDED.can_use_sql_lab,
           updated_at = now()`,
        rule.biToolConfigId,
        rule.roleLevel,
        JSON.stringify(rule.allowedSchemas),
        JSON.stringify(rule.allowedTables),
        JSON.stringify(rule.excludedTables),
        rule.canCreateDashboard,
        rule.canExportData,
        rule.canUseSqlLab,
      );
      ruleCount++;
    }
  }
  console.log(`  ✓ ${ruleCount} BI access rules seeded`);

  // ─── Default Dashboards ───────────────────────────────────────────────────
  console.log('Seeding default BI dashboards...');

  const dashboards = [
    // Grafana dashboards (provisioned via JSON files)
    {
      biToolConfigId: BI_TOOL_IDS.GRAFANA,
      externalId: 'aris-continental',
      name: {
        en: 'Continental Overview',
        fr: 'Vue d\'ensemble continentale',
        pt: 'Visao continental',
        ar: 'نظرة عامة قارية',
      },
      description: {
        en: 'Key metrics across all AU Member States',
        fr: 'Indicateurs cles pour tous les Etats membres de l\'UA',
      },
      category: 'overview',
      embedUrl: '/d/aris-continental',
      scope: 'global',
      sortOrder: 1,
      isFeatured: true,
    },
    {
      biToolConfigId: BI_TOOL_IDS.GRAFANA,
      externalId: 'aris-animal-health',
      name: {
        en: 'Animal Health',
        fr: 'Sante animale',
        pt: 'Saude animal',
        ar: 'الصحة الحيوانية',
      },
      description: {
        en: 'Outbreaks, surveillance, lab results, vaccinations',
        fr: 'Foyers, surveillance, resultats laboratoire, vaccinations',
      },
      category: 'health',
      embedUrl: '/d/aris-animal-health',
      scope: 'global',
      sortOrder: 2,
      isFeatured: true,
    },
    {
      biToolConfigId: BI_TOOL_IDS.GRAFANA,
      externalId: 'aris-trade-production',
      name: {
        en: 'Trade & Production',
        fr: 'Commerce et production',
        pt: 'Comercio e producao',
        ar: 'التجارة والإنتاج',
      },
      description: {
        en: 'Trade flows, livestock production, market prices',
        fr: 'Flux commerciaux, production animale, prix marche',
      },
      category: 'trade',
      embedUrl: '/d/aris-trade-production',
      scope: 'global',
      sortOrder: 3,
      isFeatured: false,
    },
  ];

  for (const d of dashboards) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO governance.bi_dashboards
        (id, bi_tool_config_id, external_id, name, description, category, embed_url, scope, sort_order, is_featured)
       VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9)
       ON CONFLICT (bi_tool_config_id, external_id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         embed_url = EXCLUDED.embed_url,
         updated_at = now()`,
      d.biToolConfigId,
      d.externalId,
      JSON.stringify(d.name),
      JSON.stringify(d.description),
      d.category,
      d.embedUrl,
      d.scope,
      d.sortOrder,
      d.isFeatured,
    );
  }
  console.log(`  ✓ ${dashboards.length} default BI dashboards seeded`);
}

async function main() {
  try {
    await seedBiTools();
    console.log('\n✅ BI seed complete');
  } catch (err) {
    console.error('❌ BI seed failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
