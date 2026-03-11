import { PrismaClient } from '@prisma/client';
import { REC_SEEDS, COUNTRY_SEEDS, ADMIN1_SEEDS } from './geo-seed-data';
import { ADMIN1_EXTENDED_SEEDS } from './geo-admin1-seed-data';
import { ADMIN1_MZ_SEEDS } from './geo-admin1-mz-seed-data';
import { ADMIN2_SEEDS } from './geo-admin2-seed-data';
import { SPECIES_SEEDS } from './species-seed-data';
import { DISEASE_SEEDS } from './disease-seed-data';
import { UNIT_SEEDS } from './unit-seed-data';
import { DENOMINATOR_SEEDS } from './denominator-seed-data';
import { IDENTIFIER_SEEDS } from './identifier-seed-data';
import { INFRASTRUCTURE_SEEDS } from './infrastructure-seed-data';

const prisma = new PrismaClient();

async function seedGeoEntity(entity: {
  code: string;
  name: string;
  nameEn: string;
  nameFr: string;
  level: string;
  parentCode?: string;
  countryCode: string;
  centroidLat?: number;
  centroidLng?: number;
}, resolveParent: boolean): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const level = entity.level as any;
  let parentId: string | null = null;
  if (resolveParent && entity.parentCode) {
    const parent = await prisma.geoEntity.findUnique({
      where: { code: entity.parentCode },
    });
    parentId = parent?.id ?? null;
  }

  await prisma.geoEntity.upsert({
    where: { code: entity.code },
    update: {},
    create: {
      code: entity.code,
      name: entity.name,
      nameEn: entity.nameEn,
      nameFr: entity.nameFr,
      level,
      parentId,
      countryCode: entity.countryCode,
      centroidLat: entity.centroidLat ?? null,
      centroidLng: entity.centroidLng ?? null,
    },
  });
}

async function main(): Promise<void> {
  console.log('🌱 Seeding master data...\n');

  // ── 1. Geographic Entities ──
  console.log('📍 Seeding geographic entities...');

  // RECs (stored as SPECIAL_ZONE)
  for (const rec of REC_SEEDS) {
    await seedGeoEntity({ ...rec, level: 'SPECIAL_ZONE' as string }, false);
  }
  console.log(`  ✓ ${REC_SEEDS.length} RECs`);

  // Countries
  for (const country of COUNTRY_SEEDS) {
    await seedGeoEntity(country, false);
  }
  console.log(`  ✓ ${COUNTRY_SEEDS.length} AU Member States`);

  // Admin Level 1 — pilot countries (from geo-seed-data.ts)
  for (const admin1 of ADMIN1_SEEDS) {
    await seedGeoEntity(admin1, true);
  }
  console.log(`  ✓ ${ADMIN1_SEEDS.length} Admin-1 (5 pilot countries)`);

  // Admin Level 1 — countries A-L (remaining)
  for (const admin1 of ADMIN1_EXTENDED_SEEDS) {
    await seedGeoEntity(admin1, true);
  }
  console.log(`  ✓ ${ADMIN1_EXTENDED_SEEDS.length} Admin-1 (countries A-L)`);

  // Admin Level 1 — countries M-Z (remaining)
  for (const admin1 of ADMIN1_MZ_SEEDS) {
    await seedGeoEntity(admin1, true);
  }
  console.log(`  ✓ ${ADMIN1_MZ_SEEDS.length} Admin-1 (countries M-Z)`);

  // Admin Level 2 — 5 pilot countries
  for (const admin2 of ADMIN2_SEEDS) {
    await seedGeoEntity(admin2, true);
  }
  console.log(`  ✓ ${ADMIN2_SEEDS.length} Admin-2 (5 pilot countries)`);

  const totalGeo = REC_SEEDS.length + COUNTRY_SEEDS.length +
    ADMIN1_SEEDS.length + ADMIN1_EXTENDED_SEEDS.length + ADMIN1_MZ_SEEDS.length +
    ADMIN2_SEEDS.length;
  console.log(`  Total geo entities: ${totalGeo}`);

  // ── 2. Species ──
  console.log('\n🐄 Seeding species...');
  for (const species of SPECIES_SEEDS) {
    await prisma.species.upsert({
      where: { code: species.code },
      update: {},
      create: {
        code: species.code,
        scientificName: species.scientificName,
        commonNameEn: species.commonNameEn,
        commonNameFr: species.commonNameFr,
        category: species.category,
        productionCategories: species.productionCategories,
        isWoahListed: species.isWoahListed,
      },
    });
  }
  console.log(`  ✓ ${SPECIES_SEEDS.length} species`);

  // ── 3. Diseases ──
  console.log('\n🦠 Seeding diseases...');
  for (const disease of DISEASE_SEEDS) {
    await prisma.disease.upsert({
      where: { code: disease.code },
      update: {},
      create: {
        code: disease.code,
        nameEn: disease.nameEn,
        nameFr: disease.nameFr,
        isWoahListed: disease.isWoahListed,
        affectedSpecies: disease.affectedSpecies,
        isNotifiable: disease.isNotifiable,
        wahisCategory: disease.wahisCategory,
      },
    });
  }
  console.log(`  ✓ ${DISEASE_SEEDS.length} diseases`);

  // ── 4. Units ──
  console.log('\n📏 Seeding units...');
  for (const unit of UNIT_SEEDS) {
    await prisma.unit.upsert({
      where: { code: unit.code },
      update: {},
      create: {
        code: unit.code,
        nameEn: unit.nameEn,
        nameFr: unit.nameFr,
        symbol: unit.symbol,
        category: unit.category,
        siConversion: unit.siConversion,
      },
    });
  }
  console.log(`  ✓ ${UNIT_SEEDS.length} units`);

  // ── 5. Denominators ──
  console.log('\n📊 Seeding FAOSTAT denominators...');
  let denomCount = 0;
  for (const denom of DENOMINATOR_SEEDS) {
    const species = await prisma.species.findUnique({
      where: { code: denom.speciesCode },
    });
    if (!species) {
      console.warn(`  ⚠ Species ${denom.speciesCode} not found, skipping denominator`);
      continue;
    }

    const geoEntity = await prisma.geoEntity.findUnique({
      where: { code: denom.countryCode },
    });

    const existing = await prisma.denominator.findFirst({
      where: {
        countryCode: denom.countryCode,
        speciesId: species.id,
        year: denom.year,
        source: denom.source,
      },
    });

    if (!existing) {
      await prisma.denominator.create({
        data: {
          countryCode: denom.countryCode,
          geoEntityId: geoEntity?.id ?? null,
          speciesId: species.id,
          year: denom.year,
          source: denom.source,
          population: BigInt(denom.population),
          assumptions: denom.assumptions,
        },
      });
      denomCount++;
    }
  }
  console.log(`  ✓ ${denomCount} denominators`);

  // ── 6. Identifiers ──
  console.log('\n🏷️  Seeding identifiers (labs, markets, borders, etc.)...');
  let idCount = 0;
  for (const ident of IDENTIFIER_SEEDS) {
    // Resolve geo entity if provided
    let geoEntityId: string | null = null;
    if (ident.geoEntityCode) {
      const geo = await prisma.geoEntity.findUnique({
        where: { code: ident.geoEntityCode },
      });
      geoEntityId = geo?.id ?? null;
    }

    await prisma.identifier.upsert({
      where: { code: ident.code },
      update: {},
      create: {
        code: ident.code,
        nameEn: ident.nameEn,
        nameFr: ident.nameFr,
        type: ident.type,
        geoEntityId,
        latitude: ident.latitude ?? null,
        longitude: ident.longitude ?? null,
        address: ident.address ?? null,
      },
    });
    idCount++;
  }
  console.log(`  ✓ ${idCount} identifiers`);

  // ── 7. Infrastructure Types ──
  console.log('\n🏗️  Seeding infrastructure types...');
  let infraCount = 0;
  for (const infra of INFRASTRUCTURE_SEEDS) {
    const existing = await (prisma as any).refInfrastructure.findFirst({
      where: { code: infra.code },
    });
    if (!existing) {
      await (prisma as any).refInfrastructure.create({
        data: {
          code: infra.code,
          name: { en: infra.nameEn, fr: infra.nameFr },
          category: infra.category,
          subType: infra.subType,
          status: 'operational',
          scope: 'continental',
          ownerType: 'continental',
          isActive: true,
          isDefault: false,
          sortOrder: infra.sortOrder,
        },
      });
      infraCount++;
    }
  }
  console.log(`  ✓ ${infraCount} infrastructure types`);

  // ── Summary ──
  const counts = await Promise.all([
    prisma.geoEntity.count(),
    prisma.species.count(),
    prisma.disease.count(),
    prisma.unit.count(),
    prisma.denominator.count(),
    prisma.identifier.count(),
    (prisma as any).refInfrastructure.count(),
  ]);

  console.log('\n═══════════════════════════════════════');
  console.log('  Master Data Seed Summary');
  console.log('═══════════════════════════════════════');
  console.log(`  Geo Entities:      ${counts[0]}`);
  console.log(`  Species:           ${counts[1]}`);
  console.log(`  Diseases:          ${counts[2]}`);
  console.log(`  Units:             ${counts[3]}`);
  console.log(`  Denominators:      ${counts[4]}`);
  console.log(`  Identifiers:       ${counts[5]}`);
  console.log(`  Infrastructures:   ${counts[6]}`);
  console.log('═══════════════════════════════════════');
  console.log('\n✅ Seed completed successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
