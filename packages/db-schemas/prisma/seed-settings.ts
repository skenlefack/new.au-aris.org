import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Deterministic UUIDs ─────────────────────────────────────────────────────

const TENANT_IDS = {
  KENYA: '00000000-0000-4000-a000-000000000101',
  ETHIOPIA: '00000000-0000-4000-a000-000000000102',
  NIGERIA: '00000000-0000-4000-a000-000000000201',
  SENEGAL: '00000000-0000-4000-a000-000000000202',
  SOUTH_AFRICA: '00000000-0000-4000-a000-000000000301',
} as const;

// ─── 8 RECs ──────────────────────────────────────────────────────────────────

interface RecSeedData {
  code: string;
  name: Record<string, string>;
  fullName: Record<string, string>;
  description: Record<string, string>;
  region: Record<string, string>;
  headquarters: string;
  established: number;
  accentColor: string;
  sortOrder: number;
  countryCodes: string[];
}

const RECS_DATA: RecSeedData[] = [
  {
    code: 'ecowas',
    name: { en: 'ECOWAS', fr: 'CEDEAO', pt: 'CEDEAO', ar: 'ECOWAS' },
    fullName: {
      en: 'Economic Community of West African States',
      fr: "Communaut\u00e9 \u00e9conomique des \u00c9tats de l\u2019Afrique de l\u2019Ouest",
      pt: 'Comunidade Econ\u00f3mica dos Estados da \u00c1frica Ocidental',
      ar: 'ECOWAS',
    },
    description: {
      en: 'Regional economic union promoting economic integration across West Africa, with 15 member states spanning from Senegal to Nigeria.',
      fr: "Union \u00e9conomique r\u00e9gionale favorisant l\u2019int\u00e9gration \u00e9conomique en Afrique de l\u2019Ouest, avec 15 \u00c9tats membres.",
      pt: 'Uni\u00e3o econ\u00f3mica regional promovendo a integra\u00e7\u00e3o econ\u00f3mica na \u00c1frica Ocidental, com 15 Estados membros.',
      ar: 'ECOWAS',
    },
    region: {
      en: 'West Africa',
      fr: "Afrique de l\u2019Ouest",
      pt: '\u00c1frica Ocidental',
      ar: 'ECOWAS',
    },
    headquarters: 'Abuja, Nigeria',
    established: 1975,
    accentColor: '#003399',
    sortOrder: 1,
    countryCodes: ['BJ', 'BF', 'CV', 'CI', 'GM', 'GH', 'GN', 'GW', 'LR', 'ML', 'NE', 'NG', 'SN', 'SL', 'TG'],
  },
  {
    code: 'eccas',
    name: { en: 'ECCAS', fr: 'CEEAC', pt: 'CEEAC', ar: 'ECCAS' },
    fullName: {
      en: 'Economic Community of Central African States',
      fr: "Communaut\u00e9 \u00e9conomique des \u00c9tats de l\u2019Afrique centrale",
      pt: 'Comunidade Econ\u00f3mica dos Estados da \u00c1frica Central',
      ar: 'ECCAS',
    },
    description: {
      en: 'Economic community fostering integration and cooperation among Central African nations, from Cameroon to Angola.',
      fr: "Communaut\u00e9 \u00e9conomique promouvant l\u2019int\u00e9gration et la coop\u00e9ration entre les nations d\u2019Afrique centrale.",
      pt: 'Comunidade econ\u00f3mica promovendo a integra\u00e7\u00e3o e coopera\u00e7\u00e3o entre as na\u00e7\u00f5es da \u00c1frica Central.',
      ar: 'ECCAS',
    },
    region: {
      en: 'Central Africa',
      fr: 'Afrique centrale',
      pt: '\u00c1frica Central',
      ar: 'ECCAS',
    },
    headquarters: 'Libreville, Gabon',
    established: 1983,
    accentColor: '#8B0000',
    sortOrder: 2,
    countryCodes: ['AO', 'BI', 'CM', 'CF', 'TD', 'CG', 'CD', 'GQ', 'GA', 'RW', 'ST'],
  },
  {
    code: 'eac',
    name: { en: 'EAC', fr: 'CAE', pt: 'CAL', ar: 'EAC' },
    fullName: {
      en: 'East African Community',
      fr: "Communaut\u00e9 d\u2019Afrique de l\u2019Est",
      pt: 'Comunidade da \u00c1frica Oriental',
      ar: 'EAC',
    },
    description: {
      en: 'Intergovernmental organization of 7 partner states in the East African region, with a common market and customs union.',
      fr: "Organisation intergouvernementale de 7 \u00c9tats partenaires de la r\u00e9gion est-africaine avec march\u00e9 commun.",
      pt: 'Organiza\u00e7\u00e3o intergovernamental de 7 Estados parceiros na regi\u00e3o da \u00c1frica Oriental, com mercado comum e uni\u00e3o aduaneira.',
      ar: 'EAC',
    },
    region: {
      en: 'East Africa',
      fr: "Afrique de l\u2019Est",
      pt: '\u00c1frica Oriental',
      ar: 'EAC',
    },
    headquarters: 'Arusha, Tanzania',
    established: 2000,
    accentColor: '#006B3F',
    sortOrder: 3,
    countryCodes: ['BI', 'CD', 'KE', 'RW', 'SS', 'TZ', 'UG'],
  },
  {
    code: 'sadc',
    name: { en: 'SADC', fr: 'SADC', pt: 'SADC', ar: 'SADC' },
    fullName: {
      en: 'Southern African Development Community',
      fr: "Communaut\u00e9 de d\u00e9veloppement de l\u2019Afrique australe",
      pt: 'Comunidade de Desenvolvimento da \u00c1frica Austral',
      ar: 'SADC',
    },
    description: {
      en: 'Regional community of 16 member states committed to regional integration and poverty eradication through economic development.',
      fr: "Communaut\u00e9 r\u00e9gionale de 16 \u00c9tats membres engag\u00e9s dans l\u2019int\u00e9gration r\u00e9gionale et le d\u00e9veloppement \u00e9conomique.",
      pt: 'Comunidade regional de 16 Estados membros comprometidos com a integra\u00e7\u00e3o regional e a erradica\u00e7\u00e3o da pobreza.',
      ar: 'SADC',
    },
    region: {
      en: 'Southern Africa',
      fr: 'Afrique australe',
      pt: '\u00c1frica Austral',
      ar: 'SADC',
    },
    headquarters: 'Gaborone, Botswana',
    established: 1992,
    accentColor: '#00308F',
    sortOrder: 4,
    countryCodes: ['AO', 'BW', 'KM', 'CD', 'SZ', 'LS', 'MG', 'MW', 'MU', 'MZ', 'NA', 'SC', 'ZA', 'TZ', 'ZM', 'ZW'],
  },
  {
    code: 'igad',
    name: { en: 'IGAD', fr: 'IGAD', pt: 'IGAD', ar: 'IGAD' },
    fullName: {
      en: 'Intergovernmental Authority on Development',
      fr: "Autorit\u00e9 intergouvernementale pour le d\u00e9veloppement",
      pt: 'Autoridade Intergovernamental para o Desenvolvimento',
      ar: 'IGAD',
    },
    description: {
      en: 'Regional development organization focused on drought control, food security, and conflict resolution in the Horn of Africa.',
      fr: "Organisation r\u00e9gionale ax\u00e9e sur la s\u00e9curit\u00e9 alimentaire et la r\u00e9solution des conflits dans la Corne de l\u2019Afrique.",
      pt: 'Organiza\u00e7\u00e3o regional focada no controlo da seca, seguran\u00e7a alimentar e resolu\u00e7\u00e3o de conflitos no Corno de \u00c1frica.',
      ar: 'IGAD',
    },
    region: {
      en: 'Horn of Africa',
      fr: "Corne de l\u2019Afrique",
      pt: 'Corno de \u00c1frica',
      ar: 'IGAD',
    },
    headquarters: 'Djibouti City, Djibouti',
    established: 1996,
    accentColor: '#FF8C00',
    sortOrder: 5,
    countryCodes: ['DJ', 'ER', 'ET', 'KE', 'SO', 'SS', 'SD', 'UG'],
  },
  {
    code: 'uma',
    name: { en: 'UMA', fr: 'UMA', pt: 'UMA', ar: 'UMA' },
    fullName: {
      en: 'Arab Maghreb Union',
      fr: 'Union du Maghreb arabe',
      pt: 'Uni\u00e3o do Magrebe \u00c1rabe',
      ar: 'UMA',
    },
    description: {
      en: 'Trade agreement between five North African countries aiming at economic and political unity among Maghreb states.',
      fr: "Accord commercial entre cinq pays nord-africains visant l\u2019unit\u00e9 \u00e9conomique et politique du Maghreb.",
      pt: 'Acordo comercial entre cinco pa\u00edses do Norte de \u00c1frica visando a unidade econ\u00f3mica e pol\u00edtica dos estados do Magrebe.',
      ar: 'UMA',
    },
    region: {
      en: 'North Africa',
      fr: 'Afrique du Nord',
      pt: '\u00c1frica do Norte',
      ar: 'UMA',
    },
    headquarters: 'Rabat, Morocco',
    established: 1989,
    accentColor: '#4B0082',
    sortOrder: 6,
    countryCodes: ['DZ', 'LY', 'MR', 'MA', 'TN'],
  },
  {
    code: 'censad',
    name: { en: 'CEN-SAD', fr: 'CEN-SAD', pt: 'CEN-SAD', ar: 'CEN-SAD' },
    fullName: {
      en: 'Community of Sahel-Saharan States',
      fr: "Communaut\u00e9 des \u00c9tats sah\u00e9lo-sahariens",
      pt: 'Comunidade dos Estados Sahelo-Saarianos',
      ar: 'CEN-SAD',
    },
    description: {
      en: 'The largest REC by membership, bridging Saharan and sub-Saharan Africa with 29 member states focused on economic cooperation.',
      fr: "La plus grande CER par le nombre de membres, reliant l\u2019Afrique saharienne et subsaharienne avec 29 \u00c9tats membres.",
      pt: 'A maior CER por n\u00famero de membros, ligando a \u00c1frica saariana e subsaariana com 29 Estados membros focados na coopera\u00e7\u00e3o econ\u00f3mica.',
      ar: 'CEN-SAD',
    },
    region: {
      en: 'Sahel-Sahara',
      fr: 'Sahel-Sahara',
      pt: 'Sahel-Saara',
      ar: 'CEN-SAD',
    },
    headquarters: 'Tripoli, Libya',
    established: 1998,
    accentColor: '#DAA520',
    sortOrder: 7,
    countryCodes: ['BJ', 'BF', 'CF', 'KM', 'CI', 'DJ', 'EG', 'ER', 'GM', 'GH', 'GN', 'GW', 'KE', 'LR', 'LY', 'ML', 'MR', 'MA', 'NE', 'NG', 'ST', 'SN', 'SL', 'SO', 'SD', 'TD', 'TG', 'TN'],
  },
  {
    code: 'comesa',
    name: { en: 'COMESA', fr: 'COMESA', pt: 'COMESA', ar: 'COMESA' },
    fullName: {
      en: 'Common Market for Eastern and Southern Africa',
      fr: "March\u00e9 commun de l\u2019Afrique orientale et australe",
      pt: 'Mercado Comum da \u00c1frica Oriental e Austral',
      ar: 'COMESA',
    },
    description: {
      en: 'Free trade area stretching from Libya to Eswatini, forming the largest trading bloc in Africa with 21 member states.',
      fr: "Zone de libre-\u00e9change s\u2019\u00e9tendant de la Libye \u00e0 l\u2019Eswatini, formant le plus grand bloc commercial d\u2019Afrique.",
      pt: 'Zona de com\u00e9rcio livre que se estende da L\u00edbia \u00e0 Esuat\u00edni, formando o maior bloco comercial de \u00c1frica com 21 Estados membros.',
      ar: 'COMESA',
    },
    region: {
      en: 'Eastern & Southern Africa',
      fr: 'Afrique orientale et australe',
      pt: '\u00c1frica Oriental e Austral',
      ar: 'COMESA',
    },
    headquarters: 'Lusaka, Zambia',
    established: 1994,
    accentColor: '#228B22',
    sortOrder: 8,
    countryCodes: ['BI', 'KM', 'CD', 'DJ', 'EG', 'ER', 'SZ', 'ET', 'KE', 'LY', 'MG', 'MW', 'MU', 'RW', 'SC', 'SO', 'SD', 'TN', 'UG', 'ZM', 'ZW'],
  },
];

// ─── 55 AU Countries ─────────────────────────────────────────────────────────

interface CountrySeedData {
  code: string;
  code3: string;
  name: Record<string, string>;
  officialName?: Record<string, string>;
  capital: Record<string, string>;
  flag: string;
  population: bigint;
  area?: number;
  timezone: string;
  languages: string[];
  currency: string;
  phoneCode: string;
  isOperational: boolean;
  tenantId?: string;
  sortOrder: number;
}

const COUNTRIES_DATA: CountrySeedData[] = [
  // ── North Africa / Maghreb ──
  {
    code: 'DZ', code3: 'DZA',
    name: { en: 'Algeria', fr: 'Alg\u00e9rie', pt: 'Arg\u00e9lia', ar: '\u0627\u0644\u062c\u0632\u0627\u0626\u0631' },
    officialName: { en: "People's Democratic Republic of Algeria", fr: "R\u00e9publique alg\u00e9rienne d\u00e9mocratique et populaire" },
    capital: { en: 'Algiers', fr: 'Alger', pt: 'Argel' },
    flag: '\ud83c\udde9\ud83c\uddff', population: BigInt(45_600_000), area: 2381741, timezone: 'Africa/Algiers',
    languages: ['Arabic', 'Berber', 'French'], currency: 'DZD', phoneCode: '+213',
    isOperational: false, sortOrder: 1,
  },
  {
    code: 'EG', code3: 'EGY',
    name: { en: 'Egypt', fr: '\u00c9gypte', pt: 'Egito', ar: '\u0645\u0635\u0631' },
    officialName: { en: 'Arab Republic of Egypt', fr: "R\u00e9publique arabe d'\u00c9gypte" },
    capital: { en: 'Cairo', fr: 'Le Caire', pt: 'Cairo' },
    flag: '\ud83c\uddea\ud83c\uddec', population: BigInt(112_700_000), area: 1002450, timezone: 'Africa/Cairo',
    languages: ['Arabic'], currency: 'EGP', phoneCode: '+20',
    isOperational: false, sortOrder: 2,
  },
  {
    code: 'LY', code3: 'LBY',
    name: { en: 'Libya', fr: 'Libye', pt: 'L\u00edbia', ar: '\u0644\u064a\u0628\u064a\u0627' },
    officialName: { en: 'State of Libya', fr: '\u00c9tat de Libye' },
    capital: { en: 'Tripoli', fr: 'Tripoli', pt: 'Tr\u00edpoli' },
    flag: '\ud83c\uddf1\ud83c\uddfe', population: BigInt(7_000_000), area: 1759540, timezone: 'Africa/Tripoli',
    languages: ['Arabic'], currency: 'LYD', phoneCode: '+218',
    isOperational: false, sortOrder: 3,
  },
  {
    code: 'MR', code3: 'MRT',
    name: { en: 'Mauritania', fr: 'Mauritanie', pt: 'Maurit\u00e2nia', ar: '\u0645\u0648\u0631\u064a\u062a\u0627\u0646\u064a\u0627' },
    officialName: { en: 'Islamic Republic of Mauritania', fr: 'R\u00e9publique islamique de Mauritanie' },
    capital: { en: 'Nouakchott', fr: 'Nouakchott', pt: 'Nuaquexote' },
    flag: '\ud83c\uddf2\ud83c\uddf7', population: BigInt(4_900_000), area: 1030700, timezone: 'Africa/Nouakchott',
    languages: ['Arabic', 'French'], currency: 'MRU', phoneCode: '+222',
    isOperational: false, sortOrder: 4,
  },
  {
    code: 'MA', code3: 'MAR',
    name: { en: 'Morocco', fr: 'Maroc', pt: 'Marrocos', ar: '\u0627\u0644\u0645\u063a\u0631\u0628' },
    officialName: { en: 'Kingdom of Morocco', fr: 'Royaume du Maroc' },
    capital: { en: 'Rabat', fr: 'Rabat', pt: 'Rabat' },
    flag: '\ud83c\uddf2\ud83c\udde6', population: BigInt(37_800_000), area: 446550, timezone: 'Africa/Casablanca',
    languages: ['Arabic', 'Berber', 'French'], currency: 'MAD', phoneCode: '+212',
    isOperational: false, sortOrder: 5,
  },
  {
    code: 'TN', code3: 'TUN',
    name: { en: 'Tunisia', fr: 'Tunisie', pt: 'Tun\u00edsia', ar: '\u062a\u0648\u0646\u0633' },
    officialName: { en: 'Republic of Tunisia', fr: 'R\u00e9publique tunisienne' },
    capital: { en: 'Tunis', fr: 'Tunis', pt: 'Tunes' },
    flag: '\ud83c\uddf9\ud83c\uddf3', population: BigInt(12_000_000), area: 163610, timezone: 'Africa/Tunis',
    languages: ['Arabic', 'French'], currency: 'TND', phoneCode: '+216',
    isOperational: false, sortOrder: 6,
  },
  {
    code: 'EH', code3: 'ESH',
    name: { en: 'Sahrawi Republic', fr: 'R\u00e9publique sahraouie', pt: 'Rep\u00fablica Saraui', ar: '\u0627\u0644\u062c\u0645\u0647\u0648\u0631\u064a\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0635\u062d\u0631\u0627\u0648\u064a\u0629 \u0627\u0644\u062f\u064a\u0645\u0642\u0631\u0627\u0637\u064a\u0629' },
    officialName: { en: 'Sahrawi Arab Democratic Republic', fr: 'R\u00e9publique arabe sahraouie d\u00e9mocratique' },
    capital: { en: 'Laayoune', fr: 'La\u00e2youne', pt: 'Laaiun' },
    flag: '\ud83c\uddea\ud83c\udded', population: BigInt(600_000), area: 266000, timezone: 'Africa/El_Aaiun',
    languages: ['Arabic', 'Spanish'], currency: 'MAD', phoneCode: '+212',
    isOperational: false, sortOrder: 7,
  },

  // ── West Africa (ECOWAS) ──
  {
    code: 'BJ', code3: 'BEN',
    name: { en: 'Benin', fr: 'B\u00e9nin', pt: 'Benim', ar: '\u0628\u0646\u064a\u0646' },
    officialName: { en: 'Republic of Benin', fr: 'R\u00e9publique du B\u00e9nin' },
    capital: { en: 'Porto-Novo', fr: 'Porto-Novo', pt: 'Porto-Novo' },
    flag: '\ud83c\udde7\ud83c\uddef', population: BigInt(13_400_000), area: 112622, timezone: 'Africa/Porto-Novo',
    languages: ['French'], currency: 'XOF', phoneCode: '+229',
    isOperational: false, sortOrder: 8,
  },
  {
    code: 'BF', code3: 'BFA',
    name: { en: 'Burkina Faso', fr: 'Burkina Faso', pt: 'Burquina Faso', ar: '\u0628\u0648\u0631\u0643\u064a\u0646\u0627 \u0641\u0627\u0633\u0648' },
    officialName: { en: 'Burkina Faso', fr: 'Burkina Faso' },
    capital: { en: 'Ouagadougou', fr: 'Ouagadougou', pt: 'Uagadugu' },
    flag: '\ud83c\udde7\ud83c\uddeb', population: BigInt(22_700_000), area: 274200, timezone: 'Africa/Ouagadougou',
    languages: ['French'], currency: 'XOF', phoneCode: '+226',
    isOperational: false, sortOrder: 9,
  },
  {
    code: 'CV', code3: 'CPV',
    name: { en: 'Cabo Verde', fr: 'Cap-Vert', pt: 'Cabo Verde', ar: '\u0627\u0644\u0631\u0623\u0633 \u0627\u0644\u0623\u062e\u0636\u0631' },
    officialName: { en: 'Republic of Cabo Verde', fr: 'R\u00e9publique du Cap-Vert' },
    capital: { en: 'Praia', fr: 'Praia', pt: 'Praia' },
    flag: '\ud83c\udde8\ud83c\uddfb', population: BigInt(600_000), area: 4033, timezone: 'Atlantic/Cape_Verde',
    languages: ['Portuguese'], currency: 'CVE', phoneCode: '+238',
    isOperational: false, sortOrder: 10,
  },
  {
    code: 'CI', code3: 'CIV',
    name: { en: "C\u00f4te d'Ivoire", fr: "C\u00f4te d'Ivoire", pt: 'Costa do Marfim', ar: '\u0633\u0627\u062d\u0644 \u0627\u0644\u0639\u0627\u062c' },
    officialName: { en: "Republic of C\u00f4te d'Ivoire", fr: "R\u00e9publique de C\u00f4te d'Ivoire" },
    capital: { en: 'Yamoussoukro', fr: 'Yamoussoukro', pt: 'Yamoussoukro' },
    flag: '\ud83c\udde8\ud83c\uddee', population: BigInt(28_200_000), area: 322463, timezone: 'Africa/Abidjan',
    languages: ['French'], currency: 'XOF', phoneCode: '+225',
    isOperational: false, sortOrder: 11,
  },
  {
    code: 'GM', code3: 'GMB',
    name: { en: 'Gambia', fr: 'Gambie', pt: 'G\u00e2mbia', ar: '\u063a\u0627\u0645\u0628\u064a\u0627' },
    officialName: { en: 'Republic of the Gambia', fr: 'R\u00e9publique de Gambie' },
    capital: { en: 'Banjul', fr: 'Banjul', pt: 'Banjul' },
    flag: '\ud83c\uddec\ud83c\uddf2', population: BigInt(2_700_000), area: 11295, timezone: 'Africa/Banjul',
    languages: ['English'], currency: 'GMD', phoneCode: '+220',
    isOperational: false, sortOrder: 12,
  },
  {
    code: 'GH', code3: 'GHA',
    name: { en: 'Ghana', fr: 'Ghana', pt: 'Gana', ar: '\u063a\u0627\u0646\u0627' },
    officialName: { en: 'Republic of Ghana', fr: 'R\u00e9publique du Ghana' },
    capital: { en: 'Accra', fr: 'Accra', pt: 'Acra' },
    flag: '\ud83c\uddec\ud83c\udded', population: BigInt(33_500_000), area: 238535, timezone: 'Africa/Accra',
    languages: ['English'], currency: 'GHS', phoneCode: '+233',
    isOperational: false, sortOrder: 13,
  },
  {
    code: 'GN', code3: 'GIN',
    name: { en: 'Guinea', fr: 'Guin\u00e9e', pt: 'Guin\u00e9', ar: '\u063a\u064a\u0646\u064a\u0627' },
    officialName: { en: 'Republic of Guinea', fr: 'R\u00e9publique de Guin\u00e9e' },
    capital: { en: 'Conakry', fr: 'Conakry', pt: 'Conacri' },
    flag: '\ud83c\uddec\ud83c\uddf3', population: BigInt(14_200_000), area: 245857, timezone: 'Africa/Conakry',
    languages: ['French'], currency: 'GNF', phoneCode: '+224',
    isOperational: false, sortOrder: 14,
  },
  {
    code: 'GW', code3: 'GNB',
    name: { en: 'Guinea-Bissau', fr: 'Guin\u00e9e-Bissau', pt: 'Guin\u00e9-Bissau', ar: '\u063a\u064a\u0646\u064a\u0627 \u0628\u064a\u0633\u0627\u0648' },
    officialName: { en: 'Republic of Guinea-Bissau', fr: 'R\u00e9publique de Guin\u00e9e-Bissau' },
    capital: { en: 'Bissau', fr: 'Bissau', pt: 'Bissau' },
    flag: '\ud83c\uddec\ud83c\uddfc', population: BigInt(2_100_000), area: 36125, timezone: 'Africa/Bissau',
    languages: ['Portuguese'], currency: 'XOF', phoneCode: '+245',
    isOperational: false, sortOrder: 15,
  },
  {
    code: 'LR', code3: 'LBR',
    name: { en: 'Liberia', fr: 'Lib\u00e9ria', pt: 'Lib\u00e9ria', ar: '\u0644\u064a\u0628\u064a\u0631\u064a\u0627' },
    officialName: { en: 'Republic of Liberia', fr: 'R\u00e9publique du Lib\u00e9ria' },
    capital: { en: 'Monrovia', fr: 'Monrovia', pt: 'Monr\u00f3via' },
    flag: '\ud83c\uddf1\ud83c\uddf7', population: BigInt(5_400_000), area: 111369, timezone: 'Africa/Monrovia',
    languages: ['English'], currency: 'LRD', phoneCode: '+231',
    isOperational: false, sortOrder: 16,
  },
  {
    code: 'ML', code3: 'MLI',
    name: { en: 'Mali', fr: 'Mali', pt: 'Mali', ar: '\u0645\u0627\u0644\u064a' },
    officialName: { en: 'Republic of Mali', fr: 'R\u00e9publique du Mali' },
    capital: { en: 'Bamako', fr: 'Bamako', pt: 'Bamaco' },
    flag: '\ud83c\uddf2\ud83c\uddf1', population: BigInt(22_400_000), area: 1240192, timezone: 'Africa/Bamako',
    languages: ['French'], currency: 'XOF', phoneCode: '+223',
    isOperational: false, sortOrder: 17,
  },
  {
    code: 'NE', code3: 'NER',
    name: { en: 'Niger', fr: 'Niger', pt: 'N\u00edger', ar: '\u0627\u0644\u0646\u064a\u062c\u0631' },
    officialName: { en: 'Republic of Niger', fr: 'R\u00e9publique du Niger' },
    capital: { en: 'Niamey', fr: 'Niamey', pt: 'Niamey' },
    flag: '\ud83c\uddf3\ud83c\uddea', population: BigInt(26_200_000), area: 1267000, timezone: 'Africa/Niamey',
    languages: ['French'], currency: 'XOF', phoneCode: '+227',
    isOperational: false, sortOrder: 18,
  },
  {
    code: 'NG', code3: 'NGA',
    name: { en: 'Nigeria', fr: 'Nig\u00e9ria', pt: 'Nig\u00e9ria', ar: '\u0646\u064a\u062c\u064a\u0631\u064a\u0627' },
    officialName: { en: 'Federal Republic of Nigeria', fr: 'R\u00e9publique f\u00e9d\u00e9rale du Nig\u00e9ria' },
    capital: { en: 'Abuja', fr: 'Abuja', pt: 'Abuja' },
    flag: '\ud83c\uddf3\ud83c\uddec', population: BigInt(223_800_000), area: 923768, timezone: 'Africa/Lagos',
    languages: ['English'], currency: 'NGN', phoneCode: '+234',
    isOperational: true, tenantId: TENANT_IDS.NIGERIA, sortOrder: 19,
  },
  {
    code: 'SN', code3: 'SEN',
    name: { en: 'Senegal', fr: 'S\u00e9n\u00e9gal', pt: 'Senegal', ar: '\u0627\u0644\u0633\u0646\u063a\u0627\u0644' },
    officialName: { en: 'Republic of Senegal', fr: 'R\u00e9publique du S\u00e9n\u00e9gal' },
    capital: { en: 'Dakar', fr: 'Dakar', pt: 'Dacar' },
    flag: '\ud83c\uddf8\ud83c\uddf3', population: BigInt(17_700_000), area: 196722, timezone: 'Africa/Dakar',
    languages: ['French'], currency: 'XOF', phoneCode: '+221',
    isOperational: true, tenantId: TENANT_IDS.SENEGAL, sortOrder: 20,
  },
  {
    code: 'SL', code3: 'SLE',
    name: { en: 'Sierra Leone', fr: 'Sierra Leone', pt: 'Serra Leoa', ar: '\u0633\u064a\u0631\u0627\u0644\u064a\u0648\u0646' },
    officialName: { en: 'Republic of Sierra Leone', fr: 'R\u00e9publique de Sierra Leone' },
    capital: { en: 'Freetown', fr: 'Freetown', pt: 'Freetown' },
    flag: '\ud83c\uddf8\ud83c\uddf1', population: BigInt(8_600_000), area: 71740, timezone: 'Africa/Freetown',
    languages: ['English'], currency: 'SLE', phoneCode: '+232',
    isOperational: false, sortOrder: 21,
  },
  {
    code: 'TG', code3: 'TGO',
    name: { en: 'Togo', fr: 'Togo', pt: 'Togo', ar: '\u062a\u0648\u063a\u0648' },
    officialName: { en: 'Togolese Republic', fr: 'R\u00e9publique togolaise' },
    capital: { en: 'Lom\u00e9', fr: 'Lom\u00e9', pt: 'Lom\u00e9' },
    flag: '\ud83c\uddf9\ud83c\uddec', population: BigInt(8_800_000), area: 56785, timezone: 'Africa/Lome',
    languages: ['French'], currency: 'XOF', phoneCode: '+228',
    isOperational: false, sortOrder: 22,
  },

  // ── Central Africa (ECCAS) ──
  {
    code: 'AO', code3: 'AGO',
    name: { en: 'Angola', fr: 'Angola', pt: 'Angola', ar: '\u0623\u0646\u063a\u0648\u0644\u0627' },
    officialName: { en: 'Republic of Angola', fr: "R\u00e9publique d'Angola" },
    capital: { en: 'Luanda', fr: 'Luanda', pt: 'Luanda' },
    flag: '\ud83c\udde6\ud83c\uddf4', population: BigInt(35_600_000), area: 1246700, timezone: 'Africa/Luanda',
    languages: ['Portuguese'], currency: 'AOA', phoneCode: '+244',
    isOperational: false, sortOrder: 23,
  },
  {
    code: 'BI', code3: 'BDI',
    name: { en: 'Burundi', fr: 'Burundi', pt: 'Burundi', ar: '\u0628\u0648\u0631\u0648\u0646\u062f\u064a' },
    officialName: { en: 'Republic of Burundi', fr: 'R\u00e9publique du Burundi' },
    capital: { en: 'Gitega', fr: 'Gitega', pt: 'Gitega' },
    flag: '\ud83c\udde7\ud83c\uddee', population: BigInt(13_200_000), area: 27834, timezone: 'Africa/Bujumbura',
    languages: ['Kirundi', 'French', 'English'], currency: 'BIF', phoneCode: '+257',
    isOperational: false, sortOrder: 24,
  },
  {
    code: 'CM', code3: 'CMR',
    name: { en: 'Cameroon', fr: 'Cameroun', pt: 'Camar\u00f5es', ar: '\u0627\u0644\u0643\u0627\u0645\u064a\u0631\u0648\u0646' },
    officialName: { en: 'Republic of Cameroon', fr: 'R\u00e9publique du Cameroun' },
    capital: { en: 'Yaound\u00e9', fr: 'Yaound\u00e9', pt: 'Iaund\u00e9' },
    flag: '\ud83c\udde8\ud83c\uddf2', population: BigInt(28_600_000), area: 475442, timezone: 'Africa/Douala',
    languages: ['French', 'English'], currency: 'XAF', phoneCode: '+237',
    isOperational: false, sortOrder: 25,
  },
  {
    code: 'CF', code3: 'CAF',
    name: { en: 'Central African Republic', fr: 'R\u00e9publique centrafricaine', pt: 'Rep\u00fablica Centro-Africana', ar: '\u062c\u0645\u0647\u0648\u0631\u064a\u0629 \u0623\u0641\u0631\u064a\u0642\u064a\u0627 \u0627\u0644\u0648\u0633\u0637\u0649' },
    officialName: { en: 'Central African Republic', fr: 'R\u00e9publique centrafricaine' },
    capital: { en: 'Bangui', fr: 'Bangui', pt: 'Bangui' },
    flag: '\ud83c\udde8\ud83c\uddeb', population: BigInt(5_500_000), area: 622984, timezone: 'Africa/Bangui',
    languages: ['French', 'Sango'], currency: 'XAF', phoneCode: '+236',
    isOperational: false, sortOrder: 26,
  },
  {
    code: 'TD', code3: 'TCD',
    name: { en: 'Chad', fr: 'Tchad', pt: 'Chade', ar: '\u062a\u0634\u0627\u062f' },
    officialName: { en: 'Republic of Chad', fr: 'R\u00e9publique du Tchad' },
    capital: { en: "N'Djamena", fr: "N'Djamena", pt: "N'Djamena" },
    flag: '\ud83c\uddf9\ud83c\udde9', population: BigInt(18_300_000), area: 1284000, timezone: 'Africa/Ndjamena',
    languages: ['French', 'Arabic'], currency: 'XAF', phoneCode: '+235',
    isOperational: false, sortOrder: 27,
  },
  {
    code: 'CG', code3: 'COG',
    name: { en: 'Congo', fr: 'Congo', pt: 'Congo', ar: '\u0627\u0644\u0643\u0648\u0646\u063a\u0648' },
    officialName: { en: 'Republic of the Congo', fr: 'R\u00e9publique du Congo' },
    capital: { en: 'Brazzaville', fr: 'Brazzaville', pt: 'Brazzaville' },
    flag: '\ud83c\udde8\ud83c\uddec', population: BigInt(6_100_000), area: 342000, timezone: 'Africa/Brazzaville',
    languages: ['French'], currency: 'XAF', phoneCode: '+242',
    isOperational: false, sortOrder: 28,
  },
  {
    code: 'CD', code3: 'COD',
    name: { en: 'DR Congo', fr: 'RD Congo', pt: 'RD Congo', ar: '\u0627\u0644\u0643\u0648\u0646\u063a\u0648 \u0627\u0644\u062f\u064a\u0645\u0642\u0631\u0627\u0637\u064a\u0629' },
    officialName: { en: 'Democratic Republic of the Congo', fr: 'R\u00e9publique d\u00e9mocratique du Congo' },
    capital: { en: 'Kinshasa', fr: 'Kinshasa', pt: 'Kinshasa' },
    flag: '\ud83c\udde8\ud83c\udde9', population: BigInt(102_300_000), area: 2344858, timezone: 'Africa/Kinshasa',
    languages: ['French'], currency: 'CDF', phoneCode: '+243',
    isOperational: false, sortOrder: 29,
  },
  {
    code: 'GQ', code3: 'GNQ',
    name: { en: 'Equatorial Guinea', fr: 'Guin\u00e9e \u00e9quatoriale', pt: 'Guin\u00e9 Equatorial', ar: '\u063a\u064a\u0646\u064a\u0627 \u0627\u0644\u0627\u0633\u062a\u0648\u0627\u0626\u064a\u0629' },
    officialName: { en: 'Republic of Equatorial Guinea', fr: 'R\u00e9publique de Guin\u00e9e \u00e9quatoriale' },
    capital: { en: 'Malabo', fr: 'Malabo', pt: 'Malabo' },
    flag: '\ud83c\uddec\ud83c\uddf6', population: BigInt(1_700_000), area: 28051, timezone: 'Africa/Malabo',
    languages: ['Spanish', 'French', 'Portuguese'], currency: 'XAF', phoneCode: '+240',
    isOperational: false, sortOrder: 30,
  },
  {
    code: 'GA', code3: 'GAB',
    name: { en: 'Gabon', fr: 'Gabon', pt: 'Gab\u00e3o', ar: '\u0627\u0644\u063a\u0627\u0628\u0648\u0646' },
    officialName: { en: 'Gabonese Republic', fr: 'R\u00e9publique gabonaise' },
    capital: { en: 'Libreville', fr: 'Libreville', pt: 'Libreville' },
    flag: '\ud83c\uddec\ud83c\udde6', population: BigInt(2_400_000), area: 267668, timezone: 'Africa/Libreville',
    languages: ['French'], currency: 'XAF', phoneCode: '+241',
    isOperational: false, sortOrder: 31,
  },
  {
    code: 'RW', code3: 'RWA',
    name: { en: 'Rwanda', fr: 'Rwanda', pt: 'Ruanda', ar: '\u0631\u0648\u0627\u0646\u062f\u0627' },
    officialName: { en: 'Republic of Rwanda', fr: 'R\u00e9publique du Rwanda' },
    capital: { en: 'Kigali', fr: 'Kigali', pt: 'Kigali' },
    flag: '\ud83c\uddf7\ud83c\uddfc', population: BigInt(14_100_000), area: 26338, timezone: 'Africa/Kigali',
    languages: ['Kinyarwanda', 'French', 'English'], currency: 'RWF', phoneCode: '+250',
    isOperational: false, sortOrder: 32,
  },
  {
    code: 'ST', code3: 'STP',
    name: { en: 'S\u00e3o Tom\u00e9 and Pr\u00edncipe', fr: 'Sao Tom\u00e9-et-Pr\u00edncipe', pt: 'S\u00e3o Tom\u00e9 e Pr\u00edncipe', ar: '\u0633\u0627\u0648 \u062a\u0648\u0645\u064a \u0648\u0628\u0631\u064a\u0646\u0633\u064a\u0628\u064a' },
    officialName: { en: 'Democratic Republic of S\u00e3o Tom\u00e9 and Pr\u00edncipe', fr: 'R\u00e9publique d\u00e9mocratique de Sao Tom\u00e9-et-Pr\u00edncipe' },
    capital: { en: 'S\u00e3o Tom\u00e9', fr: 'S\u00e3o Tom\u00e9', pt: 'S\u00e3o Tom\u00e9' },
    flag: '\ud83c\uddf8\ud83c\uddf9', population: BigInt(200_000), area: 964, timezone: 'Africa/Sao_Tome',
    languages: ['Portuguese'], currency: 'STN', phoneCode: '+239',
    isOperational: false, sortOrder: 33,
  },

  // ── East Africa (EAC / IGAD) ──
  {
    code: 'DJ', code3: 'DJI',
    name: { en: 'Djibouti', fr: 'Djibouti', pt: 'Djibuti', ar: '\u062c\u064a\u0628\u0648\u062a\u064a' },
    officialName: { en: 'Republic of Djibouti', fr: 'R\u00e9publique de Djibouti' },
    capital: { en: 'Djibouti', fr: 'Djibouti', pt: 'Djibuti' },
    flag: '\ud83c\udde9\ud83c\uddef', population: BigInt(1_100_000), area: 23200, timezone: 'Africa/Djibouti',
    languages: ['French', 'Arabic'], currency: 'DJF', phoneCode: '+253',
    isOperational: false, sortOrder: 34,
  },
  {
    code: 'ER', code3: 'ERI',
    name: { en: 'Eritrea', fr: '\u00c9rythr\u00e9e', pt: 'Eritreia', ar: '\u0625\u0631\u064a\u062a\u0631\u064a\u0627' },
    officialName: { en: 'State of Eritrea', fr: "\u00c9tat d'\u00c9rythr\u00e9e" },
    capital: { en: 'Asmara', fr: 'Asmara', pt: 'Asmara' },
    flag: '\ud83c\uddea\ud83c\uddf7', population: BigInt(3_700_000), area: 117600, timezone: 'Africa/Asmara',
    languages: ['Tigrinya', 'Arabic', 'English'], currency: 'ERN', phoneCode: '+291',
    isOperational: false, sortOrder: 35,
  },
  {
    code: 'ET', code3: 'ETH',
    name: { en: 'Ethiopia', fr: '\u00c9thiopie', pt: 'Eti\u00f3pia', ar: '\u0625\u062b\u064a\u0648\u0628\u064a\u0627' },
    officialName: { en: 'Federal Democratic Republic of Ethiopia', fr: "R\u00e9publique f\u00e9d\u00e9rale d\u00e9mocratique d'\u00c9thiopie" },
    capital: { en: 'Addis Ababa', fr: 'Addis-Abeba', pt: 'Adis Abeba' },
    flag: '\ud83c\uddea\ud83c\uddf9', population: BigInt(126_500_000), area: 1104300, timezone: 'Africa/Addis_Ababa',
    languages: ['Amharic'], currency: 'ETB', phoneCode: '+251',
    isOperational: true, tenantId: TENANT_IDS.ETHIOPIA, sortOrder: 36,
  },
  {
    code: 'KE', code3: 'KEN',
    name: { en: 'Kenya', fr: 'Kenya', pt: 'Qu\u00e9nia', ar: '\u0643\u064a\u0646\u064a\u0627' },
    officialName: { en: 'Republic of Kenya', fr: 'R\u00e9publique du Kenya' },
    capital: { en: 'Nairobi', fr: 'Nairobi', pt: 'Nair\u00f3bi' },
    flag: '\ud83c\uddf0\ud83c\uddea', population: BigInt(55_100_000), area: 580367, timezone: 'Africa/Nairobi',
    languages: ['Swahili', 'English'], currency: 'KES', phoneCode: '+254',
    isOperational: true, tenantId: TENANT_IDS.KENYA, sortOrder: 37,
  },
  {
    code: 'SO', code3: 'SOM',
    name: { en: 'Somalia', fr: 'Somalie', pt: 'Som\u00e1lia', ar: '\u0627\u0644\u0635\u0648\u0645\u0627\u0644' },
    officialName: { en: 'Federal Republic of Somalia', fr: 'R\u00e9publique f\u00e9d\u00e9rale de Somalie' },
    capital: { en: 'Mogadishu', fr: 'Mogadiscio', pt: 'Mogad\u00edscio' },
    flag: '\ud83c\uddf8\ud83c\uddf4', population: BigInt(18_100_000), area: 637657, timezone: 'Africa/Mogadishu',
    languages: ['Somali', 'Arabic'], currency: 'SOS', phoneCode: '+252',
    isOperational: false, sortOrder: 38,
  },
  {
    code: 'SS', code3: 'SSD',
    name: { en: 'South Sudan', fr: 'Soudan du Sud', pt: 'Sud\u00e3o do Sul', ar: '\u062c\u0646\u0648\u0628 \u0627\u0644\u0633\u0648\u062f\u0627\u0646' },
    officialName: { en: 'Republic of South Sudan', fr: 'R\u00e9publique du Soudan du Sud' },
    capital: { en: 'Juba', fr: 'Djouba', pt: 'Juba' },
    flag: '\ud83c\uddf8\ud83c\uddf8', population: BigInt(11_100_000), area: 619745, timezone: 'Africa/Juba',
    languages: ['English'], currency: 'SSP', phoneCode: '+211',
    isOperational: false, sortOrder: 39,
  },
  {
    code: 'SD', code3: 'SDN',
    name: { en: 'Sudan', fr: 'Soudan', pt: 'Sud\u00e3o', ar: '\u0627\u0644\u0633\u0648\u062f\u0627\u0646' },
    officialName: { en: 'Republic of the Sudan', fr: 'R\u00e9publique du Soudan' },
    capital: { en: 'Khartoum', fr: 'Khartoum', pt: 'Cartum' },
    flag: '\ud83c\uddf8\ud83c\udde9', population: BigInt(47_900_000), area: 1861484, timezone: 'Africa/Khartoum',
    languages: ['Arabic', 'English'], currency: 'SDG', phoneCode: '+249',
    isOperational: false, sortOrder: 40,
  },
  {
    code: 'UG', code3: 'UGA',
    name: { en: 'Uganda', fr: 'Ouganda', pt: 'Uganda', ar: '\u0623\u0648\u063a\u0646\u062f\u0627' },
    officialName: { en: 'Republic of Uganda', fr: "R\u00e9publique de l'Ouganda" },
    capital: { en: 'Kampala', fr: 'Kampala', pt: 'Campala' },
    flag: '\ud83c\uddfa\ud83c\uddec', population: BigInt(48_600_000), area: 241038, timezone: 'Africa/Kampala',
    languages: ['English', 'Swahili'], currency: 'UGX', phoneCode: '+256',
    isOperational: false, sortOrder: 41,
  },
  {
    code: 'TZ', code3: 'TZA',
    name: { en: 'Tanzania', fr: 'Tanzanie', pt: 'Tanz\u00e2nia', ar: '\u062a\u0646\u0632\u0627\u0646\u064a\u0627' },
    officialName: { en: 'United Republic of Tanzania', fr: 'R\u00e9publique-Unie de Tanzanie' },
    capital: { en: 'Dodoma', fr: 'Dodoma', pt: 'Dodoma' },
    flag: '\ud83c\uddf9\ud83c\uddff', population: BigInt(65_500_000), area: 945087, timezone: 'Africa/Dar_es_Salaam',
    languages: ['Swahili', 'English'], currency: 'TZS', phoneCode: '+255',
    isOperational: false, sortOrder: 42,
  },

  // ── Southern Africa (SADC) ──
  {
    code: 'BW', code3: 'BWA',
    name: { en: 'Botswana', fr: 'Botswana', pt: 'Botsuana', ar: '\u0628\u0648\u062a\u0633\u0648\u0627\u0646\u0627' },
    officialName: { en: 'Republic of Botswana', fr: 'R\u00e9publique du Botswana' },
    capital: { en: 'Gaborone', fr: 'Gaborone', pt: 'Gaborone' },
    flag: '\ud83c\udde7\ud83c\uddfc', population: BigInt(2_600_000), area: 581730, timezone: 'Africa/Gaborone',
    languages: ['English', 'Setswana'], currency: 'BWP', phoneCode: '+267',
    isOperational: false, sortOrder: 43,
  },
  {
    code: 'KM', code3: 'COM',
    name: { en: 'Comoros', fr: 'Comores', pt: 'Comores', ar: '\u062c\u0632\u0631 \u0627\u0644\u0642\u0645\u0631' },
    officialName: { en: 'Union of the Comoros', fr: 'Union des Comores' },
    capital: { en: 'Moroni', fr: 'Moroni', pt: 'Moroni' },
    flag: '\ud83c\uddf0\ud83c\uddf2', population: BigInt(900_000), area: 2235, timezone: 'Indian/Comoro',
    languages: ['Comorian', 'Arabic', 'French'], currency: 'KMF', phoneCode: '+269',
    isOperational: false, sortOrder: 44,
  },
  {
    code: 'SZ', code3: 'SWZ',
    name: { en: 'Eswatini', fr: 'Eswatini', pt: 'Essuat\u00edni', ar: '\u0625\u0633\u0648\u0627\u062a\u064a\u0646\u064a' },
    officialName: { en: 'Kingdom of Eswatini', fr: "Royaume d'Eswatini" },
    capital: { en: 'Mbabane', fr: 'Mbabane', pt: 'Mbabane' },
    flag: '\ud83c\uddf8\ud83c\uddff', population: BigInt(1_200_000), area: 17364, timezone: 'Africa/Mbabane',
    languages: ['English', 'Swazi'], currency: 'SZL', phoneCode: '+268',
    isOperational: false, sortOrder: 45,
  },
  {
    code: 'LS', code3: 'LSO',
    name: { en: 'Lesotho', fr: 'Lesotho', pt: 'Lesoto', ar: '\u0644\u064a\u0633\u0648\u062a\u0648' },
    officialName: { en: 'Kingdom of Lesotho', fr: 'Royaume du Lesotho' },
    capital: { en: 'Maseru', fr: 'Maseru', pt: 'Maseru' },
    flag: '\ud83c\uddf1\ud83c\uddf8', population: BigInt(2_300_000), area: 30355, timezone: 'Africa/Maseru',
    languages: ['Sesotho', 'English'], currency: 'LSL', phoneCode: '+266',
    isOperational: false, sortOrder: 46,
  },
  {
    code: 'MG', code3: 'MDG',
    name: { en: 'Madagascar', fr: 'Madagascar', pt: 'Madag\u00e1scar', ar: '\u0645\u062f\u063a\u0634\u0642\u0631' },
    officialName: { en: 'Republic of Madagascar', fr: 'R\u00e9publique de Madagascar' },
    capital: { en: 'Antananarivo', fr: 'Antananarivo', pt: 'Antananarivo' },
    flag: '\ud83c\uddf2\ud83c\uddec', population: BigInt(30_300_000), area: 587041, timezone: 'Indian/Antananarivo',
    languages: ['Malagasy', 'French'], currency: 'MGA', phoneCode: '+261',
    isOperational: false, sortOrder: 47,
  },
  {
    code: 'MW', code3: 'MWI',
    name: { en: 'Malawi', fr: 'Malawi', pt: 'Mal\u00e1ui', ar: '\u0645\u0644\u0627\u0648\u064a' },
    officialName: { en: 'Republic of Malawi', fr: 'R\u00e9publique du Malawi' },
    capital: { en: 'Lilongwe', fr: 'Lilongwe', pt: 'Lilongwe' },
    flag: '\ud83c\uddf2\ud83c\uddfc', population: BigInt(20_900_000), area: 118484, timezone: 'Africa/Blantyre',
    languages: ['English', 'Chichewa'], currency: 'MWK', phoneCode: '+265',
    isOperational: false, sortOrder: 48,
  },
  {
    code: 'MU', code3: 'MUS',
    name: { en: 'Mauritius', fr: 'Maurice', pt: 'Maur\u00edcia', ar: '\u0645\u0648\u0631\u064a\u0634\u064a\u0648\u0633' },
    officialName: { en: 'Republic of Mauritius', fr: 'R\u00e9publique de Maurice' },
    capital: { en: 'Port Louis', fr: 'Port-Louis', pt: 'Porto Lu\u00eds' },
    flag: '\ud83c\uddf2\ud83c\uddfa', population: BigInt(1_300_000), area: 2040, timezone: 'Indian/Mauritius',
    languages: ['English', 'French', 'Creole'], currency: 'MUR', phoneCode: '+230',
    isOperational: false, sortOrder: 49,
  },
  {
    code: 'MZ', code3: 'MOZ',
    name: { en: 'Mozambique', fr: 'Mozambique', pt: 'Mo\u00e7ambique', ar: '\u0645\u0648\u0632\u0645\u0628\u064a\u0642' },
    officialName: { en: 'Republic of Mozambique', fr: 'R\u00e9publique du Mozambique' },
    capital: { en: 'Maputo', fr: 'Maputo', pt: 'Maputo' },
    flag: '\ud83c\uddf2\ud83c\uddff', population: BigInt(33_900_000), area: 801590, timezone: 'Africa/Maputo',
    languages: ['Portuguese'], currency: 'MZN', phoneCode: '+258',
    isOperational: false, sortOrder: 50,
  },
  {
    code: 'NA', code3: 'NAM',
    name: { en: 'Namibia', fr: 'Namibie', pt: 'Nam\u00edbia', ar: '\u0646\u0627\u0645\u064a\u0628\u064a\u0627' },
    officialName: { en: 'Republic of Namibia', fr: 'R\u00e9publique de Namibie' },
    capital: { en: 'Windhoek', fr: 'Windhoek', pt: 'Windhoek' },
    flag: '\ud83c\uddf3\ud83c\udde6', population: BigInt(2_600_000), area: 825615, timezone: 'Africa/Windhoek',
    languages: ['English'], currency: 'NAD', phoneCode: '+264',
    isOperational: false, sortOrder: 51,
  },
  {
    code: 'SC', code3: 'SYC',
    name: { en: 'Seychelles', fr: 'Seychelles', pt: 'Seicheles', ar: '\u0633\u064a\u0634\u064a\u0644' },
    officialName: { en: 'Republic of Seychelles', fr: 'R\u00e9publique des Seychelles' },
    capital: { en: 'Victoria', fr: 'Victoria', pt: 'Vit\u00f3ria' },
    flag: '\ud83c\uddf8\ud83c\udde8', population: BigInt(100_000), area: 459, timezone: 'Indian/Mahe',
    languages: ['Creole', 'English', 'French'], currency: 'SCR', phoneCode: '+248',
    isOperational: false, sortOrder: 52,
  },
  {
    code: 'ZA', code3: 'ZAF',
    name: { en: 'South Africa', fr: 'Afrique du Sud', pt: '\u00c1frica do Sul', ar: '\u062c\u0646\u0648\u0628 \u0623\u0641\u0631\u064a\u0642\u064a\u0627' },
    officialName: { en: 'Republic of South Africa', fr: "R\u00e9publique d'Afrique du Sud" },
    capital: { en: 'Pretoria', fr: 'Pretoria', pt: 'Pret\u00f3ria' },
    flag: '\ud83c\uddff\ud83c\udde6', population: BigInt(60_400_000), area: 1221037, timezone: 'Africa/Johannesburg',
    languages: ['English', 'Zulu', 'Xhosa', 'Afrikaans'], currency: 'ZAR', phoneCode: '+27',
    isOperational: true, tenantId: TENANT_IDS.SOUTH_AFRICA, sortOrder: 53,
  },
  {
    code: 'ZM', code3: 'ZMB',
    name: { en: 'Zambia', fr: 'Zambie', pt: 'Z\u00e2mbia', ar: '\u0632\u0627\u0645\u0628\u064a\u0627' },
    officialName: { en: 'Republic of Zambia', fr: 'R\u00e9publique de Zambie' },
    capital: { en: 'Lusaka', fr: 'Lusaka', pt: 'Lusaca' },
    flag: '\ud83c\uddff\ud83c\uddf2', population: BigInt(20_600_000), area: 752618, timezone: 'Africa/Lusaka',
    languages: ['English'], currency: 'ZMW', phoneCode: '+260',
    isOperational: false, sortOrder: 54,
  },
  {
    code: 'ZW', code3: 'ZWE',
    name: { en: 'Zimbabwe', fr: 'Zimbabwe', pt: 'Zimbabu\u00e9', ar: '\u0632\u064a\u0645\u0628\u0627\u0628\u0648\u064a' },
    officialName: { en: 'Republic of Zimbabwe', fr: 'R\u00e9publique du Zimbabwe' },
    capital: { en: 'Harare', fr: 'Harare', pt: 'Harare' },
    flag: '\ud83c\uddff\ud83c\uddfc', population: BigInt(16_700_000), area: 390757, timezone: 'Africa/Harare',
    languages: ['English', 'Shona', 'Ndebele'], currency: 'ZWL', phoneCode: '+263',
    isOperational: false, sortOrder: 55,
  },
];

// ─── System Configurations ───────────────────────────────────────────────────

interface SystemConfigSeedData {
  category: string;
  key: string;
  value: unknown;
  label: Record<string, string>;
  description?: Record<string, string>;
  type: string;
  options?: unknown;
  isEditable: boolean;
  scope: string;
}

const SYSTEM_CONFIGS: SystemConfigSeedData[] = [
  // ── GENERAL ──
  {
    category: 'general', key: 'platform.name',
    value: 'ARIS',
    label: { en: 'Platform Name', fr: 'Nom de la plateforme', pt: 'Nome da plataforma' },
    description: { en: 'Short name of the platform', fr: 'Nom court de la plateforme', pt: 'Nome curto da plataforma' },
    type: 'string', isEditable: false, scope: 'global',
  },
  {
    category: 'general', key: 'platform.fullName',
    value: { en: 'Animal Resources Information System', fr: "Syst\u00e8me d'Information sur les Ressources Animales", pt: 'Sistema de Informa\u00e7\u00e3o sobre Recursos Animais', ar: '\u0646\u0638\u0627\u0645 \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0645\u0648\u0627\u0631\u062f \u0627\u0644\u062d\u064a\u0648\u0627\u0646\u064a\u0629' },
    label: { en: 'Platform Full Name', fr: 'Nom complet de la plateforme', pt: 'Nome completo da plataforma' },
    description: { en: 'Full multilingual platform name', fr: 'Nom complet multilingue de la plateforme', pt: 'Nome completo multil\u00edngue da plataforma' },
    type: 'string', isEditable: false, scope: 'global',
  },
  {
    category: 'general', key: 'platform.version',
    value: '3.0.0-rc1',
    label: { en: 'Platform Version', fr: 'Version de la plateforme', pt: 'Vers\u00e3o da plataforma' },
    description: { en: 'Current platform version', fr: 'Version actuelle de la plateforme', pt: 'Vers\u00e3o atual da plataforma' },
    type: 'string', isEditable: false, scope: 'global',
  },
  {
    category: 'general', key: 'platform.organization',
    value: 'AU-IBAR',
    label: { en: 'Organization', fr: 'Organisation', pt: 'Organiza\u00e7\u00e3o' },
    description: { en: 'Managing organization', fr: 'Organisation gestionnaire', pt: 'Organiza\u00e7\u00e3o gestora' },
    type: 'string', isEditable: false, scope: 'global',
  },
  {
    category: 'general', key: 'platform.logo.url',
    value: '/au-logo.png',
    label: { en: 'Logo URL', fr: 'URL du logo', pt: 'URL do logotipo' },
    description: { en: 'URL of the platform logo', fr: 'URL du logo de la plateforme', pt: 'URL do logotipo da plataforma' },
    type: 'url', isEditable: true, scope: 'global',
  },
  {
    category: 'general', key: 'platform.contact.email',
    value: 'ibar.office@au-ibar.org',
    label: { en: 'Contact Email', fr: 'Email de contact', pt: 'Email de contacto' },
    description: { en: 'Primary contact email', fr: 'Adresse email de contact principale', pt: 'Email de contacto principal' },
    type: 'string', isEditable: true, scope: 'global',
  },

  // ── SECURITY ──
  {
    category: 'security', key: 'security.password.minLength',
    value: 8,
    label: { en: 'Password Min Length', fr: 'Longueur minimale du mot de passe', pt: 'Comprimento m\u00ednimo da senha' },
    description: { en: 'Minimum number of characters for passwords', fr: 'Nombre minimum de caract\u00e8res pour les mots de passe', pt: 'N\u00famero m\u00ednimo de caracteres para senhas' },
    type: 'number', isEditable: true, scope: 'global',
  },
  {
    category: 'security', key: 'security.password.requireUppercase',
    value: true,
    label: { en: 'Require Uppercase', fr: 'Majuscule requise', pt: 'Mai\u00fascula obrigat\u00f3ria' },
    description: { en: 'Require at least one uppercase letter in passwords', fr: 'Exiger au moins une lettre majuscule', pt: 'Exigir pelo menos uma letra mai\u00fascula' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  {
    category: 'security', key: 'security.password.requireNumber',
    value: true,
    label: { en: 'Require Number', fr: 'Chiffre requis', pt: 'N\u00famero obrigat\u00f3rio' },
    description: { en: 'Require at least one number in passwords', fr: 'Exiger au moins un chiffre', pt: 'Exigir pelo menos um n\u00famero' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  {
    category: 'security', key: 'security.password.requireSpecial',
    value: true,
    label: { en: 'Require Special Character', fr: 'Caract\u00e8re sp\u00e9cial requis', pt: 'Caractere especial obrigat\u00f3rio' },
    description: { en: 'Require at least one special character in passwords', fr: 'Exiger au moins un caract\u00e8re sp\u00e9cial', pt: 'Exigir pelo menos um caractere especial' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  {
    category: 'security', key: 'security.mfa.enabled',
    value: true,
    label: { en: 'MFA Enabled', fr: 'MFA activ\u00e9', pt: 'MFA ativado' },
    description: { en: 'Enable multi-factor authentication', fr: "Activer l'authentification multi-facteurs", pt: 'Ativar autentica\u00e7\u00e3o multifator' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  {
    category: 'security', key: 'security.mfa.required',
    value: false,
    label: { en: 'MFA Required', fr: 'MFA obligatoire', pt: 'MFA obrigat\u00f3rio' },
    description: { en: 'Require MFA for all users', fr: 'Exiger le MFA pour tous les utilisateurs', pt: 'Exigir MFA para todos os usu\u00e1rios' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  {
    category: 'security', key: 'security.session.timeout',
    value: 3600,
    label: { en: 'Session Timeout', fr: 'D\u00e9lai de session', pt: 'Tempo limite de sess\u00e3o' },
    description: { en: 'Session timeout in seconds', fr: 'D\u00e9lai d\u2019expiration de session en secondes', pt: 'Tempo limite da sess\u00e3o em segundos' },
    type: 'number', isEditable: true, scope: 'global',
  },
  {
    category: 'security', key: 'security.login.maxAttempts',
    value: 5,
    label: { en: 'Max Login Attempts', fr: 'Tentatives de connexion max', pt: 'Tentativas m\u00e1ximas de login' },
    description: { en: 'Maximum login attempts before lockout', fr: 'Nombre maximum de tentatives avant verrouillage', pt: 'N\u00famero m\u00e1ximo de tentativas antes do bloqueio' },
    type: 'number', isEditable: true, scope: 'global',
  },
  {
    category: 'security', key: 'security.login.lockoutDuration',
    value: 900,
    label: { en: 'Lockout Duration', fr: 'Dur\u00e9e de verrouillage', pt: 'Dura\u00e7\u00e3o do bloqueio' },
    description: { en: 'Account lockout duration in seconds', fr: 'Dur\u00e9e de verrouillage du compte en secondes', pt: 'Dura\u00e7\u00e3o do bloqueio da conta em segundos' },
    type: 'number', isEditable: true, scope: 'global',
  },

  // ── NOTIFICATIONS ──
  {
    category: 'notifications', key: 'notifications.email.enabled',
    value: true,
    label: { en: 'Email Notifications', fr: 'Notifications par email', pt: 'Notifica\u00e7\u00f5es por email' },
    description: { en: 'Enable email notifications', fr: 'Activer les notifications par email', pt: 'Ativar notifica\u00e7\u00f5es por email' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  {
    category: 'notifications', key: 'notifications.email.from',
    value: 'noreply@au-aris.org',
    label: { en: 'Email From Address', fr: "Adresse d'exp\u00e9dition", pt: 'Endere\u00e7o de envio' },
    description: { en: 'Sender email address for notifications', fr: "Adresse email de l'exp\u00e9diteur", pt: 'Endere\u00e7o de email do remetente' },
    type: 'string', isEditable: true, scope: 'global',
  },
  {
    category: 'notifications', key: 'notifications.sms.enabled',
    value: false,
    label: { en: 'SMS Notifications', fr: 'Notifications SMS', pt: 'Notifica\u00e7\u00f5es SMS' },
    description: { en: 'Enable SMS notifications', fr: 'Activer les notifications SMS', pt: 'Ativar notifica\u00e7\u00f5es SMS' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  {
    category: 'notifications', key: 'notifications.push.enabled',
    value: true,
    label: { en: 'Push Notifications', fr: 'Notifications push', pt: 'Notifica\u00e7\u00f5es push' },
    description: { en: 'Enable push notifications', fr: 'Activer les notifications push', pt: 'Ativar notifica\u00e7\u00f5es push' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  {
    category: 'notifications', key: 'notifications.digest.frequency',
    value: 'daily',
    label: { en: 'Digest Frequency', fr: 'Fr\u00e9quence du r\u00e9sum\u00e9', pt: 'Frequ\u00eancia do resumo' },
    description: { en: 'How often to send digest notifications', fr: '\u00c0 quelle fr\u00e9quence envoyer les r\u00e9sum\u00e9s', pt: 'Com que frequ\u00eancia enviar resumos' },
    type: 'enum', options: ['immediate', 'daily', 'weekly'], isEditable: true, scope: 'global',
  },

  // ── BRANDING ──
  {
    category: 'branding', key: 'branding.primaryColor',
    value: '#006B3F',
    label: { en: 'Primary Color', fr: 'Couleur primaire', pt: 'Cor prim\u00e1ria' },
    description: { en: 'Primary brand color', fr: 'Couleur principale de la marque', pt: 'Cor principal da marca' },
    type: 'color', isEditable: true, scope: 'global',
  },
  {
    category: 'branding', key: 'branding.secondaryColor',
    value: '#D4A843',
    label: { en: 'Secondary Color', fr: 'Couleur secondaire', pt: 'Cor secund\u00e1ria' },
    description: { en: 'Secondary brand color', fr: 'Couleur secondaire de la marque', pt: 'Cor secund\u00e1ria da marca' },
    type: 'color', isEditable: true, scope: 'global',
  },
  {
    category: 'branding', key: 'branding.darkMode.enabled',
    value: true,
    label: { en: 'Dark Mode', fr: 'Mode sombre', pt: 'Modo escuro' },
    description: { en: 'Enable dark mode option', fr: 'Activer le mode sombre', pt: 'Ativar o modo escuro' },
    type: 'boolean', isEditable: true, scope: 'global',
  },

  // ── I18N ──
  {
    category: 'i18n', key: 'i18n.defaultLocale',
    value: 'en',
    label: { en: 'Default Locale', fr: 'Langue par d\u00e9faut', pt: 'Idioma padr\u00e3o' },
    description: { en: 'Default language for the platform', fr: 'Langue par d\u00e9faut de la plateforme', pt: 'Idioma padr\u00e3o da plataforma' },
    type: 'enum', options: ['en', 'fr', 'pt', 'es', 'ar'], isEditable: true, scope: 'global',
  },
  {
    category: 'i18n', key: 'i18n.availableLocales',
    value: ['en', 'fr', 'pt', 'es', 'ar'],
    label: { en: 'Available Locales', fr: 'Langues disponibles', pt: 'Idiomas dispon\u00edveis' },
    description: { en: 'List of supported languages', fr: 'Liste des langues prises en charge', pt: 'Lista de idiomas suportados' },
    type: 'json', isEditable: true, scope: 'global',
  },
  {
    category: 'i18n', key: 'i18n.rtl.locales',
    value: ['ar'],
    label: { en: 'RTL Locales', fr: 'Langues RTL', pt: 'Idiomas RTL' },
    description: { en: 'Languages that use right-to-left text direction', fr: 'Langues utilisant l\u2019\u00e9criture de droite \u00e0 gauche', pt: 'Idiomas que usam dire\u00e7\u00e3o de texto da direita para a esquerda' },
    type: 'json', isEditable: false, scope: 'global',
  },
  {
    category: 'i18n', key: 'i18n.dateFormat',
    value: 'DD/MM/YYYY',
    label: { en: 'Date Format', fr: 'Format de date', pt: 'Formato de data' },
    description: { en: 'Default date display format', fr: "Format d'affichage des dates par d\u00e9faut", pt: 'Formato padr\u00e3o de exibi\u00e7\u00e3o de datas' },
    type: 'string', isEditable: true, scope: 'global',
  },

  // ── DATA_QUALITY ──
  {
    category: 'data-quality', key: 'dataQuality.validation.strictMode',
    value: false,
    label: { en: 'Strict Validation Mode', fr: 'Mode de validation strict', pt: 'Modo de valida\u00e7\u00e3o rigorosa' },
    description: { en: 'Reject records that fail any quality gate', fr: 'Rejeter les enregistrements \u00e9chouant \u00e0 un contr\u00f4le qualit\u00e9', pt: 'Rejeitar registos que falhem qualquer porta de qualidade' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  {
    category: 'data-quality', key: 'dataQuality.completeness.threshold',
    value: 80,
    label: { en: 'Completeness Threshold (%)', fr: 'Seuil de compl\u00e9tude (%)', pt: 'Limiar de completude (%)' },
    description: { en: 'Minimum percentage of fields that must be completed', fr: 'Pourcentage minimum de champs devant \u00eatre renseign\u00e9s', pt: 'Percentagem m\u00ednima de campos que devem ser preenchidos' },
    type: 'number', isEditable: true, scope: 'global',
  },
  {
    category: 'data-quality', key: 'dataQuality.timeliness.deadline',
    value: 30,
    label: { en: 'Timeliness Deadline (days)', fr: "D\u00e9lai de ponctualit\u00e9 (jours)", pt: 'Prazo de pontualidade (dias)' },
    description: { en: 'Maximum days after event for timely reporting', fr: "Nombre maximum de jours apr\u00e8s l'\u00e9v\u00e9nement pour un rapport ponctuel", pt: 'N\u00famero m\u00e1ximo de dias ap\u00f3s o evento para relat\u00f3rio pontual' },
    type: 'number', isEditable: true, scope: 'global',
  },
  {
    category: 'data-quality', key: 'dataQuality.duplicateDetection.enabled',
    value: true,
    label: { en: 'Duplicate Detection', fr: 'D\u00e9tection des doublons', pt: 'Dete\u00e7\u00e3o de duplicados' },
    description: { en: 'Enable automatic duplicate detection', fr: 'Activer la d\u00e9tection automatique des doublons', pt: 'Ativar dete\u00e7\u00e3o autom\u00e1tica de duplicados' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  // ── Validation General (new) ──
  {
    category: 'data-quality', key: 'dataQuality.validation.warningAsBlocking',
    value: false,
    label: { en: 'Warnings as Blocking', fr: 'Avertissements bloquants', pt: 'Avisos como bloqueantes' },
    description: { en: 'Treat warning-level violations as blocking failures', fr: 'Traiter les violations de niveau avertissement comme des \u00e9checs bloquants', pt: 'Tratar viola\u00e7\u00f5es de n\u00edvel de aviso como falhas bloqueantes' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  {
    category: 'data-quality', key: 'dataQuality.validation.maxViolations',
    value: 5,
    label: { en: 'Max Violations before Rejection', fr: 'Violations max avant rejet', pt: 'Viola\u00e7\u00f5es m\u00e1x. antes da rejei\u00e7\u00e3o' },
    description: { en: 'Maximum number of violations before a record is auto-rejected', fr: "Nombre maximum de violations avant le rejet automatique d'un enregistrement", pt: 'N\u00famero m\u00e1ximo de viola\u00e7\u00f5es antes da rejei\u00e7\u00e3o autom\u00e1tica de um registo' },
    type: 'number', isEditable: true, scope: 'global',
  },
  {
    category: 'data-quality', key: 'dataQuality.validation.autoValidateOnSubmit',
    value: true,
    label: { en: 'Auto-validate on Submit', fr: 'Validation auto \u00e0 la soumission', pt: 'Valida\u00e7\u00e3o autom\u00e1tica ao submeter' },
    description: { en: 'Automatically run all quality gates when a record is submitted', fr: 'Ex\u00e9cuter automatiquement tous les contr\u00f4les qualit\u00e9 lors de la soumission', pt: 'Executar automaticamente todos os port\u00f5es de qualidade ao submeter' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  // ── Completeness (new) ──
  {
    category: 'data-quality', key: 'dataQuality.completeness.warningThreshold',
    value: 60,
    label: { en: 'Completeness Warning Threshold (%)', fr: "Seuil d'avertissement de compl\u00e9tude (%)", pt: 'Limiar de aviso de completude (%)' },
    description: { en: 'Percentage below which a warning is raised before failing', fr: "Pourcentage en dessous duquel un avertissement est \u00e9mis avant l'\u00e9chec", pt: 'Percentagem abaixo da qual um aviso \u00e9 emitido antes da falha' },
    type: 'number', isEditable: true, scope: 'global',
  },
  {
    category: 'data-quality', key: 'dataQuality.completeness.includeOptionalFields',
    value: false,
    label: { en: 'Include Optional Fields', fr: 'Inclure les champs facultatifs', pt: 'Incluir campos opcionais' },
    description: { en: 'Include optional fields when calculating completeness percentage', fr: 'Inclure les champs facultatifs dans le calcul du pourcentage de compl\u00e9tude', pt: 'Incluir campos opcionais no c\u00e1lculo da percentagem de completude' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  // ── Temporal Consistency (new) ──
  {
    category: 'data-quality', key: 'dataQuality.temporal.enabled',
    value: true,
    label: { en: 'Temporal Consistency Checks', fr: 'V\u00e9rifications de coh\u00e9rence temporelle', pt: 'Verifica\u00e7\u00f5es de consist\u00eancia temporal' },
    description: { en: 'Enable temporal consistency validation (date ordering, future dates)', fr: 'Activer la validation de coh\u00e9rence temporelle (ordre des dates, dates futures)', pt: 'Ativar valida\u00e7\u00e3o de consist\u00eancia temporal (ordena\u00e7\u00e3o de datas, datas futuras)' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  {
    category: 'data-quality', key: 'dataQuality.temporal.futureDateTolerance',
    value: 0,
    label: { en: 'Future Date Tolerance (days)', fr: 'Tol\u00e9rance dates futures (jours)', pt: 'Toler\u00e2ncia de datas futuras (dias)' },
    description: { en: 'Number of days in the future allowed (0 = future dates forbidden)', fr: 'Nombre de jours dans le futur autoris\u00e9s (0 = dates futures interdites)', pt: 'N\u00famero de dias no futuro permitidos (0 = datas futuras proibidas)' },
    type: 'number', isEditable: true, scope: 'global',
  },
  // ── Geographic Consistency (new) ──
  {
    category: 'data-quality', key: 'dataQuality.geographic.enabled',
    value: true,
    label: { en: 'Geographic Consistency Checks', fr: 'V\u00e9rifications de coh\u00e9rence g\u00e9ographique', pt: 'Verifica\u00e7\u00f5es de consist\u00eancia geogr\u00e1fica' },
    description: { en: 'Enable geographic validation (admin codes, boundary checks)', fr: 'Activer la validation g\u00e9ographique (codes admin, limites)', pt: 'Ativar valida\u00e7\u00e3o geogr\u00e1fica (c\u00f3digos admin, limites)' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  {
    category: 'data-quality', key: 'dataQuality.geographic.coordinateValidation',
    value: true,
    label: { en: 'Coordinate Validation', fr: 'Validation des coordonn\u00e9es', pt: 'Valida\u00e7\u00e3o de coordenadas' },
    description: { en: 'Validate that coordinates fall within continental/country boundaries', fr: 'V\u00e9rifier que les coordonn\u00e9es sont dans les limites continentales/nationales', pt: 'Validar que as coordenadas est\u00e3o dentro dos limites continentais/nacionais' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  // ── Codes & Vocabularies (new) ──
  {
    category: 'data-quality', key: 'dataQuality.codes.enabled',
    value: true,
    label: { en: 'Code Validation', fr: 'Validation des codes', pt: 'Valida\u00e7\u00e3o de c\u00f3digos' },
    description: { en: 'Validate codes against Master Data referentials', fr: 'Valider les codes par rapport aux r\u00e9f\u00e9rentiels Master Data', pt: 'Validar c\u00f3digos contra os referenciais Master Data' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  {
    category: 'data-quality', key: 'dataQuality.codes.strictMatching',
    value: false,
    label: { en: 'Strict Code Matching', fr: 'Correspondance stricte des codes', pt: 'Correspond\u00eancia estrita de c\u00f3digos' },
    description: { en: 'Require exact code match (disable fuzzy/partial matching)', fr: 'Exiger une correspondance exacte des codes (d\u00e9sactiver la correspondance floue)', pt: 'Exigir correspond\u00eancia exata de c\u00f3digo (desativar correspond\u00eancia parcial)' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  // ── Duplicate Detection (new) ──
  {
    category: 'data-quality', key: 'dataQuality.duplicateDetection.fuzzyThreshold',
    value: 80,
    label: { en: 'Fuzzy Match Threshold (%)', fr: 'Seuil de correspondance floue (%)', pt: 'Limiar de correspond\u00eancia difusa (%)' },
    description: { en: 'Similarity percentage for fuzzy duplicate matching (0\u2013100)', fr: 'Pourcentage de similarit\u00e9 pour la correspondance floue de doublons (0\u2013100)', pt: 'Percentagem de similaridade para correspond\u00eancia difusa de duplicados (0\u2013100)' },
    type: 'number', isEditable: true, scope: 'global',
  },
  {
    category: 'data-quality', key: 'dataQuality.duplicateDetection.crossTenantCheck',
    value: false,
    label: { en: 'Cross-Tenant Duplicate Check', fr: 'V\u00e9rification inter-tenants', pt: 'Verifica\u00e7\u00e3o inter-tenants' },
    description: { en: 'Check for duplicates across different tenants (cross-border)', fr: 'V\u00e9rifier les doublons entre diff\u00e9rents tenants (transfrontalier)', pt: 'Verificar duplicados entre diferentes tenants (transfronteiri\u00e7o)' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  // ── Timeliness & SLA (new) ──
  {
    category: 'data-quality', key: 'dataQuality.timeliness.warningDays',
    value: 20,
    label: { en: 'Timeliness Warning (days)', fr: 'Avertissement de ponctualit\u00e9 (jours)', pt: 'Aviso de pontualidade (dias)' },
    description: { en: 'Days before the deadline to raise a warning', fr: "Jours avant la date limite pour \u00e9mettre un avertissement", pt: 'Dias antes do prazo para emitir um aviso' },
    type: 'number', isEditable: true, scope: 'global',
  },
  {
    category: 'data-quality', key: 'dataQuality.correction.deadlineHours',
    value: 48,
    label: { en: 'Correction Deadline (hours)', fr: 'D\u00e9lai de correction (heures)', pt: 'Prazo de corre\u00e7\u00e3o (horas)' },
    description: { en: 'Hours allowed to correct a failed quality report', fr: "Heures autoris\u00e9es pour corriger un rapport qualit\u00e9 \u00e9chou\u00e9", pt: 'Horas permitidas para corrigir um relat\u00f3rio de qualidade falhado' },
    type: 'number', isEditable: true, scope: 'global',
  },
  {
    category: 'data-quality', key: 'dataQuality.correction.escalationDays',
    value: 7,
    label: { en: 'Escalation Delay (days)', fr: "D\u00e9lai d'escalade (jours)", pt: 'Prazo de escalonamento (dias)' },
    description: { en: 'Days before escalating an unresolved correction', fr: "Jours avant d'escalader une correction non r\u00e9solue", pt: 'Dias antes de escalar uma corre\u00e7\u00e3o n\u00e3o resolvida' },
    type: 'number', isEditable: true, scope: 'global',
  },
  {
    category: 'data-quality', key: 'dataQuality.correction.autoExpireDays',
    value: 30,
    label: { en: 'Auto-Expire Corrections (days)', fr: 'Expiration auto des corrections (jours)', pt: 'Expira\u00e7\u00e3o autom\u00e1tica de corre\u00e7\u00f5es (dias)' },
    description: { en: 'Days before a pending correction expires automatically', fr: "Jours avant qu'une correction en attente expire automatiquement", pt: 'Dias antes de uma corre\u00e7\u00e3o pendente expirar automaticamente' },
    type: 'number', isEditable: true, scope: 'global',
  },
  // ── Confidence Score (new) ──
  {
    category: 'data-quality', key: 'dataQuality.confidence.enabled',
    value: true,
    label: { en: 'Confidence Scoring', fr: 'Score de confiance', pt: 'Pontua\u00e7\u00e3o de confian\u00e7a' },
    description: { en: 'Enable automatic confidence scoring for event-based data', fr: 'Activer le calcul automatique du score de confiance pour les donn\u00e9es \u00e9v\u00e9nementielles', pt: 'Ativar pontua\u00e7\u00e3o de confian\u00e7a autom\u00e1tica para dados baseados em eventos' },
    type: 'boolean', isEditable: true, scope: 'global',
  },
  {
    category: 'data-quality', key: 'dataQuality.confidence.minimumLevel',
    value: 'RUMOR',
    label: { en: 'Minimum Confidence Level', fr: 'Niveau de confiance minimum', pt: 'N\u00edvel de confian\u00e7a m\u00ednimo' },
    description: { en: 'Minimum confidence level accepted for publication', fr: 'Niveau de confiance minimum accept\u00e9 pour publication', pt: 'N\u00edvel de confian\u00e7a m\u00ednimo aceite para publica\u00e7\u00e3o' },
    type: 'enum', options: ['RUMOR', 'UNVERIFIED', 'VERIFIED', 'CONFIRMED'], isEditable: true, scope: 'global',
  },

  // ── EMAIL ──
  {
    category: 'email', key: 'email.provider',
    value: 'smtp',
    label: { en: 'Email Provider', fr: 'Fournisseur email', pt: 'Provedor de email' },
    description: { en: 'Email delivery service (smtp or postmark)', fr: "Service d'envoi d'emails (smtp ou postmark)", pt: 'Servi\u00e7o de envio de emails (smtp ou postmark)' },
    type: 'enum', options: ['smtp', 'postmark'], isEditable: true, scope: 'global',
  },
  {
    category: 'email', key: 'email.postmark.serverToken',
    value: '',
    label: { en: 'Postmark Server Token', fr: 'Token serveur Postmark', pt: 'Token do servidor Postmark' },
    description: { en: 'Server API token from Postmark dashboard', fr: "Token API serveur depuis le tableau de bord Postmark", pt: 'Token API do servidor do painel Postmark' },
    type: 'secret', isEditable: true, scope: 'global',
  },
  {
    category: 'email', key: 'email.postmark.from',
    value: 'noreply@au-aris.org',
    label: { en: 'Postmark From Address', fr: "Adresse d'exp\u00e9dition Postmark", pt: 'Endere\u00e7o de envio Postmark' },
    description: { en: 'Sender address (must be verified in Postmark)', fr: "Adresse d'exp\u00e9diteur (doit \u00eatre v\u00e9rifi\u00e9e dans Postmark)", pt: 'Endere\u00e7o do remetente (deve ser verificado no Postmark)' },
    type: 'string', isEditable: true, scope: 'global',
  },
  {
    category: 'email', key: 'email.postmark.messageStream',
    value: 'outbound',
    label: { en: 'Message Stream', fr: 'Flux de messages', pt: 'Fluxo de mensagens' },
    description: { en: 'Postmark message stream (outbound, broadcast, etc.)', fr: 'Flux de messages Postmark (outbound, broadcast, etc.)', pt: 'Fluxo de mensagens Postmark (outbound, broadcast, etc.)' },
    type: 'string', isEditable: true, scope: 'global',
  },
  {
    category: 'email', key: 'email.postmark.tag',
    value: 'aris',
    label: { en: 'Postmark Tag', fr: 'Tag Postmark', pt: 'Tag Postmark' },
    description: { en: 'Tag for filtering emails in Postmark dashboard', fr: 'Tag pour filtrer les emails dans le tableau de bord Postmark', pt: 'Tag para filtrar emails no painel Postmark' },
    type: 'string', isEditable: true, scope: 'global',
  },
  {
    category: 'email', key: 'email.smtp.host',
    value: 'localhost',
    label: { en: 'SMTP Host', fr: 'H\u00f4te SMTP', pt: 'Servidor SMTP' },
    description: { en: 'SMTP server hostname', fr: 'Nom du serveur SMTP', pt: 'Nome do servidor SMTP' },
    type: 'string', isEditable: true, scope: 'global',
  },
  {
    category: 'email', key: 'email.smtp.port',
    value: 1025,
    label: { en: 'SMTP Port', fr: 'Port SMTP', pt: 'Porta SMTP' },
    description: { en: 'SMTP server port', fr: 'Port du serveur SMTP', pt: 'Porta do servidor SMTP' },
    type: 'number', isEditable: true, scope: 'global',
  },
  {
    category: 'email', key: 'email.smtp.from',
    value: 'noreply@au-aris.org',
    label: { en: 'SMTP From Address', fr: "Adresse d'exp\u00e9dition SMTP", pt: 'Endere\u00e7o de envio SMTP' },
    description: { en: 'Sender address for SMTP', fr: "Adresse d'exp\u00e9diteur SMTP", pt: 'Endere\u00e7o do remetente SMTP' },
    type: 'string', isEditable: true, scope: 'global',
  },
];

// ─── 9 Business Domains ──────────────────────────────────────────────────────

interface DomainSeedData {
  code: string;
  name: Record<string, string>;
  description: Record<string, string>;
  icon: string;
  color: string;
  sortOrder: number;
}

const DOMAINS_DATA: DomainSeedData[] = [
  {
    code: 'governance',
    name: { en: 'Governance & Capacities', fr: 'Gouvernance et capacit\u00e9s', pt: 'Governan\u00e7a e Capacidades' },
    description: {
      en: 'Legal frameworks, veterinary services evaluation, PVS metrics, and institutional capacity building.',
      fr: "Cadres juridiques, \u00e9valuation des services v\u00e9t\u00e9rinaires, indicateurs PVS et renforcement des capacit\u00e9s institutionnelles.",
      pt: 'Quadros legais, avalia\u00e7\u00e3o de servi\u00e7os veterin\u00e1rios, m\u00e9tricas PVS e capacita\u00e7\u00e3o institucional.',
    },
    icon: 'Building2', color: '#6B21A8', sortOrder: 1,
  },
  {
    code: 'animal-health',
    name: { en: 'Animal Health & One Health', fr: 'Sant\u00e9 animale et One Health', pt: 'Sa\u00fade Animal e One Health' },
    description: {
      en: 'Disease surveillance, outbreak management, laboratory results, vaccination campaigns, and antimicrobial resistance monitoring.',
      fr: 'Surveillance des maladies, gestion des foyers, r\u00e9sultats de laboratoire, campagnes de vaccination et surveillance de la r\u00e9sistance aux antimicrobiens.',
      pt: 'Vigil\u00e2ncia de doen\u00e7as, gest\u00e3o de surtos, resultados laboratoriais, campanhas de vacina\u00e7\u00e3o e monitoriza\u00e7\u00e3o da resist\u00eancia antimicrobiana.',
    },
    icon: 'HeartPulse', color: '#C62828', sortOrder: 2,
  },
  {
    code: 'livestock-prod',
    name: { en: 'Production & Pastoralism', fr: 'Production et pastoralisme', pt: 'Produ\u00e7\u00e3o e Pastoralismo' },
    description: {
      en: 'Livestock census, production systems, slaughterhouse data, and transhumance corridor management.',
      fr: "Recensement du b\u00e9tail, syst\u00e8mes de production, donn\u00e9es d'abattage et gestion des corridors de transhumance.",
      pt: 'Recenseamento pecu\u00e1rio, sistemas de produ\u00e7\u00e3o, dados de abate e gest\u00e3o de corredores de transumancia.',
    },
    icon: 'Wheat', color: '#E65100', sortOrder: 3,
  },
  {
    code: 'trade-sps',
    name: { en: 'Trade, Markets & SPS', fr: 'Commerce, march\u00e9s et SPS', pt: 'Com\u00e9rcio, Mercados e SPS' },
    description: {
      en: 'Trade flows, SPS certification, market price intelligence, and AfCFTA integration support.',
      fr: "Flux commerciaux, certification SPS, intelligence des prix de march\u00e9 et soutien \u00e0 l'int\u00e9gration ZLECAf.",
      pt: 'Fluxos comerciais, certifica\u00e7\u00e3o SPS, intelig\u00eancia de pre\u00e7os de mercado e suporte \u00e0 integra\u00e7\u00e3o ZLECAf.',
    },
    icon: 'TrendingUp', color: '#1565C0', sortOrder: 4,
  },
  {
    code: 'fisheries',
    name: { en: 'Fisheries & Aquaculture', fr: 'P\u00eaches et aquaculture', pt: 'Pescas e Aquicultura' },
    description: {
      en: 'Capture fisheries, fishing fleet management, aquaculture farms, and aquatic animal health.',
      fr: "P\u00eache de capture, gestion de la flotte de p\u00eache, fermes aquacoles et sant\u00e9 des animaux aquatiques.",
      pt: 'Pesca de captura, gest\u00e3o de frotas pesqueiras, fazendas de aquicultura e sa\u00fade de animais aqu\u00e1ticos.',
    },
    icon: 'Fish', color: '#00838F', sortOrder: 5,
  },
  {
    code: 'wildlife',
    name: { en: 'Wildlife & Biodiversity', fr: 'Faune sauvage et biodiversit\u00e9', pt: 'Vida Selvagem e Biodiversidade' },
    description: {
      en: 'Wildlife inventories, protected area management, CITES permits, and human-wildlife conflict resolution.',
      fr: "Inventaires de la faune, gestion des aires prot\u00e9g\u00e9es, permis CITES et r\u00e9solution des conflits homme-faune.",
      pt: 'Invent\u00e1rios de vida selvagem, gest\u00e3o de \u00e1reas protegidas, licen\u00e7as CITES e resolu\u00e7\u00e3o de conflitos homem-fauna.',
    },
    icon: 'TreePine', color: '#2E7D32', sortOrder: 6,
  },
  {
    code: 'apiculture',
    name: { en: 'Apiculture & Pollination', fr: 'Apiculture et pollinisation', pt: 'Apicultura e Poliniza\u00e7\u00e3o' },
    description: {
      en: 'Apiary management, honey and hive product production, colony health monitoring, and beekeeper training.',
      fr: "Gestion des ruchers, production de miel et produits de la ruche, suivi de la sant\u00e9 des colonies et formation des apiculteurs.",
      pt: 'Gest\u00e3o de api\u00e1rios, produ\u00e7\u00e3o de mel e produtos da colmeia, monitoriza\u00e7\u00e3o da sa\u00fade das col\u00f3nias e forma\u00e7\u00e3o de apicultores.',
    },
    icon: 'Bug', color: '#F9A825', sortOrder: 7,
  },
  {
    code: 'climate-env',
    name: { en: 'Climate & Environment', fr: 'Climat et environnement', pt: 'Clima e Ambiente' },
    description: {
      en: 'Water stress monitoring, rangeland condition assessment, GHG tracking, and vulnerability hotspot mapping.',
      fr: "Suivi du stress hydrique, \u00e9valuation de l'\u00e9tat des parcours, suivi des GES et cartographie des zones vuln\u00e9rables.",
      pt: 'Monitoriza\u00e7\u00e3o do estresse h\u00eddrico, avalia\u00e7\u00e3o da condi\u00e7\u00e3o das pastagens, rastreamento de GEE e mapeamento de pontos de vulnerabilidade.',
    },
    icon: 'Cloud', color: '#00695C', sortOrder: 8,
  },
  {
    code: 'knowledge-hub',
    name: { en: 'Knowledge Management', fr: 'Gestion des connaissances', pt: 'Gest\u00e3o do Conhecimento' },
    description: {
      en: 'Knowledge portal, e-repository, e-learning platform, policy briefs, and monitoring/evaluation/learning.',
      fr: "Portail de connaissances, e-r\u00e9f\u00e9rentiel, plateforme e-learning, notes de politique et suivi/\u00e9valuation/apprentissage.",
      pt: 'Portal de conhecimento, e-reposit\u00f3rio, plataforma de e-learning, notas de pol\u00edtica e monitoriza\u00e7\u00e3o/avalia\u00e7\u00e3o/aprendizagem.',
    },
    icon: 'BookOpen', color: '#4527A0', sortOrder: 9,
  },
];

// ─── Seed Functions ──────────────────────────────────────────────────────────

async function seedRecs(): Promise<void> {
  console.log('  Seeding RECs...');
  const db = prisma as any;

  for (const rec of RECS_DATA) {
    await db.rec.upsert({
      where: { code: rec.code },
      update: {
        name: rec.name,
        fullName: rec.fullName,
        description: rec.description,
        region: rec.region,
        headquarters: rec.headquarters,
        established: rec.established,
        accentColor: rec.accentColor,
        sortOrder: rec.sortOrder,
      },
      create: {
        code: rec.code,
        name: rec.name,
        fullName: rec.fullName,
        description: rec.description,
        region: rec.region,
        headquarters: rec.headquarters,
        established: rec.established,
        accentColor: rec.accentColor,
        sortOrder: rec.sortOrder,
        isActive: true,
      },
    });
  }

  console.log(`    ${RECS_DATA.length} RECs seeded.`);
}

async function seedCountries(): Promise<void> {
  console.log('  Seeding countries...');
  const db = prisma as any;

  for (const country of COUNTRIES_DATA) {
    await db.country.upsert({
      where: { code: country.code },
      update: {
        code3: country.code3,
        name: country.name,
        officialName: country.officialName ?? null,
        capital: country.capital,
        flag: country.flag,
        population: country.population,
        area: country.area ?? null,
        timezone: country.timezone,
        languages: country.languages,
        currency: country.currency,
        phoneCode: country.phoneCode,
        isOperational: country.isOperational,
        tenantId: country.tenantId ?? null,
        sortOrder: country.sortOrder,
      },
      create: {
        code: country.code,
        code3: country.code3,
        name: country.name,
        officialName: country.officialName ?? null,
        capital: country.capital,
        flag: country.flag,
        population: country.population,
        area: country.area ?? null,
        timezone: country.timezone,
        languages: country.languages,
        currency: country.currency,
        phoneCode: country.phoneCode,
        isActive: true,
        isOperational: country.isOperational,
        tenantId: country.tenantId ?? null,
        sortOrder: country.sortOrder,
      },
    });
  }

  console.log(`    ${COUNTRIES_DATA.length} countries seeded.`);
}

async function seedCountryRecs(): Promise<void> {
  console.log('  Seeding country-REC relations...');
  const db = prisma as any;

  // Fetch all REC records to get their IDs
  const recRecords: { id: string; code: string }[] = await db.rec.findMany({
    select: { id: true, code: true },
  });
  const recIdByCode = new Map<string, string>();
  for (const r of recRecords) {
    recIdByCode.set(r.code, r.id);
  }

  // Fetch all Country records to get their IDs
  const countryRecords: { id: string; code: string }[] = await db.country.findMany({
    select: { id: true, code: true },
  });
  const countryIdByCode = new Map<string, string>();
  for (const c of countryRecords) {
    countryIdByCode.set(c.code, c.id);
  }

  let count = 0;

  for (const rec of RECS_DATA) {
    const recId = recIdByCode.get(rec.code);
    if (!recId) {
      console.warn(`    WARNING: REC '${rec.code}' not found in database, skipping.`);
      continue;
    }

    for (const countryCode of rec.countryCodes) {
      const countryId = countryIdByCode.get(countryCode);
      if (!countryId) {
        console.warn(`    WARNING: Country '${countryCode}' not found in database, skipping.`);
        continue;
      }

      await db.countryRec.upsert({
        where: {
          countryId_recId: { countryId, recId },
        },
        update: {
          isActive: true,
        },
        create: {
          countryId,
          recId,
          isActive: true,
        },
      });

      count++;
    }
  }

  console.log(`    ${count} country-REC relations seeded.`);
}

async function seedSystemConfigs(): Promise<void> {
  console.log('  Seeding system configurations...');
  const db = prisma as any;

  for (const config of SYSTEM_CONFIGS) {
    await db.systemConfig.upsert({
      where: {
        category_key: {
          category: config.category,
          key: config.key,
        },
      },
      update: {
        value: config.value as any,
        label: config.label,
        description: config.description ?? null,
        type: config.type,
        options: config.options ?? null,
        isEditable: config.isEditable,
        scope: config.scope,
      },
      create: {
        category: config.category,
        key: config.key,
        value: config.value as any,
        label: config.label,
        description: config.description ?? null,
        type: config.type,
        options: config.options ?? null,
        isEditable: config.isEditable,
        scope: config.scope,
        tenantId: null,
      },
    });
  }

  console.log(`    ${SYSTEM_CONFIGS.length} system configurations seeded.`);
}

async function seedDomains(): Promise<void> {
  console.log('  Seeding domains...');
  const db = prisma as any;

  for (const domain of DOMAINS_DATA) {
    await db.domain.upsert({
      where: { code: domain.code },
      update: {
        name: domain.name,
        description: domain.description,
        icon: domain.icon,
        color: domain.color,
        sortOrder: domain.sortOrder,
      },
      create: {
        code: domain.code,
        name: domain.name,
        description: domain.description,
        icon: domain.icon,
        color: domain.color,
        isActive: true,
        sortOrder: domain.sortOrder,
      },
    });
  }

  console.log(`    ${DOMAINS_DATA.length} domains seeded.`);
}

// ─── Admin Levels (per-country administrative hierarchy) ─────────────────────

interface AdminLevelSeed {
  level: number;
  name: Record<string, string>;
  code: string;
}

const ADMIN_LEVELS_BY_COUNTRY: Record<string, AdminLevelSeed[]> = {
  KE: [
    { level: 1, name: { en: 'County', fr: 'Comté', pt: 'Condado', ar: 'مقاطعة' }, code: 'county' },
    { level: 2, name: { en: 'Sub-County', fr: 'Sous-comté', pt: 'Subcondado', ar: 'مقاطعة فرعية' }, code: 'sub_county' },
    { level: 3, name: { en: 'Ward', fr: 'Quartier', pt: 'Bairro', ar: 'حي' }, code: 'ward' },
    { level: 4, name: { en: 'Location', fr: 'Localité', pt: 'Localidade', ar: 'موقع' }, code: 'location' },
    { level: 5, name: { en: 'Sub-Location', fr: 'Sous-localité', pt: 'Sublocalidade', ar: 'موقع فرعي' }, code: 'sub_location' },
  ],
  ET: [
    { level: 1, name: { en: 'Region', fr: 'Région', pt: 'Região', ar: 'منطقة' }, code: 'region' },
    { level: 2, name: { en: 'Zone', fr: 'Zone', pt: 'Zona', ar: 'منطقة فرعية' }, code: 'zone' },
    { level: 3, name: { en: 'Woreda', fr: 'Woreda', pt: 'Woreda', ar: 'ووريدا' }, code: 'woreda' },
    { level: 4, name: { en: 'Kebele', fr: 'Kebele', pt: 'Kebele', ar: 'كيبيلي' }, code: 'kebele' },
    { level: 5, name: { en: 'Village', fr: 'Village', pt: 'Aldeia', ar: 'قرية' }, code: 'village' },
  ],
  NG: [
    { level: 1, name: { en: 'State', fr: 'État', pt: 'Estado', ar: 'ولاية' }, code: 'state' },
    { level: 2, name: { en: 'LGA', fr: 'Collectivité locale', pt: 'Governo local', ar: 'حكومة محلية' }, code: 'lga' },
    { level: 3, name: { en: 'Ward', fr: 'Quartier', pt: 'Bairro', ar: 'حي' }, code: 'ward' },
    { level: 4, name: { en: 'District', fr: 'District', pt: 'Distrito', ar: 'حي' }, code: 'district' },
    { level: 5, name: { en: 'Village', fr: 'Village', pt: 'Aldeia', ar: 'قرية' }, code: 'village' },
  ],
  SN: [
    { level: 1, name: { en: 'Region', fr: 'Région', pt: 'Região', ar: 'منطقة' }, code: 'region' },
    { level: 2, name: { en: 'Department', fr: 'Département', pt: 'Departamento', ar: 'محافظة' }, code: 'department' },
    { level: 3, name: { en: 'Arrondissement', fr: 'Arrondissement', pt: 'Arrondissement', ar: 'دائرة' }, code: 'arrondissement' },
    { level: 4, name: { en: 'Commune', fr: 'Commune', pt: 'Comuna', ar: 'بلدية' }, code: 'commune' },
    { level: 5, name: { en: 'Village', fr: 'Village', pt: 'Aldeia', ar: 'قرية' }, code: 'village' },
  ],
  ZA: [
    { level: 1, name: { en: 'Province', fr: 'Province', pt: 'Província', ar: 'مقاطعة' }, code: 'province' },
    { level: 2, name: { en: 'District', fr: 'District', pt: 'Distrito', ar: 'حي' }, code: 'district' },
    { level: 3, name: { en: 'Municipality', fr: 'Municipalité', pt: 'Município', ar: 'بلدية' }, code: 'municipality' },
    { level: 4, name: { en: 'Ward', fr: 'Quartier', pt: 'Bairro', ar: 'حي' }, code: 'ward' },
    { level: 5, name: { en: 'Suburb', fr: 'Banlieue', pt: 'Subúrbio', ar: 'ضاحية' }, code: 'suburb' },
  ],
};

async function seedAdminLevels(): Promise<void> {
  console.log('  Seeding admin levels...');
  const db = prisma as any;

  for (const [countryCode, levels] of Object.entries(ADMIN_LEVELS_BY_COUNTRY)) {
    const country = await db.country.findUnique({ where: { code: countryCode } });
    if (!country) {
      console.log(`    Skipping admin levels for ${countryCode}: country not found`);
      continue;
    }

    for (const level of levels) {
      await db.adminLevel.upsert({
        where: { countryId_level: { countryId: country.id, level: level.level } },
        update: {
          name: level.name,
          code: level.code,
          isActive: true,
        },
        create: {
          countryId: country.id,
          level: level.level,
          name: level.name,
          code: level.code,
          isActive: true,
        },
      });
    }
    console.log(`    ${countryCode}: ${levels.length} admin levels seeded`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Seeding settings data...');
  await seedRecs();
  await seedCountries();
  await seedCountryRecs();
  await seedSystemConfigs();
  await seedDomains();
  await seedAdminLevels();
  console.log('Settings seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
