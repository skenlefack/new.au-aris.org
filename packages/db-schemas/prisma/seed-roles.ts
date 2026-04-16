import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Deterministic UUIDs for Roles ──────────────────────────────────────────

const ROLE_IDS = {
  // Primary roles — enum-backed, appear in the User.role column.
  SUPER_ADMIN: '20000000-0000-4000-a000-000000000001',
  CONTINENTAL_ADMIN: '20000000-0000-4000-a000-000000000002',
  REC_ADMIN: '20000000-0000-4000-a000-000000000003',
  NATIONAL_ADMIN: '20000000-0000-4000-a000-000000000004',
  DATA_STEWARD: '20000000-0000-4000-a000-000000000005',
  WAHIS_FOCAL_POINT: '20000000-0000-4000-a000-000000000006', // displayed as "OMSA Delegate"
  ANALYST: '20000000-0000-4000-a000-000000000007',           // displayed as "Data Analyst"
  FIELD_AGENT: '20000000-0000-4000-a000-000000000008',       // displayed as "Data Collector"
  KNOWLEDGE_MANAGER: '20000000-0000-4000-a000-000000000009',
  // Additional roles — assignable via UserRoleAssignment, not bound to the
  // UserRole enum. These refine the primary role with scope (national /
  // regional / continental) or specialisation (data visualizer).
  DELEGATE_ARIS_NATIONAL:      '20000000-0000-4000-a000-000000000010',
  DELEGATE_ARIS_REGIONAL:      '20000000-0000-4000-a000-000000000011',
  DATA_COLLECTOR_NATIONAL:     '20000000-0000-4000-a000-000000000012',
  DATA_COLLECTOR_REGIONAL:     '20000000-0000-4000-a000-000000000013',
  DATA_COLLECTOR_CONTINENTAL:  '20000000-0000-4000-a000-000000000014',
  DATA_STEWARD_NATIONAL:       '20000000-0000-4000-a000-000000000015',
  DATA_STEWARD_REGIONAL:       '20000000-0000-4000-a000-000000000016',
  DATA_STEWARD_CONTINENTAL:    '20000000-0000-4000-a000-000000000017',
  DATA_VISUALIZER:             '20000000-0000-4000-a000-000000000018',
} as const;

// ── System Roles Definition ────────────────────────────────────────────────

interface RoleSeed {
  id: string;
  code: string;
  name: Record<string, string>;
  description: Record<string, string>;
  level: string;
  color: string;
  icon: string;
  sortOrder: number;
}

const SYSTEM_ROLES: RoleSeed[] = [
  // ── Primary roles (enum-backed) ──────────────────────────────────────────
  {
    id: ROLE_IDS.SUPER_ADMIN,
    code: 'SUPER_ADMIN',
    name: {
      en: 'Super Administrator',
      fr: 'Super Administrateur',
      pt: 'Super Administrador',
      es: 'Super Administrador',
      ar: 'المسؤول الأعلى',
    },
    description: {
      en: 'Full system access with all permissions',
      fr: 'Accès complet au système',
      pt: 'Acesso total ao sistema',
      es: 'Acceso total al sistema',
      ar: 'وصول كامل للنظام',
    },
    level: 'continental',
    color: '#dc2626',
    icon: 'ShieldAlert',
    sortOrder: 1,
  },
  {
    id: ROLE_IDS.CONTINENTAL_ADMIN,
    code: 'CONTINENTAL_ADMIN',
    name: {
      en: 'Continental Administrator',
      fr: 'Administrateur Continental',
      pt: 'Administrador Continental',
      es: 'Administrador Continental',
      ar: 'مسؤول قاري',
    },
    description: {
      en: 'AU-IBAR program officers with continental oversight',
      fr: 'Responsables de programmes AU-IBAR',
      pt: 'Oficiais de programa da UA-BIRA',
      es: 'Oficiales de programa AU-IBAR',
      ar: 'مسؤولو برامج الاتحاد الأفريقي',
    },
    level: 'continental',
    color: '#7c3aed',
    icon: 'Shield',
    sortOrder: 2,
  },
  {
    id: ROLE_IDS.REC_ADMIN,
    code: 'REC_ADMIN',
    name: {
      en: 'REC Administrator',
      fr: 'Administrateur CER',
      pt: 'Administrador CER',
      es: 'Administrador CER',
      ar: 'مسؤول المجموعة الاقتصادية',
    },
    description: {
      en: 'Regional Economic Community coordinators',
      fr: 'Coordinateurs des CER',
      pt: 'Coordenadores das CER',
      es: 'Coordinadores de CER',
      ar: 'منسقو المجموعات الاقتصادية الإقليمية',
    },
    level: 'regional',
    color: '#2563eb',
    icon: 'Building2',
    sortOrder: 3,
  },
  {
    id: ROLE_IDS.NATIONAL_ADMIN,
    code: 'NATIONAL_ADMIN',
    name: {
      en: 'National Administrator',
      fr: 'Administrateur National',
      pt: 'Administrador Nacional',
      es: 'Administrador Nacional',
      ar: 'مسؤول وطني',
    },
    description: {
      en: 'National administrators (CVO office)',
      fr: 'Administrateurs nationaux (bureau du CVO)',
      pt: 'Administradores nacionais (escritório do CVO)',
      es: 'Administradores nacionales (oficina del CVO)',
      ar: 'المسؤولون الوطنيون',
    },
    level: 'national',
    color: '#16a34a',
    icon: 'Flag',
    sortOrder: 4,
  },
  {
    id: ROLE_IDS.DATA_STEWARD,
    code: 'DATA_STEWARD',
    name: {
      en: 'Data Steward',
      fr: 'Gestionnaire de Données',
      pt: 'Gestor de Dados',
      es: 'Gestor de Datos',
      ar: 'مسؤول البيانات',
    },
    description: {
      en: 'Data quality officers responsible for validation',
      fr: 'Responsables qualité des données',
      pt: 'Responsáveis pela qualidade dos dados',
      es: 'Responsables de la calidad de datos',
      ar: 'مسؤولو جودة البيانات',
    },
    level: 'national',
    color: '#d97706',
    icon: 'ClipboardCheck',
    sortOrder: 5,
  },
  {
    // Enum value kept (WAHIS_FOCAL_POINT) — only the display label was
    // renamed to "OMSA Delegate" per the 2026-04 role rebrand.
    id: ROLE_IDS.WAHIS_FOCAL_POINT,
    code: 'WAHIS_FOCAL_POINT',
    name: {
      en: 'OMSA Delegate',
      fr: 'Délégué OMSA',
      pt: 'Delegado OMSA',
      es: 'Delegado OMSA',
      ar: 'مندوب المنظمة العالمية لصحة الحيوان',
    },
    description: {
      en: 'Authorized WOAH/OMSA national reporter',
      fr: 'Rapporteur national autorisé auprès de l\'OMSA',
      pt: 'Relator nacional autorizado da OMSA',
      es: 'Relator nacional autorizado de la OMSA',
      ar: 'المراسل الوطني المعتمد لدى المنظمة العالمية لصحة الحيوان',
    },
    level: 'national',
    color: '#0891b2',
    icon: 'FileCheck',
    sortOrder: 6,
  },
  {
    // Enum value kept (ANALYST) — renamed to "Data Analyst".
    id: ROLE_IDS.ANALYST,
    code: 'ANALYST',
    name: {
      en: 'Data Analyst',
      fr: 'Analyste des données',
      pt: 'Analista de Dados',
      es: 'Analista de Datos',
      ar: 'محلل بيانات',
    },
    description: {
      en: 'Read-only data analyst with dashboard and export access',
      fr: 'Analyste de données en lecture seule avec accès tableaux de bord et export',
      pt: 'Analista de dados com acesso somente leitura e exportação',
      es: 'Analista de datos con acceso de solo lectura y exportación',
      ar: 'محلل بيانات بصلاحية القراءة والتصدير',
    },
    level: 'national',
    color: '#6b7280',
    icon: 'BarChart3',
    sortOrder: 7,
  },
  {
    // Enum value kept (FIELD_AGENT) — renamed to "Data Collector".
    id: ROLE_IDS.FIELD_AGENT,
    code: 'FIELD_AGENT',
    name: {
      en: 'Data Collector',
      fr: 'Collecteur de données',
      pt: 'Coletor de Dados',
      es: 'Recolector de Datos',
      ar: 'جامع البيانات',
    },
    description: {
      en: 'Field agent collecting data through the mobile app',
      fr: 'Agent collectant des données via l\'application mobile',
      pt: 'Agente de campo que coleta dados pelo aplicativo móvel',
      es: 'Agente de campo que recolecta datos por la aplicación móvil',
      ar: 'وكيل ميداني يجمع البيانات عبر التطبيق المحمول',
    },
    level: 'national',
    color: '#ea580c',
    icon: 'Smartphone',
    sortOrder: 8,
  },
  {
    id: ROLE_IDS.KNOWLEDGE_MANAGER,
    code: 'KNOWLEDGE_MANAGER',
    name: {
      en: 'Knowledge Manager',
      fr: 'Gestionnaire de la Base de Connaissances',
      pt: 'Gestor de Conhecimento',
      es: 'Gestor del Conocimiento',
      ar: 'مدير المعرفة',
    },
    description: {
      en: 'Continental editor who validates and publishes knowledge base content',
      fr: 'Éditeur continental qui valide et publie les contenus de la base de connaissances',
      pt: 'Editor continental que valida e publica conteúdos da base de conhecimento',
      es: 'Editor continental que valida y publica el contenido de la base de conocimiento',
      ar: 'محرر قاري يقوم بالتحقق من محتوى قاعدة المعرفة ونشره',
    },
    level: 'continental',
    color: '#9333ea',
    icon: 'BookOpenCheck',
    sortOrder: 9,
  },

  // ── Additional roles (scope-specific, assignable via UserRoleAssignment) ──
  {
    id: ROLE_IDS.DELEGATE_ARIS_NATIONAL,
    code: 'DELEGATE_ARIS_NATIONAL',
    name: {
      en: 'ARIS National Delegate',
      fr: 'Délégué ARIS National',
      pt: 'Delegado ARIS Nacional',
      es: 'Delegado ARIS Nacional',
      ar: 'المندوب الوطني لنظام أريس',
    },
    description: {
      en: 'National delegate representing the country on the ARIS platform',
      fr: 'Délégué national représentant le pays sur la plateforme ARIS',
      pt: 'Delegado nacional que representa o país na plataforma ARIS',
      es: 'Delegado nacional que representa al país en la plataforma ARIS',
      ar: 'المندوب الوطني الذي يمثل البلد في منصة أريس',
    },
    level: 'national',
    color: '#0d9488',
    icon: 'UserCheck',
    sortOrder: 10,
  },
  {
    id: ROLE_IDS.DELEGATE_ARIS_REGIONAL,
    code: 'DELEGATE_ARIS_REGIONAL',
    name: {
      en: 'ARIS Regional Delegate',
      fr: 'Délégué ARIS Régional',
      pt: 'Delegado ARIS Regional',
      es: 'Delegado ARIS Regional',
      ar: 'المندوب الإقليمي لنظام أريس',
    },
    description: {
      en: 'Regional delegate representing a REC on the ARIS platform',
      fr: 'Délégué régional représentant une CER sur la plateforme ARIS',
      pt: 'Delegado regional que representa uma CER na plataforma ARIS',
      es: 'Delegado regional que representa una CER en la plataforma ARIS',
      ar: 'المندوب الإقليمي الذي يمثل المجموعة الاقتصادية في منصة أريس',
    },
    level: 'regional',
    color: '#0284c7',
    icon: 'UserCheck',
    sortOrder: 11,
  },
  {
    id: ROLE_IDS.DATA_COLLECTOR_NATIONAL,
    code: 'DATA_COLLECTOR_NATIONAL',
    name: {
      en: 'National Data Collector',
      fr: 'Collecteur de données National',
      pt: 'Coletor de Dados Nacional',
      es: 'Recolector de Datos Nacional',
      ar: 'جامع البيانات الوطني',
    },
    description: {
      en: 'Collects data within a single member state',
      fr: 'Collecte les données au sein d\'un État membre',
      pt: 'Coleta dados dentro de um Estado-membro',
      es: 'Recolecta datos dentro de un Estado miembro',
      ar: 'يجمع البيانات داخل الدولة العضو',
    },
    level: 'national',
    color: '#f97316',
    icon: 'Smartphone',
    sortOrder: 12,
  },
  {
    id: ROLE_IDS.DATA_COLLECTOR_REGIONAL,
    code: 'DATA_COLLECTOR_REGIONAL',
    name: {
      en: 'Regional Data Collector',
      fr: 'Collecteur de données Régional',
      pt: 'Coletor de Dados Regional',
      es: 'Recolector de Datos Regional',
      ar: 'جامع البيانات الإقليمي',
    },
    description: {
      en: 'Collects data across a Regional Economic Community',
      fr: 'Collecte les données à l\'échelle d\'une Communauté Économique Régionale',
      pt: 'Coleta dados em uma Comunidade Econômica Regional',
      es: 'Recolecta datos en una Comunidad Económica Regional',
      ar: 'يجمع البيانات على مستوى المجموعة الاقتصادية الإقليمية',
    },
    level: 'regional',
    color: '#f59e0b',
    icon: 'Smartphone',
    sortOrder: 13,
  },
  {
    id: ROLE_IDS.DATA_COLLECTOR_CONTINENTAL,
    code: 'DATA_COLLECTOR_CONTINENTAL',
    name: {
      en: 'Continental Data Collector',
      fr: 'Collecteur de données Continental',
      pt: 'Coletor de Dados Continental',
      es: 'Recolector de Datos Continental',
      ar: 'جامع البيانات القاري',
    },
    description: {
      en: 'Collects data at AU-IBAR / continental scope',
      fr: 'Collecte les données à l\'échelle continentale (AU-IBAR)',
      pt: 'Coleta dados no escopo continental (UA-BIRA)',
      es: 'Recolecta datos a escala continental (AU-IBAR)',
      ar: 'يجمع البيانات على المستوى القاري (AU-IBAR)',
    },
    level: 'continental',
    color: '#eab308',
    icon: 'Smartphone',
    sortOrder: 14,
  },
  {
    id: ROLE_IDS.DATA_STEWARD_NATIONAL,
    code: 'DATA_STEWARD_NATIONAL',
    name: {
      en: 'National Data Steward',
      fr: 'Gestionnaire de Données National',
      pt: 'Gestor de Dados Nacional',
      es: 'Gestor de Datos Nacional',
      ar: 'مسؤول البيانات الوطني',
    },
    description: {
      en: 'Validates data quality inside a member state',
      fr: 'Valide la qualité des données au sein d\'un État membre',
      pt: 'Valida a qualidade dos dados dentro de um Estado-membro',
      es: 'Valida la calidad de datos dentro de un Estado miembro',
      ar: 'يتحقق من جودة البيانات داخل الدولة العضو',
    },
    level: 'national',
    color: '#b45309',
    icon: 'ClipboardCheck',
    sortOrder: 15,
  },
  {
    id: ROLE_IDS.DATA_STEWARD_REGIONAL,
    code: 'DATA_STEWARD_REGIONAL',
    name: {
      en: 'Regional Data Steward',
      fr: 'Gestionnaire de Données Régional',
      pt: 'Gestor de Dados Regional',
      es: 'Gestor de Datos Regional',
      ar: 'مسؤول البيانات الإقليمي',
    },
    description: {
      en: 'Harmonises and validates cross-border data inside a REC',
      fr: 'Harmonise et valide les données transfrontalières au sein d\'une CER',
      pt: 'Harmoniza e valida dados transfronteiriços em uma CER',
      es: 'Armoniza y valida los datos transfronterizos en una CER',
      ar: 'يوفق ويدقق البيانات العابرة للحدود داخل المجموعة الاقتصادية الإقليمية',
    },
    level: 'regional',
    color: '#92400e',
    icon: 'ClipboardCheck',
    sortOrder: 16,
  },
  {
    id: ROLE_IDS.DATA_STEWARD_CONTINENTAL,
    code: 'DATA_STEWARD_CONTINENTAL',
    name: {
      en: 'Continental Data Steward',
      fr: 'Gestionnaire de Données Continental',
      pt: 'Gestor de Dados Continental',
      es: 'Gestor de Datos Continental',
      ar: 'مسؤول البيانات القاري',
    },
    description: {
      en: 'Consolidates continental datasets and approves publication',
      fr: 'Consolide les jeux de données continentaux et approuve la publication',
      pt: 'Consolida conjuntos de dados continentais e aprova a publicação',
      es: 'Consolida los conjuntos de datos continentales y aprueba la publicación',
      ar: 'يوحد مجموعات البيانات القارية ويوافق على النشر',
    },
    level: 'continental',
    color: '#78350f',
    icon: 'ClipboardCheck',
    sortOrder: 17,
  },
  {
    id: ROLE_IDS.DATA_VISUALIZER,
    code: 'DATA_VISUALIZER',
    name: {
      en: 'Data Visualizer',
      fr: 'Visualiseur de Données',
      pt: 'Visualizador de Dados',
      es: 'Visualizador de Datos',
      ar: 'مصور البيانات',
    },
    description: {
      en: 'Builds and shares dashboards, charts and embedded BI views',
      fr: 'Construit et partage des tableaux de bord, graphiques et vues BI intégrées',
      pt: 'Cria e compartilha painéis, gráficos e visualizações BI embutidas',
      es: 'Crea y comparte paneles, gráficos y vistas de BI embebidas',
      ar: 'ينشئ ويشارك لوحات المعلومات والرسوم البيانية وعروض الذكاء الأعمال المضمنة',
    },
    level: 'continental',
    color: '#4f46e5',
    icon: 'BarChart3',
    sortOrder: 18,
  },
];

// ── Permission Definitions ─────────────────────────────────────────────────

interface PermissionSeed {
  module: string;
  feature: string;
  actions: string[];
}

const ACTIONS_CRUD = ['view', 'create', 'edit', 'delete'];
const ACTIONS_FULL = ['view', 'create', 'edit', 'delete', 'export', 'validate'];
const ACTIONS_VIEW = ['view'];
const ACTIONS_VIEW_EXPORT = ['view', 'export'];
const ACTIONS_CONFIGURE = ['view', 'configure'];
const ACTIONS_CRUD_CONFIGURE = ['view', 'create', 'edit', 'delete', 'configure'];

const PERMISSION_DEFS: PermissionSeed[] = [
  // Dashboard
  { module: 'dashboard', feature: 'home', actions: ACTIONS_VIEW },

  // Animal Health
  { module: 'animal-health', feature: 'events', actions: ACTIONS_FULL },
  { module: 'animal-health', feature: 'vaccination', actions: ACTIONS_FULL },
  { module: 'animal-health', feature: 'map', actions: ACTIONS_VIEW_EXPORT },

  // Livestock
  { module: 'livestock', feature: 'census', actions: ACTIONS_FULL },
  { module: 'livestock', feature: 'production', actions: ACTIONS_FULL },
  { module: 'livestock', feature: 'transhumance', actions: ACTIONS_FULL },

  // Fisheries
  { module: 'fisheries', feature: 'captures', actions: ACTIONS_FULL },
  { module: 'fisheries', feature: 'vessels', actions: ACTIONS_FULL },
  { module: 'fisheries', feature: 'aquaculture', actions: ACTIONS_FULL },

  // Trade
  { module: 'trade', feature: 'flows', actions: ACTIONS_FULL },
  { module: 'trade', feature: 'sps', actions: ACTIONS_FULL },
  { module: 'trade', feature: 'markets', actions: ACTIONS_FULL },

  // Wildlife
  { module: 'wildlife', feature: 'inventory', actions: ACTIONS_FULL },
  { module: 'wildlife', feature: 'protected-areas', actions: ACTIONS_FULL },
  { module: 'wildlife', feature: 'cites', actions: ACTIONS_FULL },

  // Apiculture
  { module: 'apiculture', feature: 'apiaries', actions: ACTIONS_FULL },
  { module: 'apiculture', feature: 'production', actions: ACTIONS_FULL },
  { module: 'apiculture', feature: 'colony-health', actions: ACTIONS_FULL },

  // Governance
  { module: 'governance', feature: 'legal-frameworks', actions: ACTIONS_FULL },
  { module: 'governance', feature: 'pvs', actions: ACTIONS_FULL },
  { module: 'governance', feature: 'stakeholders', actions: ACTIONS_FULL },
  { module: 'governance', feature: 'capacity', actions: ACTIONS_FULL },

  // Climate & Environment
  { module: 'climate-env', feature: 'climate-data', actions: ACTIONS_FULL },
  { module: 'climate-env', feature: 'water-stress', actions: ACTIONS_VIEW_EXPORT },
  { module: 'climate-env', feature: 'rangelands', actions: ACTIONS_VIEW_EXPORT },
  { module: 'climate-env', feature: 'hotspots', actions: ACTIONS_VIEW_EXPORT },

  // Knowledge Hub (KMS)
  // - publications: create/edit own drafts; KNOWLEDGE_MANAGER reviews & publishes
  // - categories: managed by KNOWLEDGE_MANAGER + continental roles only
  // - review: validation queue (approve/reject) reserved to reviewers
  { module: 'knowledge', feature: 'publications', actions: ['view', 'create', 'edit', 'delete', 'submit', 'publish', 'archive'] },
  { module: 'knowledge', feature: 'categories', actions: ACTIONS_CRUD },
  { module: 'knowledge', feature: 'review', actions: ['view', 'approve', 'reject'] },

  // Collecte
  { module: 'collecte', feature: 'forms', actions: ACTIONS_CRUD },
  { module: 'collecte', feature: 'campaigns', actions: ACTIONS_CRUD },
  { module: 'collecte', feature: 'submissions', actions: ['view', 'create', 'edit', 'delete', 'export', 'validate'] },

  // Workflow
  { module: 'workflow', feature: 'validation', actions: ['view', 'validate'] },

  // Master Data
  { module: 'master-data', feature: 'referentials', actions: ACTIONS_CRUD },
  { module: 'master-data', feature: 'denominators', actions: ACTIONS_CRUD },
  { module: 'master-data', feature: 'infrastructures', actions: ACTIONS_CRUD },

  // Quality
  { module: 'quality', feature: 'rules', actions: ACTIONS_CRUD_CONFIGURE },
  { module: 'quality', feature: 'reports', actions: ACTIONS_VIEW_EXPORT },

  // Interop
  { module: 'interop', feature: 'wahis', actions: ['view', 'export', 'configure'] },
  { module: 'interop', feature: 'empres', actions: ['view', 'export', 'configure'] },
  { module: 'interop', feature: 'faostat', actions: ['view', 'export', 'configure'] },
  { module: 'interop', feature: 'exports', actions: ['view', 'export'] },

  // Analytics
  { module: 'analytics', feature: 'trends', actions: ACTIONS_VIEW_EXPORT },
  { module: 'analytics', feature: 'comparison', actions: ACTIONS_VIEW_EXPORT },
  { module: 'analytics', feature: 'geo', actions: ACTIONS_VIEW_EXPORT },
  { module: 'analytics', feature: 'export', actions: ['view', 'export'] },

  // Historical
  { module: 'historical', feature: 'data', actions: ACTIONS_VIEW_EXPORT },

  // Reports
  { module: 'reports', feature: 'generate', actions: ['view', 'create', 'export'] },
  { module: 'reports', feature: 'history', actions: ACTIONS_VIEW },

  // BI Tools
  { module: 'bi-tools', feature: 'superset', actions: ['view', 'configure'] },
  { module: 'bi-tools', feature: 'metabase', actions: ['view', 'configure'] },
  { module: 'bi-tools', feature: 'grafana', actions: ['view', 'configure'] },

  // Settings
  { module: 'settings', feature: 'profile', actions: ['view', 'edit'] },
  { module: 'settings', feature: 'security', actions: ACTIONS_CONFIGURE },
  { module: 'settings', feature: 'general', actions: ACTIONS_CONFIGURE },
  { module: 'settings', feature: 'tenant', actions: ['view', 'edit'] },
  { module: 'settings', feature: 'recs', actions: ACTIONS_CRUD },
  { module: 'settings', feature: 'countries', actions: ACTIONS_CRUD },
  { module: 'settings', feature: 'users', actions: ACTIONS_CRUD_CONFIGURE },
  { module: 'settings', feature: 'roles', actions: ACTIONS_CRUD_CONFIGURE },
  { module: 'settings', feature: 'domains', actions: ACTIONS_CRUD },
  { module: 'settings', feature: 'functions', actions: ACTIONS_CRUD },
  { module: 'settings', feature: 'kpis', actions: ACTIONS_CRUD },
  { module: 'settings', feature: 'statistics', actions: ACTIONS_CRUD },
  { module: 'settings', feature: 'workflow-config', actions: ACTIONS_CONFIGURE },
  { module: 'settings', feature: 'validation-chains', actions: ACTIONS_CRUD },
  { module: 'settings', feature: 'data-quality', actions: ACTIONS_CONFIGURE },
  { module: 'settings', feature: 'data-contracts', actions: ACTIONS_CRUD },
  { module: 'settings', feature: 'bi-access', actions: ACTIONS_CRUD_CONFIGURE },
  { module: 'settings', feature: 'infrastructures', actions: ACTIONS_CRUD },
  { module: 'settings', feature: 'notifications', actions: ACTIONS_CONFIGURE },
  { module: 'settings', feature: 'audit', actions: ACTIONS_VIEW },
  { module: 'settings', feature: 'i18n', actions: ACTIONS_CONFIGURE },
  { module: 'settings', feature: 'system', actions: ACTIONS_CONFIGURE },
];

// ── Role → Permission Mappings ─────────────────────────────────────────────

// Helper: returns all module/feature/action combos for a set of modules
function allPermsForModules(modules: string[]): string[] {
  const results: string[] = [];
  for (const def of PERMISSION_DEFS) {
    if (modules.includes(def.module)) {
      for (const action of def.actions) {
        results.push(`${def.module}:${def.feature}:${action}`);
      }
    }
  }
  return results;
}

// All permission keys
function allPermKeys(): string[] {
  const results: string[] = [];
  for (const def of PERMISSION_DEFS) {
    for (const action of def.actions) {
      results.push(`${def.module}:${def.feature}:${action}`);
    }
  }
  return results;
}

// Domain modules
const DOMAIN_MODULES = [
  'animal-health', 'livestock', 'fisheries', 'trade', 'wildlife',
  'apiculture', 'governance', 'climate-env', 'knowledge',
];

// SUPER_ADMIN: all permissions
const SUPER_ADMIN_PERMS = allPermKeys();

// CONTINENTAL_ADMIN: everything except system-level settings
const CONTINENTAL_ADMIN_EXCLUDE = [
  'settings:system:view', 'settings:system:configure',
];
const CONTINENTAL_ADMIN_PERMS = allPermKeys().filter(p => !CONTINENTAL_ADMIN_EXCLUDE.includes(p));

// REC_ADMIN: domain modules + analytics + dashboard + limited settings
const REC_ADMIN_PERMS = [
  ...allPermsForModules(['dashboard', ...DOMAIN_MODULES, 'analytics', 'historical', 'reports', 'workflow', 'collecte']),
  'settings:profile:view', 'settings:profile:edit',
  'settings:tenant:view', 'settings:tenant:edit',
  'settings:countries:view', 'settings:countries:edit',
  'settings:users:view', 'settings:users:create', 'settings:users:edit',
  'settings:functions:view', 'settings:functions:create', 'settings:functions:edit', 'settings:functions:delete',
  'settings:domains:view',
  'settings:roles:view',
  'settings:kpis:view', 'settings:kpis:create', 'settings:kpis:edit',
  'settings:statistics:view', 'settings:statistics:create', 'settings:statistics:edit',
  'settings:validation-chains:view', 'settings:validation-chains:create', 'settings:validation-chains:edit',
  'settings:audit:view',
  'bi-tools:superset:view', 'bi-tools:metabase:view', 'bi-tools:grafana:view',
];

// NATIONAL_ADMIN: similar to REC but national scope + master data
const NATIONAL_ADMIN_PERMS = [
  ...allPermsForModules(['dashboard', ...DOMAIN_MODULES, 'analytics', 'historical', 'reports', 'workflow', 'collecte', 'master-data']),
  'settings:profile:view', 'settings:profile:edit',
  'settings:tenant:view', 'settings:tenant:edit',
  'settings:users:view', 'settings:users:create', 'settings:users:edit',
  'settings:functions:view', 'settings:functions:create', 'settings:functions:edit', 'settings:functions:delete',
  'settings:domains:view',
  'settings:roles:view',
  'settings:kpis:view', 'settings:kpis:create', 'settings:kpis:edit',
  'settings:statistics:view', 'settings:statistics:create', 'settings:statistics:edit',
  'settings:validation-chains:view', 'settings:validation-chains:create', 'settings:validation-chains:edit', 'settings:validation-chains:delete',
  'settings:countries:view', 'settings:countries:edit',
  'settings:audit:view',
  'quality:rules:view', 'quality:reports:view', 'quality:reports:export',
  'bi-tools:superset:view', 'bi-tools:metabase:view', 'bi-tools:grafana:view',
  'interop:wahis:view', 'interop:empres:view', 'interop:faostat:view', 'interop:exports:view', 'interop:exports:export',
];

// DATA_STEWARD: domain view + quality focus + workflow validation
const DATA_STEWARD_PERMS = [
  'dashboard:home:view',
  ...allPermsForModules(DOMAIN_MODULES).filter(p => p.endsWith(':view') || p.endsWith(':edit') || p.endsWith(':validate') || p.endsWith(':export')),
  ...allPermsForModules(['workflow', 'quality']),
  'collecte:forms:view', 'collecte:campaigns:view', 'collecte:submissions:view', 'collecte:submissions:validate', 'collecte:submissions:export',
  'master-data:referentials:view', 'master-data:denominators:view', 'master-data:infrastructures:view',
  'analytics:trends:view', 'analytics:trends:export', 'analytics:comparison:view', 'analytics:comparison:export',
  'analytics:geo:view', 'analytics:geo:export', 'analytics:export:view', 'analytics:export:export',
  'historical:data:view', 'historical:data:export',
  'reports:generate:view', 'reports:generate:create', 'reports:generate:export', 'reports:history:view',
  'settings:profile:view', 'settings:profile:edit',
  'settings:audit:view',
  'bi-tools:superset:view', 'bi-tools:metabase:view',
];

// WAHIS_FOCAL_POINT: animal health focus + interop export
const WAHIS_FOCAL_POINT_PERMS = [
  'dashboard:home:view',
  ...allPermsForModules(['animal-health']),
  'livestock:census:view', 'livestock:production:view',
  'workflow:validation:view', 'workflow:validation:validate',
  'interop:wahis:view', 'interop:wahis:export', 'interop:empres:view', 'interop:empres:export',
  'interop:exports:view', 'interop:exports:export',
  'analytics:trends:view', 'analytics:geo:view',
  'reports:generate:view', 'reports:generate:create', 'reports:generate:export', 'reports:history:view',
  'settings:profile:view', 'settings:profile:edit',
];

// ANALYST: read-only across everything + export
const ANALYST_PERMS = [
  'dashboard:home:view',
  ...allPermsForModules(DOMAIN_MODULES).filter(p => p.endsWith(':view') || p.endsWith(':export')),
  ...allPermsForModules(['analytics', 'historical', 'reports']),
  'master-data:referentials:view', 'master-data:denominators:view', 'master-data:infrastructures:view',
  'bi-tools:superset:view', 'bi-tools:metabase:view', 'bi-tools:grafana:view',
  'settings:profile:view', 'settings:profile:edit',
];

// FIELD_AGENT: data collection only
const FIELD_AGENT_PERMS = [
  'dashboard:home:view',
  ...DOMAIN_MODULES.map(m => `${m}:${PERMISSION_DEFS.find(d => d.module === m)!.feature}:view`),
  'collecte:forms:view', 'collecte:campaigns:view',
  'collecte:submissions:view', 'collecte:submissions:create', 'collecte:submissions:edit',
  'settings:profile:view', 'settings:profile:edit',
];

// KNOWLEDGE_MANAGER: continental editor — full control of the Knowledge Hub
// Validates and publishes content from all RECs and countries.
const KNOWLEDGE_MANAGER_PERMS = [
  'dashboard:home:view',
  // Full publication lifecycle
  'knowledge:publications:view', 'knowledge:publications:create', 'knowledge:publications:edit',
  'knowledge:publications:delete', 'knowledge:publications:submit', 'knowledge:publications:publish',
  'knowledge:publications:archive',
  // Category management
  'knowledge:categories:view', 'knowledge:categories:create', 'knowledge:categories:edit', 'knowledge:categories:delete',
  // Review queue
  'knowledge:review:view', 'knowledge:review:approve', 'knowledge:review:reject',
  // Read-only domain visibility for context
  ...allPermsForModules(DOMAIN_MODULES).filter(p => p.endsWith(':view')),
  'analytics:trends:view',
  'reports:generate:view', 'reports:history:view',
  'settings:profile:view', 'settings:profile:edit',
  'settings:audit:view',
];

// ── Additional role permission sets ──────────────────────────────────────
// Scoped variants of DATA_STEWARD / FIELD_AGENT / ANALYST. They inherit the
// base permissions and differ only in the geographic scope enforced at
// runtime by tenant-level access checks (the scope itself lives on the
// UserRoleAssignment + tenant relationship, not on the permission list).

// DELEGATE_ARIS_*: mirror the corresponding admin scope, but read-focused
// so they don't accidentally create/modify tenant records.
const DELEGATE_ARIS_NATIONAL_PERMS = [
  'dashboard:home:view',
  ...allPermsForModules(DOMAIN_MODULES).filter(p => p.endsWith(':view') || p.endsWith(':export')),
  ...allPermsForModules(['analytics', 'historical', 'reports']),
  'workflow:validation:view', 'workflow:validation:validate',
  'collecte:forms:view', 'collecte:campaigns:view', 'collecte:submissions:view',
  'interop:wahis:view', 'interop:wahis:export',
  'interop:empres:view', 'interop:empres:export',
  'interop:exports:view', 'interop:exports:export',
  'settings:profile:view', 'settings:profile:edit',
  'settings:tenant:view',
  'bi-tools:superset:view', 'bi-tools:metabase:view',
];
const DELEGATE_ARIS_REGIONAL_PERMS = [
  ...DELEGATE_ARIS_NATIONAL_PERMS,
  'settings:countries:view',
  'bi-tools:grafana:view',
];

// DATA_COLLECTOR_*: all variants match FIELD_AGENT's capability set — the
// scope (national/regional/continental) is enforced by the tenant binding.
const DATA_COLLECTOR_NATIONAL_PERMS = FIELD_AGENT_PERMS;
const DATA_COLLECTOR_REGIONAL_PERMS = FIELD_AGENT_PERMS;
const DATA_COLLECTOR_CONTINENTAL_PERMS = FIELD_AGENT_PERMS;

// DATA_STEWARD_*: all variants match DATA_STEWARD.
const DATA_STEWARD_NATIONAL_PERMS = DATA_STEWARD_PERMS;
const DATA_STEWARD_REGIONAL_PERMS = DATA_STEWARD_PERMS;
const DATA_STEWARD_CONTINENTAL_PERMS = DATA_STEWARD_PERMS;

// DATA_VISUALIZER: analytics + BI read-heavy + limited dashboard authoring.
const DATA_VISUALIZER_PERMS = [
  'dashboard:home:view',
  ...allPermsForModules(DOMAIN_MODULES).filter(p => p.endsWith(':view') || p.endsWith(':export')),
  ...allPermsForModules(['analytics', 'historical']),
  'reports:generate:view', 'reports:generate:create', 'reports:generate:export', 'reports:history:view',
  'bi-tools:superset:view', 'bi-tools:superset:configure',
  'bi-tools:metabase:view', 'bi-tools:metabase:configure',
  'bi-tools:grafana:view', 'bi-tools:grafana:configure',
  'settings:profile:view', 'settings:profile:edit',
];

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  SUPER_ADMIN: SUPER_ADMIN_PERMS,
  CONTINENTAL_ADMIN: CONTINENTAL_ADMIN_PERMS,
  REC_ADMIN: REC_ADMIN_PERMS,
  NATIONAL_ADMIN: NATIONAL_ADMIN_PERMS,
  DATA_STEWARD: DATA_STEWARD_PERMS,
  WAHIS_FOCAL_POINT: WAHIS_FOCAL_POINT_PERMS,
  ANALYST: ANALYST_PERMS,
  FIELD_AGENT: FIELD_AGENT_PERMS,
  KNOWLEDGE_MANAGER: KNOWLEDGE_MANAGER_PERMS,
  DELEGATE_ARIS_NATIONAL: DELEGATE_ARIS_NATIONAL_PERMS,
  DELEGATE_ARIS_REGIONAL: DELEGATE_ARIS_REGIONAL_PERMS,
  DATA_COLLECTOR_NATIONAL: DATA_COLLECTOR_NATIONAL_PERMS,
  DATA_COLLECTOR_REGIONAL: DATA_COLLECTOR_REGIONAL_PERMS,
  DATA_COLLECTOR_CONTINENTAL: DATA_COLLECTOR_CONTINENTAL_PERMS,
  DATA_STEWARD_NATIONAL: DATA_STEWARD_NATIONAL_PERMS,
  DATA_STEWARD_REGIONAL: DATA_STEWARD_REGIONAL_PERMS,
  DATA_STEWARD_CONTINENTAL: DATA_STEWARD_CONTINENTAL_PERMS,
  DATA_VISUALIZER: DATA_VISUALIZER_PERMS,
};

// ── Function Category → Role Mapping ───────────────────────────────────────

const CATEGORY_TO_ROLE: Record<string, string> = {
  admin: 'SUPER_ADMIN',
  management: 'NATIONAL_ADMIN',
  technical: 'DATA_STEWARD',
  data: 'DATA_STEWARD',
  field: 'FIELD_AGENT',
};

// ── Main Seed ──────────────────────────────────────────────────────────────

async function seedRoles() {
  console.log('── Seeding Roles & Permissions ──');

  // 1. Upsert system roles
  console.log(`  1. Upserting ${SYSTEM_ROLES.length} system roles...`);
  for (const role of SYSTEM_ROLES) {
    await (prisma as any).role.upsert({
      where: { id: role.id },
      update: {
        name: role.name,
        description: role.description,
        level: role.level,
        color: role.color,
        icon: role.icon,
        sortOrder: role.sortOrder,
        isSystem: true,
        isActive: true,
      },
      create: {
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        level: role.level,
        color: role.color,
        icon: role.icon,
        isSystem: true,
        isActive: true,
        sortOrder: role.sortOrder,
        tenantId: null,
      },
    });
  }
  console.log(`    ✓ ${SYSTEM_ROLES.length} system roles upserted`);

  // 2. Upsert permission definitions
  console.log('  2. Upserting permission definitions...');
  let permCount = 0;
  const permIdMap = new Map<string, string>(); // "module:feature:action" → id

  for (const def of PERMISSION_DEFS) {
    for (const action of def.actions) {
      const key = `${def.module}:${def.feature}:${action}`;
      const perm = await (prisma as any).permission.upsert({
        where: {
          module_feature_action: {
            module: def.module,
            feature: def.feature,
            action,
          },
        },
        update: { isActive: true },
        create: {
          module: def.module,
          feature: def.feature,
          action,
          isActive: true,
        },
      });
      permIdMap.set(key, perm.id);
      permCount++;
    }
  }
  console.log(`    ✓ ${permCount} permission definitions upserted`);

  // 3. Create role-permission mappings
  console.log('  3. Creating role-permission mappings...');
  let mappingCount = 0;

  for (const [roleCode, permKeys] of Object.entries(ROLE_PERMISSION_MAP)) {
    const roleId = ROLE_IDS[roleCode as keyof typeof ROLE_IDS];
    if (!roleId) continue;

    // Delete existing mappings for this role and recreate
    await (prisma as any).rolePermission.deleteMany({ where: { roleId } });

    const mappings: { roleId: string; permissionId: string }[] = [];
    for (const key of permKeys) {
      const permId = permIdMap.get(key);
      if (permId) {
        mappings.push({ roleId, permissionId: permId });
      }
    }

    if (mappings.length > 0) {
      await (prisma as any).rolePermission.createMany({
        data: mappings,
        skipDuplicates: true,
      });
      mappingCount += mappings.length;
    }
    console.log(`    ${roleCode}: ${mappings.length} permissions`);
  }
  console.log(`    ✓ ${mappingCount} role-permission mappings created`);

  // 4. Migrate function categories → FunctionRole
  console.log('  4. Migrating function categories to FunctionRole...');
  const functions = await (prisma as any).function.findMany({
    where: { category: { not: null } },
    select: { id: true, category: true },
  });

  let fnRoleCount = 0;
  for (const fn of functions) {
    const roleCode = CATEGORY_TO_ROLE[fn.category as string];
    if (!roleCode) continue;
    const roleId = ROLE_IDS[roleCode as keyof typeof ROLE_IDS];
    if (!roleId) continue;

    await (prisma as any).functionRole.upsert({
      where: {
        functionId_roleId: { functionId: fn.id, roleId },
      },
      update: {},
      create: { functionId: fn.id, roleId },
    });
    fnRoleCount++;
  }
  console.log(`    ✓ ${fnRoleCount} function-role links created`);

  // 5. Create UserRoleAssignment from User.role
  console.log('  5. Creating user role assignments from existing User.role...');
  const users = await (prisma as any).user.findMany({
    select: { id: true, role: true },
  });

  let userRoleCount = 0;
  for (const user of users) {
    const roleId = ROLE_IDS[user.role as keyof typeof ROLE_IDS];
    if (!roleId) continue;

    await (prisma as any).userRoleAssignment.upsert({
      where: {
        userId_roleId: { userId: user.id, roleId },
      },
      update: {},
      create: {
        userId: user.id,
        roleId,
        source: 'direct',
      },
    });
    userRoleCount++;
  }
  console.log(`    ✓ ${userRoleCount} user role assignments created`);

  console.log('── Roles & Permissions seeding complete ──');
}

// ── Execute ────────────────────────────────────────────────────────────────

seedRoles()
  .catch((err) => {
    console.error('Seed roles failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

export { seedRoles, ROLE_IDS, PERMISSION_DEFS, ROLE_PERMISSION_MAP };
