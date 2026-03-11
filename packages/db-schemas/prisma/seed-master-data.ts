import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Tenant IDs from seed-tenant.ts
const TENANT_IDS = {
  AU_IBAR: '00000000-0000-4000-a000-000000000001',
  IGAD: '00000000-0000-4000-a000-000000000010',
  ECOWAS: '00000000-0000-4000-a000-000000000020',
  KENYA: '00000000-0000-4000-a000-000000000101',
  ETHIOPIA: '00000000-0000-4000-a000-000000000102',
  NIGERIA: '00000000-0000-4000-a000-000000000201',
  SENEGAL: '00000000-0000-4000-a000-000000000202',
} as const;

// Helper for multilingual names
function ml(en: string, fr: string, pt?: string, ar?: string) {
  return { en, fr, pt: pt ?? en, ar: ar ?? en };
}

// ══════════════════════════════════════════════════════════════
// Deterministic UUIDs for reference data
// ══════════════════════════════════════════════════════════════

const GROUP_IDS = {
  RUMINANTS: '10000000-0000-4000-b000-000000000001',
  MONOGASTRIC: '10000000-0000-4000-b000-000000000002',
  POULTRY: '10000000-0000-4000-b000-000000000003',
  EQUIDAE: '10000000-0000-4000-b000-000000000004',
  CAMELIDS: '10000000-0000-4000-b000-000000000005',
  SWINE: '10000000-0000-4000-b000-000000000006',
  AQUATIC: '10000000-0000-4000-b000-000000000007',
  WILDLIFE: '10000000-0000-4000-b000-000000000008',
  BEES: '10000000-0000-4000-b000-000000000009',
  PETS: '10000000-0000-4000-b000-000000000010',
} as const;

const SPECIES_IDS = {
  CATTLE: '20000000-0000-4000-b000-000000000001',
  SHEEP: '20000000-0000-4000-b000-000000000002',
  GOAT: '20000000-0000-4000-b000-000000000003',
  BUFFALO: '20000000-0000-4000-b000-000000000004',
  RABBIT: '20000000-0000-4000-b000-000000000005',
  CHICKEN: '20000000-0000-4000-b000-000000000006',
  DUCK: '20000000-0000-4000-b000-000000000007',
  TURKEY: '20000000-0000-4000-b000-000000000008',
  GUINEA_FOWL: '20000000-0000-4000-b000-000000000009',
  PIGEON: '20000000-0000-4000-b000-000000000010',
  HORSE: '20000000-0000-4000-b000-000000000011',
  DONKEY: '20000000-0000-4000-b000-000000000012',
  MULE: '20000000-0000-4000-b000-000000000013',
  DROMEDARY: '20000000-0000-4000-b000-000000000014',
  PIG: '20000000-0000-4000-b000-000000000015',
  TILAPIA: '20000000-0000-4000-b000-000000000016',
  CATFISH: '20000000-0000-4000-b000-000000000017',
  SHRIMP: '20000000-0000-4000-b000-000000000018',
  WILDEBEEST: '20000000-0000-4000-b000-000000000019',
  ELEPHANT: '20000000-0000-4000-b000-000000000020',
  LION: '20000000-0000-4000-b000-000000000021',
  HIPPO: '20000000-0000-4000-b000-000000000022',
  ANTELOPE: '20000000-0000-4000-b000-000000000023',
  HONEYBEE: '20000000-0000-4000-b000-000000000024',
  DOG: '20000000-0000-4000-b000-000000000025',
  CAT: '20000000-0000-4000-b000-000000000026',
  // Phase 4 — additional species from References-data.txt
  GOOSE: '20000000-0000-4000-b000-000000000027',
  QUAIL: '20000000-0000-4000-b000-000000000028',
  ZEBRA: '20000000-0000-4000-b000-000000000029',
  WARTHOG: '20000000-0000-4000-b000-000000000030',
  GRASS_CUTTER: '20000000-0000-4000-b000-000000000031',
  GUINEA_PIG: '20000000-0000-4000-b000-000000000032',
  DEER: '20000000-0000-4000-b000-000000000033',
  HARE: '20000000-0000-4000-b000-000000000034',
  WILD_PIG: '20000000-0000-4000-b000-000000000035',
  MOLLUSC: '20000000-0000-4000-b000-000000000036',
  CRUSTACEAN: '20000000-0000-4000-b000-000000000037',
  AFRICAN_BUFFALO: '20000000-0000-4000-b000-000000000038',
} as const;

const DISEASE_IDS = {
  FMD: '30000000-0000-4000-b000-000000000001',
  CBPP: '30000000-0000-4000-b000-000000000002',
  PPR: '30000000-0000-4000-b000-000000000003',
  ASF: '30000000-0000-4000-b000-000000000004',
  HPAI: '30000000-0000-4000-b000-000000000005',
  RVF: '30000000-0000-4000-b000-000000000006',
  LSD: '30000000-0000-4000-b000-000000000007',
  RABIES: '30000000-0000-4000-b000-000000000008',
  ANTHRAX: '30000000-0000-4000-b000-000000000009',
  BRUCELLA: '30000000-0000-4000-b000-000000000010',
  TB: '30000000-0000-4000-b000-000000000011',
  ND: '30000000-0000-4000-b000-000000000012',
  ECF: '30000000-0000-4000-b000-000000000013',
  TRYP: '30000000-0000-4000-b000-000000000014',
  BLACKLEG: '30000000-0000-4000-b000-000000000015',
  SHEEP_POX: '30000000-0000-4000-b000-000000000016',
  GOAT_POX: '30000000-0000-4000-b000-000000000017',
  AHS: '30000000-0000-4000-b000-000000000018',
  CCPP: '30000000-0000-4000-b000-000000000019',
  HEARTWATER: '30000000-0000-4000-b000-000000000020',
  ANAPLASMOSIS: '30000000-0000-4000-b000-000000000021',
  BABESIOSIS: '30000000-0000-4000-b000-000000000022',
  FASCIOLOSIS: '30000000-0000-4000-b000-000000000023',
  MANGE: '30000000-0000-4000-b000-000000000024',
  MASTITIS: '30000000-0000-4000-b000-000000000025',
  // Phase 4 — additional WOAH diseases from References-data.txt
  BLUETONGUE: '30000000-0000-4000-b000-000000000026',
  RINDERPEST: '30000000-0000-4000-b000-000000000027',
  CSF: '30000000-0000-4000-b000-000000000028',
  DOURINE: '30000000-0000-4000-b000-000000000029',
  GLANDERS: '30000000-0000-4000-b000-000000000030',
  EQUINE_INFLUENZA: '30000000-0000-4000-b000-000000000031',
  EQUINE_INFECTIOUS_ANAEMIA: '30000000-0000-4000-b000-000000000032',
  EQUINE_PIROPLASMOSIS: '30000000-0000-4000-b000-000000000033',
  EQUINE_RHINOPNEUMONITIS: '30000000-0000-4000-b000-000000000034',
  EQUINE_VIRAL_ARTERITIS: '30000000-0000-4000-b000-000000000035',
  EQUINE_ENCEPHALOMYELITIS: '30000000-0000-4000-b000-000000000036',
  VEE: '30000000-0000-4000-b000-000000000037',
  CAMELPOX: '30000000-0000-4000-b000-000000000038',
  BSE: '30000000-0000-4000-b000-000000000039',
  EBL: '30000000-0000-4000-b000-000000000040',
  IBR_IPV: '30000000-0000-4000-b000-000000000041',
  HAEMORRHAGIC_SEPTICAEMIA: '30000000-0000-4000-b000-000000000042',
  BOV_GENITAL_CAMP: '30000000-0000-4000-b000-000000000043',
  MAEDI_VISNA: '30000000-0000-4000-b000-000000000044',
  CONTAGIOUS_AGALACTIA: '30000000-0000-4000-b000-000000000045',
  NAIROBI_SHEEP: '30000000-0000-4000-b000-000000000046',
  SCRAPIE: '30000000-0000-4000-b000-000000000047',
  AUJESZKY: '30000000-0000-4000-b000-000000000048',
  PRRS: '30000000-0000-4000-b000-000000000049',
  CYSTICERCOSIS: '30000000-0000-4000-b000-000000000050',
  TRICHINELLOSIS: '30000000-0000-4000-b000-000000000051',
  AVIAN_SALMONELLOSIS: '30000000-0000-4000-b000-000000000052',
  FOWL_TYPHOID: '30000000-0000-4000-b000-000000000053',
  IBD: '30000000-0000-4000-b000-000000000054',
  MAREKS: '30000000-0000-4000-b000-000000000055',
  AVIAN_IB: '30000000-0000-4000-b000-000000000056',
  AVIAN_TB: '30000000-0000-4000-b000-000000000057',
  FOWL_POX: '30000000-0000-4000-b000-000000000058',
  ECHINOCOCCOSIS: '30000000-0000-4000-b000-000000000059',
  LEPTOSPIROSIS: '30000000-0000-4000-b000-000000000060',
  LISTERIOSIS: '30000000-0000-4000-b000-000000000061',
  BOTULISM: '30000000-0000-4000-b000-000000000062',
  LEISHMANIOSIS: '30000000-0000-4000-b000-000000000063',
  COCCIDIOSIS: '30000000-0000-4000-b000-000000000064',
  Q_FEVER: '30000000-0000-4000-b000-000000000065',
  THEILERIOSIS: '30000000-0000-4000-b000-000000000066',
  CRIMEAN_CONGO: '30000000-0000-4000-b000-000000000067',
  FILARIASIS: '30000000-0000-4000-b000-000000000068',
  MYXOMATOSIS: '30000000-0000-4000-b000-000000000069',
  RABBIT_HAEMORRHAGIC: '30000000-0000-4000-b000-000000000070',
  PARATUBERCULOSIS: '30000000-0000-4000-b000-000000000071',
  STRANGLES: '30000000-0000-4000-b000-000000000072',
  EHD: '30000000-0000-4000-b000-000000000073',
  INFECTIOUS_CORYZA: '30000000-0000-4000-b000-000000000074',
  VESICULAR_STOMATITIS: '30000000-0000-4000-b000-000000000075',
  SVD: '30000000-0000-4000-b000-000000000076',
  TULAREMIA: '30000000-0000-4000-b000-000000000077',
  // Bee diseases in RefDisease (shared)
  VARROA_DISEASE: '30000000-0000-4000-b000-000000000078',
  NOSEMA_DISEASE: '30000000-0000-4000-b000-000000000079',
  AFB_DISEASE: '30000000-0000-4000-b000-000000000080',
  SMALL_HIVE_BEETLE_DISEASE: '30000000-0000-4000-b000-000000000081',
  // Aquatic
  EUS: '30000000-0000-4000-b000-000000000082',
  ISA: '30000000-0000-4000-b000-000000000083',
  KHV: '30000000-0000-4000-b000-000000000084',
  VHS: '30000000-0000-4000-b000-000000000085',
  WHITE_SPOT: '30000000-0000-4000-b000-000000000086',
  TAURA: '30000000-0000-4000-b000-000000000087',
  YELLOWHEAD: '30000000-0000-4000-b000-000000000088',
} as const;

// ══════════════════════════════════════════════════════════════
// Seed functions
// ══════════════════════════════════════════════════════════════

async function seedSpeciesGroups() {
  console.log('  Seeding species groups...');
  const groups = [
    { id: GROUP_IDS.RUMINANTS, code: 'RUMINANTS', name: ml('Ruminants', 'Ruminants', 'Ruminantes', '\u0645\u062c\u062a\u0631\u0627\u062a'), icon: 'beef', sortOrder: 1 },
    { id: GROUP_IDS.MONOGASTRIC, code: 'MONOGASTRIC', name: ml('Monogastrics', 'Monogastriques', 'Monogastricos', '\u0623\u062d\u0627\u062f\u064a\u0629 \u0627\u0644\u0645\u0639\u062f\u0629'), icon: 'rabbit', sortOrder: 2 },
    { id: GROUP_IDS.POULTRY, code: 'POULTRY', name: ml('Poultry', 'Volailles', 'Aves', '\u062f\u0648\u0627\u062c\u0646'), icon: 'egg', sortOrder: 3 },
    { id: GROUP_IDS.EQUIDAE, code: 'EQUIDAE', name: ml('Equidae', '\u00c9quid\u00e9s', 'Equ\u00eddeos', '\u062e\u064a\u0644\u064a\u0627\u062a'), icon: 'horse', sortOrder: 4 },
    { id: GROUP_IDS.CAMELIDS, code: 'CAMELIDS', name: ml('Camelids', 'Cam\u00e9lid\u00e9s', 'Camel\u00eddeos', '\u0625\u0628\u0644\u064a\u0627\u062a'), icon: 'camel', sortOrder: 5 },
    { id: GROUP_IDS.SWINE, code: 'SWINE', name: ml('Swine', 'Porcins', 'Su\u00ednos', '\u062e\u0646\u0627\u0632\u064a\u0631'), icon: 'pig', sortOrder: 6 },
    { id: GROUP_IDS.AQUATIC, code: 'AQUATIC', name: ml('Aquatic Animals', 'Animaux Aquatiques', 'Animais Aqu\u00e1ticos', '\u062d\u064a\u0648\u0627\u0646\u0627\u062a \u0645\u0627\u0626\u064a\u0629'), icon: 'fish', sortOrder: 7 },
    { id: GROUP_IDS.WILDLIFE, code: 'WILDLIFE', name: ml('Wildlife', 'Faune Sauvage', 'Fauna Selvagem', '\u062d\u064a\u0627\u0629 \u0628\u0631\u064a\u0629'), icon: 'paw-print', sortOrder: 8 },
    { id: GROUP_IDS.BEES, code: 'BEES', name: ml('Bees', 'Abeilles', 'Abelhas', '\u0646\u062d\u0644'), icon: 'hexagon', sortOrder: 9 },
    { id: GROUP_IDS.PETS, code: 'PETS', name: ml('Companion Animals', 'Animaux de Compagnie', 'Animais de Companhia', '\u062d\u064a\u0648\u0627\u0646\u0627\u062a \u0623\u0644\u064a\u0641\u0629'), icon: 'heart', sortOrder: 10 },
  ];

  for (const g of groups) {
    await (prisma as any).refSpeciesGroup.create({
      data: { id: g.id, code: g.code, name: g.name, icon: g.icon, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: g.sortOrder },
    });
  }
  console.log(`    ${groups.length} species groups seeded`);
}

async function seedSpecies() {
  console.log('  Seeding species...');
  const species = [
    // Ruminants
    { id: SPECIES_IDS.CATTLE, code: 'CATTLE', name: ml('Cattle', 'Bovin', 'Bovino', '\u0623\u0628\u0642\u0627\u0631'), scientificName: 'Bos taurus', groupId: GROUP_IDS.RUMINANTS, sortOrder: 1 },
    { id: SPECIES_IDS.SHEEP, code: 'SHEEP', name: ml('Sheep', 'Ovin', 'Ovino', '\u0623\u063a\u0646\u0627\u0645'), scientificName: 'Ovis aries', groupId: GROUP_IDS.RUMINANTS, sortOrder: 2 },
    { id: SPECIES_IDS.GOAT, code: 'GOAT', name: ml('Goat', 'Caprin', 'Caprino', '\u0645\u0627\u0639\u0632'), scientificName: 'Capra aegagrus hircus', groupId: GROUP_IDS.RUMINANTS, sortOrder: 3 },
    { id: SPECIES_IDS.BUFFALO, code: 'BUFFALO', name: ml('Buffalo', 'Buffle', 'B\u00fafalo', '\u062c\u0627\u0645\u0648\u0633'), scientificName: 'Syncerus caffer', groupId: GROUP_IDS.RUMINANTS, sortOrder: 4 },
    // Monogastric
    { id: SPECIES_IDS.RABBIT, code: 'RABBIT', name: ml('Rabbit', 'Lapin', 'Coelho', '\u0623\u0631\u0646\u0628'), scientificName: 'Oryctolagus cuniculus', groupId: GROUP_IDS.MONOGASTRIC, sortOrder: 1 },
    // Poultry
    { id: SPECIES_IDS.CHICKEN, code: 'CHICKEN', name: ml('Chicken', 'Poulet', 'Frango', '\u062f\u062c\u0627\u062c'), scientificName: 'Gallus gallus domesticus', groupId: GROUP_IDS.POULTRY, sortOrder: 1 },
    { id: SPECIES_IDS.DUCK, code: 'DUCK', name: ml('Duck', 'Canard', 'Pato', '\u0628\u0637'), scientificName: 'Anas platyrhynchos', groupId: GROUP_IDS.POULTRY, sortOrder: 2 },
    { id: SPECIES_IDS.TURKEY, code: 'TURKEY', name: ml('Turkey', 'Dinde', 'Peru', '\u062f\u064a\u0643 \u0631\u0648\u0645\u064a'), scientificName: 'Meleagris gallopavo', groupId: GROUP_IDS.POULTRY, sortOrder: 3 },
    { id: SPECIES_IDS.GUINEA_FOWL, code: 'GUINEA_FOWL', name: ml('Guinea Fowl', 'Pintade', 'Galinha-d\'angola', '\u062f\u062c\u0627\u062c \u063a\u064a\u0646\u064a\u0627'), scientificName: 'Numida meleagris', groupId: GROUP_IDS.POULTRY, sortOrder: 4 },
    { id: SPECIES_IDS.PIGEON, code: 'PIGEON', name: ml('Pigeon', 'Pigeon', 'Pombo', '\u062d\u0645\u0627\u0645'), scientificName: 'Columba livia', groupId: GROUP_IDS.POULTRY, sortOrder: 5 },
    // Equidae
    { id: SPECIES_IDS.HORSE, code: 'HORSE', name: ml('Horse', 'Cheval', 'Cavalo', '\u062d\u0635\u0627\u0646'), scientificName: 'Equus caballus', groupId: GROUP_IDS.EQUIDAE, sortOrder: 1 },
    { id: SPECIES_IDS.DONKEY, code: 'DONKEY', name: ml('Donkey', '\u00c2ne', 'Burro', '\u062d\u0645\u0627\u0631'), scientificName: 'Equus asinus', groupId: GROUP_IDS.EQUIDAE, sortOrder: 2 },
    { id: SPECIES_IDS.MULE, code: 'MULE', name: ml('Mule', 'Mulet', 'Mula', '\u0628\u063a\u0644'), scientificName: null, groupId: GROUP_IDS.EQUIDAE, sortOrder: 3 },
    // Camelids
    { id: SPECIES_IDS.DROMEDARY, code: 'DROMEDARY', name: ml('Dromedary Camel', 'Dromadaire', 'Dromedario', '\u062c\u0645\u0644'), scientificName: 'Camelus dromedarius', groupId: GROUP_IDS.CAMELIDS, sortOrder: 1 },
    // Swine
    { id: SPECIES_IDS.PIG, code: 'PIG', name: ml('Pig', 'Porc', 'Porco', '\u062e\u0646\u0632\u064a\u0631'), scientificName: 'Sus scrofa domesticus', groupId: GROUP_IDS.SWINE, sortOrder: 1 },
    // Aquatic
    { id: SPECIES_IDS.TILAPIA, code: 'TILAPIA', name: ml('Tilapia', 'Tilapia', 'Til\u00e1pia', '\u0628\u0644\u0637\u064a'), scientificName: 'Oreochromis niloticus', groupId: GROUP_IDS.AQUATIC, sortOrder: 1 },
    { id: SPECIES_IDS.CATFISH, code: 'CATFISH', name: ml('Catfish', 'Poisson-chat', 'Peixe-gato', '\u0633\u0645\u0643 \u0627\u0644\u0642\u0631\u0645\u0648\u0637'), scientificName: 'Clarias gariepinus', groupId: GROUP_IDS.AQUATIC, sortOrder: 2 },
    { id: SPECIES_IDS.SHRIMP, code: 'SHRIMP', name: ml('Shrimp', 'Crevette', 'Camar\u00e3o', '\u062c\u0645\u0628\u0631\u064a'), scientificName: null, groupId: GROUP_IDS.AQUATIC, sortOrder: 3 },
    // Wildlife
    { id: SPECIES_IDS.WILDEBEEST, code: 'WILDEBEEST', name: ml('Wildebeest', 'Gnou', 'Gnu', '\u0646\u0648'), scientificName: 'Connochaetes', groupId: GROUP_IDS.WILDLIFE, sortOrder: 1 },
    { id: SPECIES_IDS.ELEPHANT, code: 'ELEPHANT', name: ml('Elephant', '\u00c9l\u00e9phant', 'Elefante', '\u0641\u064a\u0644'), scientificName: 'Loxodonta africana', groupId: GROUP_IDS.WILDLIFE, sortOrder: 2 },
    { id: SPECIES_IDS.LION, code: 'LION', name: ml('Lion', 'Lion', 'Le\u00e3o', '\u0623\u0633\u062f'), scientificName: 'Panthera leo', groupId: GROUP_IDS.WILDLIFE, sortOrder: 3 },
    { id: SPECIES_IDS.HIPPO, code: 'HIPPO', name: ml('Hippopotamus', 'Hippopotame', 'Hipop\u00f3tamo', '\u0641\u0631\u0633 \u0627\u0644\u0646\u0647\u0631'), scientificName: 'Hippopotamus amphibius', groupId: GROUP_IDS.WILDLIFE, sortOrder: 4 },
    { id: SPECIES_IDS.ANTELOPE, code: 'ANTELOPE', name: ml('Antelope', 'Antilope', 'Ant\u00edlope', '\u0638\u0628\u064a'), scientificName: null, groupId: GROUP_IDS.WILDLIFE, sortOrder: 5 },
    // Bees
    { id: SPECIES_IDS.HONEYBEE, code: 'HONEYBEE', name: ml('Honeybee', 'Abeille', 'Abelha', '\u0646\u062d\u0644\u0629 \u0627\u0644\u0639\u0633\u0644'), scientificName: 'Apis mellifera', groupId: GROUP_IDS.BEES, sortOrder: 1 },
    // Pets
    { id: SPECIES_IDS.DOG, code: 'DOG', name: ml('Dog', 'Chien', 'Cão', '\u0643\u0644\u0628'), scientificName: 'Canis lupus familiaris', groupId: GROUP_IDS.PETS, sortOrder: 1 },
    { id: SPECIES_IDS.CAT, code: 'CAT', name: ml('Cat', 'Chat', 'Gato', '\u0642\u0637'), scientificName: 'Felis catus', groupId: GROUP_IDS.PETS, sortOrder: 2 },
    // Phase 4 — additional species from References-data.txt
    { id: SPECIES_IDS.GOOSE, code: 'GOOSE', name: ml('Goose', 'Oie', 'Ganso', '\u0625\u0648\u0632'), scientificName: 'Anser anser', groupId: GROUP_IDS.POULTRY, sortOrder: 6 },
    { id: SPECIES_IDS.QUAIL, code: 'QUAIL', name: ml('Quail', 'Caille', 'Codorniz', '\u0633\u0645\u0627\u0646'), scientificName: 'Coturnix coturnix', groupId: GROUP_IDS.POULTRY, sortOrder: 7 },
    { id: SPECIES_IDS.ZEBRA, code: 'ZEBRA', name: ml('Zebra', 'Zèbre', 'Zebra', '\u062d\u0645\u0627\u0631 \u0648\u062d\u0634\u064a'), scientificName: 'Equus quagga', groupId: GROUP_IDS.EQUIDAE, sortOrder: 4 },
    { id: SPECIES_IDS.WARTHOG, code: 'WARTHOG', name: ml('Warthog', 'Phacochère', 'Javali africano', '\u062e\u0646\u0632\u064a\u0631 \u0628\u0631\u064a'), scientificName: 'Phacochoerus africanus', groupId: GROUP_IDS.WILDLIFE, sortOrder: 6 },
    { id: SPECIES_IDS.GRASS_CUTTER, code: 'GRASS_CUTTER', name: ml('Grass Cutter', 'Aulacode', 'Rato-do-campo', '\u0642\u0627\u0631\u0636 \u0627\u0644\u0639\u0634\u0628'), scientificName: 'Thryonomys swinderianus', groupId: GROUP_IDS.MONOGASTRIC, sortOrder: 2 },
    { id: SPECIES_IDS.GUINEA_PIG, code: 'GUINEA_PIG', name: ml('Guinea Pig', 'Cobaye', 'Porquinho-da-índia', '\u062e\u0646\u0632\u064a\u0631 \u063a\u064a\u0646\u064a\u0627'), scientificName: 'Cavia porcellus', groupId: GROUP_IDS.MONOGASTRIC, sortOrder: 3 },
    { id: SPECIES_IDS.DEER, code: 'DEER', name: ml('Deer', 'Cerf', 'Cervo', '\u063a\u0632\u0627\u0644'), scientificName: null, groupId: GROUP_IDS.WILDLIFE, sortOrder: 7 },
    { id: SPECIES_IDS.HARE, code: 'HARE', name: ml('Hare', 'Lièvre', 'Lebre', '\u0623\u0631\u0646\u0628 \u0628\u0631\u064a'), scientificName: 'Lepus capensis', groupId: GROUP_IDS.WILDLIFE, sortOrder: 8 },
    { id: SPECIES_IDS.WILD_PIG, code: 'WILD_PIG', name: ml('Wild Pig', 'Sanglier', 'Javali', '\u062e\u0646\u0632\u064a\u0631 \u0628\u0631\u064a'), scientificName: 'Sus scrofa', groupId: GROUP_IDS.WILDLIFE, sortOrder: 9 },
    { id: SPECIES_IDS.MOLLUSC, code: 'MOLLUSC', name: ml('Mollusc', 'Mollusque', 'Molusco', '\u0631\u062e\u0648\u064a\u0627\u062a'), scientificName: null, groupId: GROUP_IDS.AQUATIC, sortOrder: 4 },
    { id: SPECIES_IDS.CRUSTACEAN, code: 'CRUSTACEAN', name: ml('Crustacean', 'Crustacé', 'Crustáceo', '\u0642\u0634\u0631\u064a\u0627\u062a'), scientificName: null, groupId: GROUP_IDS.AQUATIC, sortOrder: 5 },
    { id: SPECIES_IDS.AFRICAN_BUFFALO, code: 'AFRICAN_BUFFALO', name: ml('African Buffalo', 'Buffle d\'Afrique', 'Búfalo africano', '\u062c\u0627\u0645\u0648\u0633 \u0623\u0641\u0631\u064a\u0642\u064a'), scientificName: 'Syncerus caffer', groupId: GROUP_IDS.WILDLIFE, sortOrder: 10 },
  ];

  for (const s of species) {
    await (prisma as any).refSpecies.create({
      data: { id: s.id, code: s.code, name: s.name, scientificName: s.scientificName, groupId: s.groupId, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: s.sortOrder },
    });
  }
  console.log(`    ${species.length} species seeded`);
}

async function seedAgeGroups() {
  console.log('  Seeding age groups...');
  const ageGroups = [
    // Cattle
    { code: 'CALF_0_6', name: ml('Calf (0-6 months)', 'Veau (0-6 mois)'), speciesId: SPECIES_IDS.CATTLE, minMonths: 0, maxMonths: 6, sortOrder: 1 },
    { code: 'CALF_6_12', name: ml('Young (6-12 months)', 'Jeune (6-12 mois)'), speciesId: SPECIES_IDS.CATTLE, minMonths: 6, maxMonths: 12, sortOrder: 2 },
    { code: 'HEIFER', name: ml('Heifer (1-3 years)', 'G\u00e9nisse (1-3 ans)'), speciesId: SPECIES_IDS.CATTLE, minMonths: 12, maxMonths: 36, sortOrder: 3 },
    { code: 'ADULT_CATTLE', name: ml('Adult (>3 years)', 'Adulte (>3 ans)'), speciesId: SPECIES_IDS.CATTLE, minMonths: 36, maxMonths: null, sortOrder: 4 },
    // Sheep
    { code: 'LAMB', name: ml('Lamb (0-6 months)', 'Agneau (0-6 mois)'), speciesId: SPECIES_IDS.SHEEP, minMonths: 0, maxMonths: 6, sortOrder: 1 },
    { code: 'YEARLING_SHEEP', name: ml('Yearling (6-18 months)', 'Antenais (6-18 mois)'), speciesId: SPECIES_IDS.SHEEP, minMonths: 6, maxMonths: 18, sortOrder: 2 },
    { code: 'ADULT_SHEEP', name: ml('Adult (>18 months)', 'Adulte (>18 mois)'), speciesId: SPECIES_IDS.SHEEP, minMonths: 18, maxMonths: null, sortOrder: 3 },
    // Goat
    { code: 'KID', name: ml('Kid (0-6 months)', 'Chevreau (0-6 mois)'), speciesId: SPECIES_IDS.GOAT, minMonths: 0, maxMonths: 6, sortOrder: 1 },
    { code: 'YEARLING_GOAT', name: ml('Yearling (6-18 months)', 'Antenais (6-18 mois)'), speciesId: SPECIES_IDS.GOAT, minMonths: 6, maxMonths: 18, sortOrder: 2 },
    { code: 'ADULT_GOAT', name: ml('Adult (>18 months)', 'Adulte (>18 mois)'), speciesId: SPECIES_IDS.GOAT, minMonths: 18, maxMonths: null, sortOrder: 3 },
    // Poultry (Chicken)
    { code: 'CHICK', name: ml('Chick (0-8 weeks)', 'Poussin (0-8 semaines)'), speciesId: SPECIES_IDS.CHICKEN, minMonths: 0, maxMonths: 2, sortOrder: 1 },
    { code: 'GROWER', name: ml('Grower (8-20 weeks)', 'Croissance (8-20 semaines)'), speciesId: SPECIES_IDS.CHICKEN, minMonths: 2, maxMonths: 5, sortOrder: 2 },
    { code: 'LAYER_BROILER', name: ml('Layer/Broiler (>20 weeks)', 'Pondeuse/Chair (>20 semaines)'), speciesId: SPECIES_IDS.CHICKEN, minMonths: 5, maxMonths: null, sortOrder: 3 },
    // Phase 4 — Additional species age groups from References-data.txt
    // Buffalo
    { code: 'BUFFALO_CALF', name: ml('Buffalo Calf (0-12 months)', 'Bufflon (0-12 mois)'), speciesId: SPECIES_IDS.BUFFALO, minMonths: 0, maxMonths: 12, sortOrder: 1 },
    { code: 'BUFFALO_YOUNG', name: ml('Young Buffalo (1-3 years)', 'Jeune buffle (1-3 ans)'), speciesId: SPECIES_IDS.BUFFALO, minMonths: 12, maxMonths: 36, sortOrder: 2 },
    { code: 'BUFFALO_ADULT', name: ml('Adult Buffalo (>3 years)', 'Buffle adulte (>3 ans)'), speciesId: SPECIES_IDS.BUFFALO, minMonths: 36, maxMonths: null, sortOrder: 3 },
    // Pig
    { code: 'PIGLET', name: ml('Piglet (0-2 months)', 'Porcelet (0-2 mois)'), speciesId: SPECIES_IDS.PIG, minMonths: 0, maxMonths: 2, sortOrder: 1 },
    { code: 'WEANER_PIG', name: ml('Weaner (2-4 months)', 'Sevré (2-4 mois)'), speciesId: SPECIES_IDS.PIG, minMonths: 2, maxMonths: 4, sortOrder: 2 },
    { code: 'GROWER_PIG', name: ml('Grower (4-6 months)', 'Croissance (4-6 mois)'), speciesId: SPECIES_IDS.PIG, minMonths: 4, maxMonths: 6, sortOrder: 3 },
    { code: 'ADULT_PIG', name: ml('Adult Pig (>6 months)', 'Porc adulte (>6 mois)'), speciesId: SPECIES_IDS.PIG, minMonths: 6, maxMonths: null, sortOrder: 4 },
    // Horse
    { code: 'FOAL', name: ml('Foal (0-12 months)', 'Poulain (0-12 mois)'), speciesId: SPECIES_IDS.HORSE, minMonths: 0, maxMonths: 12, sortOrder: 1 },
    { code: 'YEARLING_HORSE', name: ml('Yearling (1-2 years)', 'Yearling (1-2 ans)'), speciesId: SPECIES_IDS.HORSE, minMonths: 12, maxMonths: 24, sortOrder: 2 },
    { code: 'YOUNG_HORSE', name: ml('Young Horse (2-4 years)', 'Jeune cheval (2-4 ans)'), speciesId: SPECIES_IDS.HORSE, minMonths: 24, maxMonths: 48, sortOrder: 3 },
    { code: 'ADULT_HORSE', name: ml('Adult Horse (>4 years)', 'Cheval adulte (>4 ans)'), speciesId: SPECIES_IDS.HORSE, minMonths: 48, maxMonths: null, sortOrder: 4 },
    // Camel
    { code: 'CAMEL_CALF', name: ml('Camel Calf (0-12 months)', 'Chamelon (0-12 mois)'), speciesId: SPECIES_IDS.DROMEDARY, minMonths: 0, maxMonths: 12, sortOrder: 1 },
    { code: 'YOUNG_CAMEL', name: ml('Young Camel (1-4 years)', 'Jeune chameau (1-4 ans)'), speciesId: SPECIES_IDS.DROMEDARY, minMonths: 12, maxMonths: 48, sortOrder: 2 },
    { code: 'ADULT_CAMEL', name: ml('Adult Camel (>4 years)', 'Chameau adulte (>4 ans)'), speciesId: SPECIES_IDS.DROMEDARY, minMonths: 48, maxMonths: null, sortOrder: 3 },
    // Rabbit
    { code: 'KITTEN_RABBIT', name: ml('Kitten (0-2 months)', 'Lapereau (0-2 mois)'), speciesId: SPECIES_IDS.RABBIT, minMonths: 0, maxMonths: 2, sortOrder: 1 },
    { code: 'YOUNG_RABBIT', name: ml('Young Rabbit (2-5 months)', 'Jeune lapin (2-5 mois)'), speciesId: SPECIES_IDS.RABBIT, minMonths: 2, maxMonths: 5, sortOrder: 2 },
    { code: 'ADULT_RABBIT', name: ml('Adult Rabbit (>5 months)', 'Lapin adulte (>5 mois)'), speciesId: SPECIES_IDS.RABBIT, minMonths: 5, maxMonths: null, sortOrder: 3 },
  ];

  for (const ag of ageGroups) {
    await (prisma as any).refAgeGroup.create({
      data: {
        code: ag.code,
        name: ag.name,
        speciesId: ag.speciesId,
        minMonths: ag.minMonths,
        maxMonths: ag.maxMonths,
        scope: 'continental',
        ownerId: null,
        ownerType: 'continental',
        sortOrder: ag.sortOrder,
      },
    }).catch(() => {
      // Ignore duplicate constraint violations on re-run
    });
  }
  console.log(`    ${ageGroups.length} age groups seeded`);
}

async function seedDiseases() {
  console.log('  Seeding diseases...');
  const diseases = [
    { id: DISEASE_IDS.FMD, code: 'FMD', name: ml('Foot and Mouth Disease', 'Fi\u00e8vre Aphteuse'), oieCode: 'A010', isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 1 },
    { id: DISEASE_IDS.CBPP, code: 'CBPP', name: ml('Contagious Bovine Pleuropneumonia', 'P\u00e9ripneumonie Contagieuse Bovine'), oieCode: 'B101', isNotifiable: true, isZoonotic: false, category: 'bacterial', sortOrder: 2 },
    { id: DISEASE_IDS.PPR, code: 'PPR', name: ml('Peste des Petits Ruminants', 'Peste des Petits Ruminants'), oieCode: 'A040', isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 3 },
    { id: DISEASE_IDS.ASF, code: 'ASF', name: ml('African Swine Fever', 'Peste Porcine Africaine'), oieCode: 'A120', isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 4 },
    { id: DISEASE_IDS.HPAI, code: 'HPAI', name: ml('Highly Pathogenic Avian Influenza', 'Influenza Aviaire Hautement Pathog\u00e8ne'), oieCode: 'A150', isNotifiable: true, isZoonotic: true, category: 'viral', sortOrder: 5 },
    { id: DISEASE_IDS.RVF, code: 'RVF', name: ml('Rift Valley Fever', 'Fi\u00e8vre de la Vall\u00e9e du Rift'), oieCode: 'A080', isNotifiable: true, isZoonotic: true, category: 'viral', sortOrder: 6 },
    { id: DISEASE_IDS.LSD, code: 'LSD', name: ml('Lumpy Skin Disease', 'Dermatose Nodulaire'), oieCode: 'A110', isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 7 },
    { id: DISEASE_IDS.RABIES, code: 'RABIES', name: ml('Rabies', 'Rage'), oieCode: 'B050', isNotifiable: true, isZoonotic: true, category: 'viral', sortOrder: 8 },
    { id: DISEASE_IDS.ANTHRAX, code: 'ANTHRAX', name: ml('Anthrax', 'Charbon Bact\u00e9ridien'), oieCode: 'B010', isNotifiable: true, isZoonotic: true, category: 'bacterial', sortOrder: 9 },
    { id: DISEASE_IDS.BRUCELLA, code: 'BRUCELLA', name: ml('Brucellosis', 'Brucellose'), oieCode: 'B020', isNotifiable: true, isZoonotic: true, category: 'bacterial', sortOrder: 10 },
    { id: DISEASE_IDS.TB, code: 'TB', name: ml('Bovine Tuberculosis', 'Tuberculose Bovine'), oieCode: 'B040', isNotifiable: true, isZoonotic: true, category: 'bacterial', sortOrder: 11 },
    { id: DISEASE_IDS.ND, code: 'ND', name: ml('Newcastle Disease', 'Maladie de Newcastle'), oieCode: 'A160', isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 12 },
    { id: DISEASE_IDS.ECF, code: 'ECF', name: ml('East Coast Fever', 'Th\u00e9il\u00e9riose'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'parasitic', sortOrder: 13 },
    { id: DISEASE_IDS.TRYP, code: 'TRYP', name: ml('Trypanosomosis', 'Trypanosomose'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'parasitic', sortOrder: 14 },
    { id: DISEASE_IDS.BLACKLEG, code: 'BLACKLEG', name: ml('Blackleg', 'Charbon Symptomatique'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'bacterial', sortOrder: 15 },
    { id: DISEASE_IDS.SHEEP_POX, code: 'SHEEP_POX', name: ml('Sheep Pox', 'Clavel\u00e9e'), oieCode: 'A130', isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 16 },
    { id: DISEASE_IDS.GOAT_POX, code: 'GOAT_POX', name: ml('Goat Pox', 'Variole Caprine'), oieCode: 'A131', isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 17 },
    { id: DISEASE_IDS.AHS, code: 'AHS', name: ml('African Horse Sickness', 'Peste \u00c9quine'), oieCode: 'A060', isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 18 },
    { id: DISEASE_IDS.CCPP, code: 'CCPP', name: ml('Contagious Caprine Pleuropneumonia', 'PPCC'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'bacterial', sortOrder: 19 },
    { id: DISEASE_IDS.HEARTWATER, code: 'HEARTWATER', name: ml('Heartwater', 'Cowdriose'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'bacterial', sortOrder: 20 },
    { id: DISEASE_IDS.ANAPLASMOSIS, code: 'ANAPLASMOSIS', name: ml('Anaplasmosis', 'Anaplasmose'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'bacterial', sortOrder: 21 },
    { id: DISEASE_IDS.BABESIOSIS, code: 'BABESIOSIS', name: ml('Babesiosis', 'Bab\u00e9siose'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'parasitic', sortOrder: 22 },
    { id: DISEASE_IDS.FASCIOLOSIS, code: 'FASCIOLOSIS', name: ml('Fasciolosis', 'Fasciolose'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'parasitic', sortOrder: 23 },
    { id: DISEASE_IDS.MANGE, code: 'MANGE', name: ml('Mange', 'Gale'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'parasitic', sortOrder: 24 },
    { id: DISEASE_IDS.MASTITIS, code: 'MASTITIS', name: ml('Mastitis', 'Mammite'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'bacterial', sortOrder: 25 },
    // Phase 4 — WOAH diseases from References-data.txt (63 new)
    // Bovine
    { id: DISEASE_IDS.BLUETONGUE, code: 'BLUETONGUE', name: ml('Bluetongue', 'Fièvre catarrhale du mouton'), oieCode: 'A090', isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 26 },
    { id: DISEASE_IDS.RINDERPEST, code: 'RINDERPEST', name: ml('Rinderpest', 'Peste bovine'), oieCode: 'A020', isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 27 },
    { id: DISEASE_IDS.BSE, code: 'BSE', name: ml('Bovine Spongiform Encephalopathy', 'Encéphalopathie spongiforme bovine'), oieCode: 'B050', isNotifiable: true, isZoonotic: true, category: 'prion', sortOrder: 28 },
    { id: DISEASE_IDS.EBL, code: 'EBL', name: ml('Enzootic Bovine Leukosis', 'Leucose bovine enzootique'), oieCode: 'B060', isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 29 },
    { id: DISEASE_IDS.IBR_IPV, code: 'IBR_IPV', name: ml('Infectious Bovine Rhinotracheitis / IPV', 'Rhinotrachéite infectieuse bovine / IPV'), oieCode: 'B070', isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 30 },
    { id: DISEASE_IDS.HAEMORRHAGIC_SEPTICAEMIA, code: 'HAEMORRHAGIC_SEPTICAEMIA', name: ml('Haemorrhagic Septicaemia', 'Septicémie hémorragique'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'bacterial', sortOrder: 31 },
    { id: DISEASE_IDS.BOV_GENITAL_CAMP, code: 'BOV_GENITAL_CAMP', name: ml('Bovine Genital Campylobacteriosis', 'Campylobactériose génitale bovine'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'bacterial', sortOrder: 32 },
    // Equine
    { id: DISEASE_IDS.DOURINE, code: 'DOURINE', name: ml('Dourine', 'Dourine'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'parasitic', sortOrder: 33 },
    { id: DISEASE_IDS.GLANDERS, code: 'GLANDERS', name: ml('Glanders', 'Morve'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'bacterial', sortOrder: 34 },
    { id: DISEASE_IDS.EQUINE_INFLUENZA, code: 'EQUINE_INFLUENZA', name: ml('Equine Influenza', 'Grippe équine'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 35 },
    { id: DISEASE_IDS.EQUINE_INFECTIOUS_ANAEMIA, code: 'EQUINE_INFECTIOUS_ANAEMIA', name: ml('Equine Infectious Anaemia', 'Anémie infectieuse des équidés'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 36 },
    { id: DISEASE_IDS.EQUINE_PIROPLASMOSIS, code: 'EQUINE_PIROPLASMOSIS', name: ml('Equine Piroplasmosis', 'Piroplasmose équine'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'parasitic', sortOrder: 37 },
    { id: DISEASE_IDS.EQUINE_RHINOPNEUMONITIS, code: 'EQUINE_RHINOPNEUMONITIS', name: ml('Equine Rhinopneumonitis', 'Rhinopneumonie équine'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 38 },
    { id: DISEASE_IDS.EQUINE_VIRAL_ARTERITIS, code: 'EQUINE_VIRAL_ARTERITIS', name: ml('Equine Viral Arteritis', 'Artérite virale équine'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 39 },
    { id: DISEASE_IDS.EQUINE_ENCEPHALOMYELITIS, code: 'EQUINE_ENCEPHALOMYELITIS', name: ml('Equine Encephalomyelitis (Eastern/Western)', 'Encéphalomyélite équine (Est/Ouest)'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'viral', sortOrder: 40 },
    { id: DISEASE_IDS.VEE, code: 'VEE', name: ml('Venezuelan Equine Encephalomyelitis', 'Encéphalomyélite équine vénézuélienne'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'viral', sortOrder: 41 },
    { id: DISEASE_IDS.STRANGLES, code: 'STRANGLES', name: ml('Strangles', 'Gourme'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'bacterial', sortOrder: 42 },
    // Camelid
    { id: DISEASE_IDS.CAMELPOX, code: 'CAMELPOX', name: ml('Camelpox', 'Variole du chameau'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 43 },
    // Sheep & Goat
    { id: DISEASE_IDS.MAEDI_VISNA, code: 'MAEDI_VISNA', name: ml('Maedi-Visna', 'Maedi-Visna'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 44 },
    { id: DISEASE_IDS.CONTAGIOUS_AGALACTIA, code: 'CONTAGIOUS_AGALACTIA', name: ml('Contagious Agalactia', 'Agalaxie contagieuse'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'bacterial', sortOrder: 45 },
    { id: DISEASE_IDS.NAIROBI_SHEEP, code: 'NAIROBI_SHEEP', name: ml('Nairobi Sheep Disease', 'Maladie de Nairobi'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 46 },
    { id: DISEASE_IDS.SCRAPIE, code: 'SCRAPIE', name: ml('Scrapie', 'Tremblante'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'prion', sortOrder: 47 },
    // Swine
    { id: DISEASE_IDS.CSF, code: 'CSF', name: ml('Classical Swine Fever', 'Peste porcine classique'), oieCode: 'A130', isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 48 },
    { id: DISEASE_IDS.AUJESZKY, code: 'AUJESZKY', name: ml('Aujeszky\'s Disease', 'Maladie d\'Aujeszky'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 49 },
    { id: DISEASE_IDS.PRRS, code: 'PRRS', name: ml('Porcine Reproductive & Respiratory Syndrome', 'SDRP'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 50 },
    { id: DISEASE_IDS.SVD, code: 'SVD', name: ml('Swine Vesicular Disease', 'Maladie vésiculeuse du porc'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 51 },
    { id: DISEASE_IDS.CYSTICERCOSIS, code: 'CYSTICERCOSIS', name: ml('Cysticercosis', 'Cysticercose'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'parasitic', sortOrder: 52 },
    // Poultry
    { id: DISEASE_IDS.AVIAN_SALMONELLOSIS, code: 'AVIAN_SALMONELLOSIS', name: ml('Avian Salmonellosis (S. pullorum)', 'Salmonellose aviaire (S. pullorum)'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'bacterial', sortOrder: 53 },
    { id: DISEASE_IDS.FOWL_TYPHOID, code: 'FOWL_TYPHOID', name: ml('Fowl Typhoid', 'Typhose aviaire'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'bacterial', sortOrder: 54 },
    { id: DISEASE_IDS.IBD, code: 'IBD', name: ml('Infectious Bursal Disease (Gumboro)', 'Maladie de Gumboro'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 55 },
    { id: DISEASE_IDS.MAREKS, code: 'MAREKS', name: ml('Marek\'s Disease', 'Maladie de Marek'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 56 },
    { id: DISEASE_IDS.AVIAN_IB, code: 'AVIAN_IB', name: ml('Avian Infectious Bronchitis', 'Bronchite infectieuse aviaire'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 57 },
    { id: DISEASE_IDS.AVIAN_TB, code: 'AVIAN_TB', name: ml('Avian Tuberculosis', 'Tuberculose aviaire'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'bacterial', sortOrder: 58 },
    { id: DISEASE_IDS.FOWL_POX, code: 'FOWL_POX', name: ml('Fowl Pox', 'Variole aviaire'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 59 },
    { id: DISEASE_IDS.INFECTIOUS_CORYZA, code: 'INFECTIOUS_CORYZA', name: ml('Infectious Coryza', 'Coryza infectieux'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'bacterial', sortOrder: 60 },
    // Multi-species
    { id: DISEASE_IDS.ECHINOCOCCOSIS, code: 'ECHINOCOCCOSIS', name: ml('Echinococcosis / Hydatidosis', 'Échinococcose / Hydatidose'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'parasitic', sortOrder: 61 },
    { id: DISEASE_IDS.LEPTOSPIROSIS, code: 'LEPTOSPIROSIS', name: ml('Leptospirosis', 'Leptospirose'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'bacterial', sortOrder: 62 },
    { id: DISEASE_IDS.LISTERIOSIS, code: 'LISTERIOSIS', name: ml('Listeriosis', 'Listériose'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'bacterial', sortOrder: 63 },
    { id: DISEASE_IDS.BOTULISM, code: 'BOTULISM', name: ml('Botulism', 'Botulisme'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'bacterial', sortOrder: 64 },
    { id: DISEASE_IDS.LEISHMANIOSIS, code: 'LEISHMANIOSIS', name: ml('Leishmaniosis', 'Leishmaniose'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'parasitic', sortOrder: 65 },
    { id: DISEASE_IDS.COCCIDIOSIS, code: 'COCCIDIOSIS', name: ml('Coccidiosis', 'Coccidiose'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'parasitic', sortOrder: 66 },
    { id: DISEASE_IDS.Q_FEVER, code: 'Q_FEVER', name: ml('Q Fever (Coxiellosis)', 'Fièvre Q (Coxiellose)'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'bacterial', sortOrder: 67 },
    { id: DISEASE_IDS.THEILERIOSIS, code: 'THEILERIOSIS', name: ml('Theileriosis (tropical)', 'Theilériose (tropicale)'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'parasitic', sortOrder: 68 },
    { id: DISEASE_IDS.CRIMEAN_CONGO, code: 'CRIMEAN_CONGO', name: ml('Crimean-Congo Haemorrhagic Fever', 'Fièvre hémorragique de Crimée-Congo'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'viral', sortOrder: 69 },
    { id: DISEASE_IDS.FILARIASIS, code: 'FILARIASIS', name: ml('Filariasis', 'Filariose'), oieCode: null, isNotifiable: false, isZoonotic: false, category: 'parasitic', sortOrder: 70 },
    { id: DISEASE_IDS.TRICHINELLOSIS, code: 'TRICHINELLOSIS', name: ml('Trichinellosis', 'Trichinellose'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'parasitic', sortOrder: 71 },
    { id: DISEASE_IDS.PARATUBERCULOSIS, code: 'PARATUBERCULOSIS', name: ml('Paratuberculosis (Johne\'s)', 'Paratuberculose (Johne)'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'bacterial', sortOrder: 72 },
    { id: DISEASE_IDS.VESICULAR_STOMATITIS, code: 'VESICULAR_STOMATITIS', name: ml('Vesicular Stomatitis', 'Stomatite vésiculeuse'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'viral', sortOrder: 73 },
    { id: DISEASE_IDS.TULAREMIA, code: 'TULAREMIA', name: ml('Tularemia', 'Tularémie'), oieCode: null, isNotifiable: true, isZoonotic: true, category: 'bacterial', sortOrder: 74 },
    { id: DISEASE_IDS.EHD, code: 'EHD', name: ml('Epizootic Haemorrhagic Disease', 'Maladie hémorragique épizootique'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 75 },
    // Rabbit
    { id: DISEASE_IDS.MYXOMATOSIS, code: 'MYXOMATOSIS', name: ml('Myxomatosis', 'Myxomatose'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 76 },
    { id: DISEASE_IDS.RABBIT_HAEMORRHAGIC, code: 'RABBIT_HAEMORRHAGIC', name: ml('Rabbit Haemorrhagic Disease', 'Maladie hémorragique du lapin'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 77 },
    // Bee diseases (in RefDisease for cross-domain use)
    { id: DISEASE_IDS.VARROA_DISEASE, code: 'VARROA_DISEASE', name: ml('Varroosis', 'Varroose'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'parasitic', sortOrder: 78 },
    { id: DISEASE_IDS.NOSEMA_DISEASE, code: 'NOSEMA_DISEASE', name: ml('Nosemosis (Nosema apis/ceranae)', 'Nosémose'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'fungal', sortOrder: 79 },
    { id: DISEASE_IDS.AFB_DISEASE, code: 'AFB_DISEASE', name: ml('American Foulbrood', 'Loque américaine'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'bacterial', sortOrder: 80 },
    { id: DISEASE_IDS.SMALL_HIVE_BEETLE_DISEASE, code: 'SMALL_HIVE_BEETLE_DISEASE', name: ml('Small Hive Beetle Infestation', 'Infestation par le petit coléoptère'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'parasitic', sortOrder: 81 },
    // Aquatic
    { id: DISEASE_IDS.EUS, code: 'EUS', name: ml('Epizootic Ulcerative Syndrome', 'Syndrome ulcéreux épizootique'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'fungal', sortOrder: 82 },
    { id: DISEASE_IDS.ISA, code: 'ISA', name: ml('Infectious Salmon Anaemia', 'Anémie infectieuse du saumon'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 83 },
    { id: DISEASE_IDS.KHV, code: 'KHV', name: ml('Koi Herpesvirus Disease', 'Herpèsvirose de la carpe koï'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 84 },
    { id: DISEASE_IDS.VHS, code: 'VHS', name: ml('Viral Haemorrhagic Septicaemia', 'Septicémie hémorragique virale'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 85 },
    { id: DISEASE_IDS.WHITE_SPOT, code: 'WHITE_SPOT', name: ml('White Spot Disease', 'Maladie des points blancs'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 86 },
    { id: DISEASE_IDS.TAURA, code: 'TAURA', name: ml('Taura Syndrome', 'Syndrome de Taura'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 87 },
    { id: DISEASE_IDS.YELLOWHEAD, code: 'YELLOWHEAD', name: ml('Yellow Head Disease', 'Maladie de la tête jaune'), oieCode: null, isNotifiable: true, isZoonotic: false, category: 'viral', sortOrder: 88 },
  ];

  for (const d of diseases) {
    await (prisma as any).refDisease.create({
      data: { id: d.id, code: d.code, name: d.name, oieCode: d.oieCode, isNotifiable: d.isNotifiable, isZoonotic: d.isZoonotic, category: d.category, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: d.sortOrder },
    });
  }
  console.log(`    ${diseases.length} diseases seeded`);
}

async function seedDiseaseSpecies() {
  console.log('  Seeding disease-species relations...');
  const relations: { diseaseId: string; speciesId: string; susceptibility?: string }[] = [
    // FMD
    { diseaseId: DISEASE_IDS.FMD, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.FMD, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.FMD, speciesId: SPECIES_IDS.GOAT, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.FMD, speciesId: SPECIES_IDS.BUFFALO, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.FMD, speciesId: SPECIES_IDS.PIG, susceptibility: 'high' },
    // CBPP
    { diseaseId: DISEASE_IDS.CBPP, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.CBPP, speciesId: SPECIES_IDS.BUFFALO, susceptibility: 'moderate' },
    // PPR
    { diseaseId: DISEASE_IDS.PPR, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.PPR, speciesId: SPECIES_IDS.GOAT, susceptibility: 'high' },
    // ASF
    { diseaseId: DISEASE_IDS.ASF, speciesId: SPECIES_IDS.PIG, susceptibility: 'high' },
    // HPAI
    { diseaseId: DISEASE_IDS.HPAI, speciesId: SPECIES_IDS.CHICKEN, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.HPAI, speciesId: SPECIES_IDS.DUCK, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.HPAI, speciesId: SPECIES_IDS.TURKEY, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.HPAI, speciesId: SPECIES_IDS.GUINEA_FOWL, susceptibility: 'moderate' },
    // RVF
    { diseaseId: DISEASE_IDS.RVF, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.RVF, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.RVF, speciesId: SPECIES_IDS.GOAT, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.RVF, speciesId: SPECIES_IDS.DROMEDARY, susceptibility: 'moderate' },
    // LSD
    { diseaseId: DISEASE_IDS.LSD, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.LSD, speciesId: SPECIES_IDS.BUFFALO, susceptibility: 'moderate' },
    // RABIES
    { diseaseId: DISEASE_IDS.RABIES, speciesId: SPECIES_IDS.DOG, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.RABIES, speciesId: SPECIES_IDS.CAT, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.RABIES, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'moderate' },
    // ANTHRAX
    { diseaseId: DISEASE_IDS.ANTHRAX, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.ANTHRAX, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.ANTHRAX, speciesId: SPECIES_IDS.GOAT, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.ANTHRAX, speciesId: SPECIES_IDS.HORSE, susceptibility: 'moderate' },
    // BRUCELLA
    { diseaseId: DISEASE_IDS.BRUCELLA, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.BRUCELLA, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.BRUCELLA, speciesId: SPECIES_IDS.GOAT, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.BRUCELLA, speciesId: SPECIES_IDS.PIG, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.BRUCELLA, speciesId: SPECIES_IDS.DROMEDARY, susceptibility: 'moderate' },
    // TB
    { diseaseId: DISEASE_IDS.TB, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.TB, speciesId: SPECIES_IDS.BUFFALO, susceptibility: 'moderate' },
    // ND
    { diseaseId: DISEASE_IDS.ND, speciesId: SPECIES_IDS.CHICKEN, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.ND, speciesId: SPECIES_IDS.DUCK, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.ND, speciesId: SPECIES_IDS.TURKEY, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.ND, speciesId: SPECIES_IDS.PIGEON, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.ND, speciesId: SPECIES_IDS.GUINEA_FOWL, susceptibility: 'moderate' },
    // ECF
    { diseaseId: DISEASE_IDS.ECF, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    // TRYP
    { diseaseId: DISEASE_IDS.TRYP, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.TRYP, speciesId: SPECIES_IDS.HORSE, susceptibility: 'high' },
    // BLACKLEG
    { diseaseId: DISEASE_IDS.BLACKLEG, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    // SHEEP_POX
    { diseaseId: DISEASE_IDS.SHEEP_POX, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'high' },
    // GOAT_POX
    { diseaseId: DISEASE_IDS.GOAT_POX, speciesId: SPECIES_IDS.GOAT, susceptibility: 'high' },
    // AHS
    { diseaseId: DISEASE_IDS.AHS, speciesId: SPECIES_IDS.HORSE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.AHS, speciesId: SPECIES_IDS.DONKEY, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.AHS, speciesId: SPECIES_IDS.MULE, susceptibility: 'moderate' },
    // CCPP
    { diseaseId: DISEASE_IDS.CCPP, speciesId: SPECIES_IDS.GOAT, susceptibility: 'high' },
    // HEARTWATER
    { diseaseId: DISEASE_IDS.HEARTWATER, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.HEARTWATER, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.HEARTWATER, speciesId: SPECIES_IDS.GOAT, susceptibility: 'moderate' },
    // ANAPLASMOSIS
    { diseaseId: DISEASE_IDS.ANAPLASMOSIS, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    // BABESIOSIS
    { diseaseId: DISEASE_IDS.BABESIOSIS, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    // FASCIOLOSIS
    { diseaseId: DISEASE_IDS.FASCIOLOSIS, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.FASCIOLOSIS, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.FASCIOLOSIS, speciesId: SPECIES_IDS.GOAT, susceptibility: 'moderate' },
    // MANGE
    { diseaseId: DISEASE_IDS.MANGE, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.MANGE, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.MANGE, speciesId: SPECIES_IDS.GOAT, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.MANGE, speciesId: SPECIES_IDS.DROMEDARY, susceptibility: 'moderate' },
    // MASTITIS
    { diseaseId: DISEASE_IDS.MASTITIS, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.MASTITIS, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.MASTITIS, speciesId: SPECIES_IDS.GOAT, susceptibility: 'moderate' },
    // ── Phase 4 — Disease-species relations for new WOAH diseases ──
    // BLUETONGUE
    { diseaseId: DISEASE_IDS.BLUETONGUE, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.BLUETONGUE, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.BLUETONGUE, speciesId: SPECIES_IDS.GOAT, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.BLUETONGUE, speciesId: SPECIES_IDS.DEER, susceptibility: 'high' },
    // RINDERPEST
    { diseaseId: DISEASE_IDS.RINDERPEST, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.RINDERPEST, speciesId: SPECIES_IDS.BUFFALO, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.RINDERPEST, speciesId: SPECIES_IDS.AFRICAN_BUFFALO, susceptibility: 'high' },
    // BSE
    { diseaseId: DISEASE_IDS.BSE, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    // EBL
    { diseaseId: DISEASE_IDS.EBL, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    // IBR/IPV
    { diseaseId: DISEASE_IDS.IBR_IPV, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    // HAEMORRHAGIC SEPTICAEMIA
    { diseaseId: DISEASE_IDS.HAEMORRHAGIC_SEPTICAEMIA, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.HAEMORRHAGIC_SEPTICAEMIA, speciesId: SPECIES_IDS.BUFFALO, susceptibility: 'high' },
    // BOV GENITAL CAMPYLOBACTERIOSIS
    { diseaseId: DISEASE_IDS.BOV_GENITAL_CAMP, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    // DOURINE
    { diseaseId: DISEASE_IDS.DOURINE, speciesId: SPECIES_IDS.HORSE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.DOURINE, speciesId: SPECIES_IDS.DONKEY, susceptibility: 'moderate' },
    // GLANDERS
    { diseaseId: DISEASE_IDS.GLANDERS, speciesId: SPECIES_IDS.HORSE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.GLANDERS, speciesId: SPECIES_IDS.DONKEY, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.GLANDERS, speciesId: SPECIES_IDS.MULE, susceptibility: 'high' },
    // EQUINE INFLUENZA
    { diseaseId: DISEASE_IDS.EQUINE_INFLUENZA, speciesId: SPECIES_IDS.HORSE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.EQUINE_INFLUENZA, speciesId: SPECIES_IDS.DONKEY, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.EQUINE_INFLUENZA, speciesId: SPECIES_IDS.ZEBRA, susceptibility: 'moderate' },
    // EQUINE INFECTIOUS ANAEMIA
    { diseaseId: DISEASE_IDS.EQUINE_INFECTIOUS_ANAEMIA, speciesId: SPECIES_IDS.HORSE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.EQUINE_INFECTIOUS_ANAEMIA, speciesId: SPECIES_IDS.DONKEY, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.EQUINE_INFECTIOUS_ANAEMIA, speciesId: SPECIES_IDS.MULE, susceptibility: 'moderate' },
    // EQUINE PIROPLASMOSIS
    { diseaseId: DISEASE_IDS.EQUINE_PIROPLASMOSIS, speciesId: SPECIES_IDS.HORSE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.EQUINE_PIROPLASMOSIS, speciesId: SPECIES_IDS.DONKEY, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.EQUINE_PIROPLASMOSIS, speciesId: SPECIES_IDS.ZEBRA, susceptibility: 'moderate' },
    // EQUINE RHINOPNEUMONITIS
    { diseaseId: DISEASE_IDS.EQUINE_RHINOPNEUMONITIS, speciesId: SPECIES_IDS.HORSE, susceptibility: 'high' },
    // EQUINE VIRAL ARTERITIS
    { diseaseId: DISEASE_IDS.EQUINE_VIRAL_ARTERITIS, speciesId: SPECIES_IDS.HORSE, susceptibility: 'high' },
    // EQUINE ENCEPHALOMYELITIS
    { diseaseId: DISEASE_IDS.EQUINE_ENCEPHALOMYELITIS, speciesId: SPECIES_IDS.HORSE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.EQUINE_ENCEPHALOMYELITIS, speciesId: SPECIES_IDS.DONKEY, susceptibility: 'moderate' },
    // VEE
    { diseaseId: DISEASE_IDS.VEE, speciesId: SPECIES_IDS.HORSE, susceptibility: 'high' },
    // STRANGLES
    { diseaseId: DISEASE_IDS.STRANGLES, speciesId: SPECIES_IDS.HORSE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.STRANGLES, speciesId: SPECIES_IDS.DONKEY, susceptibility: 'moderate' },
    // CAMELPOX
    { diseaseId: DISEASE_IDS.CAMELPOX, speciesId: SPECIES_IDS.DROMEDARY, susceptibility: 'high' },
    // MAEDI-VISNA
    { diseaseId: DISEASE_IDS.MAEDI_VISNA, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.MAEDI_VISNA, speciesId: SPECIES_IDS.GOAT, susceptibility: 'moderate' },
    // CONTAGIOUS AGALACTIA
    { diseaseId: DISEASE_IDS.CONTAGIOUS_AGALACTIA, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.CONTAGIOUS_AGALACTIA, speciesId: SPECIES_IDS.GOAT, susceptibility: 'high' },
    // NAIROBI SHEEP DISEASE
    { diseaseId: DISEASE_IDS.NAIROBI_SHEEP, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.NAIROBI_SHEEP, speciesId: SPECIES_IDS.GOAT, susceptibility: 'high' },
    // SCRAPIE
    { diseaseId: DISEASE_IDS.SCRAPIE, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.SCRAPIE, speciesId: SPECIES_IDS.GOAT, susceptibility: 'moderate' },
    // CSF
    { diseaseId: DISEASE_IDS.CSF, speciesId: SPECIES_IDS.PIG, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.CSF, speciesId: SPECIES_IDS.WILD_PIG, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.CSF, speciesId: SPECIES_IDS.WARTHOG, susceptibility: 'moderate' },
    // AUJESZKY
    { diseaseId: DISEASE_IDS.AUJESZKY, speciesId: SPECIES_IDS.PIG, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.AUJESZKY, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'low' },
    // PRRS
    { diseaseId: DISEASE_IDS.PRRS, speciesId: SPECIES_IDS.PIG, susceptibility: 'high' },
    // SVD
    { diseaseId: DISEASE_IDS.SVD, speciesId: SPECIES_IDS.PIG, susceptibility: 'high' },
    // CYSTICERCOSIS
    { diseaseId: DISEASE_IDS.CYSTICERCOSIS, speciesId: SPECIES_IDS.PIG, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.CYSTICERCOSIS, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'moderate' },
    // AVIAN SALMONELLOSIS
    { diseaseId: DISEASE_IDS.AVIAN_SALMONELLOSIS, speciesId: SPECIES_IDS.CHICKEN, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.AVIAN_SALMONELLOSIS, speciesId: SPECIES_IDS.TURKEY, susceptibility: 'high' },
    // FOWL TYPHOID
    { diseaseId: DISEASE_IDS.FOWL_TYPHOID, speciesId: SPECIES_IDS.CHICKEN, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.FOWL_TYPHOID, speciesId: SPECIES_IDS.TURKEY, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.FOWL_TYPHOID, speciesId: SPECIES_IDS.GUINEA_FOWL, susceptibility: 'moderate' },
    // IBD (GUMBORO)
    { diseaseId: DISEASE_IDS.IBD, speciesId: SPECIES_IDS.CHICKEN, susceptibility: 'high' },
    // MAREK'S
    { diseaseId: DISEASE_IDS.MAREKS, speciesId: SPECIES_IDS.CHICKEN, susceptibility: 'high' },
    // AVIAN IB
    { diseaseId: DISEASE_IDS.AVIAN_IB, speciesId: SPECIES_IDS.CHICKEN, susceptibility: 'high' },
    // AVIAN TB
    { diseaseId: DISEASE_IDS.AVIAN_TB, speciesId: SPECIES_IDS.CHICKEN, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.AVIAN_TB, speciesId: SPECIES_IDS.DUCK, susceptibility: 'moderate' },
    // FOWL POX
    { diseaseId: DISEASE_IDS.FOWL_POX, speciesId: SPECIES_IDS.CHICKEN, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.FOWL_POX, speciesId: SPECIES_IDS.TURKEY, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.FOWL_POX, speciesId: SPECIES_IDS.PIGEON, susceptibility: 'moderate' },
    // INFECTIOUS CORYZA
    { diseaseId: DISEASE_IDS.INFECTIOUS_CORYZA, speciesId: SPECIES_IDS.CHICKEN, susceptibility: 'high' },
    // ECHINOCOCCOSIS
    { diseaseId: DISEASE_IDS.ECHINOCOCCOSIS, speciesId: SPECIES_IDS.DOG, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.ECHINOCOCCOSIS, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.ECHINOCOCCOSIS, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.ECHINOCOCCOSIS, speciesId: SPECIES_IDS.GOAT, susceptibility: 'moderate' },
    // LEPTOSPIROSIS
    { diseaseId: DISEASE_IDS.LEPTOSPIROSIS, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.LEPTOSPIROSIS, speciesId: SPECIES_IDS.PIG, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.LEPTOSPIROSIS, speciesId: SPECIES_IDS.DOG, susceptibility: 'high' },
    // LISTERIOSIS
    { diseaseId: DISEASE_IDS.LISTERIOSIS, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.LISTERIOSIS, speciesId: SPECIES_IDS.GOAT, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.LISTERIOSIS, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'moderate' },
    // BOTULISM
    { diseaseId: DISEASE_IDS.BOTULISM, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.BOTULISM, speciesId: SPECIES_IDS.HORSE, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.BOTULISM, speciesId: SPECIES_IDS.CHICKEN, susceptibility: 'high' },
    // LEISHMANIOSIS
    { diseaseId: DISEASE_IDS.LEISHMANIOSIS, speciesId: SPECIES_IDS.DOG, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.LEISHMANIOSIS, speciesId: SPECIES_IDS.CAT, susceptibility: 'moderate' },
    // COCCIDIOSIS
    { diseaseId: DISEASE_IDS.COCCIDIOSIS, speciesId: SPECIES_IDS.CHICKEN, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.COCCIDIOSIS, speciesId: SPECIES_IDS.RABBIT, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.COCCIDIOSIS, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'moderate' },
    // Q FEVER
    { diseaseId: DISEASE_IDS.Q_FEVER, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.Q_FEVER, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.Q_FEVER, speciesId: SPECIES_IDS.GOAT, susceptibility: 'high' },
    // THEILERIOSIS
    { diseaseId: DISEASE_IDS.THEILERIOSIS, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.THEILERIOSIS, speciesId: SPECIES_IDS.BUFFALO, susceptibility: 'moderate' },
    // CRIMEAN-CONGO
    { diseaseId: DISEASE_IDS.CRIMEAN_CONGO, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.CRIMEAN_CONGO, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'moderate' },
    // FILARIASIS
    { diseaseId: DISEASE_IDS.FILARIASIS, speciesId: SPECIES_IDS.DOG, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.FILARIASIS, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'moderate' },
    // TRICHINELLOSIS
    { diseaseId: DISEASE_IDS.TRICHINELLOSIS, speciesId: SPECIES_IDS.PIG, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.TRICHINELLOSIS, speciesId: SPECIES_IDS.WILD_PIG, susceptibility: 'high' },
    // PARATUBERCULOSIS
    { diseaseId: DISEASE_IDS.PARATUBERCULOSIS, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.PARATUBERCULOSIS, speciesId: SPECIES_IDS.SHEEP, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.PARATUBERCULOSIS, speciesId: SPECIES_IDS.GOAT, susceptibility: 'moderate' },
    // VESICULAR STOMATITIS
    { diseaseId: DISEASE_IDS.VESICULAR_STOMATITIS, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.VESICULAR_STOMATITIS, speciesId: SPECIES_IDS.HORSE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.VESICULAR_STOMATITIS, speciesId: SPECIES_IDS.PIG, susceptibility: 'moderate' },
    // TULAREMIA
    { diseaseId: DISEASE_IDS.TULAREMIA, speciesId: SPECIES_IDS.RABBIT, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.TULAREMIA, speciesId: SPECIES_IDS.HARE, susceptibility: 'high' },
    // EHD
    { diseaseId: DISEASE_IDS.EHD, speciesId: SPECIES_IDS.CATTLE, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.EHD, speciesId: SPECIES_IDS.DEER, susceptibility: 'high' },
    // MYXOMATOSIS
    { diseaseId: DISEASE_IDS.MYXOMATOSIS, speciesId: SPECIES_IDS.RABBIT, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.MYXOMATOSIS, speciesId: SPECIES_IDS.HARE, susceptibility: 'moderate' },
    // RABBIT HAEMORRHAGIC
    { diseaseId: DISEASE_IDS.RABBIT_HAEMORRHAGIC, speciesId: SPECIES_IDS.RABBIT, susceptibility: 'high' },
    // BEE DISEASES
    { diseaseId: DISEASE_IDS.VARROA_DISEASE, speciesId: SPECIES_IDS.HONEYBEE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.NOSEMA_DISEASE, speciesId: SPECIES_IDS.HONEYBEE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.AFB_DISEASE, speciesId: SPECIES_IDS.HONEYBEE, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.SMALL_HIVE_BEETLE_DISEASE, speciesId: SPECIES_IDS.HONEYBEE, susceptibility: 'high' },
    // AQUATIC DISEASES
    { diseaseId: DISEASE_IDS.EUS, speciesId: SPECIES_IDS.TILAPIA, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.EUS, speciesId: SPECIES_IDS.CATFISH, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.ISA, speciesId: SPECIES_IDS.TILAPIA, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.KHV, speciesId: SPECIES_IDS.TILAPIA, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.VHS, speciesId: SPECIES_IDS.TILAPIA, susceptibility: 'moderate' },
    { diseaseId: DISEASE_IDS.WHITE_SPOT, speciesId: SPECIES_IDS.SHRIMP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.TAURA, speciesId: SPECIES_IDS.SHRIMP, susceptibility: 'high' },
    { diseaseId: DISEASE_IDS.YELLOWHEAD, speciesId: SPECIES_IDS.SHRIMP, susceptibility: 'high' },
  ];

  for (const r of relations) {
    await (prisma as any).refDiseaseSpecies.create({
      data: { diseaseId: r.diseaseId, speciesId: r.speciesId, susceptibility: r.susceptibility ?? null },
    }).catch(() => {});
  }
  console.log(`    ${relations.length} disease-species relations seeded`);
}

async function seedClinicalSigns() {
  console.log('  Seeding clinical signs...');
  const signs: { code: string; name: ReturnType<typeof ml>; diseaseId: string; severity?: string; sortOrder: number }[] = [
    // FMD
    { code: 'FMD_FEVER', name: ml('Fever', 'Fi\u00e8vre'), diseaseId: DISEASE_IDS.FMD, severity: 'moderate', sortOrder: 1 },
    { code: 'FMD_VESICLES_MOUTH', name: ml('Vesicles in mouth', 'V\u00e9sicules buccales'), diseaseId: DISEASE_IDS.FMD, severity: 'high', sortOrder: 2 },
    { code: 'FMD_VESICLES_FEET', name: ml('Vesicles on feet', 'V\u00e9sicules podales'), diseaseId: DISEASE_IDS.FMD, severity: 'high', sortOrder: 3 },
    { code: 'FMD_SALIVATION', name: ml('Excessive salivation', 'Salivation excessive'), diseaseId: DISEASE_IDS.FMD, severity: 'moderate', sortOrder: 4 },
    { code: 'FMD_LAMENESS', name: ml('Lameness', 'Boiterie'), diseaseId: DISEASE_IDS.FMD, severity: 'moderate', sortOrder: 5 },
    { code: 'FMD_MILK_DROP', name: ml('Reduced milk production', 'Baisse de production laiti\u00e8re'), diseaseId: DISEASE_IDS.FMD, severity: 'moderate', sortOrder: 6 },
    // PPR
    { code: 'PPR_FEVER', name: ml('High fever', 'Forte fi\u00e8vre'), diseaseId: DISEASE_IDS.PPR, severity: 'high', sortOrder: 1 },
    { code: 'PPR_NASAL', name: ml('Nasal discharge', 'Jetage nasal'), diseaseId: DISEASE_IDS.PPR, severity: 'moderate', sortOrder: 2 },
    { code: 'PPR_DIARRHEA', name: ml('Diarrhea', 'Diarrh\u00e9e'), diseaseId: DISEASE_IDS.PPR, severity: 'high', sortOrder: 3 },
    { code: 'PPR_EROSIONS', name: ml('Mouth erosions', '\u00c9rosions buccales'), diseaseId: DISEASE_IDS.PPR, severity: 'high', sortOrder: 4 },
    { code: 'PPR_PNEUMONIA', name: ml('Pneumonia', 'Pneumonie'), diseaseId: DISEASE_IDS.PPR, severity: 'high', sortOrder: 5 },
    // ASF
    { code: 'ASF_FEVER', name: ml('High fever', 'Forte fi\u00e8vre'), diseaseId: DISEASE_IDS.ASF, severity: 'high', sortOrder: 1 },
    { code: 'ASF_CYANOSIS', name: ml('Cyanosis', 'Cyanose'), diseaseId: DISEASE_IDS.ASF, severity: 'high', sortOrder: 2 },
    { code: 'ASF_HEMORRHAGES', name: ml('Hemorrhages', 'H\u00e9morragies'), diseaseId: DISEASE_IDS.ASF, severity: 'high', sortOrder: 3 },
    { code: 'ASF_ANOREXIA', name: ml('Loss of appetite', 'Perte d\'app\u00e9tit'), diseaseId: DISEASE_IDS.ASF, severity: 'moderate', sortOrder: 4 },
    { code: 'ASF_DEATH', name: ml('Sudden death', 'Mort subite'), diseaseId: DISEASE_IDS.ASF, severity: 'critical', sortOrder: 5 },
    // HPAI
    { code: 'HPAI_DEATH', name: ml('Sudden death', 'Mort subite'), diseaseId: DISEASE_IDS.HPAI, severity: 'critical', sortOrder: 1 },
    { code: 'HPAI_EGG_DROP', name: ml('Drop in egg production', 'Chute de ponte'), diseaseId: DISEASE_IDS.HPAI, severity: 'high', sortOrder: 2 },
    { code: 'HPAI_SWOLLEN_HEAD', name: ml('Swollen head', 'T\u00eate enfl\u00e9e'), diseaseId: DISEASE_IDS.HPAI, severity: 'high', sortOrder: 3 },
    { code: 'HPAI_RESPIRATORY', name: ml('Respiratory distress', 'D\u00e9tresse respiratoire'), diseaseId: DISEASE_IDS.HPAI, severity: 'high', sortOrder: 4 },
    // RVF
    { code: 'RVF_FEVER', name: ml('High fever', 'Forte fi\u00e8vre'), diseaseId: DISEASE_IDS.RVF, severity: 'high', sortOrder: 1 },
    { code: 'RVF_ABORTION', name: ml('Abortion storm', 'Temp\u00eate d\'avortements'), diseaseId: DISEASE_IDS.RVF, severity: 'critical', sortOrder: 2 },
    { code: 'RVF_HEPATITIS', name: ml('Hepatitis', 'H\u00e9patite'), diseaseId: DISEASE_IDS.RVF, severity: 'high', sortOrder: 3 },
    { code: 'RVF_NEONATAL_DEATH', name: ml('Neonatal mortality', 'Mortalit\u00e9 n\u00e9onatale'), diseaseId: DISEASE_IDS.RVF, severity: 'critical', sortOrder: 4 },
    // RABIES
    { code: 'RABIES_AGGRESSION', name: ml('Aggression/behavior change', 'Agressivit\u00e9/changement de comportement'), diseaseId: DISEASE_IDS.RABIES, severity: 'high', sortOrder: 1 },
    { code: 'RABIES_HYDROPHOBIA', name: ml('Hydrophobia', 'Hydrophobie'), diseaseId: DISEASE_IDS.RABIES, severity: 'high', sortOrder: 2 },
    { code: 'RABIES_PARALYSIS', name: ml('Progressive paralysis', 'Paralysie progressive'), diseaseId: DISEASE_IDS.RABIES, severity: 'critical', sortOrder: 3 },
    // LSD
    { code: 'LSD_NODULES', name: ml('Skin nodules', 'Nodules cutan\u00e9s'), diseaseId: DISEASE_IDS.LSD, severity: 'high', sortOrder: 1 },
    { code: 'LSD_FEVER', name: ml('Fever', 'Fi\u00e8vre'), diseaseId: DISEASE_IDS.LSD, severity: 'moderate', sortOrder: 2 },
    { code: 'LSD_LYMPH', name: ml('Enlarged lymph nodes', 'Hypertrophie des ganglions'), diseaseId: DISEASE_IDS.LSD, severity: 'moderate', sortOrder: 3 },
    // ANTHRAX
    { code: 'ANTHRAX_DEATH', name: ml('Sudden death', 'Mort subite'), diseaseId: DISEASE_IDS.ANTHRAX, severity: 'critical', sortOrder: 1 },
    { code: 'ANTHRAX_BLEEDING', name: ml('Bleeding from orifices', 'Saignement des orifices'), diseaseId: DISEASE_IDS.ANTHRAX, severity: 'critical', sortOrder: 2 },
    { code: 'ANTHRAX_EDEMA', name: ml('Subcutaneous edema', 'Oed\u00e8me sous-cutan\u00e9'), diseaseId: DISEASE_IDS.ANTHRAX, severity: 'high', sortOrder: 3 },
  ];

  for (const s of signs) {
    await (prisma as any).refClinicalSign.create({
      data: {
        code: s.code,
        name: s.name,
        diseaseId: s.diseaseId,
        severity: s.severity ?? null,
        scope: 'continental',
        ownerId: null,
        ownerType: 'continental',
        sortOrder: s.sortOrder,
      },
    }).catch(() => {});
  }
  console.log(`    ${signs.length} clinical signs seeded`);
}

async function seedControlMeasures() {
  console.log('  Seeding control measures (WOAH-aligned)...');
  const measures = [
    { code: 'CWR', name: ml('Control of wildlife reservoirs', 'Contrôle des réservoirs de faune sauvage'), type: 'prevention', sortOrder: 1 },
    { code: 'DD', name: ml('Destruction of infected material', 'Destruction du matériel infecté'), type: 'eradication', sortOrder: 2 },
    { code: 'D', name: ml('Disinfection', 'Désinfection'), type: 'containment', sortOrder: 3 },
    { code: 'DC', name: ml('Disposal of carcass', 'Élimination de carcasses'), type: 'eradication', sortOrder: 4 },
    { code: 'IN', name: ml('Incineration', 'Incinération'), type: 'eradication', sortOrder: 5 },
    { code: 'IS', name: ml('Isolation', 'Isolement'), type: 'containment', sortOrder: 6 },
    { code: 'MSO', name: ml('Modified stamping out', 'Abattage sanitaire modifié'), type: 'eradication', sortOrder: 7 },
    { code: 'MO', name: ml('Monitoring', 'Monitoring'), type: 'surveillance', sortOrder: 8 },
    { code: 'MC', name: ml('Movement control', 'Contrôle des mouvements'), type: 'containment', sortOrder: 9 },
    { code: 'PB', name: ml('Precautions at the borders', 'Précautions aux frontières'), type: 'containment', sortOrder: 10 },
    { code: 'Q', name: ml('Quarantine', 'Quarantaine'), type: 'containment', sortOrder: 11 },
    { code: 'SC', name: ml('Screening', 'Dépistage'), type: 'surveillance', sortOrder: 12 },
    { code: 'S', name: ml('Slaughter', 'Abattage'), type: 'eradication', sortOrder: 13 },
    { code: 'SO', name: ml('Stamping out', 'Abattage sanitaire total'), type: 'eradication', sortOrder: 14 },
    { code: 'SV', name: ml('Surveillance', 'Surveillance'), type: 'surveillance', sortOrder: 15 },
    { code: 'T', name: ml('Treatment', 'Traitement'), type: 'treatment', sortOrder: 16 },
    { code: 'V', name: ml('Vaccination', 'Vaccination'), type: 'prevention', sortOrder: 17 },
    { code: 'VC', name: ml('Vector control', 'Lutte anti-vectorielle'), type: 'prevention', sortOrder: 18 },
    { code: 'ZO', name: ml('Zoning', 'Zonage'), type: 'containment', sortOrder: 19 },
  ];

  for (const m of measures) {
    await (prisma as any).refControlMeasure.create({
      data: { code: m.code, name: m.name, type: m.type, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: m.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${measures.length} control measures seeded`);
}

async function seedSeizureReasons() {
  console.log('  Seeding seizure reasons...');
  const reasons = [
    { code: 'UNFIT', name: ml('Unfit for consumption', 'Impropre \u00e0 la consommation'), category: 'quality', sortOrder: 1 },
    { code: 'DISEASE', name: ml('Diseased animal', 'Animal malade'), category: 'health', sortOrder: 2 },
    { code: 'CONTAMINATED', name: ml('Contaminated', 'Contamin\u00e9'), category: 'safety', sortOrder: 3 },
    { code: 'EXPIRED', name: ml('Expired', 'P\u00e9rim\u00e9'), category: 'quality', sortOrder: 4 },
    { code: 'NO_CERTIFICATE', name: ml('No health certificate', 'Sans certificat sanitaire'), category: 'regulatory', sortOrder: 5 },
    { code: 'RESIDUES', name: ml('Chemical residues', 'R\u00e9sidus chimiques'), category: 'safety', sortOrder: 6 },
    { code: 'PARASITES', name: ml('Parasite infestation', 'Infestation parasitaire'), category: 'health', sortOrder: 7 },
    { code: 'DECOMPOSED', name: ml('Decomposed', 'D\u00e9compos\u00e9'), category: 'quality', sortOrder: 8 },
    { code: 'BRUISED', name: ml('Severely bruised', 'Gravement meurtri'), category: 'quality', sortOrder: 9 },
    { code: 'UNDERAGE', name: ml('Underage animal', 'Animal trop jeune'), category: 'regulatory', sortOrder: 10 },
  ];

  for (const r of reasons) {
    await (prisma as any).refSeizureReason.create({
      data: { code: r.code, name: r.name, category: r.category, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: r.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${reasons.length} seizure reasons seeded`);
}

async function seedSampleTypes() {
  console.log('  Seeding sample types...');
  const types = [
    { code: 'BLOOD', name: ml('Whole blood', 'Sang total'), category: 'liquid', storageTemp: '2-8\u00b0C', sortOrder: 1 },
    { code: 'SERUM', name: ml('Serum', 'S\u00e9rum'), category: 'liquid', storageTemp: '-20\u00b0C', sortOrder: 2 },
    { code: 'TISSUE', name: ml('Tissue sample', '\u00c9chantillon de tissu'), category: 'solid', storageTemp: '-20\u00b0C', sortOrder: 3 },
    { code: 'SWAB_NASAL', name: ml('Nasal swab', '\u00c9couvillon nasal'), category: 'swab', storageTemp: '2-8\u00b0C', sortOrder: 4 },
    { code: 'SWAB_ORAL', name: ml('Oral swab', '\u00c9couvillon oral'), category: 'swab', storageTemp: '2-8\u00b0C', sortOrder: 5 },
    { code: 'SWAB_CLOACAL', name: ml('Cloacal swab', '\u00c9couvillon cloacal'), category: 'swab', storageTemp: '2-8\u00b0C', sortOrder: 6 },
    { code: 'FECES', name: ml('Feces', 'F\u00e8ces'), category: 'solid', storageTemp: '2-8\u00b0C', sortOrder: 7 },
    { code: 'MILK', name: ml('Milk sample', '\u00c9chantillon de lait'), category: 'liquid', storageTemp: '2-8\u00b0C', sortOrder: 8 },
    { code: 'URINE', name: ml('Urine', 'Urine'), category: 'liquid', storageTemp: '2-8\u00b0C', sortOrder: 9 },
    { code: 'BRAIN', name: ml('Brain tissue', 'Tissu c\u00e9r\u00e9bral'), category: 'solid', storageTemp: '-20\u00b0C', sortOrder: 10 },
    { code: 'LYMPH', name: ml('Lymph node', 'Ganglion lymphatique'), category: 'solid', storageTemp: '-20\u00b0C', sortOrder: 11 },
    { code: 'SKIN', name: ml('Skin biopsy', 'Biopsie cutan\u00e9e'), category: 'solid', storageTemp: '-20\u00b0C', sortOrder: 12 },
    { code: 'WATER', name: ml('Water sample', '\u00c9chantillon d\'eau'), category: 'environmental', storageTemp: '2-8\u00b0C', sortOrder: 13 },
    { code: 'FEED', name: ml('Feed sample', '\u00c9chantillon d\'aliment'), category: 'environmental', storageTemp: 'ambient', sortOrder: 14 },
  ];

  for (const t of types) {
    await (prisma as any).refSampleType.create({
      data: { code: t.code, name: t.name, category: t.category, storageTemp: t.storageTemp, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: t.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${types.length} sample types seeded`);
}

async function seedContaminationSources() {
  console.log('  Seeding contamination sources...');
  const sources = [
    { code: 'WATER_CONT', name: ml('Contaminated water', 'Eau contamin\u00e9e'), category: 'environmental', sortOrder: 1 },
    { code: 'FEED_CONT', name: ml('Contaminated feed', 'Aliment contamin\u00e9'), category: 'environmental', sortOrder: 2 },
    { code: 'DIRECT_CONTACT', name: ml('Direct contact', 'Contact direct'), category: 'transmission', sortOrder: 3 },
    { code: 'VECTOR_TICK', name: ml('Tick vector', 'Vecteur tique'), category: 'vector', sortOrder: 4 },
    { code: 'VECTOR_MOSQUITO', name: ml('Mosquito vector', 'Vecteur moustique'), category: 'vector', sortOrder: 5 },
    { code: 'VECTOR_TSETSE', name: ml('Tsetse fly vector', 'Vecteur mouche ts\u00e9-ts\u00e9'), category: 'vector', sortOrder: 6 },
    { code: 'FOMITE', name: ml('Fomite (contaminated object)', 'Fomite (objet contamin\u00e9)'), category: 'transmission', sortOrder: 7 },
    { code: 'AEROSOL', name: ml('Aerosol/airborne', 'A\u00e9rosol/a\u00e9roportation'), category: 'transmission', sortOrder: 8 },
    { code: 'TRADE', name: ml('Trade/movement of animals', 'Commerce/mouvement d\'animaux'), category: 'anthropogenic', sortOrder: 9 },
    { code: 'WILDLIFE_CONTACT', name: ml('Wildlife contact', 'Contact faune sauvage'), category: 'wildlife', sortOrder: 10 },
    { code: 'CROSS_BORDER', name: ml('Cross-border movement', 'Mouvement transfrontalier'), category: 'anthropogenic', sortOrder: 11 },
    { code: 'UNKNOWN', name: ml('Unknown', 'Inconnue'), category: 'unknown', sortOrder: 12 },
  ];

  for (const s of sources) {
    await (prisma as any).refContaminationSource.create({
      data: { code: s.code, name: s.name, category: s.category, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: s.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${sources.length} contamination sources seeded`);
}

async function seedAbattoirs() {
  console.log('  Seeding abattoirs (national scope)...');
  const abattoirs = [
    // Kenya
    { code: 'NRB_CENTRAL', name: ml('Nairobi Central Abattoir', 'Abattoir Central de Nairobi'), type: 'industrial', capacity: 500, latitude: -1.2921, longitude: 36.8219, adminLevel1: 'Nairobi', ownerId: TENANT_IDS.KENYA },
    { code: 'KCO_DAGORETTI', name: ml('Dagoretti Slaughterhouse', 'Abattoir de Dagoretti'), type: 'semi_industrial', capacity: 200, latitude: -1.3000, longitude: 36.7500, adminLevel1: 'Nairobi', ownerId: TENANT_IDS.KENYA },
    { code: 'MSA_ABATTOIR', name: ml('Mombasa Abattoir', 'Abattoir de Mombasa'), type: 'industrial', capacity: 300, latitude: -4.0435, longitude: 39.6682, adminLevel1: 'Coast', ownerId: TENANT_IDS.KENYA },
    // Nigeria
    { code: 'ABJ_ABATTOIR', name: ml('Abuja Main Abattoir', 'Abattoir Principal d\'Abuja'), type: 'industrial', capacity: 400, latitude: 9.0579, longitude: 7.4951, adminLevel1: 'FCT', ownerId: TENANT_IDS.NIGERIA },
    { code: 'LAG_ABATTOIR', name: ml('Lagos Abattoir', 'Abattoir de Lagos'), type: 'industrial', capacity: 350, latitude: 6.5244, longitude: 3.3792, adminLevel1: 'Lagos', ownerId: TENANT_IDS.NIGERIA },
  ];

  for (const a of abattoirs) {
    await (prisma as any).refAbattoir.create({
      data: { code: a.code, name: a.name, type: a.type, capacity: a.capacity, latitude: a.latitude, longitude: a.longitude, adminLevel1: a.adminLevel1, scope: 'national', ownerId: a.ownerId, ownerType: 'country' },
    }).catch(() => {});
  }
  console.log(`    ${abattoirs.length} abattoirs seeded`);
}

async function seedMarkets() {
  console.log('  Seeding markets (national scope)...');
  const markets = [
    { code: 'NRB_CITY_MKT', name: ml('Nairobi City Market', 'March\u00e9 de la ville de Nairobi'), type: 'livestock', frequency: 'weekly', marketDay: 'monday', capacity: 500, latitude: -1.2824, longitude: 36.8260, adminLevel1: 'Nairobi', ownerId: TENANT_IDS.KENYA },
    { code: 'MAAI_MAHIU', name: ml('Maai Mahiu Market', 'March\u00e9 de Maai Mahiu'), type: 'livestock', frequency: 'weekly', marketDay: 'thursday', capacity: 300, latitude: -1.0500, longitude: 36.5833, adminLevel1: 'Nakuru', ownerId: TENANT_IDS.KENYA },
    { code: 'ABJ_MARKET', name: ml('Abuja Livestock Market', 'March\u00e9 de b\u00e9tail d\'Abuja'), type: 'mixed', frequency: 'daily', marketDay: null, capacity: 600, latitude: 9.0579, longitude: 7.4951, adminLevel1: 'FCT', ownerId: TENANT_IDS.NIGERIA },
  ];

  for (const m of markets) {
    await (prisma as any).refMarket.create({
      data: { code: m.code, name: m.name, type: m.type, frequency: m.frequency, marketDay: m.marketDay, capacity: m.capacity, latitude: m.latitude, longitude: m.longitude, adminLevel1: m.adminLevel1, scope: 'national', ownerId: m.ownerId, ownerType: 'country' },
    }).catch(() => {});
  }
  console.log(`    ${markets.length} markets seeded`);
}

async function seedCheckpoints() {
  console.log('  Seeding checkpoints (national scope)...');
  const checkpoints = [
    { code: 'NAMANGA', name: ml('Namanga Border Post', 'Poste frontalier de Namanga'), type: 'border', borderWith: 'TZ', latitude: -2.5500, longitude: 36.7833, ownerId: TENANT_IDS.KENYA },
    { code: 'BUSIA', name: ml('Busia Border Post', 'Poste frontalier de Busia'), type: 'border', borderWith: 'UG', latitude: 0.4608, longitude: 34.1108, ownerId: TENANT_IDS.KENYA },
    { code: 'MOYALE', name: ml('Moyale Border Post', 'Poste frontalier de Moyale'), type: 'border', borderWith: 'ET', latitude: 3.5167, longitude: 39.0500, ownerId: TENANT_IDS.KENYA },
    { code: 'SEME', name: ml('Seme Border Post', 'Poste frontalier de Seme'), type: 'border', borderWith: 'BJ', latitude: 6.4000, longitude: 2.7167, ownerId: TENANT_IDS.NIGERIA },
    { code: 'IDIROKO', name: ml('Idiroko Border Post', 'Poste frontalier d\'Idiroko'), type: 'border', borderWith: 'BJ', latitude: 6.9500, longitude: 2.7333, ownerId: TENANT_IDS.NIGERIA },
  ];

  for (const c of checkpoints) {
    await (prisma as any).refCheckpoint.create({
      data: { code: c.code, name: c.name, type: c.type, borderWith: c.borderWith, latitude: c.latitude, longitude: c.longitude, scope: 'national', ownerId: c.ownerId, ownerType: 'country' },
    }).catch(() => {});
  }
  console.log(`    ${checkpoints.length} checkpoints seeded`);
}

async function seedProductionSystems() {
  console.log('  Seeding production systems...');
  const systems = [
    { code: 'EXTENSIVE_PASTORAL', name: ml('Extensive Pastoral', 'Pastoral extensif', 'Pastoral extensivo', '\u0631\u0639\u0648\u064a \u0645\u0648\u0633\u0639'), category: 'extensive', sortOrder: 1 },
    { code: 'EXTENSIVE_RANCHING', name: ml('Extensive Ranching', 'Ranching extensif', 'Ranching extensivo', '\u062a\u0631\u0628\u064a\u0629 \u0645\u0648\u0633\u0639\u0629'), category: 'extensive', sortOrder: 2 },
    { code: 'AGROPASTORAL', name: ml('Agropastoral', 'Agropastoral', 'Agropastoril', '\u0632\u0631\u0627\u0639\u064a \u0631\u0639\u0648\u064a'), category: 'mixed', sortOrder: 3 },
    { code: 'MIXED_CROP_LIVESTOCK', name: ml('Mixed Crop-Livestock', 'Mixte culture-\u00e9levage', 'Misto lavoura-pecu\u00e1ria', '\u0645\u062e\u062a\u0644\u0637 \u0632\u0631\u0627\u0639\u0629-\u062b\u0631\u0648\u0629 \u062d\u064a\u0648\u0627\u0646\u064a\u0629'), category: 'mixed', sortOrder: 4 },
    { code: 'SEMI_INTENSIVE', name: ml('Semi-Intensive', 'Semi-intensif', 'Semi-intensivo', '\u0634\u0628\u0647 \u0645\u0643\u062b\u0641'), category: 'semi_intensive', sortOrder: 5 },
    { code: 'INTENSIVE_DAIRY', name: ml('Intensive Dairy', '\u00c9levage laitier intensif', 'Leiteiro intensivo', '\u0623\u0644\u0628\u0627\u0646 \u0645\u0643\u062b\u0641'), category: 'intensive', sortOrder: 6 },
    { code: 'INTENSIVE_FEEDLOT', name: ml('Intensive Feedlot', 'Engraissement intensif', 'Confinamento intensivo', '\u062a\u0633\u0645\u064a\u0646 \u0645\u0643\u062b\u0641'), category: 'intensive', sortOrder: 7 },
    { code: 'INTENSIVE_POULTRY', name: ml('Intensive Poultry', 'Aviculture intensive', 'Avicultura intensiva', '\u062f\u0648\u0627\u062c\u0646 \u0645\u0643\u062b\u0641'), category: 'intensive', sortOrder: 8 },
    { code: 'BACKYARD', name: ml('Backyard / Smallholder', '\u00c9levage familial', 'Quintal / Pequeno produtor', '\u062a\u0631\u0628\u064a\u0629 \u0645\u0646\u0632\u0644\u064a\u0629'), category: 'extensive', sortOrder: 9 },
    { code: 'PERIURBAN', name: ml('Peri-urban', 'P\u00e9riurbain', 'Periurbano', '\u0634\u0628\u0647 \u062d\u0636\u0631\u064a'), category: 'semi_intensive', sortOrder: 10 },
    { code: 'NOMADIC', name: ml('Nomadic', 'Nomade', 'N\u00f4made', '\u0631\u062d\u0644'), category: 'extensive', sortOrder: 11 },
    { code: 'TRANSHUMANT', name: ml('Transhumant', 'Transhumant', 'Transumante', '\u0631\u0639\u064a \u0645\u062a\u0646\u0642\u0644'), category: 'extensive', sortOrder: 12 },
    { code: 'AQUACULTURE_POND', name: ml('Aquaculture — Pond', 'Aquaculture — \u00c9tang', 'Aquicultura — Tanque', '\u0627\u0633\u062a\u0632\u0631\u0627\u0639 \u0645\u0627\u0626\u064a \u2014 \u0623\u062d\u0648\u0627\u0636'), category: 'intensive', sortOrder: 13 },
    { code: 'AQUACULTURE_CAGE', name: ml('Aquaculture — Cage', 'Aquaculture — Cage', 'Aquicultura — Gaiola', '\u0627\u0633\u062a\u0632\u0631\u0627\u0639 \u0645\u0627\u0626\u064a \u2014 \u0623\u0642\u0641\u0627\u0635'), category: 'intensive', sortOrder: 14 },
    { code: 'APICULTURE_TRAD', name: ml('Traditional Beekeeping', 'Apiculture traditionnelle', 'Apicultura tradicional', '\u062a\u0631\u0628\u064a\u0629 \u0646\u062d\u0644 \u062a\u0642\u0644\u064a\u062f\u064a\u0629'), category: 'extensive', sortOrder: 15 },
    { code: 'APICULTURE_MODERN', name: ml('Modern Beekeeping', 'Apiculture moderne', 'Apicultura moderna', '\u062a\u0631\u0628\u064a\u0629 \u0646\u062d\u0644 \u062d\u062f\u064a\u062b\u0629'), category: 'semi_intensive', sortOrder: 16 },
  ];

  for (const s of systems) {
    await (prisma as any).refProductionSystem.create({
      data: { code: s.code, name: s.name, category: s.category, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: s.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${systems.length} production systems seeded`);
}

// ══════════════════════════════════════════════════════════════
// Phase 2 — 20 new reference types
// ══════════════════════════════════════════════════════════════

async function seedBreeds() {
  console.log('  Seeding breeds...');
  const breeds = [
    { code: 'ANKOLE', name: ml('Ankole Longhorn', 'Ankole Longhorn'), speciesId: SPECIES_IDS.CATTLE, origin: 'East Africa', purpose: 'dual', sortOrder: 1 },
    { code: 'ZEBU_EAST', name: ml('East African Zebu', 'Zébu d\'Afrique de l\'Est'), speciesId: SPECIES_IDS.CATTLE, origin: 'East Africa', purpose: 'dual', sortOrder: 2 },
    { code: 'NDAMA', name: ml('N\'Dama', 'N\'Dama'), speciesId: SPECIES_IDS.CATTLE, origin: 'West Africa', purpose: 'meat', sortOrder: 3 },
    { code: 'BORAN', name: ml('Boran', 'Boran'), speciesId: SPECIES_IDS.CATTLE, origin: 'East Africa', purpose: 'meat', sortOrder: 4 },
    { code: 'SAHIWAL', name: ml('Sahiwal', 'Sahiwal'), speciesId: SPECIES_IDS.CATTLE, origin: 'South Asia', purpose: 'dairy', sortOrder: 5 },
    { code: 'HOLSTEIN_FRIESIAN', name: ml('Holstein Friesian', 'Holstein Frisonne'), speciesId: SPECIES_IDS.CATTLE, origin: 'Europe', purpose: 'dairy', sortOrder: 6 },
    { code: 'JERSEY', name: ml('Jersey', 'Jersey'), speciesId: SPECIES_IDS.CATTLE, origin: 'Europe', purpose: 'dairy', sortOrder: 7 },
    { code: 'BORGOU', name: ml('Borgou', 'Borgou'), speciesId: SPECIES_IDS.CATTLE, origin: 'West Africa', purpose: 'dual', sortOrder: 8 },
    { code: 'KURI', name: ml('Kuri', 'Kouri'), speciesId: SPECIES_IDS.CATTLE, origin: 'Central Africa', purpose: 'dual', sortOrder: 9 },
    { code: 'AFRIKANDER', name: ml('Afrikander', 'Afrikander'), speciesId: SPECIES_IDS.CATTLE, origin: 'Southern Africa', purpose: 'meat', sortOrder: 10 },
    { code: 'RED_MAASAI', name: ml('Red Maasai', 'Rouge Massaï'), speciesId: SPECIES_IDS.SHEEP, origin: 'East Africa', purpose: 'meat', sortOrder: 11 },
    { code: 'DJALLONKE', name: ml('Djallonké', 'Djallonké'), speciesId: SPECIES_IDS.SHEEP, origin: 'West Africa', purpose: 'meat', sortOrder: 12 },
    { code: 'DORPER', name: ml('Dorper', 'Dorper'), speciesId: SPECIES_IDS.SHEEP, origin: 'Southern Africa', purpose: 'meat', sortOrder: 13 },
    { code: 'BLACKHEAD_PERSIAN', name: ml('Blackhead Persian', 'Persan à Tête Noire'), speciesId: SPECIES_IDS.SHEEP, origin: 'Southern Africa', purpose: 'meat', sortOrder: 14 },
    { code: 'SMALL_EAST_AFRICAN', name: ml('Small East African Goat', 'Petite chèvre d\'Afrique de l\'Est'), speciesId: SPECIES_IDS.GOAT, origin: 'East Africa', purpose: 'dual', sortOrder: 15 },
    { code: 'BOER', name: ml('Boer Goat', 'Chèvre Boer'), speciesId: SPECIES_IDS.GOAT, origin: 'Southern Africa', purpose: 'meat', sortOrder: 16 },
    { code: 'SAANEN', name: ml('Saanen', 'Saanen'), speciesId: SPECIES_IDS.GOAT, origin: 'Europe', purpose: 'dairy', sortOrder: 17 },
    { code: 'KIGEZI', name: ml('Kigezi', 'Kigezi'), speciesId: SPECIES_IDS.GOAT, origin: 'Central Africa', purpose: 'dual', sortOrder: 18 },
    { code: 'KUROILER', name: ml('Kuroiler', 'Kuroiler'), speciesId: SPECIES_IDS.CHICKEN, origin: 'South Asia', purpose: 'dual', sortOrder: 19 },
    { code: 'INDIGENOUS_CHICKEN', name: ml('Indigenous Chicken', 'Poulet local'), speciesId: SPECIES_IDS.CHICKEN, origin: 'Africa', purpose: 'dual', sortOrder: 20 },
    // Phase 4 — Additional important African breeds from References-data.txt
    // Cattle
    { code: 'WHITE_FULANI', name: ml('White Fulani (Bunaji)', 'Peul blanc (Bunaji)'), speciesId: SPECIES_IDS.CATTLE, origin: 'West Africa', purpose: 'dual', sortOrder: 21 },
    { code: 'SOKOTO_GUDALI', name: ml('Sokoto Gudali', 'Sokoto Gudali'), speciesId: SPECIES_IDS.CATTLE, origin: 'West Africa', purpose: 'meat', sortOrder: 22 },
    { code: 'BAOULÉ', name: ml('Baoulé', 'Baoulé'), speciesId: SPECIES_IDS.CATTLE, origin: 'West Africa', purpose: 'dual', sortOrder: 23 },
    { code: 'AZAWAK', name: ml('Azawak', 'Azawak'), speciesId: SPECIES_IDS.CATTLE, origin: 'West Africa', purpose: 'dual', sortOrder: 24 },
    { code: 'MAURE', name: ml('Maure', 'Maure'), speciesId: SPECIES_IDS.CATTLE, origin: 'West Africa', purpose: 'dual', sortOrder: 25 },
    { code: 'NGUNI', name: ml('Nguni', 'Nguni'), speciesId: SPECIES_IDS.CATTLE, origin: 'Southern Africa', purpose: 'dual', sortOrder: 26 },
    { code: 'TSWANA', name: ml('Tswana', 'Tswana'), speciesId: SPECIES_IDS.CATTLE, origin: 'Southern Africa', purpose: 'meat', sortOrder: 27 },
    { code: 'MPWAPWA', name: ml('Mpwapwa', 'Mpwapwa'), speciesId: SPECIES_IDS.CATTLE, origin: 'East Africa', purpose: 'dairy', sortOrder: 28 },
    { code: 'KENANA', name: ml('Kenana', 'Kenana'), speciesId: SPECIES_IDS.CATTLE, origin: 'East Africa', purpose: 'dairy', sortOrder: 29 },
    { code: 'SHEKO', name: ml('Sheko', 'Sheko'), speciesId: SPECIES_IDS.CATTLE, origin: 'East Africa', purpose: 'dual', sortOrder: 30 },
    // Sheep
    { code: 'UDA', name: ml('Uda', 'Ouda'), speciesId: SPECIES_IDS.SHEEP, origin: 'West Africa', purpose: 'dual', sortOrder: 31 },
    { code: 'BALAMI', name: ml('Balami', 'Balami'), speciesId: SPECIES_IDS.SHEEP, origin: 'West Africa', purpose: 'meat', sortOrder: 32 },
    { code: 'BLACKHEAD_OGADEN', name: ml('Blackhead Somali / Ogaden', 'Somali à tête noire'), speciesId: SPECIES_IDS.SHEEP, origin: 'East Africa', purpose: 'meat', sortOrder: 33 },
    { code: 'MENZ', name: ml('Menz', 'Menz'), speciesId: SPECIES_IDS.SHEEP, origin: 'East Africa', purpose: 'dual', sortOrder: 34 },
    { code: 'DAMARA', name: ml('Damara', 'Damara'), speciesId: SPECIES_IDS.SHEEP, origin: 'Southern Africa', purpose: 'meat', sortOrder: 35 },
    // Goat
    { code: 'RED_SOKOTO', name: ml('Red Sokoto (Maradi)', 'Rousse de Sokoto (Maradi)'), speciesId: SPECIES_IDS.GOAT, origin: 'West Africa', purpose: 'dual', sortOrder: 36 },
    { code: 'PYGMY', name: ml('West African Dwarf / Pygmy', 'Naine d\'Afrique de l\'Ouest'), speciesId: SPECIES_IDS.GOAT, origin: 'West Africa', purpose: 'meat', sortOrder: 37 },
    { code: 'GALLA', name: ml('Galla', 'Galla'), speciesId: SPECIES_IDS.GOAT, origin: 'East Africa', purpose: 'dual', sortOrder: 38 },
    { code: 'SAVANNA_GOAT', name: ml('Savanna', 'Savanna'), speciesId: SPECIES_IDS.GOAT, origin: 'Southern Africa', purpose: 'meat', sortOrder: 39 },
    // Pig
    { code: 'LARGE_WHITE', name: ml('Large White', 'Large White'), speciesId: SPECIES_IDS.PIG, origin: 'Europe', purpose: 'meat', sortOrder: 40 },
    { code: 'LANDRACE_PIG', name: ml('Landrace', 'Landrace'), speciesId: SPECIES_IDS.PIG, origin: 'Europe', purpose: 'meat', sortOrder: 41 },
    { code: 'ASHANTI_BLACK', name: ml('Ashanti Black', 'Noir Ashanti'), speciesId: SPECIES_IDS.PIG, origin: 'West Africa', purpose: 'meat', sortOrder: 42 },
    // Camel
    { code: 'SAHEL_CAMEL', name: ml('Sahel Type', 'Type Sahélien'), speciesId: SPECIES_IDS.DROMEDARY, origin: 'West Africa', purpose: 'dual', sortOrder: 43 },
    { code: 'SOMALI_CAMEL', name: ml('Somali / Hori', 'Somali / Hori'), speciesId: SPECIES_IDS.DROMEDARY, origin: 'East Africa', purpose: 'dairy', sortOrder: 44 },
    // Poultry
    { code: 'RHODE_ISLAND', name: ml('Rhode Island Red', 'Rhode Island Red'), speciesId: SPECIES_IDS.CHICKEN, origin: 'North America', purpose: 'dual', sortOrder: 45 },
    { code: 'LEGHORN', name: ml('Leghorn', 'Leghorn'), speciesId: SPECIES_IDS.CHICKEN, origin: 'Europe', purpose: 'egg', sortOrder: 46 },
    { code: 'BROILER_ROSS', name: ml('Broiler (Ross/Cobb)', 'Poulet de chair (Ross/Cobb)'), speciesId: SPECIES_IDS.CHICKEN, origin: 'International', purpose: 'meat', sortOrder: 47 },
  ];

  for (const b of breeds) {
    await (prisma as any).refBreed.create({
      data: { code: b.code, name: b.name, speciesId: b.speciesId, origin: b.origin, purpose: b.purpose, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: b.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${breeds.length} breeds seeded`);
}

async function seedVaccineTypes() {
  console.log('  Seeding vaccine types...');
  const vaccines = [
    { code: 'FMD_INACT_TRIVAL', name: ml('FMD Trivalent Inactivated', 'FA Trivalent Inactivé'), diseaseId: DISEASE_IDS.FMD, vaccineClass: 'inactivated', manufacturer: 'Various', routeOfAdmin: 'intramuscular', dosesRequired: 2, sortOrder: 1 },
    { code: 'PPR_LIVE_ATTEN', name: ml('PPR Live Attenuated (Nigeria 75/1)', 'PPR Vivant Atténué (Nigeria 75/1)'), diseaseId: DISEASE_IDS.PPR, vaccineClass: 'live', manufacturer: 'Various', routeOfAdmin: 'subcutaneous', dosesRequired: 1, sortOrder: 2 },
    { code: 'CBPP_T1_44', name: ml('CBPP T1/44', 'PPCB T1/44'), diseaseId: DISEASE_IDS.CBPP, vaccineClass: 'live', manufacturer: 'NVI', routeOfAdmin: 'subcutaneous', dosesRequired: 1, sortOrder: 3 },
    { code: 'ND_LASOTA', name: ml('Newcastle LaSota', 'Newcastle LaSota'), diseaseId: DISEASE_IDS.ND, vaccineClass: 'live', manufacturer: 'Various', routeOfAdmin: 'eye-drop', dosesRequired: 2, sortOrder: 4 },
    { code: 'ND_I2', name: ml('Newcastle I-2 Thermotolerant', 'Newcastle I-2 Thermotolérant'), diseaseId: DISEASE_IDS.ND, vaccineClass: 'live', manufacturer: 'ACIAR', routeOfAdmin: 'eye-drop', dosesRequired: 1, sortOrder: 5 },
    { code: 'RVF_CLONE_13', name: ml('RVF Clone 13', 'FVR Clone 13'), diseaseId: DISEASE_IDS.RVF, vaccineClass: 'live', manufacturer: 'Onderstepoort', routeOfAdmin: 'subcutaneous', dosesRequired: 1, sortOrder: 6 },
    { code: 'LSD_NEETHLING', name: ml('LSD Neethling', 'DN Neethling'), diseaseId: DISEASE_IDS.LSD, vaccineClass: 'live', manufacturer: 'Onderstepoort', routeOfAdmin: 'subcutaneous', dosesRequired: 1, sortOrder: 7 },
    { code: 'RABIES_INACT', name: ml('Rabies Inactivated', 'Rage Inactivé'), diseaseId: DISEASE_IDS.RABIES, vaccineClass: 'inactivated', manufacturer: 'Various', routeOfAdmin: 'intramuscular', dosesRequired: 1, sortOrder: 8 },
    { code: 'ANTHRAX_STERNE', name: ml('Anthrax Sterne 34F2', 'Charbon Sterne 34F2'), diseaseId: DISEASE_IDS.ANTHRAX, vaccineClass: 'live', manufacturer: 'Various', routeOfAdmin: 'subcutaneous', dosesRequired: 1, sortOrder: 9 },
    { code: 'BRUCELLA_S19', name: ml('Brucella S19', 'Brucella S19'), diseaseId: DISEASE_IDS.BRUCELLA, vaccineClass: 'live', manufacturer: 'Various', routeOfAdmin: 'subcutaneous', dosesRequired: 1, sortOrder: 10 },
    { code: 'BLACKLEG_VACC', name: ml('Blackleg Vaccine', 'Vaccin Charbon Symptomatique'), diseaseId: DISEASE_IDS.BLACKLEG, vaccineClass: 'inactivated', manufacturer: 'Various', routeOfAdmin: 'subcutaneous', dosesRequired: 2, sortOrder: 11 },
    { code: 'SHEEP_POX_VACC', name: ml('Sheep Pox Vaccine', 'Vaccin Clavelée'), diseaseId: DISEASE_IDS.SHEEP_POX, vaccineClass: 'live', manufacturer: 'Various', routeOfAdmin: 'subcutaneous', dosesRequired: 1, sortOrder: 12 },
    { code: 'AHS_VACC', name: ml('AHS Polyvalent', 'PE Polyvalent'), diseaseId: DISEASE_IDS.AHS, vaccineClass: 'live', manufacturer: 'Onderstepoort', routeOfAdmin: 'subcutaneous', dosesRequired: 1, sortOrder: 13 },
    { code: 'HPAI_INACT', name: ml('HPAI H5 Inactivated', 'IAHP H5 Inactivé'), diseaseId: DISEASE_IDS.HPAI, vaccineClass: 'inactivated', manufacturer: 'Various', routeOfAdmin: 'intramuscular', dosesRequired: 2, sortOrder: 14 },
    { code: 'ECF_ITM', name: ml('ECF Infection & Treatment', 'ECF Infection & Traitement'), diseaseId: DISEASE_IDS.ECF, vaccineClass: 'live', manufacturer: 'ILRI', routeOfAdmin: 'subcutaneous', dosesRequired: 1, sortOrder: 15 },
  ];

  for (const v of vaccines) {
    await (prisma as any).refVaccineType.create({
      data: { code: v.code, name: v.name, diseaseId: v.diseaseId, vaccineClass: v.vaccineClass, manufacturer: v.manufacturer, routeOfAdmin: v.routeOfAdmin, dosesRequired: v.dosesRequired, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: v.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${vaccines.length} vaccine types seeded`);
}

async function seedTestTypes() {
  console.log('  Seeding test types...');
  const tests = [
    { code: 'ELISA', name: ml('ELISA', 'ELISA'), testCategory: 'serology', turnaroundDays: 1, sortOrder: 1 },
    { code: 'PCR', name: ml('Polymerase Chain Reaction', 'Réaction en Chaîne par Polymérase'), testCategory: 'pcr', turnaroundDays: 1, sortOrder: 2 },
    { code: 'RT_PCR', name: ml('Real-Time PCR', 'PCR en Temps Réel'), testCategory: 'pcr', turnaroundDays: 1, sortOrder: 3 },
    { code: 'CFT', name: ml('Complement Fixation Test', 'Test de Fixation du Complément'), testCategory: 'serology', turnaroundDays: 2, sortOrder: 4 },
    { code: 'RBT', name: ml('Rose Bengal Test', 'Test au Rose Bengale'), testCategory: 'serology', turnaroundDays: 0, sortOrder: 5 },
    { code: 'FAT', name: ml('Fluorescent Antibody Test', 'Test d\'Anticorps Fluorescent'), testCategory: 'antigen', turnaroundDays: 1, sortOrder: 6 },
    { code: 'VIRUS_ISOLATION', name: ml('Virus Isolation', 'Isolement Viral'), testCategory: 'culture', turnaroundDays: 7, sortOrder: 7 },
    { code: 'BACTERIAL_CULTURE', name: ml('Bacterial Culture', 'Culture Bactérienne'), testCategory: 'culture', turnaroundDays: 5, sortOrder: 8 },
    { code: 'MICROSCOPY', name: ml('Microscopy', 'Microscopie'), testCategory: 'microscopy', turnaroundDays: 0, sortOrder: 9 },
    { code: 'RAPID_AG', name: ml('Rapid Antigen Test', 'Test Antigénique Rapide'), testCategory: 'rapid', turnaroundDays: 0, sortOrder: 10 },
    { code: 'LATERAL_FLOW', name: ml('Lateral Flow Assay', 'Test à Flux Latéral'), testCategory: 'rapid', turnaroundDays: 0, sortOrder: 11 },
    { code: 'AGAR_GEL', name: ml('Agar Gel Immunodiffusion', 'Immunodiffusion en Gélose'), testCategory: 'serology', turnaroundDays: 2, sortOrder: 12 },
  ];

  for (const t of tests) {
    await (prisma as any).refTestType.create({
      data: { code: t.code, name: t.name, testCategory: t.testCategory, turnaroundDays: t.turnaroundDays, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: t.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${tests.length} test types seeded`);
}

async function seedLabs() {
  console.log('  Seeding laboratories...');
  const labs = [
    { code: 'KE_CVL', name: ml('Central Veterinary Laboratory - Kabete', 'Laboratoire Vétérinaire Central - Kabete'), labLevel: 'national', bslLevel: 3, accreditation: 'ISO 17025', latitude: -1.2667, longitude: 36.7333, ownerId: TENANT_IDS.KENYA, sortOrder: 1 },
    { code: 'KE_KARI', name: ml('KALRO Veterinary Research', 'Recherche Vétérinaire KALRO'), labLevel: 'reference', bslLevel: 3, accreditation: 'ISO 17025', latitude: -1.2500, longitude: 36.7400, ownerId: TENANT_IDS.KENYA, sortOrder: 2 },
    { code: 'NG_NVRI', name: ml('National Veterinary Research Institute - Vom', 'Institut National de Recherche Vétérinaire - Vom'), labLevel: 'reference', bslLevel: 3, accreditation: 'ISO 17025', latitude: 9.7167, longitude: 8.7833, ownerId: TENANT_IDS.NIGERIA, sortOrder: 3 },
    { code: 'NG_FDVS', name: ml('Federal Department of Veterinary Services Lab', 'Lab du Département Fédéral des Services Vétérinaires'), labLevel: 'national', bslLevel: 2, accreditation: null, latitude: 9.0579, longitude: 7.4951, ownerId: TENANT_IDS.NIGERIA, sortOrder: 4 },
    { code: 'ET_NAHDIC', name: ml('NAHDIC - National Animal Health Diagnostic', 'NAHDIC - Diagnostic de Santé Animale'), labLevel: 'reference', bslLevel: 3, accreditation: 'ISO 17025', latitude: 9.0107, longitude: 38.7469, ownerId: TENANT_IDS.ETHIOPIA, sortOrder: 5 },
    { code: 'ET_NVI', name: ml('National Veterinary Institute - Debre Zeit', 'Institut Vétérinaire National - Debre Zeit'), labLevel: 'national', bslLevel: 3, accreditation: null, latitude: 8.7500, longitude: 38.9833, ownerId: TENANT_IDS.ETHIOPIA, sortOrder: 6 },
    { code: 'SN_LNERV', name: ml('LNERV - Laboratoire National d\'Élevage', 'LNERV - National Livestock Laboratory'), labLevel: 'national', bslLevel: 2, accreditation: null, latitude: 14.6928, longitude: -17.4467, ownerId: TENANT_IDS.SENEGAL, sortOrder: 7 },
    { code: 'SN_ISRA', name: ml('ISRA Veterinary Lab', 'Laboratoire Vétérinaire ISRA'), labLevel: 'reference', bslLevel: 3, accreditation: 'ISO 17025', latitude: 14.7167, longitude: -17.4500, ownerId: TENANT_IDS.SENEGAL, sortOrder: 8 },
  ];

  for (const l of labs) {
    await (prisma as any).refLab.create({
      data: { code: l.code, name: l.name, labLevel: l.labLevel, bslLevel: l.bslLevel, accreditation: l.accreditation, latitude: l.latitude, longitude: l.longitude, scope: 'national', ownerId: l.ownerId, ownerType: 'country', sortOrder: l.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${labs.length} laboratories seeded`);
}

async function seedLivestockProducts() {
  console.log('  Seeding livestock products (51 from WOAH reference)...');
  const products = [
    // Meat & carcass
    { code: 'MEAT', name: ml('Meat', 'Viande'), productCategory: 'meat', sortOrder: 1 },
    { code: 'FRESH_MEAT', name: ml('Fresh Meat', 'Viande Fraîche'), productCategory: 'meat', sortOrder: 2 },
    { code: 'CHILLED_MEAT', name: ml('Chilled Meat', 'Viande Réfrigérée'), productCategory: 'meat', sortOrder: 3 },
    { code: 'DRIED_MEAT', name: ml('Dried Meat', 'Viande Séchée'), productCategory: 'meat', sortOrder: 4 },
    { code: 'SAUSAGES', name: ml('Sausages', 'Saucisses'), productCategory: 'meat', sortOrder: 5 },
    { code: 'OFFALS', name: ml('Offals', 'Abats'), productCategory: 'meat', sortOrder: 6 },
    // Dairy
    { code: 'MILK', name: ml('Milk', 'Lait'), productCategory: 'dairy', sortOrder: 7 },
    { code: 'MILK_WHOLE', name: ml('Whole Milk', 'Lait Entier'), productCategory: 'dairy', sortOrder: 8 },
    { code: 'MILK_SKIMMED', name: ml('Skimmed Milk', 'Lait Écrémé'), productCategory: 'dairy', sortOrder: 9 },
    { code: 'MILK_POWDER', name: ml('Milk Powder', 'Lait en Poudre'), productCategory: 'dairy', sortOrder: 10 },
    { code: 'MILK_CONDENSED', name: ml('Condensed Milk', 'Lait Concentré'), productCategory: 'dairy', sortOrder: 11 },
    { code: 'MILK_EVAPORATED', name: ml('Evaporated Milk', 'Lait Évaporé'), productCategory: 'dairy', sortOrder: 12 },
    { code: 'BUTTERMILK', name: ml('Buttermilk', 'Babeurre'), productCategory: 'dairy', sortOrder: 13 },
    { code: 'BUTTER', name: ml('Butter', 'Beurre'), productCategory: 'dairy', sortOrder: 14 },
    { code: 'CHEESE', name: ml('Cheese', 'Fromage'), productCategory: 'dairy', sortOrder: 15 },
    { code: 'WHEY', name: ml('Whey', 'Lactosérum'), productCategory: 'dairy', sortOrder: 16 },
    // Eggs & reproduction
    { code: 'EGG_ALBUMEN', name: ml('Egg Albumen', 'Blanc d\'Œuf'), productCategory: 'egg', sortOrder: 17 },
    { code: 'EGG_YOLK', name: ml('Egg Yolk', 'Jaune d\'Œuf'), productCategory: 'egg', sortOrder: 18 },
    { code: 'EMBRYO', name: ml('Embryo', 'Embryon'), productCategory: 'reproduction', sortOrder: 19 },
    { code: 'SEMEN', name: ml('Semen', 'Semence'), productCategory: 'reproduction', sortOrder: 20 },
    { code: 'OOCYTES', name: ml('Oocytes', 'Ovocytes'), productCategory: 'reproduction', sortOrder: 21 },
    // Hides & fibre
    { code: 'HIDES', name: ml('Hides', 'Cuirs'), productCategory: 'hide', sortOrder: 22 },
    { code: 'HIDES_SKINS_FUR', name: ml('Hides/Skins/Fur', 'Cuirs/Peaux/Fourrure'), productCategory: 'hide', sortOrder: 23 },
    { code: 'SKIN', name: ml('Skin', 'Peau'), productCategory: 'hide', sortOrder: 24 },
    { code: 'LEATHER', name: ml('Leather', 'Cuir'), productCategory: 'hide', sortOrder: 25 },
    { code: 'WOOL_FIBRE', name: ml('Wool/Fibre', 'Laine/Fibre'), productCategory: 'fibre', sortOrder: 26 },
    { code: 'MOHAIR', name: ml('Mohair', 'Mohair'), productCategory: 'fibre', sortOrder: 27 },
    { code: 'FEATHERS', name: ml('Feathers', 'Plumes'), productCategory: 'fibre', sortOrder: 28 },
    { code: 'HAIR_BRISTLES', name: ml('Hair/Bristles', 'Poils/Soies'), productCategory: 'fibre', sortOrder: 29 },
    // Apiculture
    { code: 'HONEY', name: ml('Honey', 'Miel'), productCategory: 'apiculture', sortOrder: 30 },
    { code: 'BEESWAX', name: ml('Beeswax', 'Cire d\'Abeille'), productCategory: 'apiculture', sortOrder: 31 },
    { code: 'PROPOLIS', name: ml('Propolis', 'Propolis'), productCategory: 'apiculture', sortOrder: 32 },
    { code: 'ROYAL_JELLY', name: ml('Royal Jelly', 'Gelée Royale'), productCategory: 'apiculture', sortOrder: 33 },
    { code: 'BEE_BREAD', name: ml('Bee Bread', 'Pain d\'Abeille'), productCategory: 'apiculture', sortOrder: 34 },
    { code: 'VENOM', name: ml('Venom', 'Venin'), productCategory: 'apiculture', sortOrder: 35 },
    { code: 'POLLINATION', name: ml('Pollination', 'Pollinisation'), productCategory: 'apiculture', sortOrder: 36 },
    { code: 'LIVE_COLONIES', name: ml('Live Colonies', 'Colonies Vivantes'), productCategory: 'apiculture', sortOrder: 37 },
    // By-products & services
    { code: 'BONES_HOOVES', name: ml('Bones & Hooves', 'Os & Sabots'), productCategory: 'by-product', sortOrder: 38 },
    { code: 'BONES_HORNS', name: ml('Bones & Horn Corn Cores', 'Os & Cornillons'), productCategory: 'by-product', sortOrder: 39 },
    { code: 'FAT_TALLOW', name: ml('Fat/Tallow', 'Graisse/Suif'), productCategory: 'by-product', sortOrder: 40 },
    { code: 'MANURE', name: ml('Manure', 'Fumier'), productCategory: 'by-product', sortOrder: 41 },
    { code: 'BIOGAS', name: ml('Biogas', 'Biogaz'), productCategory: 'by-product', sortOrder: 42 },
    // Live animal
    { code: 'LIVE_ANIMAL', name: ml('Live Animal', 'Animal Vivant'), productCategory: 'live', sortOrder: 43 },
    { code: 'LIVE_BIRD', name: ml('Live Bird', 'Oiseau Vivant'), productCategory: 'live', sortOrder: 44 },
    // Services
    { code: 'DRAUGHT', name: ml('Draught', 'Traction'), productCategory: 'service', sortOrder: 45 },
    { code: 'TRACTION', name: ml('Traction', 'Traction'), productCategory: 'service', sortOrder: 46 },
    { code: 'TRANSPORT', name: ml('Transport', 'Transport'), productCategory: 'service', sortOrder: 47 },
    // Milk liquid
    { code: 'LIQUID_MILK', name: ml('Liquid Milk', 'Lait Liquide'), productCategory: 'dairy', sortOrder: 48 },
    // Bones for poultry
    { code: 'BONES_BEAKS_CLAWS', name: ml('Bones, Beaks, Claws, Shells', 'Os, Becs, Griffes, Coquilles'), productCategory: 'by-product', sortOrder: 49 },
    // Pelts
    { code: 'CARRY', name: ml('Carry (Pack Animal)', 'Portage'), productCategory: 'service', sortOrder: 50 },
    { code: 'FISH_MEAT', name: ml('Fish Meat', 'Chair de Poisson'), productCategory: 'meat', sortOrder: 51 },
  ];

  for (const p of products) {
    await (prisma as any).refLivestockProduct.create({
      data: { code: p.code, name: p.name, productCategory: p.productCategory, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: p.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${products.length} livestock products seeded`);
}

async function seedCensusMethodologies() {
  console.log('  Seeding census methodologies...');
  const methods = [
    { code: 'FULL_CENSUS', name: ml('Full Census', 'Recensement Complet'), methodType: 'census', sortOrder: 1 },
    { code: 'SAMPLE_SURVEY', name: ml('Sample Survey', 'Enquête par Sondage'), methodType: 'survey', sortOrder: 2 },
    { code: 'ADMINISTRATIVE', name: ml('Administrative Estimate', 'Estimation Administrative'), methodType: 'estimate', sortOrder: 3 },
    { code: 'AERIAL_SURVEY', name: ml('Aerial Survey', 'Survol Aérien'), methodType: 'aerial', sortOrder: 4 },
    { code: 'SAMPLE_FRAME', name: ml('Sample Frame Enumeration', 'Dénombrement par Cadre d\'Échantillonnage'), methodType: 'sample', sortOrder: 5 },
    { code: 'RAPID_APPRAISAL', name: ml('Rapid Rural Appraisal', 'Évaluation Rurale Rapide'), methodType: 'estimate', sortOrder: 6 },
  ];

  for (const m of methods) {
    await (prisma as any).refCensusMethodology.create({
      data: { code: m.code, name: m.name, methodType: m.methodType, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: m.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${methods.length} census methodologies seeded`);
}

async function seedGearTypes() {
  console.log('  Seeding gear types...');
  const gears = [
    { code: 'BOTTOM_TRAWL', name: ml('Bottom Trawl', 'Chalut de Fond'), gearCategory: 'trawl', sortOrder: 1 },
    { code: 'PELAGIC_TRAWL', name: ml('Pelagic Trawl', 'Chalut Pélagique'), gearCategory: 'trawl', sortOrder: 2 },
    { code: 'GILL_NET', name: ml('Gill Net', 'Filet Maillant'), gearCategory: 'net', sortOrder: 3 },
    { code: 'SEINE_NET', name: ml('Seine Net', 'Senne'), gearCategory: 'net', sortOrder: 4 },
    { code: 'PURSE_SEINE', name: ml('Purse Seine', 'Senne Coulissante'), gearCategory: 'net', sortOrder: 5 },
    { code: 'CAST_NET', name: ml('Cast Net', 'Épervier'), gearCategory: 'net', sortOrder: 6 },
    { code: 'LONGLINE', name: ml('Longline', 'Palangre'), gearCategory: 'line', sortOrder: 7 },
    { code: 'HANDLINE', name: ml('Handline', 'Ligne à Main'), gearCategory: 'line', sortOrder: 8 },
    { code: 'TROLLING', name: ml('Trolling Line', 'Ligne de Traîne'), gearCategory: 'line', sortOrder: 9 },
    { code: 'FISH_TRAP', name: ml('Fish Trap', 'Nasse'), gearCategory: 'trap', sortOrder: 10 },
    { code: 'CRAB_POT', name: ml('Crab Pot', 'Casier à Crabe'), gearCategory: 'trap', sortOrder: 11 },
    { code: 'BEACH_SEINE', name: ml('Beach Seine', 'Senne de Plage'), gearCategory: 'net', sortOrder: 12 },
  ];

  for (const g of gears) {
    await (prisma as any).refGearType.create({
      data: { code: g.code, name: g.name, gearCategory: g.gearCategory, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: g.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${gears.length} gear types seeded`);
}

async function seedVesselTypes() {
  console.log('  Seeding vessel types...');
  const vessels = [
    { code: 'PIROGUE', name: ml('Pirogue/Canoe', 'Pirogue'), lengthCategory: 'small', propulsionType: 'paddle/sail', sortOrder: 1 },
    { code: 'MOTORIZED_CANOE', name: ml('Motorized Canoe', 'Pirogue Motorisée'), lengthCategory: 'small', propulsionType: 'outboard', sortOrder: 2 },
    { code: 'ARTISANAL_BOAT', name: ml('Artisanal Fishing Boat', 'Embarcation Artisanale'), lengthCategory: 'small', propulsionType: 'outboard', sortOrder: 3 },
    { code: 'COASTAL_TRAWLER', name: ml('Coastal Trawler', 'Chalutier Côtier'), lengthCategory: 'medium', propulsionType: 'diesel', sortOrder: 4 },
    { code: 'LONGLINE_VESSEL', name: ml('Longline Vessel', 'Palangrier'), lengthCategory: 'medium', propulsionType: 'diesel', sortOrder: 5 },
    { code: 'PURSE_SEINER', name: ml('Purse Seiner', 'Senneur'), lengthCategory: 'large', propulsionType: 'diesel', sortOrder: 6 },
    { code: 'INDUSTRIAL_TRAWLER', name: ml('Industrial Trawler', 'Chalutier Industriel'), lengthCategory: 'large', propulsionType: 'diesel', sortOrder: 7 },
    { code: 'CARRIER_VESSEL', name: ml('Carrier/Transport Vessel', 'Navire de Transport'), lengthCategory: 'large', propulsionType: 'diesel', sortOrder: 8 },
  ];

  for (const v of vessels) {
    await (prisma as any).refVesselType.create({
      data: { code: v.code, name: v.name, lengthCategory: v.lengthCategory, propulsionType: v.propulsionType, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: v.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${vessels.length} vessel types seeded`);
}

async function seedAquacultureFarmTypes() {
  console.log('  Seeding aquaculture farm types...');
  const types = [
    { code: 'FRESHWATER_POND', name: ml('Freshwater Pond', 'Étang d\'Eau Douce'), waterType: 'freshwater', cultureSystem: 'pond', sortOrder: 1 },
    { code: 'FRESHWATER_CAGE', name: ml('Freshwater Cage', 'Cage en Eau Douce'), waterType: 'freshwater', cultureSystem: 'cage', sortOrder: 2 },
    { code: 'FRESHWATER_RACEWAY', name: ml('Freshwater Raceway', 'Raceway Eau Douce'), waterType: 'freshwater', cultureSystem: 'raceway', sortOrder: 3 },
    { code: 'MARINE_CAGE', name: ml('Marine Cage', 'Cage Marine'), waterType: 'marine', cultureSystem: 'cage', sortOrder: 4 },
    { code: 'MARINE_POND', name: ml('Marine/Brackish Pond', 'Étang Marin/Saumâtre'), waterType: 'brackish', cultureSystem: 'pond', sortOrder: 5 },
    { code: 'TANK_RAS', name: ml('Recirculating Aquaculture System', 'Système d\'Aquaculture en Recirculation'), waterType: 'freshwater', cultureSystem: 'RAS', sortOrder: 6 },
    { code: 'INTEGRATED', name: ml('Integrated Aquaculture-Agriculture', 'Aquaculture-Agriculture Intégrée'), waterType: 'freshwater', cultureSystem: 'pond', sortOrder: 7 },
    { code: 'HATCHERY', name: ml('Hatchery', 'Écloserie'), waterType: 'freshwater', cultureSystem: 'tank', sortOrder: 8 },
  ];

  for (const t of types) {
    await (prisma as any).refAquacultureFarmType.create({
      data: { code: t.code, name: t.name, waterType: t.waterType, cultureSystem: t.cultureSystem, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: t.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${types.length} aquaculture farm types seeded`);
}

async function seedLandingSites() {
  console.log('  Seeding landing sites...');
  const sites = [
    { code: 'KE_KISUMU', name: ml('Kisumu Fish Landing', 'Débarcadère de Kisumu'), latitude: -0.0917, longitude: 34.7500, adminLevel1: 'Kisumu', capacity: 200, ownerId: TENANT_IDS.KENYA, sortOrder: 1 },
    { code: 'KE_MOMBASA', name: ml('Mombasa Old Port Landing', 'Débarcadère du Vieux Port de Mombasa'), latitude: -4.0435, longitude: 39.6682, adminLevel1: 'Mombasa', capacity: 350, ownerId: TENANT_IDS.KENYA, sortOrder: 2 },
    { code: 'KE_MALINDI', name: ml('Malindi Fish Landing', 'Débarcadère de Malindi'), latitude: -3.2138, longitude: 40.1169, adminLevel1: 'Kilifi', capacity: 150, ownerId: TENANT_IDS.KENYA, sortOrder: 3 },
    { code: 'NG_LAGOS_BAR', name: ml('Bar Beach Landing Site', 'Débarcadère de Bar Beach'), latitude: 6.4186, longitude: 3.4186, adminLevel1: 'Lagos', capacity: 400, ownerId: TENANT_IDS.NIGERIA, sortOrder: 4 },
    { code: 'NG_KAINJI', name: ml('Kainji Lake Landing', 'Débarcadère du Lac Kainji'), latitude: 9.8500, longitude: 4.6167, adminLevel1: 'Niger', capacity: 250, ownerId: TENANT_IDS.NIGERIA, sortOrder: 5 },
    { code: 'NG_CALABAR', name: ml('Calabar Fish Landing', 'Débarcadère de Calabar'), latitude: 4.9500, longitude: 8.3167, adminLevel1: 'Cross River', capacity: 200, ownerId: TENANT_IDS.NIGERIA, sortOrder: 6 },
  ];

  for (const s of sites) {
    await (prisma as any).refLandingSite.create({
      data: { code: s.code, name: s.name, latitude: s.latitude, longitude: s.longitude, adminLevel1: s.adminLevel1, capacity: s.capacity, scope: 'national', ownerId: s.ownerId, ownerType: 'country', sortOrder: s.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${sites.length} landing sites seeded`);
}

async function seedConservationStatuses() {
  console.log('  Seeding conservation statuses...');
  const statuses = [
    { code: 'LC', name: ml('Least Concern', 'Préoccupation Mineure'), iucnCode: 'LC', sortOrder: 1 },
    { code: 'NT', name: ml('Near Threatened', 'Quasi Menacé'), iucnCode: 'NT', sortOrder: 2 },
    { code: 'VU', name: ml('Vulnerable', 'Vulnérable'), iucnCode: 'VU', sortOrder: 3 },
    { code: 'EN', name: ml('Endangered', 'En Danger'), iucnCode: 'EN', sortOrder: 4 },
    { code: 'CR', name: ml('Critically Endangered', 'En Danger Critique'), iucnCode: 'CR', sortOrder: 5 },
    { code: 'EW', name: ml('Extinct in the Wild', 'Éteint à l\'État Sauvage'), iucnCode: 'EW', sortOrder: 6 },
    { code: 'EX', name: ml('Extinct', 'Éteint'), iucnCode: 'EX', sortOrder: 7 },
  ];

  for (const s of statuses) {
    await (prisma as any).refConservationStatus.create({
      data: { code: s.code, name: s.name, iucnCode: s.iucnCode, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: s.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${statuses.length} conservation statuses seeded`);
}

async function seedHabitatTypes() {
  console.log('  Seeding habitat types...');
  const habitats = [
    { code: 'TROPICAL_FOREST', name: ml('Tropical Forest', 'Forêt Tropicale'), biome: 'forest', sortOrder: 1 },
    { code: 'MONTANE_FOREST', name: ml('Montane Forest', 'Forêt de Montagne'), biome: 'forest', sortOrder: 2 },
    { code: 'WOODED_SAVANNA', name: ml('Wooded Savanna', 'Savane Boisée'), biome: 'savanna', sortOrder: 3 },
    { code: 'GRASS_SAVANNA', name: ml('Grass Savanna', 'Savane Herbeuse'), biome: 'savanna', sortOrder: 4 },
    { code: 'WETLAND', name: ml('Wetland/Marshes', 'Zones Humides/Marécages'), biome: 'wetland', sortOrder: 5 },
    { code: 'SAHEL', name: ml('Sahel/Semi-Arid', 'Sahel/Semi-Aride'), biome: 'desert', sortOrder: 6 },
    { code: 'DESERT', name: ml('Desert', 'Désert'), biome: 'desert', sortOrder: 7 },
    { code: 'COASTAL_MARINE', name: ml('Coastal/Marine', 'Côtier/Marin'), biome: 'marine', sortOrder: 8 },
    { code: 'ALPINE', name: ml('Alpine/Mountain', 'Alpin/Montagne'), biome: 'mountain', sortOrder: 9 },
    { code: 'GRASSLAND', name: ml('Grassland/Steppe', 'Prairie/Steppe'), biome: 'grassland', sortOrder: 10 },
  ];

  for (const h of habitats) {
    await (prisma as any).refHabitatType.create({
      data: { code: h.code, name: h.name, biome: h.biome, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: h.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${habitats.length} habitat types seeded`);
}

async function seedCrimeTypes() {
  console.log('  Seeding wildlife crime types...');
  const crimes = [
    { code: 'POACHING', name: ml('Poaching', 'Braconnage'), crimeCategory: 'poaching', sortOrder: 1 },
    { code: 'IVORY_TRAFFICKING', name: ml('Ivory Trafficking', 'Trafic d\'Ivoire'), crimeCategory: 'trafficking', sortOrder: 2 },
    { code: 'BUSHMEAT_TRADE', name: ml('Illegal Bushmeat Trade', 'Commerce Illégal de Viande de Brousse'), crimeCategory: 'illegal-trade', sortOrder: 3 },
    { code: 'LIVE_ANIMAL_TRAFFIC', name: ml('Live Animal Trafficking', 'Trafic d\'Animaux Vivants'), crimeCategory: 'trafficking', sortOrder: 4 },
    { code: 'HABITAT_DESTRUCTION', name: ml('Habitat Destruction', 'Destruction d\'Habitat'), crimeCategory: 'habitat-destruction', sortOrder: 5 },
    { code: 'POISONING', name: ml('Wildlife Poisoning', 'Empoisonnement de Faune'), crimeCategory: 'poisoning', sortOrder: 6 },
    { code: 'ILLEGAL_FISHING', name: ml('Illegal Fishing (IUU)', 'Pêche Illégale (INN)'), crimeCategory: 'illegal-trade', sortOrder: 7 },
    { code: 'CITES_VIOLATION', name: ml('CITES Violation', 'Violation CITES'), crimeCategory: 'trafficking', sortOrder: 8 },
  ];

  for (const c of crimes) {
    await (prisma as any).refCrimeType.create({
      data: { code: c.code, name: c.name, crimeCategory: c.crimeCategory, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: c.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${crimes.length} crime types seeded`);
}

async function seedCommodities() {
  console.log('  Seeding commodities...');
  const commodities = [
    { code: 'LIVE_CATTLE', name: ml('Live Cattle', 'Bovins Vivants'), hsCode: '0102', commodityGroup: 'live-animals', sortOrder: 1 },
    { code: 'LIVE_SHEEP_GOATS', name: ml('Live Sheep & Goats', 'Ovins & Caprins Vivants'), hsCode: '0104', commodityGroup: 'live-animals', sortOrder: 2 },
    { code: 'LIVE_POULTRY', name: ml('Live Poultry', 'Volailles Vivantes'), hsCode: '0105', commodityGroup: 'live-animals', sortOrder: 3 },
    { code: 'BEEF_FRESH', name: ml('Beef (Fresh/Chilled)', 'Viande Bovine (Fraîche/Réfrigérée)'), hsCode: '0201', commodityGroup: 'meat', sortOrder: 4 },
    { code: 'BEEF_FROZEN', name: ml('Beef (Frozen)', 'Viande Bovine (Congelée)'), hsCode: '0202', commodityGroup: 'meat', sortOrder: 5 },
    { code: 'POULTRY_MEAT_HS', name: ml('Poultry Meat', 'Viande de Volaille'), hsCode: '0207', commodityGroup: 'meat', sortOrder: 6 },
    { code: 'MILK_CREAM', name: ml('Milk & Cream', 'Lait & Crème'), hsCode: '0401', commodityGroup: 'dairy', sortOrder: 7 },
    { code: 'CHEESE', name: ml('Cheese', 'Fromage'), hsCode: '0406', commodityGroup: 'dairy', sortOrder: 8 },
    { code: 'FISH_FRESH', name: ml('Fish (Fresh/Chilled)', 'Poisson (Frais/Réfrigéré)'), hsCode: '0302', commodityGroup: 'fish', sortOrder: 9 },
    { code: 'FISH_DRIED', name: ml('Fish (Dried/Smoked)', 'Poisson (Séché/Fumé)'), hsCode: '0305', commodityGroup: 'fish', sortOrder: 10 },
    { code: 'RAW_HIDES', name: ml('Raw Hides & Skins', 'Cuirs & Peaux Bruts'), hsCode: '4101', commodityGroup: 'hides', sortOrder: 11 },
    { code: 'NATURAL_HONEY', name: ml('Natural Honey', 'Miel Naturel'), hsCode: '0409', commodityGroup: 'honey', sortOrder: 12 },
    { code: 'BEESWAX', name: ml('Beeswax', 'Cire d\'Abeille'), hsCode: '1521', commodityGroup: 'honey', sortOrder: 13 },
    { code: 'ANIMAL_FEED', name: ml('Animal Feed', 'Aliments pour Animaux'), hsCode: '2309', commodityGroup: 'feed', sortOrder: 14 },
    { code: 'EGGS_HS', name: ml('Eggs (in shell)', 'Œufs (en coquille)'), hsCode: '0407', commodityGroup: 'dairy', sortOrder: 15 },
  ];

  for (const c of commodities) {
    await (prisma as any).refCommodity.create({
      data: { code: c.code, name: c.name, hsCode: c.hsCode, commodityGroup: c.commodityGroup, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: c.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${commodities.length} commodities seeded`);
}

async function seedHiveTypes() {
  console.log('  Seeding hive types...');
  const hives = [
    { code: 'LANGSTROTH', name: ml('Langstroth', 'Langstroth'), hiveCategory: 'langstroth', sortOrder: 1 },
    { code: 'TOP_BAR', name: ml('Top-Bar (Kenya TBH)', 'Ruche à Barrettes (Kenya TBH)'), hiveCategory: 'top-bar', sortOrder: 2 },
    { code: 'TRADITIONAL_LOG', name: ml('Traditional Log Hive', 'Ruche Traditionnelle en Tronc'), hiveCategory: 'log', sortOrder: 3 },
    { code: 'TRADITIONAL_BARK', name: ml('Traditional Bark Hive', 'Ruche Traditionnelle en Écorce'), hiveCategory: 'traditional', sortOrder: 4 },
    { code: 'WARRE', name: ml('Warré', 'Warré'), hiveCategory: 'warre', sortOrder: 5 },
    { code: 'FRAME_HIVE', name: ml('Frame Hive (Modified)', 'Ruche à Cadres (Modifiée)'), hiveCategory: 'langstroth', sortOrder: 6 },
  ];

  for (const h of hives) {
    await (prisma as any).refHiveType.create({
      data: { code: h.code, name: h.name, hiveCategory: h.hiveCategory, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: h.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${hives.length} hive types seeded`);
}

async function seedBeeDiseases() {
  console.log('  Seeding bee diseases...');
  const diseases = [
    { code: 'VARROA', name: ml('Varroa Mite', 'Varroa'), pathogenType: 'parasite', affectedCaste: 'all', sortOrder: 1 },
    { code: 'NOSEMA', name: ml('Nosema', 'Nosémose'), pathogenType: 'fungal', affectedCaste: 'worker', sortOrder: 2 },
    { code: 'AFB', name: ml('American Foulbrood', 'Loque Américaine'), pathogenType: 'bacteria', affectedCaste: 'brood', sortOrder: 3 },
    { code: 'EFB', name: ml('European Foulbrood', 'Loque Européenne'), pathogenType: 'bacteria', affectedCaste: 'brood', sortOrder: 4 },
    { code: 'SMALL_HIVE_BEETLE', name: ml('Small Hive Beetle', 'Petit Coléoptère de la Ruche'), pathogenType: 'parasite', affectedCaste: 'all', sortOrder: 5 },
    { code: 'WAX_MOTH', name: ml('Wax Moth', 'Fausse Teigne'), pathogenType: 'parasite', affectedCaste: 'brood', sortOrder: 6 },
    { code: 'CHALKBROOD', name: ml('Chalkbrood', 'Couvain Plâtré'), pathogenType: 'fungal', affectedCaste: 'brood', sortOrder: 7 },
    { code: 'DWV', name: ml('Deformed Wing Virus', 'Virus des Ailes Déformées'), pathogenType: 'virus', affectedCaste: 'worker', sortOrder: 8 },
    { code: 'ABPV', name: ml('Acute Bee Paralysis Virus', 'Virus de la Paralysie Aiguë'), pathogenType: 'virus', affectedCaste: 'worker', sortOrder: 9 },
    { code: 'TROPILAELAPS', name: ml('Tropilaelaps', 'Tropilaelaps'), pathogenType: 'parasite', affectedCaste: 'brood', sortOrder: 10 },
  ];

  for (const d of diseases) {
    await (prisma as any).refBeeDisease.create({
      data: { code: d.code, name: d.name, pathogenType: d.pathogenType, affectedCaste: d.affectedCaste, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: d.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${diseases.length} bee diseases seeded`);
}

async function seedFloralSources() {
  console.log('  Seeding floral sources...');
  const sources = [
    { code: 'ACACIA', name: ml('Acacia', 'Acacia'), floweringSeason: 'dry', nectarType: 'monofloral', sortOrder: 1 },
    { code: 'EUCALYPTUS', name: ml('Eucalyptus', 'Eucalyptus'), floweringSeason: 'all-year', nectarType: 'monofloral', sortOrder: 2 },
    { code: 'CITRUS', name: ml('Citrus', 'Agrumes'), floweringSeason: 'wet', nectarType: 'monofloral', sortOrder: 3 },
    { code: 'SUNFLOWER', name: ml('Sunflower', 'Tournesol'), floweringSeason: 'dry', nectarType: 'monofloral', sortOrder: 4 },
    { code: 'COFFEE', name: ml('Coffee', 'Café'), floweringSeason: 'wet', nectarType: 'monofloral', sortOrder: 5 },
    { code: 'MANGO', name: ml('Mango', 'Mangue'), floweringSeason: 'dry', nectarType: 'monofloral', sortOrder: 6 },
    { code: 'SAVANNA_WILDFLOWER', name: ml('Savanna Wildflowers', 'Fleurs Sauvages de Savane'), floweringSeason: 'wet', nectarType: 'polyfloral', sortOrder: 7 },
    { code: 'FOREST_MIXED', name: ml('Forest Mixed Flora', 'Flore Forestière Mixte'), floweringSeason: 'all-year', nectarType: 'polyfloral', sortOrder: 8 },
    { code: 'BAOBAB', name: ml('Baobab', 'Baobab'), floweringSeason: 'wet', nectarType: 'monofloral', sortOrder: 9 },
    { code: 'SHEA', name: ml('Shea Tree', 'Karité'), floweringSeason: 'dry', nectarType: 'monofloral', sortOrder: 10 },
  ];

  for (const s of sources) {
    await (prisma as any).refFloralSource.create({
      data: { code: s.code, name: s.name, floweringSeason: s.floweringSeason, nectarType: s.nectarType, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: s.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${sources.length} floral sources seeded`);
}

async function seedLegalFrameworkTypes() {
  console.log('  Seeding legal framework types...');
  const types = [
    { code: 'LAW', name: ml('Law/Act', 'Loi'), frameworkCategory: 'law', sortOrder: 1 },
    { code: 'REGULATION', name: ml('Regulation', 'Règlement'), frameworkCategory: 'regulation', sortOrder: 2 },
    { code: 'DECREE', name: ml('Decree/Order', 'Décret/Arrêté'), frameworkCategory: 'decree', sortOrder: 3 },
    { code: 'POLICY', name: ml('Policy Document', 'Document de Politique'), frameworkCategory: 'policy', sortOrder: 4 },
    { code: 'STANDARD', name: ml('Standard/Norm', 'Norme/Standard'), frameworkCategory: 'standard', sortOrder: 5 },
    { code: 'GUIDELINE', name: ml('Guideline/SOP', 'Directive/POS'), frameworkCategory: 'guideline', sortOrder: 6 },
  ];

  for (const t of types) {
    await (prisma as any).refLegalFrameworkType.create({
      data: { code: t.code, name: t.name, frameworkCategory: t.frameworkCategory, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: t.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${types.length} legal framework types seeded`);
}

async function seedStakeholderTypes() {
  console.log('  Seeding stakeholder types...');
  const types = [
    { code: 'GOVT_MINISTRY', name: ml('Government Ministry', 'Ministère'), sector: 'public', sortOrder: 1 },
    { code: 'VET_SERVICE', name: ml('Veterinary Service', 'Service Vétérinaire'), sector: 'public', sortOrder: 2 },
    { code: 'PRIVATE_SECTOR', name: ml('Private Sector/Industry', 'Secteur Privé/Industrie'), sector: 'private', sortOrder: 3 },
    { code: 'FARMERS_ORG', name: ml('Farmers Organization', 'Organisation de Producteurs'), sector: 'private', sortOrder: 4 },
    { code: 'NGO', name: ml('NGO/Civil Society', 'ONG/Société Civile'), sector: 'ngo', sortOrder: 5 },
    { code: 'INTL_ORG', name: ml('International Organization', 'Organisation Internationale'), sector: 'international', sortOrder: 6 },
    { code: 'UNIVERSITY', name: ml('University/Academic', 'Université/Académie'), sector: 'academic', sortOrder: 7 },
    { code: 'RESEARCH_INST', name: ml('Research Institute', 'Institut de Recherche'), sector: 'research', sortOrder: 8 },
  ];

  for (const t of types) {
    await (prisma as any).refStakeholderType.create({
      data: { code: t.code, name: t.name, sector: t.sector, scope: 'continental', ownerId: null, ownerType: 'continental', sortOrder: t.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${types.length} stakeholder types seeded`);
}

// ══════════════════════════════════════════════════════════════
// Phase 4 — WOAH/References-data enrichment (13 new types)
// ══════════════════════════════════════════════════════════════

async function seedDiagnosisBases() {
  console.log('  Seeding diagnosis bases...');
  const bases = [
    { code: 'PM', name: ml('Post-mortem', 'Post-mortem'), abbreviation: 'PM', description: ml('Used on carcasses to determine cause of disease', 'Utilisé sur les carcasses pour déterminer la cause de la maladie'), sortOrder: 1 },
    { code: 'BLT', name: ml('Basic laboratory test(s)', 'Test(s) de laboratoire de base'), abbreviation: 'BLT', description: ml('Screening test', 'Test de dépistage'), sortOrder: 2 },
    { code: 'ALT', name: ml('Advanced laboratory test(s)', 'Test(s) de laboratoire avancé(s)'), abbreviation: 'ALT', description: ml('Confirmatory test', 'Test de confirmation'), sortOrder: 3 },
    { code: 'SP', name: ml('Suspicion', 'Suspicion'), abbreviation: 'SP', description: ml('Diagnosis from veterinarian while waiting for lab confirmation', 'Diagnostic du vétérinaire en attente de confirmation'), sortOrder: 4 },
    { code: 'CL', name: ml('Clinical', 'Clinique'), abbreviation: 'CL', description: ml('Based on history of the disease outbreak or claims from reporter', 'Basé sur l\'historique de la maladie ou les déclarations du rapporteur'), sortOrder: 5 },
    { code: 'OW', name: ml('Owner\'s claim', 'Déclaration du propriétaire'), abbreviation: 'OW', description: ml('What the farmer has reported to the vet', 'Ce que l\'éleveur a rapporté au vétérinaire'), sortOrder: 6 },
  ];

  for (const b of bases) {
    await (prisma as any).refDiagnosisBasis.create({
      data: { code: b.code, name: b.name, abbreviation: b.abbreviation, description: b.description, scope: 'continental', ownerId: null, ownerType: 'system', sortOrder: b.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${bases.length} diagnosis bases seeded`);
}

async function seedBodyParts() {
  console.log('  Seeding body parts...');
  const parts = [
    { code: 'FORE_QUARTER', name: ml('Fore Quarter', 'Quartier avant'), sortOrder: 1 },
    { code: 'HEAD', name: ml('Head', 'Tête'), sortOrder: 2 },
    { code: 'HEART', name: ml('Heart', 'Cœur'), sortOrder: 3 },
    { code: 'HIND_QUARTER', name: ml('Hind Quarter', 'Quartier arrière'), sortOrder: 4 },
    { code: 'KIDNEY', name: ml('Kidney', 'Rein'), sortOrder: 5 },
    { code: 'LIVER', name: ml('Liver', 'Foie'), sortOrder: 6 },
    { code: 'LUNG', name: ml('Lung', 'Poumon'), sortOrder: 7 },
    { code: 'SHOULDER', name: ml('Shoulder', 'Épaule'), sortOrder: 8 },
    { code: 'SPLEEN', name: ml('Spleen', 'Rate'), sortOrder: 9 },
    { code: 'STOMACH', name: ml('Stomach', 'Estomac'), sortOrder: 10 },
    { code: 'TONGUE', name: ml('Tongue', 'Langue'), sortOrder: 11 },
    { code: 'WHOLE_CARCASS', name: ml('Whole Carcass', 'Carcasse entière'), sortOrder: 12 },
  ];

  for (const p of parts) {
    await (prisma as any).refBodyPart.create({
      data: { code: p.code, name: p.name, scope: 'continental', ownerId: null, ownerType: 'system', sortOrder: p.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${parts.length} body parts seeded`);
}

async function seedCausalAgentTypes() {
  console.log('  Seeding causal agent types...');
  const agents = [
    { code: 'BACTERIA', name: ml('Bacteria', 'Bactérie'), sortOrder: 1 },
    { code: 'FUNGUS', name: ml('Fungus', 'Champignon'), sortOrder: 2 },
    { code: 'METABOLIC', name: ml('Metabolic', 'Métabolique'), sortOrder: 3 },
    { code: 'PARASITE', name: ml('Parasite', 'Parasite'), sortOrder: 4 },
    { code: 'PRION', name: ml('Prion', 'Prion'), sortOrder: 5 },
    { code: 'VIRUS', name: ml('Virus', 'Virus'), sortOrder: 6 },
    { code: 'UNKNOWN', name: ml('Unknown', 'Inconnu'), sortOrder: 7 },
  ];

  for (const a of agents) {
    await (prisma as any).refCausalAgentType.create({
      data: { code: a.code, name: a.name, scope: 'continental', ownerId: null, ownerType: 'system', sortOrder: a.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${agents.length} causal agent types seeded`);
}

async function seedOutbreakStatuses() {
  console.log('  Seeding outbreak statuses...');
  const statuses = [
    { code: 'NEW', name: ml('New', 'Nouveau'), description: ml('New disease outbreak', 'Nouveau foyer de maladie'), sortOrder: 1 },
    { code: 'FOLLOW_UP', name: ml('Follow-up', 'Suivi'), description: ml('Monitoring an outbreak to ascertain if the disease ended or is continuing', 'Suivi d\'un foyer pour déterminer si la maladie a pris fin ou se poursuit'), sortOrder: 2 },
    { code: 'CONTAINED', name: ml('Contained', 'Contenu'), description: ml('Disease outbreak has been controlled within a geographical area', 'Le foyer est contrôlé dans une zone géographique'), sortOrder: 3 },
    { code: 'CONTINUING', name: ml('Continuing', 'En cours'), description: ml('Disease outbreak is still active', 'Le foyer est toujours actif'), sortOrder: 4 },
    { code: 'ENDED', name: ml('Ended', 'Terminé'), description: ml('The disease outbreak has ended', 'Le foyer de maladie est terminé'), sortOrder: 5 },
    { code: 'RESOLVED', name: ml('Resolved', 'Résolu'), description: ml('Outbreak fully resolved', 'Foyer entièrement résolu'), sortOrder: 6 },
  ];

  for (const s of statuses) {
    await (prisma as any).refOutbreakStatus.create({
      data: { code: s.code, name: s.name, description: s.description, scope: 'continental', ownerId: null, ownerType: 'system', sortOrder: s.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${statuses.length} outbreak statuses seeded`);
}

async function seedEpidemiologicalUnitTypes() {
  console.log('  Seeding epidemiological unit types...');
  const units = [
    { code: 'COMPARTMENT', name: ml('Compartment', 'Compartiment'), sortOrder: 1 },
    { code: 'FARM', name: ml('Farm', 'Exploitation'), sortOrder: 2 },
    { code: 'QUARANTINE_FACILITY', name: ml('Quarantine facility', 'Installation de quarantaine'), sortOrder: 3 },
    { code: 'VILLAGE', name: ml('Village', 'Village'), sortOrder: 4 },
    { code: 'ZONE', name: ml('Zone', 'Zone'), sortOrder: 5 },
  ];

  for (const u of units) {
    await (prisma as any).refEpidemiologicalUnitType.create({
      data: { code: u.code, name: u.name, scope: 'continental', ownerId: null, ownerType: 'system', sortOrder: u.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${units.length} epidemiological unit types seeded`);
}

async function seedNotificationReasons() {
  console.log('  Seeding notification reasons...');
  const reasons = [
    { code: 'FIRST_OCCURRENCE', name: ml('First occurrence of a listed disease in a country or zone', 'Première apparition d\'une maladie listée dans un pays ou une zone'), sortOrder: 1 },
    { code: 'RE_OCCURRENCE', name: ml('Re-occurrence following a report declaring the outbreak ended', 'Réapparition après un rapport déclarant la fin du foyer'), sortOrder: 2 },
    { code: 'NEW_STRAIN', name: ml('First occurrence of a new strain of a pathogen', 'Première apparition d\'une nouvelle souche d\'un agent pathogène'), sortOrder: 3 },
    { code: 'SUDDEN_INCREASE', name: ml('Sudden and unexpected increase in distribution, incidence, morbidity or mortality', 'Augmentation soudaine et inattendue de la distribution, l\'incidence, la morbidité ou la mortalité'), sortOrder: 4 },
    { code: 'EMERGING_DISEASE', name: ml('An emerging disease with significant morbidity or mortality, or zoonotic potential', 'Une maladie émergente avec morbidité ou mortalité significative, ou potentiel zoonotique'), sortOrder: 5 },
    { code: 'EPIDEMIOLOGY_CHANGE', name: ml('Evidence of a change in the epidemiology of a listed disease', 'Preuve d\'un changement dans l\'épidémiologie d\'une maladie listée'), sortOrder: 6 },
  ];

  for (const r of reasons) {
    await (prisma as any).refNotificationReason.create({
      data: { code: r.code, name: r.name, scope: 'continental', ownerId: null, ownerType: 'system', sortOrder: r.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${reasons.length} notification reasons seeded`);
}

async function seedSourceOfInfections() {
  console.log('  Seeding sources of infection...');
  const sources = [
    { code: 'AIRBORNE', name: ml('Airborne', 'Aéroporté'), sortOrder: 1 },
    { code: 'ANIMAL_MOVEMENT', name: ml('Animal Movement', 'Mouvement d\'animaux'), sortOrder: 2 },
    { code: 'WILDLIFE_EXTENSION', name: ml('Extension from wildlife', 'Extension depuis la faune sauvage'), sortOrder: 3 },
    { code: 'FOMITES', name: ml('Fomites', 'Fomites'), sortOrder: 4 },
    { code: 'FROM_FOCI', name: ml('From foci at locality', 'À partir de foyers locaux'), sortOrder: 5 },
    { code: 'MECHANICAL', name: ml('Mechanical', 'Mécanique'), sortOrder: 6 },
    { code: 'ANIMAL_PRODUCT', name: ml('Movement of animal product', 'Mouvement de produits animaux'), sortOrder: 7 },
    { code: 'VECTOR', name: ml('Vector', 'Vecteur'), sortOrder: 8 },
    { code: 'UNKNOWN', name: ml('Unknown', 'Inconnu'), sortOrder: 9 },
  ];

  for (const s of sources) {
    await (prisma as any).refSourceOfInfection.create({
      data: { code: s.code, name: s.name, scope: 'continental', ownerId: null, ownerType: 'system', sortOrder: s.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${sources.length} sources of infection seeded`);
}

async function seedTransportModes() {
  console.log('  Seeding transport modes...');
  const modes = [
    { code: 'SEA', name: ml('Sea (Ship, Dhows, Boats)', 'Mer (Navire, Boutres, Bateaux)'), sortOrder: 1 },
    { code: 'AIR', name: ml('Air (Aeroplane)', 'Air (Avion)'), sortOrder: 2 },
    { code: 'ROAD', name: ml('Road (Motor Vehicle)', 'Route (Véhicule motorisé)'), sortOrder: 3 },
    { code: 'TREKKING', name: ml('Trekking', 'À pied'), sortOrder: 4 },
    { code: 'RAIL', name: ml('Rail', 'Rail'), sortOrder: 5 },
    { code: 'MOTORCYCLE', name: ml('Motorcycle', 'Moto'), sortOrder: 6 },
    { code: 'BICYCLE', name: ml('Bicycle', 'Vélo'), sortOrder: 7 },
    { code: 'OTHER', name: ml('Other', 'Autre'), sortOrder: 8 },
  ];

  for (const m of modes) {
    await (prisma as any).refTransportMode.create({
      data: { code: m.code, name: m.name, scope: 'continental', ownerId: null, ownerType: 'system', sortOrder: m.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${modes.length} transport modes seeded`);
}

async function seedAnimalSexes() {
  console.log('  Seeding animal sexes...');
  const sexes = [
    { code: 'M', name: ml('Male', 'Mâle'), sortOrder: 1 },
    { code: 'F', name: ml('Female', 'Femelle'), sortOrder: 2 },
    { code: 'A', name: ml('All', 'Tous'), sortOrder: 3 },
    { code: 'U', name: ml('Unknown', 'Inconnu'), sortOrder: 4 },
  ];

  for (const s of sexes) {
    await (prisma as any).refAnimalSex.create({
      data: { code: s.code, name: s.name, scope: 'continental', ownerId: null, ownerType: 'system', sortOrder: s.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${sexes.length} animal sexes seeded`);
}

async function seedAnimalHusbandries() {
  console.log('  Seeding animal husbandry types...');
  const types = [
    { code: 'AQUACULTURE', name: ml('Aquaculture', 'Aquaculture'), sortOrder: 1 },
    { code: 'INLAND', name: ml('Inland', 'Intérieur'), sortOrder: 2 },
    { code: 'MARINE', name: ml('Marine', 'Marin'), sortOrder: 3 },
    { code: 'DOMESTIC', name: ml('Domestic', 'Domestique'), sortOrder: 4 },
    { code: 'WILD', name: ml('Wild', 'Sauvage'), sortOrder: 5 },
  ];

  for (const t of types) {
    await (prisma as any).refAnimalHusbandry.create({
      data: { code: t.code, name: t.name, scope: 'continental', ownerId: null, ownerType: 'system', sortOrder: t.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${types.length} animal husbandry types seeded`);
}

async function seedGeneticDiversities() {
  console.log('  Seeding genetic diversities...');
  const types = [
    { code: 'LOCAL', name: ml('Local', 'Local'), sortOrder: 1 },
    { code: 'EXOTIC', name: ml('Exotic', 'Exotique'), sortOrder: 2 },
    { code: 'CROSSBREED', name: ml('Crossbreed', 'Croisé'), sortOrder: 3 },
  ];

  for (const t of types) {
    await (prisma as any).refGeneticDiversity.create({
      data: { code: t.code, name: t.name, scope: 'continental', ownerId: null, ownerType: 'system', sortOrder: t.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${types.length} genetic diversities seeded`);
}

async function seedDataSources() {
  console.log('  Seeding data sources...');
  const sources = [
    { code: 'ASD', name: ml('Agricultural Statistics Division', 'Division des Statistiques Agricoles'), abbreviation: 'ASD', sortOrder: 1 },
    { code: 'ABSR', name: ml('Annual Breed Society Records', 'Registres Annuels des Sociétés de Races'), abbreviation: 'ABSR', sortOrder: 2 },
    { code: 'BA', name: ml('Breeders Associations', 'Associations d\'Éleveurs'), abbreviation: 'BA', sortOrder: 3 },
    { code: 'CBBP', name: ml('Community-Based Breeding Programs', 'Programmes d\'Élevage Communautaires'), abbreviation: 'C', sortOrder: 4 },
    { code: 'CSO', name: ml('Central Statistics Office', 'Office Central des Statistiques'), abbreviation: 'CSO', sortOrder: 5 },
    { code: 'CE', name: ml('Customs and Excise', 'Douanes et Accises'), abbreviation: 'CE', sortOrder: 6 },
    { code: 'DB', name: ml('Dairy Board', 'Office du Lait'), abbreviation: 'DB', sortOrder: 7 },
    { code: 'DAP', name: ml('Department of Animal Production', 'Département de la Production Animale'), abbreviation: 'DAP', sortOrder: 8 },
    { code: 'DLMT', name: ml('Department of Livestock Marketing and Trade', 'Département de la Commercialisation du Bétail'), abbreviation: 'DLMT', sortOrder: 9 },
    { code: 'DVS', name: ml('Department of Veterinary Services', 'Département des Services Vétérinaires'), abbreviation: 'DVS', sortOrder: 10 },
    { code: 'FA', name: ml('Farmers Associations', 'Associations de Producteurs'), abbreviation: 'FA', sortOrder: 11 },
    { code: 'H', name: ml('Herdbook', 'Livre Généalogique'), abbreviation: 'H', sortOrder: 12 },
    { code: 'LA', name: ml('Livestock Auctioneers', 'Commissaires-Priseurs de Bétail'), abbreviation: 'LA', sortOrder: 13 },
    { code: 'LC', name: ml('Livestock Census', 'Recensement du Bétail'), abbreviation: 'LC', sortOrder: 14 },
    { code: 'LD', name: ml('Livestock Department', 'Département de l\'Élevage'), abbreviation: 'LD', sortOrder: 15 },
    { code: 'MB', name: ml('Meat Board', 'Office de la Viande'), abbreviation: 'MB', sortOrder: 16 },
    { code: 'MTCMAR', name: ml('Ministry of Trade Annual Reports', 'Rapports Annuels du Ministère du Commerce'), abbreviation: 'MTCMAR', sortOrder: 17 },
    { code: 'NBIP', name: ml('National Breed Improvement Programs', 'Programmes Nationaux d\'Amélioration Génétique'), abbreviation: 'NBIP', sortOrder: 18 },
    { code: 'NGAIC', name: ml('National Genetic & AI Centres', 'Centres Nationaux de Génétique et IA'), abbreviation: 'NGAIC', sortOrder: 19 },
    { code: 'OTHER', name: ml('Other', 'Autre'), abbreviation: 'O', sortOrder: 20 },
  ];

  for (const s of sources) {
    await (prisma as any).refDataSource.create({
      data: { code: s.code, name: s.name, abbreviation: s.abbreviation, scope: 'continental', ownerId: null, ownerType: 'system', sortOrder: s.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${sources.length} data sources seeded`);
}

async function seedFishFamilies() {
  console.log('  Seeding fish families...');
  const families = [
    { code: 'ATHERINOPSIDAE', name: ml('Atherinopsidae', 'Atherinopsidae'), sortOrder: 1 },
    { code: 'CICHLIDAE', name: ml('Cichlidae', 'Cichlidés'), sortOrder: 2 },
    { code: 'CLARIIDAE', name: ml('Clariidae', 'Clariidés'), sortOrder: 3 },
    { code: 'CLUPEIDAE', name: ml('Clupeidae', 'Clupéidés'), sortOrder: 4 },
    { code: 'CYPRINIDAE', name: ml('Cyprinidae', 'Cyprinidés'), sortOrder: 5 },
    { code: 'GOBIIDAE', name: ml('Gobiidae', 'Gobiidés'), sortOrder: 6 },
    { code: 'ICTALURIDAE', name: ml('Ictaluridae', 'Ictaluridés'), sortOrder: 7 },
    { code: 'LATIDAE', name: ml('Latidae', 'Latidés'), sortOrder: 8 },
    { code: 'LORICARIIDAE', name: ml('Loricariidae', 'Loricariidés'), sortOrder: 9 },
    { code: 'ODONTOBUTIDAE', name: ml('Odontobutidae', 'Odontobutidés'), sortOrder: 10 },
    { code: 'POECILIIDAE', name: ml('Poeciliidae', 'Poeciliidés'), sortOrder: 11 },
    { code: 'SALMONIDAE', name: ml('Salmonidae', 'Salmonidés'), sortOrder: 12 },
  ];

  for (const f of families) {
    await (prisma as any).refFishFamily.create({
      data: { code: f.code, name: f.name, scope: 'continental', ownerId: null, ownerType: 'system', sortOrder: f.sortOrder },
    }).catch(() => {});
  }
  console.log(`    ${families.length} fish families seeded`);
}

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('Seeding master data reference tables...\n');

  // Clean existing data (in reverse dependency order)
  console.log('  Cleaning existing reference data...');
  // Phase 4 new types (no FK dependencies)
  await (prisma as any).refFishFamily.deleteMany({}).catch(() => {});
  await (prisma as any).refDataSource.deleteMany({}).catch(() => {});
  await (prisma as any).refGeneticDiversity.deleteMany({}).catch(() => {});
  await (prisma as any).refAnimalHusbandry.deleteMany({}).catch(() => {});
  await (prisma as any).refAnimalSex.deleteMany({}).catch(() => {});
  await (prisma as any).refTransportMode.deleteMany({}).catch(() => {});
  await (prisma as any).refSourceOfInfection.deleteMany({}).catch(() => {});
  await (prisma as any).refNotificationReason.deleteMany({}).catch(() => {});
  await (prisma as any).refEpidemiologicalUnitType.deleteMany({}).catch(() => {});
  await (prisma as any).refOutbreakStatus.deleteMany({}).catch(() => {});
  await (prisma as any).refCausalAgentType.deleteMany({}).catch(() => {});
  await (prisma as any).refBodyPart.deleteMany({}).catch(() => {});
  await (prisma as any).refDiagnosisBasis.deleteMany({}).catch(() => {});
  // Phase 2 new types (no FK dependencies, clean first)
  await (prisma as any).refStakeholderType.deleteMany({});
  await (prisma as any).refLegalFrameworkType.deleteMany({});
  await (prisma as any).refFloralSource.deleteMany({});
  await (prisma as any).refBeeDisease.deleteMany({});
  await (prisma as any).refHiveType.deleteMany({});
  await (prisma as any).refCommodity.deleteMany({});
  await (prisma as any).refCrimeType.deleteMany({});
  await (prisma as any).refHabitatType.deleteMany({});
  await (prisma as any).refConservationStatus.deleteMany({});
  await (prisma as any).refLandingSite.deleteMany({});
  await (prisma as any).refAquacultureFarmType.deleteMany({});
  await (prisma as any).refVesselType.deleteMany({});
  await (prisma as any).refGearType.deleteMany({});
  await (prisma as any).refCensusMethodology.deleteMany({});
  await (prisma as any).refLivestockProduct.deleteMany({});
  await (prisma as any).refLab.deleteMany({});
  await (prisma as any).refTestType.deleteMany({});
  await (prisma as any).refVaccineType.deleteMany({});
  await (prisma as any).refBreed.deleteMany({});
  // Original types
  await (prisma as any).refProductionSystem.deleteMany({});
  await (prisma as any).refCheckpoint.deleteMany({});
  await (prisma as any).refMarket.deleteMany({});
  await (prisma as any).refAbattoir.deleteMany({});
  await (prisma as any).refContaminationSource.deleteMany({});
  await (prisma as any).refSampleType.deleteMany({});
  await (prisma as any).refSeizureReason.deleteMany({});
  await (prisma as any).refControlMeasure.deleteMany({});
  await (prisma as any).refClinicalSign.deleteMany({});
  await (prisma as any).refDiseaseSpecies.deleteMany({});
  await (prisma as any).refDisease.deleteMany({});
  await (prisma as any).refAgeGroup.deleteMany({});
  await (prisma as any).refSpecies.deleteMany({});
  await (prisma as any).refSpeciesGroup.deleteMany({});
  console.log('    Done\n');

  // Original seeds
  await seedSpeciesGroups();
  await seedSpecies();
  await seedAgeGroups();
  await seedDiseases();
  await seedDiseaseSpecies();
  await seedClinicalSigns();
  await seedControlMeasures();
  await seedSeizureReasons();
  await seedSampleTypes();
  await seedContaminationSources();
  await seedAbattoirs();
  await seedMarkets();
  await seedCheckpoints();
  await seedProductionSystems();

  // Phase 2 seeds
  await seedBreeds();
  await seedVaccineTypes();
  await seedTestTypes();
  await seedLabs();
  await seedLivestockProducts();
  await seedCensusMethodologies();
  await seedGearTypes();
  await seedVesselTypes();
  await seedAquacultureFarmTypes();
  await seedLandingSites();
  await seedConservationStatuses();
  await seedHabitatTypes();
  await seedCrimeTypes();
  await seedCommodities();
  await seedHiveTypes();
  await seedBeeDiseases();
  await seedFloralSources();
  await seedLegalFrameworkTypes();
  await seedStakeholderTypes();

  // Phase 4 seeds — WOAH/References-data enrichment
  await seedDiagnosisBases();
  await seedBodyParts();
  await seedCausalAgentTypes();
  await seedOutbreakStatuses();
  await seedEpidemiologicalUnitTypes();
  await seedNotificationReasons();
  await seedSourceOfInfections();
  await seedTransportModes();
  await seedAnimalSexes();
  await seedAnimalHusbandries();
  await seedGeneticDiversities();
  await seedDataSources();
  await seedFishFamilies();

  console.log('\nMaster data seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
