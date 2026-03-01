// ─── 8 Regional Economic Communities (RECs) recognized by the AU ──────────────

export interface RecConfig {
  code: string;
  name: string;
  nameFr: string;
  fullName: string;
  fullNameFr: string;
  color: string;           // Primary brand color
  colorLight: string;      // Light variant for backgrounds
  colorDark: string;       // Dark variant for text
  region: string;          // Geographic region
  regionFr: string;
  memberCount: number;
  headquarters: string;
  establishedYear: number;
  description: string;
  descriptionFr: string;
  countryCodes: string[];  // ISO alpha-2 codes
  tenantId: string;        // Linked tenant UUID
}

export const RECS: Record<string, RecConfig> = {
  ecowas: {
    code: 'ecowas',
    name: 'ECOWAS',
    nameFr: 'CEDEAO',
    fullName: 'Economic Community of West African States',
    fullNameFr: 'Communaut\u00e9 \u00e9conomique des \u00c9tats de l\u2019Afrique de l\u2019Ouest',
    color: '#003399',
    colorLight: '#E8EEF9',
    colorDark: '#001A4D',
    region: 'West Africa',
    regionFr: 'Afrique de l\u2019Ouest',
    memberCount: 15,
    headquarters: 'Abuja, Nigeria',
    establishedYear: 1975,
    description: 'Regional economic union promoting economic integration across West Africa, with 15 member states spanning from Senegal to Nigeria.',
    descriptionFr: 'Union \u00e9conomique r\u00e9gionale favorisant l\u2019int\u00e9gration \u00e9conomique en Afrique de l\u2019Ouest, avec 15 \u00c9tats membres.',
    countryCodes: ['BJ', 'BF', 'CV', 'CI', 'GM', 'GH', 'GN', 'GW', 'LR', 'ML', 'NE', 'NG', 'SN', 'SL', 'TG'],
    tenantId: '00000000-0000-4000-a000-000000000020',
  },
  eccas: {
    code: 'eccas',
    name: 'ECCAS',
    nameFr: 'CEEAC',
    fullName: 'Economic Community of Central African States',
    fullNameFr: 'Communaut\u00e9 \u00e9conomique des \u00c9tats de l\u2019Afrique centrale',
    color: '#8B0000',
    colorLight: '#F9E8E8',
    colorDark: '#5C0000',
    region: 'Central Africa',
    regionFr: 'Afrique centrale',
    memberCount: 11,
    headquarters: 'Libreville, Gabon',
    establishedYear: 1983,
    description: 'Economic community fostering integration and cooperation among Central African nations, from Cameroon to Angola.',
    descriptionFr: 'Communaut\u00e9 \u00e9conomique promouvant l\u2019int\u00e9gration et la coop\u00e9ration entre les nations d\u2019Afrique centrale.',
    countryCodes: ['AO', 'BI', 'CM', 'CF', 'TD', 'CG', 'CD', 'GQ', 'GA', 'RW', 'ST'],
    tenantId: '00000000-0000-4000-a000-000000000050',
  },
  eac: {
    code: 'eac',
    name: 'EAC',
    nameFr: 'CAE',
    fullName: 'East African Community',
    fullNameFr: 'Communaut\u00e9 d\u2019Afrique de l\u2019Est',
    color: '#006B3F',
    colorLight: '#E6F4ED',
    colorDark: '#003D24',
    region: 'East Africa',
    regionFr: 'Afrique de l\u2019Est',
    memberCount: 7,
    headquarters: 'Arusha, Tanzania',
    establishedYear: 2000,
    description: 'Intergovernmental organization of 7 partner states in the East African region, with a common market and customs union.',
    descriptionFr: 'Organisation intergouvernementale de 7 \u00c9tats partenaires de la r\u00e9gion est-africaine avec march\u00e9 commun.',
    countryCodes: ['BI', 'CD', 'KE', 'RW', 'SS', 'TZ', 'UG'],
    tenantId: '00000000-0000-4000-a000-000000000040',
  },
  sadc: {
    code: 'sadc',
    name: 'SADC',
    nameFr: 'SADC',
    fullName: 'Southern African Development Community',
    fullNameFr: 'Communaut\u00e9 de d\u00e9veloppement de l\u2019Afrique australe',
    color: '#00308F',
    colorLight: '#E6ECF7',
    colorDark: '#001A4D',
    region: 'Southern Africa',
    regionFr: 'Afrique australe',
    memberCount: 16,
    headquarters: 'Gaborone, Botswana',
    establishedYear: 1992,
    description: 'Regional community of 16 member states committed to regional integration and poverty eradication through economic development.',
    descriptionFr: 'Communaut\u00e9 r\u00e9gionale de 16 \u00c9tats membres engag\u00e9s dans l\u2019int\u00e9gration r\u00e9gionale et le d\u00e9veloppement \u00e9conomique.',
    countryCodes: ['AO', 'BW', 'KM', 'CD', 'SZ', 'LS', 'MG', 'MW', 'MU', 'MZ', 'NA', 'SC', 'ZA', 'TZ', 'ZM', 'ZW'],
    tenantId: '00000000-0000-4000-a000-000000000030',
  },
  igad: {
    code: 'igad',
    name: 'IGAD',
    nameFr: 'IGAD',
    fullName: 'Intergovernmental Authority on Development',
    fullNameFr: 'Autorit\u00e9 intergouvernementale pour le d\u00e9veloppement',
    color: '#FF8C00',
    colorLight: '#FFF3E0',
    colorDark: '#CC7000',
    region: 'Horn of Africa',
    regionFr: 'Corne de l\u2019Afrique',
    memberCount: 8,
    headquarters: 'Djibouti City, Djibouti',
    establishedYear: 1996,
    description: 'Regional development organization focused on drought control, food security, and conflict resolution in the Horn of Africa.',
    descriptionFr: 'Organisation r\u00e9gionale ax\u00e9e sur la s\u00e9curit\u00e9 alimentaire et la r\u00e9solution des conflits dans la Corne de l\u2019Afrique.',
    countryCodes: ['DJ', 'ER', 'ET', 'KE', 'SO', 'SS', 'SD', 'UG'],
    tenantId: '00000000-0000-4000-a000-000000000010',
  },
  uma: {
    code: 'uma',
    name: 'UMA',
    nameFr: 'UMA',
    fullName: 'Arab Maghreb Union',
    fullNameFr: 'Union du Maghreb arabe',
    color: '#4B0082',
    colorLight: '#F0E6FA',
    colorDark: '#2D004D',
    region: 'North Africa',
    regionFr: 'Afrique du Nord',
    memberCount: 5,
    headquarters: 'Rabat, Morocco',
    establishedYear: 1989,
    description: 'Trade agreement between five North African countries aiming at economic and political unity among Maghreb states.',
    descriptionFr: 'Accord commercial entre cinq pays nord-africains visant l\u2019unit\u00e9 \u00e9conomique et politique du Maghreb.',
    countryCodes: ['DZ', 'LY', 'MR', 'MA', 'TN'],
    tenantId: '00000000-0000-4000-a000-000000000060',
  },
  censad: {
    code: 'censad',
    name: 'CEN-SAD',
    nameFr: 'CEN-SAD',
    fullName: 'Community of Sahel-Saharan States',
    fullNameFr: 'Communaut\u00e9 des \u00c9tats sah\u00e9lo-sahariens',
    color: '#DAA520',
    colorLight: '#FDF6E3',
    colorDark: '#8B6914',
    region: 'Sahel-Sahara',
    regionFr: 'Sahel-Sahara',
    memberCount: 29,
    headquarters: 'Tripoli, Libya',
    establishedYear: 1998,
    description: 'The largest REC by membership, bridging Saharan and sub-Saharan Africa with 29 member states focused on economic cooperation.',
    descriptionFr: 'La plus grande CER par le nombre de membres, reliant l\u2019Afrique saharienne et subsaharienne avec 29 \u00c9tats membres.',
    countryCodes: ['BJ', 'BF', 'CF', 'KM', 'CI', 'DJ', 'EG', 'ER', 'GM', 'GH', 'GN', 'GW', 'KE', 'LR', 'LY', 'ML', 'MR', 'MA', 'NE', 'NG', 'ST', 'SN', 'SL', 'SO', 'SD', 'TD', 'TG', 'TN'],
    tenantId: '00000000-0000-4000-a000-000000000070',
  },
  comesa: {
    code: 'comesa',
    name: 'COMESA',
    nameFr: 'COMESA',
    fullName: 'Common Market for Eastern and Southern Africa',
    fullNameFr: 'March\u00e9 commun de l\u2019Afrique orientale et australe',
    color: '#228B22',
    colorLight: '#E8F5E9',
    colorDark: '#145214',
    region: 'Eastern & Southern Africa',
    regionFr: 'Afrique orientale et australe',
    memberCount: 21,
    headquarters: 'Lusaka, Zambia',
    establishedYear: 1994,
    description: 'Free trade area stretching from Libya to Eswatini, forming the largest trading bloc in Africa with 21 member states.',
    descriptionFr: 'Zone de libre-\u00e9change s\u2019\u00e9tendant de la Libye \u00e0 l\u2019Eswatini, formant le plus grand bloc commercial d\u2019Afrique.',
    countryCodes: ['BI', 'KM', 'CD', 'DJ', 'EG', 'ER', 'SZ', 'ET', 'KE', 'LY', 'MG', 'MW', 'MU', 'RW', 'SC', 'SO', 'SD', 'TN', 'UG', 'ZM', 'ZW'],
    tenantId: '00000000-0000-4000-a000-000000000080',
  },
};

/** REC display order for the landing page grid */
export const REC_ORDER: string[] = [
  'ecowas', 'eccas', 'eac', 'sadc', 'igad', 'uma', 'censad', 'comesa',
];

/** Get a REC config by code */
export function getRec(code: string): RecConfig | undefined {
  return RECS[code.toLowerCase()];
}

/** Get all RECs in display order */
export function getAllRecs(): RecConfig[] {
  return REC_ORDER.map((code) => RECS[code]);
}

/** Find which REC(s) a country belongs to (returns primary = first match) */
export function getRecsForCountry(countryCode: string): RecConfig[] {
  return Object.values(RECS).filter((rec) =>
    rec.countryCodes.includes(countryCode.toUpperCase()),
  );
}

export const TOTAL_RECS = REC_ORDER.length;
