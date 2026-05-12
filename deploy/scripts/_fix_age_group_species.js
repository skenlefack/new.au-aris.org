/**
 * Fix age-group speciesId references after reseed.
 * Also check and fix breeds speciesId.
 * Run inside aris-master-data container.
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Get current species (new IDs after reseed)
  const species = await p.$queryRawUnsafe(
    "SELECT id, code FROM animal_health.ref_species WHERE is_active = true"
  );
  const speciesByCode = {};
  for (const s of species) speciesByCode[s.code] = s.id;
  console.log(`Species in DB: ${species.length}`);

  // Check age-groups with broken speciesId
  const ageGroups = await p.$queryRawUnsafe(
    `SELECT ag.id, ag.code, ag.species_id, s.code as species_code
     FROM animal_health.ref_age_groups ag
     LEFT JOIN animal_health.ref_species s ON s.id = ag.species_id`
  );

  let fixedAg = 0;
  let brokenAg = 0;
  for (const ag of ageGroups) {
    if (ag.species_code) continue; // Already valid
    if (!ag.species_id) continue; // No species assigned

    brokenAg++;
    // Try to find the correct species by matching common patterns
    const code = ag.code.toUpperCase();
    let newSpeciesCode = null;

    if (code.includes('CALF') && !code.includes('BUFFALO') && !code.includes('CAMEL')) newSpeciesCode = 'CATTLE';
    else if (code.includes('BUFFALO')) newSpeciesCode = 'BUFFALO';
    else if (code.includes('CAMEL')) newSpeciesCode = 'DROMEDARY';
    else if (code.includes('LAMB') || code.includes('EWE') || code.includes('RAM')) newSpeciesCode = 'SHEEP';
    else if (code.includes('KID') || code.includes('GOAT') || code.includes('DOE') || code.includes('BUCK')) newSpeciesCode = 'GOAT';
    else if (code.includes('PIGLET') || code.includes('SOW') || code.includes('BOAR') || code.includes('GILT') || code.includes('PIG')) newSpeciesCode = 'PIG';
    else if (code.includes('FOAL') || code.includes('MARE') || code.includes('STALLION') || code.includes('HORSE')) newSpeciesCode = 'HORSE';
    else if (code.includes('CHICK') || code.includes('PULLET') || code.includes('LAYER') || code.includes('BROILER') || code.includes('COCKEREL')) newSpeciesCode = 'CHICKEN';
    else if (code.includes('DUCKLING') || code.includes('DUCK')) newSpeciesCode = 'DUCK';
    else if (code.includes('POULT') || code.includes('TURKEY')) newSpeciesCode = 'TURKEY';
    else if (code.includes('KITTEN') && code.includes('RABBIT')) newSpeciesCode = 'RABBIT';
    else if (code.includes('DOG') || code.includes('PUPPY')) newSpeciesCode = 'DOG';
    else if (code.includes('CAT') || code.includes('KITTEN')) newSpeciesCode = 'CAT';
    else if (code.includes('DONKEY')) newSpeciesCode = 'DONKEY';

    if (newSpeciesCode && speciesByCode[newSpeciesCode]) {
      await p.$executeRawUnsafe(
        "UPDATE animal_health.ref_age_groups SET species_id = $1::uuid WHERE id = $2::uuid",
        speciesByCode[newSpeciesCode], ag.id
      );
      console.log(`  Fixed age-group ${ag.code} -> ${newSpeciesCode}`);
      fixedAg++;
    } else {
      console.log(`  WARN: Cannot resolve species for age-group ${ag.code} (old speciesId: ${ag.species_id})`);
    }
  }
  console.log(`Age-groups: ${brokenAg} broken, ${fixedAg} fixed`);

  // Fix breeds too
  const breeds = await p.$queryRawUnsafe(
    `SELECT b.id, b.code, b.species_id, s.code as species_code
     FROM animal_health.ref_breeds b
     LEFT JOIN animal_health.ref_species s ON s.id = b.species_id`
  );

  let fixedBreed = 0;
  let brokenBreed = 0;
  for (const b of breeds) {
    if (b.species_code) continue;
    if (!b.species_id) continue;
    brokenBreed++;
    // Breeds need manual mapping - just log for now
    console.log(`  WARN: Breed ${b.code} has broken speciesId: ${b.species_id}`);
  }
  console.log(`Breeds: ${brokenBreed} broken, ${fixedBreed} fixed`);

  // Verify
  const verifyAg = await p.$queryRawUnsafe(
    `SELECT ag.code, s.code as species
     FROM animal_health.ref_age_groups ag
     JOIN animal_health.ref_species s ON s.id = ag.species_id
     ORDER BY s.code, ag.code`
  );
  console.log(`\nVerified age-group links: ${verifyAg.length}`);
  for (const v of verifyAg) console.log(`  ${v.species} -> ${v.code}`);
}

main().catch(console.error).finally(() => p.$disconnect());
