/**
 * GeoZone seed data — domain-specific geographic zones for pilot countries.
 * Zones group ADMIN1 divisions by epidemiological/ecological/economic criteria.
 * memberCodes reference GeoEntity codes (resolved to IDs at seed time).
 */

export interface GeoZoneSeed {
  countryCode: string;
  domainCode: string;
  code: string;
  name: Record<string, string>;
  description?: Record<string, string>;
  memberCodes: string[]; // GeoEntity codes (ADMIN1), resolved to UUIDs at seed time
  sortOrder: number;
}

// ── Kenya — Animal Health ──
const KE_ANIMAL_HEALTH: GeoZoneSeed[] = [
  {
    countryCode: 'KE', domainCode: 'animal-health', code: 'KE_AH_HIGHLANDS',
    name: { en: 'Central Highlands', fr: 'Hauts plateaux centraux', pt: 'Planalto Central', ar: 'المرتفعات الوسطى' },
    description: { en: 'Highland zone — dairy-intensive, FMD/ECF surveillance', fr: 'Zone des hauts plateaux — élevage laitier intensif, surveillance FA/ECF' },
    memberCodes: ['KE-30', 'KE-12', 'KE-13', 'KE-22', 'KE-28', 'KE-36', 'KE-37'],
    sortOrder: 1,
  },
  {
    countryCode: 'KE', domainCode: 'animal-health', code: 'KE_AH_ASAL',
    name: { en: 'ASAL Pastoral Zone', fr: 'Zone pastorale ASAL', pt: 'Zona pastoral ASAL', ar: 'منطقة الرعوية ASAL' },
    description: { en: 'Arid and semi-arid — pastoral systems, CCPP/RVF/PPR hotspots', fr: 'Zone aride/semi-aride — systèmes pastoraux, points chauds PPCB/FVR/PPR' },
    memberCodes: ['KE-10', 'KE-23', 'KE-25', 'KE-46', 'KE-09', 'KE-18'],
    sortOrder: 2,
  },
  {
    countryCode: 'KE', domainCode: 'animal-health', code: 'KE_AH_COAST',
    name: { en: 'Coastal Zone', fr: 'Zone côtière', pt: 'Zona costeira', ar: 'المنطقة الساحلية' },
    description: { en: 'Coastal counties — trypanosomosis, tick-borne diseases', fr: 'Comtés côtiers — trypanosomose, maladies vectorielles' },
    memberCodes: ['KE-01', 'KE-02', 'KE-03', 'KE-04', 'KE-05', 'KE-06'],
    sortOrder: 3,
  },
];

// ── Kenya — Livestock ──
const KE_LIVESTOCK: GeoZoneSeed[] = [
  {
    countryCode: 'KE', domainCode: 'livestock', code: 'KE_LV_DAIRY_BELT',
    name: { en: 'Dairy Belt', fr: 'Ceinture laitière', pt: 'Cinturão leiteiro', ar: 'حزام الألبان' },
    memberCodes: ['KE-30', 'KE-12', 'KE-13', 'KE-28', 'KE-36', 'KE-32'],
    sortOrder: 1,
  },
  {
    countryCode: 'KE', domainCode: 'livestock', code: 'KE_LV_PASTORAL',
    name: { en: 'Pastoral Rangeland', fr: 'Parcours pastoral', pt: 'Pastagem pastoral', ar: 'المراعي الرعوية' },
    memberCodes: ['KE-10', 'KE-23', 'KE-25', 'KE-46', 'KE-09'],
    sortOrder: 2,
  },
];

// ── Senegal — Animal Health ──
const SN_ANIMAL_HEALTH: GeoZoneSeed[] = [
  {
    countryCode: 'SN', domainCode: 'animal-health', code: 'SN_AH_NORTH',
    name: { en: 'Northern Pastoral Zone', fr: 'Zone pastorale Nord', pt: 'Zona pastoral Norte', ar: 'المنطقة الرعوية الشمالية' },
    description: { en: 'Sahel zone — transhumance corridor, PPR/CBPP', fr: 'Zone sahélienne — corridor de transhumance, PPR/PPCB' },
    memberCodes: ['SN-SL', 'SN-MT', 'SN-LG'],
    sortOrder: 1,
  },
  {
    countryCode: 'SN', domainCode: 'animal-health', code: 'SN_AH_CASAMANCE',
    name: { en: 'Casamance Zone', fr: 'Zone Casamance', pt: 'Zona Casamança', ar: 'منطقة كازامانس' },
    description: { en: 'Southern zone — trypanosomosis, ASF', fr: 'Zone sud — trypanosomose, PPA' },
    memberCodes: ['SN-ZG', 'SN-SE', 'SN-KD'],
    sortOrder: 2,
  },
  {
    countryCode: 'SN', domainCode: 'animal-health', code: 'SN_AH_CENTRE',
    name: { en: 'Central Groundnut Basin', fr: 'Bassin arachidier', pt: 'Bacia do amendoim', ar: 'حوض الفول السوداني' },
    memberCodes: ['SN-KL', 'SN-FK', 'SN-DL', 'SN-TH'],
    sortOrder: 3,
  },
];

// ── Nigeria — Animal Health ──
const NG_ANIMAL_HEALTH: GeoZoneSeed[] = [
  {
    countryCode: 'NG', domainCode: 'animal-health', code: 'NG_AH_NORTH',
    name: { en: 'Northern Savanna', fr: 'Savane du Nord', pt: 'Savana do Norte', ar: 'سافانا الشمال' },
    description: { en: 'Guinea/Sudan savanna — PPR/CBPP endemic zone', fr: 'Savane guinéenne/soudanaise — zone endémique PPR/PPCB' },
    memberCodes: ['NG-KN', 'NG-KT', 'NG-SO', 'NG-ZA', 'NG-KD', 'NG-BO', 'NG-JI'],
    sortOrder: 1,
  },
  {
    countryCode: 'NG', domainCode: 'animal-health', code: 'NG_AH_MIDDLE_BELT',
    name: { en: 'Middle Belt', fr: 'Ceinture médiane', pt: 'Cinturão médio', ar: 'الحزام الأوسط' },
    description: { en: 'Transition zone — mixed farming, FMD/AI risk', fr: 'Zone de transition — agriculture mixte, risque FA/IA' },
    memberCodes: ['NG-PL', 'NG-NA', 'NG-NI', 'NG-KW', 'NG-BE', 'NG-AD'],
    sortOrder: 2,
  },
  {
    countryCode: 'NG', domainCode: 'animal-health', code: 'NG_AH_SOUTH',
    name: { en: 'Southern Coastal', fr: 'Côtier Sud', pt: 'Litoral Sul', ar: 'الساحل الجنوبي' },
    description: { en: 'Humid zone — ASF/trypanosomosis, poultry-intensive', fr: 'Zone humide — PPA/trypanosomose, aviculture intensive' },
    memberCodes: ['NG-LA', 'NG-OG', 'NG-ON', 'NG-ED', 'NG-DE', 'NG-BA', 'NG-RI', 'NG-CR'],
    sortOrder: 3,
  },
];

// ── Ethiopia — Animal Health ──
const ET_ANIMAL_HEALTH: GeoZoneSeed[] = [
  {
    countryCode: 'ET', domainCode: 'animal-health', code: 'ET_AH_HIGHLANDS',
    name: { en: 'Ethiopian Highlands', fr: 'Hauts plateaux éthiopiens', pt: 'Planalto etíope', ar: 'المرتفعات الإثيوبية' },
    memberCodes: ['ET-AM', 'ET-TI', 'ET-OR'],
    sortOrder: 1,
  },
  {
    countryCode: 'ET', domainCode: 'animal-health', code: 'ET_AH_LOWLANDS',
    name: { en: 'Eastern Lowlands', fr: 'Basses terres orientales', pt: 'Terras baixas orientais', ar: 'المنخفضات الشرقية' },
    description: { en: 'Pastoral lowlands — RVF/CCPP/camel diseases', fr: 'Basses terres pastorales — FVR/PPCB/maladies camelines' },
    memberCodes: ['ET-SO', 'ET-AF', 'ET-DD'],
    sortOrder: 2,
  },
];

// ── South Africa — Animal Health ──
const ZA_ANIMAL_HEALTH: GeoZoneSeed[] = [
  {
    countryCode: 'ZA', domainCode: 'animal-health', code: 'ZA_AH_FMD_ZONE',
    name: { en: 'FMD Protection Zone', fr: 'Zone de protection FA', pt: 'Zona de proteção FA', ar: 'منطقة حماية الحمى القلاعية' },
    description: { en: 'FMD control zone with movement restrictions', fr: 'Zone de contrôle FA avec restrictions de mouvements' },
    memberCodes: ['ZA-LP', 'ZA-MP', 'ZA-NW'],
    sortOrder: 1,
  },
  {
    countryCode: 'ZA', domainCode: 'animal-health', code: 'ZA_AH_FREE_ZONE',
    name: { en: 'FMD-Free Zone', fr: 'Zone indemne de FA', pt: 'Zona livre de FA', ar: 'منطقة خالية من الحمى القلاعية' },
    memberCodes: ['ZA-WC', 'ZA-EC', 'ZA-NC', 'ZA-FS', 'ZA-GT', 'ZA-KZN'],
    sortOrder: 2,
  },
];

export const GEO_ZONE_SEEDS: GeoZoneSeed[] = [
  ...KE_ANIMAL_HEALTH,
  ...KE_LIVESTOCK,
  ...SN_ANIMAL_HEALTH,
  ...NG_ANIMAL_HEALTH,
  ...ET_ANIMAL_HEALTH,
  ...ZA_ANIMAL_HEALTH,
];
