import { PrismaClient } from '@prisma/client';
import { REC_SEEDS, COUNTRY_SEEDS, ADMIN1_SEEDS } from './geo-seed-data';
import { SPECIES_SEEDS } from './species-seed-data';
import { DISEASE_SEEDS } from './disease-seed-data';
import { UNIT_SEEDS } from './unit-seed-data';
import { DENOMINATOR_SEEDS } from './denominator-seed-data';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding master data...\n');

  // ── 1. Geographic Entities ──
  console.log('📍 Seeding geographic entities...');

  // RECs (stored as SPECIAL_ZONE)
  for (const rec of REC_SEEDS) {
    await prisma.geoEntity.upsert({
      where: { code: rec.code },
      update: {},
      create: {
        code: rec.code,
        name: rec.name,
        nameEn: rec.nameEn,
        nameFr: rec.nameFr,
        level: 'SPECIAL_ZONE',
        countryCode: rec.countryCode,
        centroidLat: rec.centroidLat ?? null,
        centroidLng: rec.centroidLng ?? null,
      },
    });
  }
  console.log(`  ✓ ${REC_SEEDS.length} RECs`);

  // Countries
  for (const country of COUNTRY_SEEDS) {
    await prisma.geoEntity.upsert({
      where: { code: country.code },
      update: {},
      create: {
        code: country.code,
        name: country.name,
        nameEn: country.nameEn,
        nameFr: country.nameFr,
        level: 'COUNTRY',
        countryCode: country.countryCode,
        centroidLat: country.centroidLat ?? null,
        centroidLng: country.centroidLng ?? null,
      },
    });
  }
  console.log(`  ✓ ${COUNTRY_SEEDS.length} AU Member States`);

  // Admin Level 1 (need to resolve parent IDs)
  let admin1Count = 0;
  for (const admin1 of ADMIN1_SEEDS) {
    const parent = await prisma.geoEntity.findUnique({
      where: { code: admin1.parentCode! },
    });

    await prisma.geoEntity.upsert({
      where: { code: admin1.code },
      update: {},
      create: {
        code: admin1.code,
        name: admin1.name,
        nameEn: admin1.nameEn,
        nameFr: admin1.nameFr,
        level: 'ADMIN1',
        parentId: parent?.id ?? null,
        countryCode: admin1.countryCode,
        centroidLat: admin1.centroidLat ?? null,
        centroidLng: admin1.centroidLng ?? null,
      },
    });
    admin1Count++;
  }
  console.log(`  ✓ ${admin1Count} Admin-1 entities (5 pilot countries)`);

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
    // Resolve species ID from code
    const species = await prisma.species.findUnique({
      where: { code: denom.speciesCode },
    });
    if (!species) {
      console.warn(`  ⚠ Species ${denom.speciesCode} not found, skipping denominator`);
      continue;
    }

    // Resolve geoEntity from country code
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

  // ── Summary ──
  const counts = await Promise.all([
    prisma.geoEntity.count(),
    prisma.species.count(),
    prisma.disease.count(),
    prisma.unit.count(),
    prisma.denominator.count(),
  ]);

  console.log('\n═══════════════════════════════════════');
  console.log('  Master Data Seed Summary');
  console.log('═══════════════════════════════════════');
  console.log(`  Geo Entities:   ${counts[0]}`);
  console.log(`  Species:        ${counts[1]}`);
  console.log(`  Diseases:       ${counts[2]}`);
  console.log(`  Units:          ${counts[3]}`);
  console.log(`  Denominators:   ${counts[4]}`);
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
