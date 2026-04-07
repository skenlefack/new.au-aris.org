// ARIS 4.0 — Knowledge Hub default categories seed
//
// Creates the hierarchical taxonomy used by the Knowledge Management System:
//   • 1 CONTINENTAL root + 6 default subcategories
//   • 8 REC roots (one per Regional Economic Community) + 6 subcategories each
//   • 55 COUNTRY roots (one per AU member state) + 6 subcategories each
//
// Default subcategories (per product owner):
//   - actualites          → Actualités / News
//   - rapports-officiels  → Rapports officiels / Official Reports
//   - legislation         → Législation / Legislation
//   - evenements          → Événements / Events
//   - ressources-techniques → Ressources techniques / Technical Resources
//   - communiques         → Communiqués / Press Releases
//
// All seeded categories are marked isSystem=true and cannot be deleted from the
// admin UI. Re-running this script is idempotent (uses upsert by deterministic
// UUIDs derived from tenant id + slug).

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

interface CategoryDef {
  slug: string;
  nameEn: string;
  nameFr: string;
  namePt: string;
  nameAr: string;
  icon: string;
  color: string;
  sortOrder: number;
}

const DEFAULT_SUBCATEGORIES: CategoryDef[] = [
  { slug: 'actualites',           nameEn: 'News',                 nameFr: 'Actualités',            namePt: 'Notícias',                nameAr: 'الأخبار',         icon: 'Newspaper',     color: '#0ea5e9', sortOrder: 1 },
  { slug: 'rapports-officiels',   nameEn: 'Official Reports',     nameFr: 'Rapports officiels',    namePt: 'Relatórios oficiais',     nameAr: 'التقارير الرسمية', icon: 'FileText',      color: '#7c3aed', sortOrder: 2 },
  { slug: 'legislation',          nameEn: 'Legislation',          nameFr: 'Législation',           namePt: 'Legislação',              nameAr: 'التشريعات',       icon: 'Scale',         color: '#0891b2', sortOrder: 3 },
  { slug: 'evenements',           nameEn: 'Events',               nameFr: 'Événements',            namePt: 'Eventos',                 nameAr: 'الفعاليات',       icon: 'Calendar',      color: '#16a34a', sortOrder: 4 },
  { slug: 'ressources-techniques', nameEn: 'Technical Resources', nameFr: 'Ressources techniques', namePt: 'Recursos técnicos',       nameAr: 'الموارد التقنية',  icon: 'BookOpen',      color: '#d97706', sortOrder: 5 },
  { slug: 'communiques',          nameEn: 'Press Releases',       nameFr: 'Communiqués',           namePt: 'Comunicados de imprensa', nameAr: 'البيانات الصحفية',  icon: 'Megaphone',     color: '#dc2626', sortOrder: 6 },
];

/**
 * Deterministic UUID for a category — derived from (tenantId, slug) so the
 * seed remains idempotent across runs and environments.
 *
 * Format: xxxxxxxx-xxxx-4xxx-axxx-xxxxxxxxxxxx (UUID v4-shaped, namespace md5)
 */
function deterministicUuid(namespace: string): string {
  const hash = createHash('md5').update(namespace).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    'a' + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

async function upsertCategory(args: {
  id: string;
  parentId: string | null;
  slug: string;
  nameEn: string;
  nameFr: string | null;
  namePt: string | null;
  nameAr: string | null;
  scope: 'CONTINENTAL' | 'REC' | 'COUNTRY';
  scopeTenantId: string | null;
  recParentTenantId: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
}): Promise<void> {
  await (prisma as any).knowledgeCategory.upsert({
    where: { id: args.id },
    create: {
      id: args.id,
      parentId: args.parentId,
      slug: args.slug,
      nameEn: args.nameEn,
      nameFr: args.nameFr,
      namePt: args.namePt,
      nameAr: args.nameAr,
      scope: args.scope,
      scopeTenantId: args.scopeTenantId,
      recParentTenantId: args.recParentTenantId,
      icon: args.icon,
      color: args.color,
      sortOrder: args.sortOrder,
      isSystem: true,
      isActive: true,
    },
    update: {
      // Keep slug, scope, scopeTenantId stable. Refresh display fields only.
      nameEn: args.nameEn,
      nameFr: args.nameFr,
      namePt: args.namePt,
      nameAr: args.nameAr,
      icon: args.icon,
      color: args.color,
      sortOrder: args.sortOrder,
      parentId: args.parentId,
    },
  });
}

async function seedRoot(
  rootId: string,
  rootSlug: string,
  rootName: { en: string; fr: string; pt: string; ar: string },
  scope: 'CONTINENTAL' | 'REC' | 'COUNTRY',
  scopeTenantId: string | null,
  recParentTenantId: string | null,
  icon: string,
  color: string,
): Promise<void> {
  await upsertCategory({
    id: rootId,
    parentId: null,
    slug: rootSlug,
    nameEn: rootName.en,
    nameFr: rootName.fr,
    namePt: rootName.pt,
    nameAr: rootName.ar,
    scope,
    scopeTenantId,
    recParentTenantId,
    icon,
    color,
    sortOrder: 0,
  });

  for (const sub of DEFAULT_SUBCATEGORIES) {
    const subSlug = `${rootSlug}--${sub.slug}`;
    await upsertCategory({
      id: deterministicUuid(`khub:${rootId}:${sub.slug}`),
      parentId: rootId,
      slug: subSlug,
      nameEn: sub.nameEn,
      nameFr: sub.nameFr,
      namePt: sub.namePt,
      nameAr: sub.nameAr,
      scope,
      scopeTenantId,
      recParentTenantId,
      icon: sub.icon,
      color: sub.color,
      sortOrder: sub.sortOrder,
    });
  }
}

async function main(): Promise<void> {
  console.log('🌱 Seeding Knowledge Hub default categories...');

  // 1. Pull tenants from DB (continental + REC + country)
  const tenants = await (prisma as any).tenant.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, level: true, parentId: true, countryCode: true },
    orderBy: [{ level: 'asc' }, { code: 'asc' }],
  });

  if (tenants.length === 0) {
    console.error('❌ No tenants found. Run seed-tenant.ts first.');
    process.exit(1);
  }

  const continentalTenants = tenants.filter((t: any) => t.level === 'CONTINENTAL');
  const recTenants = tenants.filter((t: any) => t.level === 'REC');
  const countryTenants = tenants.filter((t: any) => t.level === 'MEMBER_STATE');

  console.log(`  → ${continentalTenants.length} continental, ${recTenants.length} REC, ${countryTenants.length} country tenants`);

  // 2. Continental root
  for (const t of continentalTenants) {
    const rootId = deterministicUuid(`khub:root:continental:${t.id}`);
    await seedRoot(
      rootId,
      'continental',
      { en: 'Continental', fr: 'Continental', pt: 'Continental', ar: 'قاري' },
      'CONTINENTAL',
      null,
      null,
      'Globe2',
      '#7c3aed',
    );
  }

  // 3. REC roots
  for (const rec of recTenants) {
    const rootId = deterministicUuid(`khub:root:rec:${rec.id}`);
    const slug = `rec-${(rec.code as string).toLowerCase().replace(/_/g, '-')}`;
    await seedRoot(
      rootId,
      slug,
      { en: rec.name, fr: rec.name, pt: rec.name, ar: rec.name },
      'REC',
      rec.id,
      null,
      'Building2',
      '#2563eb',
    );
  }

  // 4. Country roots — recParentTenantId points to the country's REC parent
  for (const country of countryTenants) {
    const rootId = deterministicUuid(`khub:root:country:${country.id}`);
    const slug = `country-${(country.countryCode as string).toLowerCase()}`;
    await seedRoot(
      rootId,
      slug,
      { en: country.name, fr: country.name, pt: country.name, ar: country.name },
      'COUNTRY',
      country.id,
      country.parentId, // the REC tenant id
      'Flag',
      '#16a34a',
    );
  }

  const total = await (prisma as any).knowledgeCategory.count();
  console.log(`✅ Knowledge Hub seed complete — ${total} categories in database`);
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
