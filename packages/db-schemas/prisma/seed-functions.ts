import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'Aris2024!';

// ── Tenant IDs from seed-tenant.ts ──
const TENANT_IDS = {
  AU_IBAR: '00000000-0000-4000-a000-000000000001',
  IGAD: '00000000-0000-4000-a000-000000000010',
  ECOWAS: '00000000-0000-4000-a000-000000000020',
  EAC: '00000000-0000-4000-a000-000000000040',
  KENYA: '00000000-0000-4000-a000-000000000101',
  NIGERIA: '00000000-0000-4000-a000-000000000201',
  SENEGAL: '00000000-0000-4000-a000-000000000202',
} as const;

// ── Existing user IDs from seed-credential.ts ──
const EXISTING_USER_IDS = {
  SUPER_ADMIN: '10000000-0000-4000-a000-000000000001',
  KE_ADMIN: '10000000-0000-4000-a000-000000000101',
  NG_ADMIN: '10000000-0000-4000-a000-000000000201',
} as const;

// ── New user IDs ──
const NEW_USER_IDS = {
  ECOWAS_COORD: '10000000-0000-4000-a000-000000000020',
  EAC_COORD: '10000000-0000-4000-a000-000000000040',
  CM_ADMIN: '10000000-0000-4000-a000-000000000050',
  KE_VET: '10000000-0000-4000-a000-000000000111',
  KE_DATA: '10000000-0000-4000-a000-000000000112',
} as const;

// ── Deterministic function IDs (used only for AU-IBAR continental functions) ──
const FN = {
  // Continental
  SUPER_ADMIN: '20000000-0000-4000-a000-000000000000',
  DIR_GEN: '20000000-0000-4000-a000-000000000001',
  DEP_DIR: '20000000-0000-4000-a000-000000000002',
  AU_CVO: '20000000-0000-4000-a000-000000000003',
  SR_ANALYST: '20000000-0000-4000-a000-000000000004',
  IT_ADMIN: '20000000-0000-4000-a000-000000000005',
  PROG_COORD: '20000000-0000-4000-a000-000000000006',
  ME_SPEC: '20000000-0000-4000-a000-000000000007',
  COMM_OFF: '20000000-0000-4000-a000-000000000008',
} as const;

interface FunctionTemplate {
  code: string;
  level: string;
  category: string;
  name: { en: string; fr: string; pt: string; ar: string };
  description: { en: string; fr: string; pt: string; ar: string };
  sortOrder: number;
}

// ── Continental functions (only for AU-IBAR) ──
const CONTINENTAL_FUNCTIONS: (FunctionTemplate & { id: string })[] = [
  { id: FN.SUPER_ADMIN, code: 'SUPER_ADMIN', level: 'continental', category: 'admin', sortOrder: 0,
    name: { en: 'Super Administrator', fr: 'Super Administrateur', pt: 'Super Administrador', ar: 'المسؤول الأعلى' },
    description: { en: 'Platform super administrator', fr: 'Super administrateur de la plateforme', pt: 'Super administrador da plataforma', ar: 'المسؤول الأعلى للمنصة' } },
  { id: FN.DIR_GEN, code: 'DIR_GEN', level: 'continental', category: 'management', sortOrder: 1,
    name: { en: 'Director General', fr: 'Directeur Général', pt: 'Diretor Geral', ar: 'المدير العام' },
    description: { en: 'Head of AU-IBAR operations', fr: "Chef des opérations de l'UA-BIRA", pt: 'Chefe das operações da UA-BIRA', ar: 'رئيس عمليات المكتب' } },
  { id: FN.DEP_DIR, code: 'DEP_DIR', level: 'continental', category: 'management', sortOrder: 2,
    name: { en: 'Deputy Director', fr: 'Directeur Adjoint', pt: 'Diretor Adjunto', ar: 'نائب المدير' },
    description: { en: 'Deputy head of AU-IBAR', fr: "Directeur adjoint de l'UA-BIRA", pt: 'Vice-chefe da UA-BIRA', ar: 'نائب رئيس المكتب' } },
  { id: FN.AU_CVO, code: 'AU_CVO', level: 'continental', category: 'technical', sortOrder: 3,
    name: { en: 'Chief Veterinary Officer', fr: 'Chef Vétérinaire', pt: 'Chefe Veterinário', ar: 'كبير الأطباء البيطريين' },
    description: { en: 'Continental chief veterinary officer', fr: 'Chef vétérinaire continental', pt: 'Chefe veterinário continental', ar: 'كبير الأطباء البيطريين القاري' } },
  { id: FN.SR_ANALYST, code: 'SR_ANALYST', level: 'continental', category: 'data', sortOrder: 4,
    name: { en: 'Senior Data Analyst', fr: 'Analyste de Données Senior', pt: 'Analista de Dados Sénior', ar: 'محلل بيانات أول' },
    description: { en: 'Senior continental data analyst', fr: 'Analyste de données senior continental', pt: 'Analista de dados sénior continental', ar: 'محلل بيانات قاري أول' } },
  { id: FN.IT_ADMIN, code: 'IT_ADMIN', level: 'continental', category: 'admin', sortOrder: 5,
    name: { en: 'IT Administrator', fr: 'Administrateur IT', pt: 'Administrador de TI', ar: 'مسؤول تكنولوجيا المعلومات' },
    description: { en: 'Information technology administrator', fr: "Administrateur des technologies de l'information", pt: 'Administrador de tecnologia da informação', ar: 'مسؤول تكنولوجيا المعلومات' } },
  { id: FN.PROG_COORD, code: 'PROG_COORD', level: 'continental', category: 'management', sortOrder: 6,
    name: { en: 'Program Coordinator', fr: 'Coordinateur de Programme', pt: 'Coordenador de Programa', ar: 'منسق البرنامج' },
    description: { en: 'Coordinates continental programs', fr: 'Coordonne les programmes continentaux', pt: 'Coordena programas continentais', ar: 'ينسق البرامج القارية' } },
  { id: FN.ME_SPEC, code: 'ME_SPEC', level: 'continental', category: 'technical', sortOrder: 7,
    name: { en: 'M&E Specialist', fr: 'Spécialiste Suivi-Évaluation', pt: 'Especialista em M&A', ar: 'أخصائي المتابعة والتقييم' },
    description: { en: 'Monitoring and evaluation specialist', fr: 'Spécialiste suivi et évaluation', pt: 'Especialista em monitoramento e avaliação', ar: 'أخصائي المتابعة والتقييم' } },
  { id: FN.COMM_OFF, code: 'COMM_OFF', level: 'continental', category: 'admin', sortOrder: 8,
    name: { en: 'Communication Officer', fr: 'Chargé de Communication', pt: 'Oficial de Comunicação', ar: 'مسؤول الاتصالات' },
    description: { en: 'Handles communications and outreach', fr: 'Gère la communication et la sensibilisation', pt: 'Gere comunicação e divulgação', ar: 'يدير الاتصالات والتواصل' } },
];

// ── Regional function templates (created for each REC) ──
const REGIONAL_TEMPLATES: FunctionTemplate[] = [
  { code: 'REG_COORD', level: 'regional', category: 'management', sortOrder: 1,
    name: { en: 'Regional Coordinator', fr: 'Coordinateur Régional', pt: 'Coordenador Regional', ar: 'المنسق الإقليمي' },
    description: { en: 'Coordinates regional activities', fr: 'Coordonne les activités régionales', pt: 'Coordena atividades regionais', ar: 'ينسق الأنشطة الإقليمية' } },
  { code: 'REG_VET', level: 'regional', category: 'technical', sortOrder: 2,
    name: { en: 'Regional Veterinary Officer', fr: 'Officier Vétérinaire Régional', pt: 'Oficial Veterinário Regional', ar: 'المسؤول البيطري الإقليمي' },
    description: { en: 'Regional veterinary oversight', fr: 'Supervision vétérinaire régionale', pt: 'Supervisão veterinária regional', ar: 'الإشراف البيطري الإقليمي' } },
  { code: 'REG_DATA', level: 'regional', category: 'data', sortOrder: 3,
    name: { en: 'Data Manager', fr: 'Gestionnaire de Données', pt: 'Gestor de Dados', ar: 'مدير البيانات' },
    description: { en: 'Manages regional data', fr: 'Gère les données régionales', pt: 'Gere dados regionais', ar: 'يدير البيانات الإقليمية' } },
  { code: 'REG_EPID', level: 'regional', category: 'technical', sortOrder: 4,
    name: { en: 'Regional Epidemiologist', fr: 'Épidémiologiste Régional', pt: 'Epidemiologista Regional', ar: 'عالم الأوبئة الإقليمي' },
    description: { en: 'Regional disease surveillance', fr: 'Surveillance régionale des maladies', pt: 'Vigilância regional de doenças', ar: 'مراقبة الأمراض الإقليمية' } },
  { code: 'TECH_ADV', level: 'regional', category: 'technical', sortOrder: 5,
    name: { en: 'Technical Advisor', fr: 'Conseiller Technique', pt: 'Conselheiro Técnico', ar: 'المستشار الفني' },
    description: { en: 'Provides technical guidance', fr: 'Fournit des conseils techniques', pt: 'Fornece orientação técnica', ar: 'يقدم التوجيه الفني' } },
  { code: 'REG_FOCAL', level: 'regional', category: 'technical', sortOrder: 6,
    name: { en: 'Regional Focal Point', fr: 'Point Focal Régional', pt: 'Ponto Focal Regional', ar: 'نقطة الاتصال الإقليمية' },
    description: { en: 'Primary regional contact', fr: 'Contact régional principal', pt: 'Contato regional principal', ar: 'جهة الاتصال الإقليمية الرئيسية' } },
  { code: 'ADMIN_ASST', level: 'regional', category: 'admin', sortOrder: 7,
    name: { en: 'Administrative Assistant', fr: 'Assistant Administratif', pt: 'Assistente Administrativo', ar: 'مساعد إداري' },
    description: { en: 'Administrative support', fr: 'Support administratif', pt: 'Suporte administrativo', ar: 'الدعم الإداري' } },
];

// ── National function templates (created for each MEMBER_STATE) ──
const NATIONAL_TEMPLATES: FunctionTemplate[] = [
  { code: 'NAT_CVO', level: 'national', category: 'management', sortOrder: 1,
    name: { en: 'Chief Veterinary Officer', fr: 'Directeur des Services Vétérinaires', pt: 'Diretor dos Serviços Veterinários', ar: 'مدير الخدمات البيطرية' },
    description: { en: 'National chief veterinary officer', fr: 'Directeur national des services vétérinaires', pt: 'Diretor nacional dos serviços veterinários', ar: 'المدير الوطني للخدمات البيطرية' } },
  { code: 'NAT_EPID', level: 'national', category: 'technical', sortOrder: 2,
    name: { en: 'National Epidemiologist', fr: 'Épidémiologiste National', pt: 'Epidemiologista Nacional', ar: 'عالم الأوبئة الوطني' },
    description: { en: 'National epidemiological surveillance lead', fr: 'Responsable de la surveillance épidémiologique nationale', pt: 'Responsável pela vigilância epidemiológica nacional', ar: 'رئيس المراقبة الوبائية الوطنية' } },
  { code: 'NAT_FOCAL', level: 'national', category: 'technical', sortOrder: 3,
    name: { en: 'National Focal Point', fr: 'Point Focal National', pt: 'Ponto Focal Nacional', ar: 'نقطة الاتصال الوطنية' },
    description: { en: 'Primary national contact for ARIS', fr: "Point de contact national principal pour l'ARIS", pt: 'Ponto de contato nacional principal para o ARIS', ar: 'جهة الاتصال الوطنية الرئيسية لـ ARIS' } },
  { code: 'LAB_DIR', level: 'national', category: 'technical', sortOrder: 4,
    name: { en: 'Laboratory Director', fr: 'Directeur de Laboratoire', pt: 'Diretor de Laboratório', ar: 'مدير المختبر' },
    description: { en: 'Heads national veterinary laboratory', fr: 'Dirige le laboratoire vétérinaire national', pt: 'Dirige o laboratório veterinário nacional', ar: 'يرأس المختبر البيطري الوطني' } },
  { code: 'FIELD_VET', level: 'national', category: 'field', sortOrder: 5,
    name: { en: 'Field Veterinarian', fr: 'Vétérinaire de Terrain', pt: 'Veterinário de Campo', ar: 'طبيب بيطري ميداني' },
    description: { en: 'Field-based veterinary officer', fr: 'Vétérinaire basé sur le terrain', pt: 'Oficial veterinário de campo', ar: 'مسؤول بيطري ميداني' } },
  { code: 'DATA_ENTRY', level: 'national', category: 'data', sortOrder: 6,
    name: { en: 'Data Entry Officer', fr: 'Agent de Saisie', pt: 'Oficial de Entrada de Dados', ar: 'مسؤول إدخال البيانات' },
    description: { en: 'Enters and validates data', fr: 'Saisit et valide les données', pt: 'Insere e valida dados', ar: 'يدخل ويتحقق من البيانات' } },
  { code: 'DIST_VET', level: 'national', category: 'field', sortOrder: 7,
    name: { en: 'District Veterinary Officer', fr: 'Vétérinaire de District', pt: 'Oficial Veterinário Distrital', ar: 'المسؤول البيطري للمقاطعة' },
    description: { en: 'District-level veterinary officer', fr: 'Vétérinaire au niveau du district', pt: 'Oficial veterinário ao nível distrital', ar: 'المسؤول البيطري على مستوى المقاطعة' } },
  { code: 'LIVESTOCK_INSP', level: 'national', category: 'field', sortOrder: 8,
    name: { en: 'Livestock Inspector', fr: 'Inspecteur du Bétail', pt: 'Inspetor de Gado', ar: 'مفتش الماشية' },
    description: { en: 'Inspects livestock and holdings', fr: 'Inspecte le bétail et les exploitations', pt: 'Inspeciona gado e propriedades', ar: 'يفتش الماشية والممتلكات' } },
  { code: 'WILDLIFE_OFF', level: 'national', category: 'field', sortOrder: 9,
    name: { en: 'Wildlife Officer', fr: 'Agent de la Faune Sauvage', pt: 'Oficial da Vida Selvagem', ar: 'مسؤول الحياة البرية' },
    description: { en: 'Wildlife conservation and monitoring', fr: 'Conservation et surveillance de la faune', pt: 'Conservação e monitoramento da vida selvagem', ar: 'حماية ومراقبة الحياة البرية' } },
  { code: 'FISH_OFF', level: 'national', category: 'field', sortOrder: 10,
    name: { en: 'Fisheries Officer', fr: 'Agent des Pêches', pt: 'Oficial de Pescas', ar: 'مسؤول المصايد' },
    description: { en: 'Fisheries management and data', fr: 'Gestion des pêches et données', pt: 'Gestão de pescas e dados', ar: 'إدارة المصايد والبيانات' } },
  { code: 'TRADE_INSP', level: 'national', category: 'field', sortOrder: 11,
    name: { en: 'Trade Inspector', fr: 'Inspecteur du Commerce', pt: 'Inspetor de Comércio', ar: 'مفتش التجارة' },
    description: { en: 'Inspects trade and SPS compliance', fr: 'Inspecte le commerce et la conformité SPS', pt: 'Inspeciona comércio e conformidade SPS', ar: 'يفتش التجارة والامتثال لمعايير SPS' } },
  { code: 'EXT_WORKER', level: 'national', category: 'field', sortOrder: 12,
    name: { en: 'Extension Worker', fr: 'Agent de Vulgarisation', pt: 'Agente de Extensão', ar: 'عامل الإرشاد' },
    description: { en: 'Agricultural extension and community outreach', fr: 'Vulgarisation agricole et sensibilisation communautaire', pt: 'Extensão agrícola e divulgação comunitária', ar: 'الإرشاد الزراعي والتواصل المجتمعي' } },
];

async function upsertFunction(tenantId: string, template: FunctionTemplate, fixedId?: string): Promise<string> {
  const fn = await (prisma as any).function.upsert({
    where: {
      tenantId_code_level: { tenantId, code: template.code, level: template.level },
    },
    update: {
      name: template.name,
      description: template.description,
      category: template.category,
      sortOrder: template.sortOrder,
    },
    create: {
      ...(fixedId ? { id: fixedId } : {}),
      code: template.code,
      name: template.name,
      description: template.description,
      level: template.level,
      category: template.category,
      isActive: true,
      isDefault: true,
      sortOrder: template.sortOrder,
      tenantId,
    },
  });
  return fn.id;
}

async function main(): Promise<void> {
  console.log('Seeding functions...');

  // ── 1. Continental functions → AU-IBAR only ──
  for (const fn of CONTINENTAL_FUNCTIONS) {
    await upsertFunction(TENANT_IDS.AU_IBAR, fn, fn.id);
  }
  console.log(`  ${CONTINENTAL_FUNCTIONS.length} continental functions seeded (AU-IBAR)`);

  // ── 2. Regional functions → one copy per REC ──
  const recs = await (prisma as any).tenant.findMany({
    where: { level: 'REC' },
    select: { id: true, name: true },
  });
  let regionalCount = 0;
  for (const rec of recs) {
    for (const tpl of REGIONAL_TEMPLATES) {
      await upsertFunction(rec.id, tpl);
    }
    regionalCount += REGIONAL_TEMPLATES.length;
  }
  console.log(`  ${regionalCount} regional functions seeded (${recs.length} RECs × ${REGIONAL_TEMPLATES.length} functions)`);

  // ── 3. National functions → one copy per MEMBER_STATE ──
  const countries = await (prisma as any).tenant.findMany({
    where: { level: 'MEMBER_STATE' },
    select: { id: true, name: true },
  });
  let nationalCount = 0;
  for (const country of countries) {
    for (const tpl of NATIONAL_TEMPLATES) {
      await upsertFunction(country.id, tpl);
    }
    nationalCount += NATIONAL_TEMPLATES.length;
  }
  console.log(`  ${nationalCount} national functions seeded (${countries.length} countries × ${NATIONAL_TEMPLATES.length} functions)`);

  console.log(`  Total: ${CONTINENTAL_FUNCTIONS.length + regionalCount + nationalCount} functions`);

  // ── 4. Assign functions to existing users ──
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  // Super Admin → Super Administrator (continental, AU-IBAR)
  await upsertUserFunction(EXISTING_USER_IDS.SUPER_ADMIN, FN.SUPER_ADMIN, true);

  // Kenya Admin → NAT_CVO (find the Kenya-specific function)
  const kenyaCvo = await findFunction(TENANT_IDS.KENYA, 'NAT_CVO', 'national');
  if (kenyaCvo) await upsertUserFunction(EXISTING_USER_IDS.KE_ADMIN, kenyaCvo.id, true);

  // Nigeria Admin → NAT_CVO
  const nigeriaCvo = await findFunction(TENANT_IDS.NIGERIA, 'NAT_CVO', 'national');
  if (nigeriaCvo) await upsertUserFunction(EXISTING_USER_IDS.NG_ADMIN, nigeriaCvo.id, true);

  console.log('  Assigned functions to existing users');

  // ── 5. Create new test users ──

  // ECOWAS Regional Coordinator
  await prisma.user.upsert({
    where: { id: NEW_USER_IDS.ECOWAS_COORD },
    update: {},
    create: {
      id: NEW_USER_IDS.ECOWAS_COORD,
      tenantId: TENANT_IDS.ECOWAS,
      email: 'coordinator@ecowas.au-aris.org',
      passwordHash,
      firstName: 'Amina',
      lastName: 'Diallo',
      role: UserRole.REC_ADMIN,
      isActive: true,
    },
  });
  const ecowasCoord = await findFunction(TENANT_IDS.ECOWAS, 'REG_COORD', 'regional');
  if (ecowasCoord) await upsertUserFunction(NEW_USER_IDS.ECOWAS_COORD, ecowasCoord.id, true);

  // EAC Regional Coordinator
  await prisma.user.upsert({
    where: { id: NEW_USER_IDS.EAC_COORD },
    update: {},
    create: {
      id: NEW_USER_IDS.EAC_COORD,
      tenantId: TENANT_IDS.EAC,
      email: 'coordinator@eac.au-aris.org',
      passwordHash,
      firstName: 'Joseph',
      lastName: 'Mwangi',
      role: UserRole.REC_ADMIN,
      isActive: true,
    },
  });
  const eacCoord = await findFunction(TENANT_IDS.EAC, 'REG_COORD', 'regional');
  if (eacCoord) await upsertUserFunction(NEW_USER_IDS.EAC_COORD, eacCoord.id, true);

  // Kenya Field Veterinarian
  await prisma.user.upsert({
    where: { id: NEW_USER_IDS.KE_VET },
    update: {},
    create: {
      id: NEW_USER_IDS.KE_VET,
      tenantId: TENANT_IDS.KENYA,
      email: 'vet@ke.au-aris.org',
      passwordHash,
      firstName: 'Grace',
      lastName: 'Ochieng',
      role: UserRole.FIELD_AGENT,
      isActive: true,
    },
  });
  const keVet = await findFunction(TENANT_IDS.KENYA, 'FIELD_VET', 'national');
  if (keVet) await upsertUserFunction(NEW_USER_IDS.KE_VET, keVet.id, true);

  // Kenya Data Entry Officer
  await prisma.user.upsert({
    where: { id: NEW_USER_IDS.KE_DATA },
    update: {},
    create: {
      id: NEW_USER_IDS.KE_DATA,
      tenantId: TENANT_IDS.KENYA,
      email: 'data@ke.au-aris.org',
      passwordHash,
      firstName: 'Samuel',
      lastName: 'Kipchoge',
      role: UserRole.ANALYST,
      isActive: true,
    },
  });
  const keData = await findFunction(TENANT_IDS.KENYA, 'DATA_ENTRY', 'national');
  if (keData) await upsertUserFunction(NEW_USER_IDS.KE_DATA, keData.id, true);

  console.log('  Created new test users with function assignments');
  console.log(`  Default password: ${DEFAULT_PASSWORD}`);
}

async function findFunction(tenantId: string, code: string, level: string): Promise<{ id: string } | null> {
  return (prisma as any).function.findFirst({
    where: { tenantId, code, level },
    select: { id: true },
  });
}

async function upsertUserFunction(userId: string, functionId: string, isPrimary: boolean): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO governance.user_functions (id, user_id, function_id, is_primary, start_date, created_at, updated_at)
    VALUES (gen_random_uuid(), ${userId}::uuid, ${functionId}::uuid, ${isPrimary}, NOW(), NOW(), NOW())
    ON CONFLICT (user_id, function_id) DO UPDATE SET is_primary = ${isPrimary}, updated_at = NOW()
  `;
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
