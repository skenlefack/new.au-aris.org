import type { PrismaClient } from '@prisma/client';

interface FisheryRefSeed {
  category: string;
  code: string;
  name: { en: string; fr: string };
  faoCode?: string;
  sortOrder: number;
}

const GEAR_TYPES: FisheryRefSeed[] = [
  { category: 'GEAR_TYPE', code: 'GILLNET', name: { en: 'Gillnet', fr: 'Filet maillant' }, faoCode: '07.0.0', sortOrder: 1 },
  { category: 'GEAR_TYPE', code: 'SEINE', name: { en: 'Seine net', fr: 'Senne' }, faoCode: '02.0.0', sortOrder: 2 },
  { category: 'GEAR_TYPE', code: 'TRAWL', name: { en: 'Trawl', fr: 'Chalut' }, faoCode: '03.0.0', sortOrder: 3 },
  { category: 'GEAR_TYPE', code: 'LONGLINE', name: { en: 'Longline', fr: 'Palangre' }, faoCode: '09.3.0', sortOrder: 4 },
  { category: 'GEAR_TYPE', code: 'TRAP', name: { en: 'Trap', fr: 'Nasse / Casier' }, faoCode: '08.0.0', sortOrder: 5 },
  { category: 'GEAR_TYPE', code: 'CAST_NET', name: { en: 'Cast net', fr: 'Epervier' }, faoCode: '04.0.0', sortOrder: 6 },
  { category: 'GEAR_TYPE', code: 'BEACH_SEINE', name: { en: 'Beach seine', fr: 'Senne de plage' }, faoCode: '02.1.0', sortOrder: 7 },
  { category: 'GEAR_TYPE', code: 'PURSE_SEINE', name: { en: 'Purse seine', fr: 'Senne coulissante' }, faoCode: '02.2.0', sortOrder: 8 },
  { category: 'GEAR_TYPE', code: 'DREDGE', name: { en: 'Dredge', fr: 'Drague' }, faoCode: '06.0.0', sortOrder: 9 },
  { category: 'GEAR_TYPE', code: 'HOOK_LINE', name: { en: 'Hook and line', fr: 'Ligne et hamecon' }, faoCode: '09.0.0', sortOrder: 10 },
];

const VESSEL_TYPES: FisheryRefSeed[] = [
  { category: 'VESSEL_TYPE', code: 'ARTISANAL', name: { en: 'Artisanal canoe / pirogue', fr: 'Pirogue artisanale' }, sortOrder: 1 },
  { category: 'VESSEL_TYPE', code: 'SEMI_INDUSTRIAL', name: { en: 'Semi-industrial vessel', fr: 'Navire semi-industriel' }, sortOrder: 2 },
  { category: 'VESSEL_TYPE', code: 'INDUSTRIAL', name: { en: 'Industrial vessel', fr: 'Navire industriel' }, sortOrder: 3 },
  { category: 'VESSEL_TYPE', code: 'TRAWLER', name: { en: 'Trawler', fr: 'Chalutier' }, sortOrder: 4 },
  { category: 'VESSEL_TYPE', code: 'PURSE_SEINER', name: { en: 'Purse seiner', fr: 'Senneur' }, sortOrder: 5 },
  { category: 'VESSEL_TYPE', code: 'LONGLINER', name: { en: 'Longliner', fr: 'Palangrier' }, sortOrder: 6 },
  { category: 'VESSEL_TYPE', code: 'GILLNETTER', name: { en: 'Gillnetter', fr: 'Fileyeur' }, sortOrder: 7 },
];

const FARM_TYPES: FisheryRefSeed[] = [
  { category: 'FARM_TYPE', code: 'POND', name: { en: 'Pond', fr: 'Etang' }, sortOrder: 1 },
  { category: 'FARM_TYPE', code: 'CAGE', name: { en: 'Cage', fr: 'Cage flottante' }, sortOrder: 2 },
  { category: 'FARM_TYPE', code: 'RACEWAY', name: { en: 'Raceway', fr: 'Raceway / Canal' }, sortOrder: 3 },
  { category: 'FARM_TYPE', code: 'TANK', name: { en: 'Tank', fr: 'Bassin / Bac' }, sortOrder: 4 },
  { category: 'FARM_TYPE', code: 'RAS', name: { en: 'Recirculating aquaculture system (RAS)', fr: 'Systeme aquacole en recirculation (RAS)' }, sortOrder: 5 },
  { category: 'FARM_TYPE', code: 'PEN', name: { en: 'Pen / Enclosure', fr: 'Enclos' }, sortOrder: 6 },
];

const CULTURE_METHODS: FisheryRefSeed[] = [
  { category: 'CULTURE_METHOD', code: 'POND_CULTURE', name: { en: 'Pond culture', fr: 'Pisciculture en etang' }, sortOrder: 1 },
  { category: 'CULTURE_METHOD', code: 'CAGE_CULTURE', name: { en: 'Cage culture', fr: 'Elevage en cage' }, sortOrder: 2 },
  { category: 'CULTURE_METHOD', code: 'RACEWAY_CULTURE', name: { en: 'Raceway culture', fr: 'Elevage en raceway' }, sortOrder: 3 },
  { category: 'CULTURE_METHOD', code: 'RAS_CULTURE', name: { en: 'RAS culture', fr: 'Elevage en RAS' }, sortOrder: 4 },
  { category: 'CULTURE_METHOD', code: 'PEN_CULTURE', name: { en: 'Pen culture', fr: 'Elevage en enclos' }, sortOrder: 5 },
  { category: 'CULTURE_METHOD', code: 'INTEGRATED', name: { en: 'Integrated aquaculture (fish + crops/livestock)', fr: 'Aquaculture integree (poisson + cultures/elevage)' }, sortOrder: 6 },
];

const FISHING_AREAS: FisheryRefSeed[] = [
  { category: 'FISHING_AREA', code: '01', name: { en: 'Africa — Inland waters', fr: 'Afrique — Eaux interieures' }, faoCode: '01', sortOrder: 1 },
  { category: 'FISHING_AREA', code: '34', name: { en: 'Atlantic, Eastern Central', fr: 'Atlantique, Centre-Est' }, faoCode: '34', sortOrder: 2 },
  { category: 'FISHING_AREA', code: '47', name: { en: 'Atlantic, Southeast', fr: 'Atlantique, Sud-Est' }, faoCode: '47', sortOrder: 3 },
  { category: 'FISHING_AREA', code: '51', name: { en: 'Indian Ocean, Western', fr: 'Ocean Indien, Ouest' }, faoCode: '51', sortOrder: 4 },
  { category: 'FISHING_AREA', code: '57', name: { en: 'Indian Ocean, Eastern', fr: 'Ocean Indien, Est' }, faoCode: '57', sortOrder: 5 },
  { category: 'FISHING_AREA', code: '37', name: { en: 'Mediterranean and Black Sea', fr: 'Mediterranee et Mer Noire' }, faoCode: '37', sortOrder: 6 },
];

const FISH_CATEGORIES: FisheryRefSeed[] = [
  { category: 'FISH_CATEGORY', code: 'FINFISH', name: { en: 'Finfish', fr: 'Poissons' }, sortOrder: 1 },
  { category: 'FISH_CATEGORY', code: 'CRUSTACEAN', name: { en: 'Crustacean', fr: 'Crustace' }, sortOrder: 2 },
  { category: 'FISH_CATEGORY', code: 'MOLLUSC', name: { en: 'Mollusc', fr: 'Mollusque' }, sortOrder: 3 },
  { category: 'FISH_CATEGORY', code: 'AQUATIC_PLANT', name: { en: 'Aquatic plant / Seaweed', fr: 'Plante aquatique / Algue' }, sortOrder: 4 },
  { category: 'FISH_CATEGORY', code: 'CEPHALOPOD', name: { en: 'Cephalopod', fr: 'Cephalopode' }, sortOrder: 5 },
];

const PRODUCT_STATES: FisheryRefSeed[] = [
  { category: 'PRODUCT_STATE', code: 'LIVE', name: { en: 'Live', fr: 'Vivant' }, sortOrder: 1 },
  { category: 'PRODUCT_STATE', code: 'FRESH', name: { en: 'Fresh', fr: 'Frais' }, sortOrder: 2 },
  { category: 'PRODUCT_STATE', code: 'FROZEN', name: { en: 'Frozen', fr: 'Congele' }, sortOrder: 3 },
  { category: 'PRODUCT_STATE', code: 'DRIED', name: { en: 'Dried', fr: 'Seche' }, sortOrder: 4 },
  { category: 'PRODUCT_STATE', code: 'SMOKED', name: { en: 'Smoked', fr: 'Fume' }, sortOrder: 5 },
  { category: 'PRODUCT_STATE', code: 'CANNED', name: { en: 'Canned', fr: 'En conserve' }, sortOrder: 6 },
  { category: 'PRODUCT_STATE', code: 'SALTED', name: { en: 'Salted', fr: 'Sale' }, sortOrder: 7 },
  { category: 'PRODUCT_STATE', code: 'FILLETED', name: { en: 'Filleted', fr: 'En filets' }, sortOrder: 8 },
];

const ALL_SEEDS: FisheryRefSeed[] = [
  ...GEAR_TYPES,
  ...VESSEL_TYPES,
  ...FARM_TYPES,
  ...CULTURE_METHODS,
  ...FISHING_AREAS,
  ...FISH_CATEGORIES,
  ...PRODUCT_STATES,
];

export async function seedFisheryReferentials(prisma: PrismaClient): Promise<number> {
  let count = 0;

  for (const seed of ALL_SEEDS) {
    await (prisma as any).fisheryReferential.upsert({
      where: {
        category_code: { category: seed.category, code: seed.code },
      },
      update: {},
      create: {
        category: seed.category,
        code: seed.code,
        name: seed.name,
        faoCode: seed.faoCode ?? null,
        sortOrder: seed.sortOrder,
        isActive: true,
        metadata: {},
      },
    });
    count++;
  }

  return count;
}

export { ALL_SEEDS as FISHERY_REF_SEEDS };
