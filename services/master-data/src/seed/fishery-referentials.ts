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
  { category: 'GEAR_TYPE', code: 'TRAWL', name: { en: 'Trawl net', fr: 'Chalut' }, faoCode: '03.0.0', sortOrder: 3 },
  { category: 'GEAR_TYPE', code: 'LONGLINE', name: { en: 'Longline', fr: 'Palangre' }, faoCode: '09.3.0', sortOrder: 4 },
  { category: 'GEAR_TYPE', code: 'TRAP', name: { en: 'Trap', fr: 'Nasse / Casier' }, faoCode: '08.0.0', sortOrder: 5 },
  { category: 'GEAR_TYPE', code: 'CAST_NET', name: { en: 'Cast net', fr: 'Epervier' }, faoCode: '04.0.0', sortOrder: 6 },
  { category: 'GEAR_TYPE', code: 'BEACH_SEINE', name: { en: 'Beach seine', fr: 'Senne de plage' }, faoCode: '02.1.0', sortOrder: 7 },
  { category: 'GEAR_TYPE', code: 'PURSE_SEINE', name: { en: 'Purse seine', fr: 'Senne coulissante' }, faoCode: '02.2.0', sortOrder: 8 },
  { category: 'GEAR_TYPE', code: 'DREDGE', name: { en: 'Dredge', fr: 'Drague' }, faoCode: '06.0.0', sortOrder: 9 },
  { category: 'GEAR_TYPE', code: 'HOOK_LINE', name: { en: 'Hook and line', fr: 'Ligne et hamecon' }, faoCode: '09.0.0', sortOrder: 10 },
  { category: 'GEAR_TYPE', code: 'DRAG_NET', name: { en: 'Drag net', fr: 'Filet trainant' }, faoCode: '03.1.0', sortOrder: 11 },
];

const VESSEL_TYPES: FisheryRefSeed[] = [
  { category: 'VESSEL_TYPE', code: 'CANOE', name: { en: 'Canoe', fr: 'Pirogue' }, sortOrder: 1 },
  { category: 'VESSEL_TYPE', code: 'ARTISANAL', name: { en: 'Artisanal canoe / pirogue', fr: 'Pirogue artisanale' }, sortOrder: 2 },
  { category: 'VESSEL_TYPE', code: 'SEMI_INDUSTRIAL', name: { en: 'Semi-industrial vessel', fr: 'Navire semi-industriel' }, sortOrder: 3 },
  { category: 'VESSEL_TYPE', code: 'INDUSTRIAL', name: { en: 'Industrial vessel', fr: 'Navire industriel' }, sortOrder: 4 },
  { category: 'VESSEL_TYPE', code: 'DEMERSAL_TRAWLER', name: { en: 'Demersal Trawler', fr: 'Chalutier demersal' }, sortOrder: 5 },
  { category: 'VESSEL_TYPE', code: 'PELAGIC_TRAWLER', name: { en: 'Pelagic Trawler', fr: 'Chalutier pelagique' }, sortOrder: 6 },
  { category: 'VESSEL_TYPE', code: 'TRAWLER', name: { en: 'Trawler', fr: 'Chalutier' }, sortOrder: 7 },
  { category: 'VESSEL_TYPE', code: 'PURSE_SEINER', name: { en: 'Purse seiner', fr: 'Senneur' }, sortOrder: 8 },
  { category: 'VESSEL_TYPE', code: 'LONGLINER', name: { en: 'Longliner', fr: 'Palangrier' }, sortOrder: 9 },
  { category: 'VESSEL_TYPE', code: 'GILLNETTER', name: { en: 'Gillnetter', fr: 'Fileyeur' }, sortOrder: 10 },
  { category: 'VESSEL_TYPE', code: 'TUNA_FLEET', name: { en: 'Tuna Fleet', fr: 'Flottille thoniere' }, sortOrder: 11 },
  { category: 'VESSEL_TYPE', code: 'SHRIMPERS', name: { en: 'Shrimpers', fr: 'Crevettier' }, sortOrder: 12 },
  { category: 'VESSEL_TYPE', code: 'BOAT', name: { en: 'Boat', fr: 'Bateau' }, sortOrder: 13 },
];

const FARM_TYPES: FisheryRefSeed[] = [
  { category: 'FARM_TYPE', code: 'TANK', name: { en: 'Tank', fr: 'Bassin / Bac' }, sortOrder: 1 },
  { category: 'FARM_TYPE', code: 'POND', name: { en: 'Ponds', fr: 'Etangs' }, sortOrder: 2 },
  { category: 'FARM_TYPE', code: 'RAS', name: { en: 'Recirculating aquaculture system (RAS)', fr: 'Systeme aquacole en recirculation (RAS)' }, sortOrder: 3 },
  { category: 'FARM_TYPE', code: 'CAGE', name: { en: 'Cage / Pen', fr: 'Cage / Enclos' }, sortOrder: 4 },
  { category: 'FARM_TYPE', code: 'RACEWAY', name: { en: 'Raceway', fr: 'Raceway / Canal' }, sortOrder: 5 },
  { category: 'FARM_TYPE', code: 'RACKS', name: { en: 'Racks', fr: 'Casiers / Racks' }, sortOrder: 6 },
  { category: 'FARM_TYPE', code: 'LONG_LINES', name: { en: 'Long lines', fr: 'Filières' }, sortOrder: 7 },
  { category: 'FARM_TYPE', code: 'TUBES_BASKET', name: { en: 'Tubes / Basket', fr: 'Tubes / Paniers' }, sortOrder: 8 },
  { category: 'FARM_TYPE', code: 'PEN', name: { en: 'Pen / Enclosure', fr: 'Enclos' }, sortOrder: 9 },
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
  { category: 'FISH_CATEGORY', code: 'SEAWEED', name: { en: 'Seaweed', fr: 'Algues' }, sortOrder: 1 },
  { category: 'FISH_CATEGORY', code: 'FINFISH', name: { en: 'Finfish', fr: 'Poissons' }, sortOrder: 2 },
  { category: 'FISH_CATEGORY', code: 'SHELLFISH', name: { en: 'Shellfish', fr: 'Coquillages / Crustaces' }, sortOrder: 3 },
  { category: 'FISH_CATEGORY', code: 'CRUSTACEAN', name: { en: 'Crustacean', fr: 'Crustace' }, sortOrder: 4 },
  { category: 'FISH_CATEGORY', code: 'MOLLUSC', name: { en: 'Mollusc', fr: 'Mollusque' }, sortOrder: 5 },
  { category: 'FISH_CATEGORY', code: 'AQUATIC_PLANT', name: { en: 'Aquatic plant', fr: 'Plante aquatique' }, sortOrder: 6 },
  { category: 'FISH_CATEGORY', code: 'CEPHALOPOD', name: { en: 'Cephalopod', fr: 'Cephalopode' }, sortOrder: 7 },
];

// ── AFAData reference data (new categories) ──

const FISHERY_TYPES: FisheryRefSeed[] = [
  { category: 'FISHERY_TYPE', code: 'ARTISANAL_GLEANER', name: { en: 'Artisanal / Gleaner', fr: 'Artisanal / Glaneur' }, sortOrder: 1 },
  { category: 'FISHERY_TYPE', code: 'ARTISANAL', name: { en: 'Artisanal', fr: 'Artisanal' }, sortOrder: 2 },
  { category: 'FISHERY_TYPE', code: 'SEMI_INDUSTRIAL', name: { en: 'Semi-industrial', fr: 'Semi-industriel' }, sortOrder: 3 },
  { category: 'FISHERY_TYPE', code: 'INDUSTRIAL', name: { en: 'Industrial', fr: 'Industriel' }, sortOrder: 4 },
  { category: 'FISHERY_TYPE', code: 'RECREATIONAL', name: { en: 'Recreational', fr: 'Recreatif' }, sortOrder: 5 },
  { category: 'FISHERY_TYPE', code: 'GLEANING', name: { en: 'Gleaning', fr: 'Glanage' }, sortOrder: 6 },
];

const FISHING_ENVIRONMENTS: FisheryRefSeed[] = [
  { category: 'FISHING_ENVIRONMENT', code: 'FRESHWATER', name: { en: 'Freshwater', fr: 'Eau douce' }, sortOrder: 1 },
  { category: 'FISHING_ENVIRONMENT', code: 'BRACKISH', name: { en: 'Brackish', fr: 'Eau saumatre' }, sortOrder: 2 },
  { category: 'FISHING_ENVIRONMENT', code: 'MARINE', name: { en: 'Marine', fr: 'Marine' }, sortOrder: 3 },
];

const FISHING_SYSTEMS: FisheryRefSeed[] = [
  { category: 'FISHING_SYSTEM', code: 'EXTENSIVE', name: { en: 'Extensive', fr: 'Extensif' }, sortOrder: 1 },
  { category: 'FISHING_SYSTEM', code: 'INTENSIVE', name: { en: 'Intensive', fr: 'Intensif' }, sortOrder: 2 },
  { category: 'FISHING_SYSTEM', code: 'SEMI_INTENSIVE', name: { en: 'Semi-intensive', fr: 'Semi-intensif' }, sortOrder: 3 },
];

const EFFORT_TYPES: FisheryRefSeed[] = [
  { category: 'EFFORT_TYPE', code: 'NUM_VESSELS', name: { en: 'Number of Vessels', fr: 'Nombre de navires' }, sortOrder: 1 },
  { category: 'EFFORT_TYPE', code: 'NUM_FISHING_DAYS', name: { en: 'Number of Fishing days', fr: 'Nombre de jours de peche' }, sortOrder: 2 },
  { category: 'EFFORT_TYPE', code: 'NUM_FISHING_TRIPS', name: { en: 'Number of Fishing trips', fr: 'Nombre de sorties' }, sortOrder: 3 },
  { category: 'EFFORT_TYPE', code: 'NUM_FISHERMEN', name: { en: 'Number of Fishermen', fr: 'Nombre de pecheurs' }, sortOrder: 4 },
];

const OPERATIONAL_SIZES: FisheryRefSeed[] = [
  { category: 'OPERATIONAL_SIZE', code: 'SMALL', name: { en: 'Small scale (below 5 mt/yr)', fr: 'Petite echelle (moins de 5 t/an)' }, sortOrder: 1 },
  { category: 'OPERATIONAL_SIZE', code: 'MEDIUM', name: { en: 'Medium (between 5 - 50 mt/yr)', fr: 'Moyen (entre 5 - 50 t/an)' }, sortOrder: 2 },
  { category: 'OPERATIONAL_SIZE', code: 'LARGE', name: { en: 'Large (above 50 mt/yr)', fr: 'Grande echelle (plus de 50 t/an)' }, sortOrder: 3 },
];

const PRODUCTION_NODES: FisheryRefSeed[] = [
  { category: 'PRODUCTION_NODE', code: 'HATCHERY', name: { en: 'Hatchery', fr: 'Ecloserie' }, sortOrder: 1 },
  { category: 'PRODUCTION_NODE', code: 'OUT_GROWER', name: { en: 'Out-grower', fr: 'Sous-traitant grossissement' }, sortOrder: 2 },
  { category: 'PRODUCTION_NODE', code: 'BROODSTOCK', name: { en: 'Broodstock Production', fr: 'Production de geniteurs' }, sortOrder: 3 },
  { category: 'PRODUCTION_NODE', code: 'OFFSHORE_CAGES', name: { en: 'Marine aquaculture in offshore cages', fr: 'Aquaculture marine en cages offshore' }, sortOrder: 4 },
];

const PRODUCTION_TYPES: FisheryRefSeed[] = [
  { category: 'PRODUCTION_TYPE', code: 'AQUACULTURE', name: { en: 'Aquaculture', fr: 'Aquaculture' }, sortOrder: 1 },
  { category: 'PRODUCTION_TYPE', code: 'CAPTURE', name: { en: 'Capture fisheries', fr: 'Peche de capture' }, sortOrder: 2 },
];

const TRADE_TYPES: FisheryRefSeed[] = [
  { category: 'TRADE_TYPE', code: 'EXPORT', name: { en: 'Export', fr: 'Exportation' }, sortOrder: 1 },
  { category: 'TRADE_TYPE', code: 'IMPORT', name: { en: 'Import', fr: 'Importation' }, sortOrder: 2 },
];

const GENDERS: FisheryRefSeed[] = [
  { category: 'GENDER', code: 'MALE', name: { en: 'Male', fr: 'Masculin' }, sortOrder: 1 },
  { category: 'GENDER', code: 'FEMALE', name: { en: 'Female', fr: 'Feminin' }, sortOrder: 2 },
  { category: 'GENDER', code: 'NOT_DISCLOSED', name: { en: 'Prefer not to disclose', fr: 'Prefere ne pas divulguer' }, sortOrder: 3 },
];

const AGE_RANGES: FisheryRefSeed[] = [
  { category: 'AGE_RANGE', code: '15_24', name: { en: '15 - 24', fr: '15 - 24' }, sortOrder: 1 },
  { category: 'AGE_RANGE', code: '25_34', name: { en: '25 - 34', fr: '25 - 34' }, sortOrder: 2 },
  { category: 'AGE_RANGE', code: '35_44', name: { en: '35 - 44', fr: '35 - 44' }, sortOrder: 3 },
  { category: 'AGE_RANGE', code: '45_54', name: { en: '45 - 54', fr: '45 - 54' }, sortOrder: 4 },
  { category: 'AGE_RANGE', code: '55_PLUS', name: { en: '>= 54', fr: '>= 54' }, sortOrder: 5 },
];

const PRODUCT_STATES: FisheryRefSeed[] = [
  { category: 'PRODUCT_STATE', code: 'FISH_OIL', name: { en: 'Fish Oil', fr: 'Huile de poisson' }, sortOrder: 1 },
  { category: 'PRODUCT_STATE', code: 'FISH_MEAL', name: { en: 'Fish Meal', fr: 'Farine de poisson' }, sortOrder: 2 },
  { category: 'PRODUCT_STATE', code: 'FRESH', name: { en: 'Fresh', fr: 'Frais' }, sortOrder: 3 },
  { category: 'PRODUCT_STATE', code: 'LIVE', name: { en: 'Live', fr: 'Vivant' }, sortOrder: 4 },
  { category: 'PRODUCT_STATE', code: 'FILLETED', name: { en: 'Fillet', fr: 'Filet' }, sortOrder: 5 },
  { category: 'PRODUCT_STATE', code: 'FROZEN', name: { en: 'Frozen', fr: 'Congele' }, sortOrder: 6 },
  { category: 'PRODUCT_STATE', code: 'SMOKED', name: { en: 'Smoked', fr: 'Fume' }, sortOrder: 7 },
  { category: 'PRODUCT_STATE', code: 'DRIED', name: { en: 'Dried', fr: 'Seche' }, sortOrder: 8 },
  { category: 'PRODUCT_STATE', code: 'CANNED', name: { en: 'Canned', fr: 'En conserve' }, sortOrder: 9 },
  { category: 'PRODUCT_STATE', code: 'SALTED', name: { en: 'Salted', fr: 'Sale' }, sortOrder: 10 },
];

const ALL_SEEDS: FisheryRefSeed[] = [
  ...GEAR_TYPES,
  ...VESSEL_TYPES,
  ...FARM_TYPES,
  ...CULTURE_METHODS,
  ...FISHING_AREAS,
  ...FISH_CATEGORIES,
  ...PRODUCT_STATES,
  ...FISHERY_TYPES,
  ...FISHING_ENVIRONMENTS,
  ...FISHING_SYSTEMS,
  ...EFFORT_TYPES,
  ...OPERATIONAL_SIZES,
  ...PRODUCTION_NODES,
  ...PRODUCTION_TYPES,
  ...TRADE_TYPES,
  ...GENDERS,
  ...AGE_RANGES,
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
