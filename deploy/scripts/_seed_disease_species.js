/**
 * Seed disease-species associations based on WOAH/OMSA referential.
 * Run inside aris-master-data container: node seed_disease_species.js
 *
 * Maps major WOAH-listed diseases to their susceptible species using OIE codes.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// WOAH disease-species mapping: disease code → species codes that can contract it
// Source: WOAH Terrestrial/Aquatic Animal Health Code + OIE Listed Diseases 2024
const DISEASE_SPECIES_MAP = {
  // ── Multi-species diseases ──
  'FMD':       ['BOV', 'OVI', 'CAP', 'SUI', 'BUF', 'CAM'],    // Foot and mouth disease
  'RVF':       ['BOV', 'OVI', 'CAP', 'BUF', 'CAM'],             // Rift Valley fever
  'ANTHRAX':   ['BOV', 'OVI', 'CAP', 'EQU', 'SUI', 'BUF', 'CAM', 'CER'], // Anthrax
  'RABIES':    ['BOV', 'OVI', 'CAP', 'EQU', 'SUI', 'CAN', 'FEL', 'BUF', 'CAM', 'CER'], // Rabies
  'BRUCELL':   ['BOV', 'OVI', 'CAP', 'SUI', 'BUF', 'CAM'],     // Brucellosis
  'TB':        ['BOV', 'BUF', 'CAP', 'CER'],                     // Bovine tuberculosis
  'LUMP':      ['BOV', 'BUF'],                                     // Lumpy skin disease
  'BTV':       ['BOV', 'OVI', 'CAP', 'BUF', 'CER'],             // Bluetongue

  // ── Cattle diseases ──
  'CBPP':      ['BOV', 'BUF'],                                     // Contagious bovine pleuropneumonia
  'BSE':       ['BOV'],                                             // Bovine spongiform encephalopathy
  'THEIL':     ['BOV', 'BUF'],                                     // Theileriosis (East Coast fever)
  'ANAP':      ['BOV', 'BUF'],                                     // Anaplasmosis
  'BABESIOSIS':['BOV', 'BUF'],                                     // Babesiosis
  'BVD':       ['BOV'],                                             // Bovine viral diarrhoea
  'IBR':       ['BOV'],                                             // Infectious bovine rhinotracheitis

  // ── Small ruminant diseases ──
  'PPR':       ['OVI', 'CAP', 'CER'],                             // Peste des petits ruminants
  'CCPP':      ['CAP'],                                             // Contagious caprine pleuropneumonia
  'SGP':       ['OVI', 'CAP'],                                     // Sheep and goat pox
  'SCRAPIE':   ['OVI', 'CAP'],                                     // Scrapie
  'COENUR':    ['OVI', 'CAP'],                                     // Coenurosis

  // ── Pig diseases ──
  'ASF':       ['SUI'],                                             // African swine fever
  'CSF':       ['SUI'],                                             // Classical swine fever
  'PRRS':      ['SUI'],                                             // Porcine reproductive and respiratory syndrome
  'TGE':       ['SUI'],                                             // Transmissible gastroenteritis

  // ── Equine diseases ──
  'AHS':       ['EQU'],                                             // African horse sickness
  'GLANDERS':  ['EQU'],                                             // Glanders
  'EIA':       ['EQU'],                                             // Equine infectious anaemia
  'EVA':       ['EQU'],                                             // Equine viral arteritis
  'DOURINE':   ['EQU'],                                             // Dourine
  'SURRA':     ['EQU', 'BOV', 'CAM', 'BUF'],                     // Surra (Trypanosomiasis)

  // ── Poultry diseases ──
  'HPAI':      ['CKN', 'DUC', 'TUR', 'GUI', 'GEE', 'QUA', 'PIG', 'OST'], // Highly pathogenic avian influenza
  'LPAI':      ['CKN', 'DUC', 'TUR', 'QUA'],                     // Low pathogenic avian influenza
  'ND':        ['CKN', 'DUC', 'TUR', 'GUI', 'GEE', 'QUA', 'PIG', 'OST'], // Newcastle disease
  'IB':        ['CKN'],                                             // Infectious bronchitis
  'IBD':       ['CKN'],                                             // Infectious bursal disease (Gumboro)
  'MG':        ['CKN', 'TUR'],                                     // Mycoplasma gallisepticum
  'FOWLPOX':   ['CKN', 'TUR', 'DUC'],                             // Fowl pox
  'PULLORUM':  ['CKN', 'TUR'],                                     // Pullorum disease
  'FOWLTYPH':  ['CKN'],                                             // Fowl typhoid
  'MAREK':     ['CKN'],                                             // Marek's disease
  'DUCK_PLAGUE': ['DUC', 'GEE'],                                   // Duck viral enteritis

  // ── Camelid diseases ──
  'CAMEL_POX': ['CAM'],                                             // Camelpox
  'MERS':      ['CAM'],                                             // Middle East respiratory syndrome
  'TRYP_CAMEL':['CAM'],                                             // Trypanosomiasis (camel)

  // ── Bee diseases ──
  'AFB':       ['BEE'],                                             // American foulbrood
  'EFB':       ['BEE'],                                             // European foulbrood
  'VARROOSIS': ['BEE'],                                             // Varroosis
  'SHB':       ['BEE'],                                             // Small hive beetle

  // ── Dog/Cat diseases ──
  'CDV':       ['CAN'],                                             // Canine distemper
  'PARVO':     ['CAN'],                                             // Canine parvovirus
  'LEISH':     ['CAN'],                                             // Leishmaniosis
  'FPV':       ['FEL'],                                             // Feline panleukopenia

  // ── Aquatic diseases ──
  'EUS':       ['FISH'],                                            // Epizootic ulcerative syndrome
  'ISA':       ['FISH'],                                            // Infectious salmon anaemia
  'VHS':       ['FISH'],                                            // Viral haemorrhagic septicaemia
  'IHN':       ['FISH'],                                            // Infectious haematopoietic necrosis
  'WSSV':      ['SHRIMP'],                                          // White spot disease
  'YHV':       ['SHRIMP'],                                          // Yellowhead disease
};

async function main() {
  // Get all diseases
  const diseases = await prisma.$queryRawUnsafe(
    `SELECT id, code, name FROM animal_health.ref_diseases WHERE is_active = true`
  );
  console.log(`Diseases in DB: ${diseases.length}`);

  // Get all species
  const species = await prisma.$queryRawUnsafe(
    `SELECT id, code, name FROM animal_health.ref_species WHERE is_active = true`
  );
  console.log(`Species in DB: ${species.length}`);

  // Build lookup maps
  const diseaseByCode = {};
  for (const d of diseases) {
    diseaseByCode[d.code.toUpperCase()] = d;
    // Also try partial match
    const shortCode = d.code.replace(/_/g, '').toUpperCase();
    diseaseByCode[shortCode] = d;
  }

  const speciesByCode = {};
  for (const s of species) {
    speciesByCode[s.code.toUpperCase()] = s;
  }

  // Check existing associations
  const existing = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM animal_health.ref_disease_species`
  );
  console.log(`Existing disease-species links: ${existing[0].count}`);

  let created = 0;
  let skipped = 0;
  let missingDisease = new Set();
  let missingSpecies = new Set();

  for (const [diseaseCode, speciesCodes] of Object.entries(DISEASE_SPECIES_MAP)) {
    const disease = diseaseByCode[diseaseCode];
    if (!disease) {
      missingDisease.add(diseaseCode);
      continue;
    }

    for (const speciesCode of speciesCodes) {
      const sp = speciesByCode[speciesCode];
      if (!sp) {
        missingSpecies.add(speciesCode);
        continue;
      }

      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO animal_health.ref_disease_species (id, disease_id, species_id, susceptibility)
           VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'confirmed')
           ON CONFLICT (disease_id, species_id) DO NOTHING`,
          disease.id, sp.id
        );
        created++;
      } catch (e) {
        skipped++;
      }
    }
  }

  console.log(`\nResults:`);
  console.log(`  Created: ${created} disease-species links`);
  console.log(`  Skipped (duplicate): ${skipped}`);
  if (missingDisease.size > 0) console.log(`  Missing diseases: ${[...missingDisease].join(', ')}`);
  if (missingSpecies.size > 0) console.log(`  Missing species: ${[...missingSpecies].join(', ')}`);

  // Final count
  const finalCount = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM animal_health.ref_disease_species`
  );
  console.log(`  Total links in DB: ${finalCount[0].count}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
