// ─── 8 Regional Economic Communities (RECs) recognized by the AU ──────────────

export interface RecConfig {
  code: string;
  name: string;
  nameFr: string;
  namePt: string;
  fullName: string;
  fullNameFr: string;
  fullNamePt: string;
  color: string;           // Primary brand color
  colorLight: string;      // Light variant for backgrounds
  colorDark: string;       // Dark variant for text
  region: string;          // Geographic region
  regionFr: string;
  regionPt: string;
  memberCount: number;
  headquarters: string;
  establishedYear: number;
  description: string;
  descriptionFr: string;
  descriptionPt: string;
  countryCodes: string[];  // ISO alpha-2 codes
  tenantId: string;        // Linked tenant UUID
}

export const RECS: Record<string, RecConfig> = {
  ecowas: {
    code: 'ecowas',
    name: 'ECOWAS',
    nameFr: 'CEDEAO',
    namePt: 'CEDEAO',
    fullName: 'Economic Community of West African States',
    fullNameFr: 'Communauté économique des États de l\u2019Afrique de l\u2019Ouest',
    fullNamePt: 'Comunidade Económica dos Estados da África Ocidental',
    color: '#003399',
    colorLight: '#E8EEF9',
    colorDark: '#001A4D',
    region: 'West Africa',
    regionFr: 'Afrique de l\u2019Ouest',
    regionPt: 'África Ocidental',
    memberCount: 15,
    headquarters: 'Abuja, Nigeria',
    establishedYear: 1975,
    description: 'Regional economic union promoting economic integration across West Africa, with 15 member states spanning from Senegal to Nigeria.',
    descriptionFr: 'Union économique régionale favorisant l\u2019intégration économique en Afrique de l\u2019Ouest, avec 15 États membres.',
    descriptionPt: 'União económica regional que promove a integração económica na África Ocidental, com 15 Estados-membros do Senegal à Nigéria.',
    countryCodes: ['BJ', 'BF', 'CV', 'CI', 'GM', 'GH', 'GN', 'GW', 'LR', 'ML', 'NE', 'NG', 'SN', 'SL', 'TG'],
    tenantId: '00000000-0000-4000-a000-000000000020',
  },
  eccas: {
    code: 'eccas',
    name: 'ECCAS',
    nameFr: 'CEEAC',
    namePt: 'CEEAC',
    fullName: 'Economic Community of Central African States',
    fullNameFr: 'Communauté économique des États de l\u2019Afrique centrale',
    fullNamePt: 'Comunidade Económica dos Estados da África Central',
    color: '#8B0000',
    colorLight: '#F9E8E8',
    colorDark: '#5C0000',
    region: 'Central Africa',
    regionFr: 'Afrique centrale',
    regionPt: 'África Central',
    memberCount: 11,
    headquarters: 'Libreville, Gabon',
    establishedYear: 1983,
    description: 'Economic community fostering integration and cooperation among Central African nations, from Cameroon to Angola.',
    descriptionFr: 'Communauté économique promouvant l\u2019intégration et la coopération entre les nations d\u2019Afrique centrale.',
    descriptionPt: 'Comunidade económica que promove a integração e cooperação entre as nações da África Central, dos Camarões a Angola.',
    countryCodes: ['AO', 'BI', 'CM', 'CF', 'TD', 'CG', 'CD', 'GQ', 'GA', 'RW', 'ST'],
    tenantId: '00000000-0000-4000-a000-000000000050',
  },
  eac: {
    code: 'eac',
    name: 'EAC',
    nameFr: 'CAE',
    namePt: 'CAO',
    fullName: 'East African Community',
    fullNameFr: 'Communauté d\u2019Afrique de l\u2019Est',
    fullNamePt: 'Comunidade da África Oriental',
    color: '#006B3F',
    colorLight: '#E6F4ED',
    colorDark: '#003D24',
    region: 'East Africa',
    regionFr: 'Afrique de l\u2019Est',
    regionPt: 'África Oriental',
    memberCount: 7,
    headquarters: 'Arusha, Tanzania',
    establishedYear: 2000,
    description: 'Intergovernmental organization of 7 partner states in the East African region, with a common market and customs union.',
    descriptionFr: 'Organisation intergouvernementale de 7 États partenaires de la région est-africaine avec marché commun.',
    descriptionPt: 'Organização intergovernamental de 7 Estados parceiros na região da África Oriental, com mercado comum e união aduaneira.',
    countryCodes: ['BI', 'CD', 'KE', 'RW', 'SS', 'TZ', 'UG'],
    tenantId: '00000000-0000-4000-a000-000000000040',
  },
  sadc: {
    code: 'sadc',
    name: 'SADC',
    nameFr: 'SADC',
    namePt: 'SADC',
    fullName: 'Southern African Development Community',
    fullNameFr: 'Communauté de développement de l\u2019Afrique australe',
    fullNamePt: 'Comunidade de Desenvolvimento da África Austral',
    color: '#00308F',
    colorLight: '#E6ECF7',
    colorDark: '#001A4D',
    region: 'Southern Africa',
    regionFr: 'Afrique australe',
    regionPt: 'África Austral',
    memberCount: 16,
    headquarters: 'Gaborone, Botswana',
    establishedYear: 1992,
    description: 'Regional community of 16 member states committed to regional integration and poverty eradication through economic development.',
    descriptionFr: 'Communauté régionale de 16 États membres engagés dans l\u2019intégration régionale et le développement économique.',
    descriptionPt: 'Comunidade regional de 16 Estados-membros comprometidos com a integração regional e a erradicação da pobreza através do desenvolvimento económico.',
    countryCodes: ['AO', 'BW', 'KM', 'CD', 'SZ', 'LS', 'MG', 'MW', 'MU', 'MZ', 'NA', 'SC', 'ZA', 'TZ', 'ZM', 'ZW'],
    tenantId: '00000000-0000-4000-a000-000000000030',
  },
  igad: {
    code: 'igad',
    name: 'IGAD',
    nameFr: 'IGAD',
    namePt: 'IGAD',
    fullName: 'Intergovernmental Authority on Development',
    fullNameFr: 'Autorité intergouvernementale pour le développement',
    fullNamePt: 'Autoridade Intergovernamental para o Desenvolvimento',
    color: '#FF8C00',
    colorLight: '#FFF3E0',
    colorDark: '#CC7000',
    region: 'Horn of Africa',
    regionFr: 'Corne de l\u2019Afrique',
    regionPt: 'Corno de África',
    memberCount: 8,
    headquarters: 'Djibouti City, Djibouti',
    establishedYear: 1996,
    description: 'Regional development organization focused on drought control, food security, and conflict resolution in the Horn of Africa.',
    descriptionFr: 'Organisation régionale axée sur la sécurité alimentaire et la résolution des conflits dans la Corne de l\u2019Afrique.',
    descriptionPt: 'Organização regional de desenvolvimento focada no controlo da seca, segurança alimentar e resolução de conflitos no Corno de África.',
    countryCodes: ['DJ', 'ER', 'ET', 'KE', 'SO', 'SS', 'SD', 'UG'],
    tenantId: '00000000-0000-4000-a000-000000000010',
  },
  uma: {
    code: 'uma',
    name: 'UMA',
    nameFr: 'UMA',
    namePt: 'UMA',
    fullName: 'Arab Maghreb Union',
    fullNameFr: 'Union du Maghreb arabe',
    fullNamePt: 'União do Magrebe Árabe',
    color: '#4B0082',
    colorLight: '#F0E6FA',
    colorDark: '#2D004D',
    region: 'North Africa',
    regionFr: 'Afrique du Nord',
    regionPt: 'Norte de África',
    memberCount: 5,
    headquarters: 'Rabat, Morocco',
    establishedYear: 1989,
    description: 'Trade agreement between five North African countries aiming at economic and political unity among Maghreb states.',
    descriptionFr: 'Accord commercial entre cinq pays nord-africains visant l\u2019unité économique et politique du Maghreb.',
    descriptionPt: 'Acordo comercial entre cinco países norte-africanos visando a unidade económica e política entre os Estados do Magrebe.',
    countryCodes: ['DZ', 'LY', 'MR', 'MA', 'TN'],
    tenantId: '00000000-0000-4000-a000-000000000060',
  },
  censad: {
    code: 'censad',
    name: 'CEN-SAD',
    nameFr: 'CEN-SAD',
    namePt: 'CEN-SAD',
    fullName: 'Community of Sahel-Saharan States',
    fullNameFr: 'Communauté des États sahélo-sahariens',
    fullNamePt: 'Comunidade dos Estados Sahelo-Saarianos',
    color: '#DAA520',
    colorLight: '#FDF6E3',
    colorDark: '#8B6914',
    region: 'Sahel-Sahara',
    regionFr: 'Sahel-Sahara',
    regionPt: 'Sahel-Saara',
    memberCount: 28,
    headquarters: 'Tripoli, Libya',
    establishedYear: 1998,
    description: 'The largest REC by membership, bridging Saharan and sub-Saharan Africa with 28 member states focused on economic cooperation.',
    descriptionFr: 'La plus grande CER par le nombre de membres, reliant l\u2019Afrique saharienne et subsaharienne avec 28 États membres.',
    descriptionPt: 'A maior CER em número de membros, ligando a África Saariana e Subsaariana com 28 Estados-membros focados na cooperação económica.',
    countryCodes: ['BJ', 'BF', 'CF', 'KM', 'CI', 'DJ', 'EG', 'ER', 'GM', 'GH', 'GN', 'GW', 'KE', 'LR', 'LY', 'ML', 'MR', 'MA', 'NE', 'NG', 'ST', 'SN', 'SL', 'SO', 'SD', 'TD', 'TG', 'TN'],
    tenantId: '00000000-0000-4000-a000-000000000070',
  },
  comesa: {
    code: 'comesa',
    name: 'COMESA',
    nameFr: 'COMESA',
    namePt: 'COMESA',
    fullName: 'Common Market for Eastern and Southern Africa',
    fullNameFr: 'Marché commun de l\u2019Afrique orientale et australe',
    fullNamePt: 'Mercado Comum da África Oriental e Austral',
    color: '#228B22',
    colorLight: '#E8F5E9',
    colorDark: '#145214',
    region: 'Eastern & Southern Africa',
    regionFr: 'Afrique orientale et australe',
    regionPt: 'África Oriental e Austral',
    memberCount: 21,
    headquarters: 'Lusaka, Zambia',
    establishedYear: 1994,
    description: 'Free trade area stretching from Libya to Eswatini, forming the largest trading bloc in Africa with 21 member states.',
    descriptionFr: 'Zone de libre-échange s\u2019étendant de la Libye à l\u2019Eswatini, formant le plus grand bloc commercial d\u2019Afrique.',
    descriptionPt: 'Zona de comércio livre que se estende da Líbia à Essuatíni, formando o maior bloco comercial de África com 21 Estados-membros.',
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
