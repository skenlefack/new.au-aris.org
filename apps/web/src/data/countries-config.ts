// ─── All 55 African Union Member States ───────────────────────────────────────
// ISO 3166-1 alpha-2 codes, flags as emoji, organized for the ARIS landing page.

export interface CountryConfig {
  code: string;          // ISO 3166-1 alpha-2
  name: string;          // English name
  nameFr: string;        // French name
  namePt: string;        // Portuguese name
  capital: string;
  flag: string;          // Emoji flag
  population: number;    // Estimated population (millions)
  languages: string[];   // Official languages
  timezone: string;      // Primary IANA timezone
  recs: string[];        // REC codes this country belongs to
  tenantId?: string;     // Linked tenant UUID (set for pilot countries)
}

export const COUNTRIES: Record<string, CountryConfig> = {
  // ── North Africa / Maghreb ──
  DZ: { code: 'DZ', name: 'Algeria', nameFr: 'Algérie', namePt: 'Argélia', capital: 'Algiers', flag: '\ud83c\udde9\ud83c\uddff', population: 45.6, languages: ['Arabic', 'Berber', 'French'], timezone: 'Africa/Algiers', recs: ['uma', 'censad'] },
  LY: { code: 'LY', name: 'Libya', nameFr: 'Libye', namePt: 'Líbia', capital: 'Tripoli', flag: '\ud83c\uddf1\ud83c\uddfe', population: 7.0, languages: ['Arabic'], timezone: 'Africa/Tripoli', recs: ['uma', 'censad', 'comesa'] },
  MR: { code: 'MR', name: 'Mauritania', nameFr: 'Mauritanie', namePt: 'Mauritânia', capital: 'Nouakchott', flag: '\ud83c\uddf2\ud83c\uddf7', population: 4.9, languages: ['Arabic', 'French'], timezone: 'Africa/Nouakchott', recs: ['uma', 'censad'] },
  MA: { code: 'MA', name: 'Morocco', nameFr: 'Maroc', namePt: 'Marrocos', capital: 'Rabat', flag: '\ud83c\uddf2\ud83c\udde6', population: 37.8, languages: ['Arabic', 'Berber', 'French'], timezone: 'Africa/Casablanca', recs: ['uma', 'censad'] },
  TN: { code: 'TN', name: 'Tunisia', nameFr: 'Tunisie', namePt: 'Tunísia', capital: 'Tunis', flag: '\ud83c\uddf9\ud83c\uddf3', population: 12.0, languages: ['Arabic', 'French'], timezone: 'Africa/Tunis', recs: ['uma', 'censad', 'comesa'] },

  // ── West Africa (ECOWAS) ──
  BJ: { code: 'BJ', name: 'Benin', nameFr: 'Bénin', namePt: 'Benim', capital: 'Porto-Novo', flag: '\ud83c\udde7\ud83c\uddef', population: 13.4, languages: ['French'], timezone: 'Africa/Porto-Novo', recs: ['ecowas', 'censad'] },
  BF: { code: 'BF', name: 'Burkina Faso', nameFr: 'Burkina Faso', namePt: 'Burquina Faso', capital: 'Ouagadougou', flag: '\ud83c\udde7\ud83c\uddeb', population: 22.7, languages: ['French'], timezone: 'Africa/Ouagadougou', recs: ['censad'] },
  CV: { code: 'CV', name: 'Cabo Verde', nameFr: 'Cap-Vert', namePt: 'Cabo Verde', capital: 'Praia', flag: '\ud83c\udde8\ud83c\uddfb', population: 0.6, languages: ['Portuguese'], timezone: 'Atlantic/Cape_Verde', recs: ['ecowas'] },
  CI: { code: 'CI', name: "Côte d'Ivoire", nameFr: "Côte d'Ivoire", namePt: 'Costa do Marfim', capital: 'Yamoussoukro', flag: '\ud83c\udde8\ud83c\uddee', population: 28.2, languages: ['French'], timezone: 'Africa/Abidjan', recs: ['ecowas', 'censad'] },
  GM: { code: 'GM', name: 'Gambia', nameFr: 'Gambie', namePt: 'Gâmbia', capital: 'Banjul', flag: '\ud83c\uddec\ud83c\uddf2', population: 2.7, languages: ['English'], timezone: 'Africa/Banjul', recs: ['ecowas', 'censad'] },
  GH: { code: 'GH', name: 'Ghana', nameFr: 'Ghana', namePt: 'Gana', capital: 'Accra', flag: '\ud83c\uddec\ud83c\udded', population: 33.5, languages: ['English'], timezone: 'Africa/Accra', recs: ['ecowas', 'censad'] },
  GN: { code: 'GN', name: 'Guinea', nameFr: 'Guinée', namePt: 'Guiné', capital: 'Conakry', flag: '\ud83c\uddec\ud83c\uddf3', population: 14.2, languages: ['French'], timezone: 'Africa/Conakry', recs: ['ecowas', 'censad'] },
  GW: { code: 'GW', name: 'Guinea-Bissau', nameFr: 'Guinée-Bissau', namePt: 'Guiné-Bissau', capital: 'Bissau', flag: '\ud83c\uddec\ud83c\uddfc', population: 2.1, languages: ['Portuguese'], timezone: 'Africa/Bissau', recs: ['ecowas', 'censad'] },
  LR: { code: 'LR', name: 'Liberia', nameFr: 'Libéria', namePt: 'Libéria', capital: 'Monrovia', flag: '\ud83c\uddf1\ud83c\uddf7', population: 5.4, languages: ['English'], timezone: 'Africa/Monrovia', recs: ['ecowas', 'censad'] },
  ML: { code: 'ML', name: 'Mali', nameFr: 'Mali', namePt: 'Mali', capital: 'Bamako', flag: '\ud83c\uddf2\ud83c\uddf1', population: 22.4, languages: ['French'], timezone: 'Africa/Bamako', recs: ['censad'] },
  NE: { code: 'NE', name: 'Niger', nameFr: 'Niger', namePt: 'Níger', capital: 'Niamey', flag: '\ud83c\uddf3\ud83c\uddea', population: 26.2, languages: ['French'], timezone: 'Africa/Niamey', recs: ['censad'] },
  NG: { code: 'NG', name: 'Nigeria', nameFr: 'Nigéria', namePt: 'Nigéria', capital: 'Abuja', flag: '\ud83c\uddf3\ud83c\uddec', population: 223.8, languages: ['English'], timezone: 'Africa/Lagos', recs: ['ecowas', 'censad'], tenantId: '00000000-0000-4000-a000-000000000201' },
  SN: { code: 'SN', name: 'Senegal', nameFr: 'Sénégal', namePt: 'Senegal', capital: 'Dakar', flag: '\ud83c\uddf8\ud83c\uddf3', population: 17.7, languages: ['French'], timezone: 'Africa/Dakar', recs: ['ecowas', 'censad'], tenantId: '00000000-0000-4000-a000-000000000202' },
  SL: { code: 'SL', name: 'Sierra Leone', nameFr: 'Sierra Leone', namePt: 'Serra Leoa', capital: 'Freetown', flag: '\ud83c\uddf8\ud83c\uddf1', population: 8.6, languages: ['English'], timezone: 'Africa/Freetown', recs: ['ecowas', 'censad'] },
  TG: { code: 'TG', name: 'Togo', nameFr: 'Togo', namePt: 'Togo', capital: 'Lomé', flag: '\ud83c\uddf9\ud83c\uddec', population: 8.8, languages: ['French'], timezone: 'Africa/Lome', recs: ['ecowas', 'censad'] },

  // ── Central Africa (ECCAS) ──
  AO: { code: 'AO', name: 'Angola', nameFr: 'Angola', namePt: 'Angola', capital: 'Luanda', flag: '\ud83c\udde6\ud83c\uddf4', population: 35.6, languages: ['Portuguese'], timezone: 'Africa/Luanda', recs: ['eccas', 'sadc'] },
  BI: { code: 'BI', name: 'Burundi', nameFr: 'Burundi', namePt: 'Burundi', capital: 'Gitega', flag: '\ud83c\udde7\ud83c\uddee', population: 13.2, languages: ['Kirundi', 'French', 'English'], timezone: 'Africa/Bujumbura', recs: ['eccas', 'eac', 'comesa'] },
  CM: { code: 'CM', name: 'Cameroon', nameFr: 'Cameroun', namePt: 'Camarões', capital: 'Yaoundé', flag: '\ud83c\udde8\ud83c\uddf2', population: 28.6, languages: ['French', 'English'], timezone: 'Africa/Douala', recs: ['eccas', 'censad'] },
  CF: { code: 'CF', name: 'Central African Republic', nameFr: 'République centrafricaine', namePt: 'República Centro-Africana', capital: 'Bangui', flag: '\ud83c\udde8\ud83c\uddeb', population: 5.5, languages: ['French', 'Sango'], timezone: 'Africa/Bangui', recs: ['eccas', 'censad'] },
  TD: { code: 'TD', name: 'Chad', nameFr: 'Tchad', namePt: 'Chade', capital: "N'Djamena", flag: '\ud83c\uddf9\ud83c\udde9', population: 18.3, languages: ['French', 'Arabic'], timezone: 'Africa/Ndjamena', recs: ['eccas', 'censad'] },
  CG: { code: 'CG', name: 'Congo', nameFr: 'Congo', namePt: 'Congo', capital: 'Brazzaville', flag: '\ud83c\udde8\ud83c\uddec', population: 6.1, languages: ['French'], timezone: 'Africa/Brazzaville', recs: ['eccas'] },
  CD: { code: 'CD', name: 'DR Congo', nameFr: 'RD Congo', namePt: 'RD Congo', capital: 'Kinshasa', flag: '\ud83c\udde8\ud83c\udde9', population: 102.3, languages: ['French'], timezone: 'Africa/Kinshasa', recs: ['eccas', 'eac', 'sadc', 'comesa'] },
  GQ: { code: 'GQ', name: 'Equatorial Guinea', nameFr: 'Guinée équatoriale', namePt: 'Guiné Equatorial', capital: 'Malabo', flag: '\ud83c\uddec\ud83c\uddf6', population: 1.7, languages: ['Spanish', 'French', 'Portuguese'], timezone: 'Africa/Malabo', recs: ['eccas'] },
  GA: { code: 'GA', name: 'Gabon', nameFr: 'Gabon', namePt: 'Gabão', capital: 'Libreville', flag: '\ud83c\uddec\ud83c\udde6', population: 2.4, languages: ['French'], timezone: 'Africa/Libreville', recs: ['eccas'] },
  RW: { code: 'RW', name: 'Rwanda', nameFr: 'Rwanda', namePt: 'Ruanda', capital: 'Kigali', flag: '\ud83c\uddf7\ud83c\uddfc', population: 14.1, languages: ['Kinyarwanda', 'French', 'English'], timezone: 'Africa/Kigali', recs: ['eccas', 'eac', 'comesa'] },
  ST: { code: 'ST', name: 'São Tomé and Príncipe', nameFr: 'Sao Tomé-et-Príncipe', namePt: 'São Tomé e Príncipe', capital: 'São Tomé', flag: '\ud83c\uddf8\ud83c\uddf9', population: 0.2, languages: ['Portuguese'], timezone: 'Africa/Sao_Tome', recs: ['eccas', 'censad'] },

  // ── East Africa (EAC / IGAD) ──
  DJ: { code: 'DJ', name: 'Djibouti', nameFr: 'Djibouti', namePt: 'Djibuti', capital: 'Djibouti', flag: '\ud83c\udde9\ud83c\uddef', population: 1.1, languages: ['French', 'Arabic'], timezone: 'Africa/Djibouti', recs: ['igad', 'comesa', 'censad'] },
  ER: { code: 'ER', name: 'Eritrea', nameFr: 'Érythrée', namePt: 'Eritreia', capital: 'Asmara', flag: '\ud83c\uddea\ud83c\uddf7', population: 3.7, languages: ['Tigrinya', 'Arabic', 'English'], timezone: 'Africa/Asmara', recs: ['igad', 'comesa', 'censad'] },
  ET: { code: 'ET', name: 'Ethiopia', nameFr: 'Éthiopie', namePt: 'Etiópia', capital: 'Addis Ababa', flag: '\ud83c\uddea\ud83c\uddf9', population: 126.5, languages: ['Amharic'], timezone: 'Africa/Addis_Ababa', recs: ['igad', 'comesa'], tenantId: '00000000-0000-4000-a000-000000000102' },
  KE: { code: 'KE', name: 'Kenya', nameFr: 'Kenya', namePt: 'Quénia', capital: 'Nairobi', flag: '\ud83c\uddf0\ud83c\uddea', population: 55.1, languages: ['Swahili', 'English'], timezone: 'Africa/Nairobi', recs: ['igad', 'eac', 'comesa', 'censad'], tenantId: '00000000-0000-4000-a000-000000000101' },
  SO: { code: 'SO', name: 'Somalia', nameFr: 'Somalie', namePt: 'Somália', capital: 'Mogadishu', flag: '\ud83c\uddf8\ud83c\uddf4', population: 18.1, languages: ['Somali', 'Arabic'], timezone: 'Africa/Mogadishu', recs: ['igad', 'comesa', 'censad'] },
  SS: { code: 'SS', name: 'South Sudan', nameFr: 'Soudan du Sud', namePt: 'Sudão do Sul', capital: 'Juba', flag: '\ud83c\uddf8\ud83c\uddf8', population: 11.1, languages: ['English'], timezone: 'Africa/Juba', recs: ['igad', 'eac'] },
  SD: { code: 'SD', name: 'Sudan', nameFr: 'Soudan', namePt: 'Sudão', capital: 'Khartoum', flag: '\ud83c\uddf8\ud83c\udde9', population: 47.9, languages: ['Arabic', 'English'], timezone: 'Africa/Khartoum', recs: ['igad', 'comesa', 'censad'] },
  UG: { code: 'UG', name: 'Uganda', nameFr: 'Ouganda', namePt: 'Uganda', capital: 'Kampala', flag: '\ud83c\uddfa\ud83c\uddec', population: 48.6, languages: ['English', 'Swahili'], timezone: 'Africa/Kampala', recs: ['igad', 'eac', 'comesa'] },
  TZ: { code: 'TZ', name: 'Tanzania', nameFr: 'Tanzanie', namePt: 'Tanzânia', capital: 'Dodoma', flag: '\ud83c\uddf9\ud83c\uddff', population: 65.5, languages: ['Swahili', 'English'], timezone: 'Africa/Dar_es_Salaam', recs: ['eac', 'sadc'] },

  // ── Southern Africa (SADC) ──
  BW: { code: 'BW', name: 'Botswana', nameFr: 'Botswana', namePt: 'Botsuana', capital: 'Gaborone', flag: '\ud83c\udde7\ud83c\uddfc', population: 2.6, languages: ['English', 'Setswana'], timezone: 'Africa/Gaborone', recs: ['sadc'] },
  KM: { code: 'KM', name: 'Comoros', nameFr: 'Comores', namePt: 'Comores', capital: 'Moroni', flag: '\ud83c\uddf0\ud83c\uddf2', population: 0.9, languages: ['Comorian', 'Arabic', 'French'], timezone: 'Indian/Comoro', recs: ['sadc', 'comesa', 'censad'] },
  SZ: { code: 'SZ', name: 'Eswatini', nameFr: 'Eswatini', namePt: 'Essuatíni', capital: 'Mbabane', flag: '\ud83c\uddf8\ud83c\uddff', population: 1.2, languages: ['English', 'Swazi'], timezone: 'Africa/Mbabane', recs: ['sadc', 'comesa'] },
  LS: { code: 'LS', name: 'Lesotho', nameFr: 'Lesotho', namePt: 'Lesoto', capital: 'Maseru', flag: '\ud83c\uddf1\ud83c\uddf8', population: 2.3, languages: ['Sesotho', 'English'], timezone: 'Africa/Maseru', recs: ['sadc'] },
  MG: { code: 'MG', name: 'Madagascar', nameFr: 'Madagascar', namePt: 'Madagáscar', capital: 'Antananarivo', flag: '\ud83c\uddf2\ud83c\uddec', population: 30.3, languages: ['Malagasy', 'French'], timezone: 'Indian/Antananarivo', recs: ['sadc', 'comesa'] },
  MW: { code: 'MW', name: 'Malawi', nameFr: 'Malawi', namePt: 'Maláui', capital: 'Lilongwe', flag: '\ud83c\uddf2\ud83c\uddfc', population: 20.9, languages: ['English', 'Chichewa'], timezone: 'Africa/Blantyre', recs: ['sadc', 'comesa'] },
  MU: { code: 'MU', name: 'Mauritius', nameFr: 'Maurice', namePt: 'Maurícia', capital: 'Port Louis', flag: '\ud83c\uddf2\ud83c\uddfa', population: 1.3, languages: ['English', 'French', 'Creole'], timezone: 'Indian/Mauritius', recs: ['sadc', 'comesa'] },
  MZ: { code: 'MZ', name: 'Mozambique', nameFr: 'Mozambique', namePt: 'Moçambique', capital: 'Maputo', flag: '\ud83c\uddf2\ud83c\uddff', population: 33.9, languages: ['Portuguese'], timezone: 'Africa/Maputo', recs: ['sadc'] },
  NA: { code: 'NA', name: 'Namibia', nameFr: 'Namibie', namePt: 'Namíbia', capital: 'Windhoek', flag: '\ud83c\uddf3\ud83c\udde6', population: 2.6, languages: ['English'], timezone: 'Africa/Windhoek', recs: ['sadc'] },
  SC: { code: 'SC', name: 'Seychelles', nameFr: 'Seychelles', namePt: 'Seicheles', capital: 'Victoria', flag: '\ud83c\uddf8\ud83c\udde8', population: 0.1, languages: ['Creole', 'English', 'French'], timezone: 'Indian/Mahe', recs: ['sadc', 'comesa'] },
  ZA: { code: 'ZA', name: 'South Africa', nameFr: 'Afrique du Sud', namePt: 'África do Sul', capital: 'Pretoria', flag: '\ud83c\uddff\ud83c\udde6', population: 60.4, languages: ['English', 'Zulu', 'Xhosa', 'Afrikaans'], timezone: 'Africa/Johannesburg', recs: ['sadc'], tenantId: '00000000-0000-4000-a000-000000000301' },
  ZM: { code: 'ZM', name: 'Zambia', nameFr: 'Zambie', namePt: 'Zâmbia', capital: 'Lusaka', flag: '\ud83c\uddff\ud83c\uddf2', population: 20.6, languages: ['English'], timezone: 'Africa/Lusaka', recs: ['sadc', 'comesa'] },
  ZW: { code: 'ZW', name: 'Zimbabwe', nameFr: 'Zimbabwe', namePt: 'Zimbábue', capital: 'Harare', flag: '\ud83c\uddff\ud83c\uddfc', population: 16.7, languages: ['English', 'Shona', 'Ndebele'], timezone: 'Africa/Harare', recs: ['sadc', 'comesa'] },

  // ── Other ──
  EG: { code: 'EG', name: 'Egypt', nameFr: 'Égypte', namePt: 'Egito', capital: 'Cairo', flag: '\ud83c\uddea\ud83c\uddec', population: 112.7, languages: ['Arabic'], timezone: 'Africa/Cairo', recs: ['comesa', 'censad'] },
  EH: { code: 'EH', name: 'Sahrawi Republic', nameFr: 'République sahraouie', namePt: 'República Saarauí', capital: 'Laayoune', flag: '\ud83c\uddea\ud83c\udded', population: 0.6, languages: ['Arabic', 'Spanish'], timezone: 'Africa/El_Aaiun', recs: [] },
};

/**
 * Ministry / Department in charge of Animal Resources per country (English).
 */
export const MINISTRIES: Record<string, string> = {
  // North Africa
  DZ: 'Ministry of Agriculture, Rural Development and Fisheries',
  LY: 'Ministry of Agriculture, Livestock and Marine Resources',
  MR: 'Ministry of Livestock',
  MA: 'Ministry of Agriculture, Maritime Fisheries, Rural Development, Waters and Forests',
  TN: 'Ministry of Agriculture, Water Resources and Fisheries',
  // West Africa
  BJ: 'Ministry of Agriculture, Livestock and Fisheries',
  BF: 'Ministry of Animal and Fisheries Resources',
  CV: 'Ministry of Agriculture and Environment',
  CI: 'Ministry of Animal and Fisheries Resources',
  GM: 'Ministry of Agriculture',
  GH: 'Ministry of Food and Agriculture',
  GN: 'Ministry of Livestock',
  GW: 'Ministry of Agriculture and Rural Development',
  LR: 'Ministry of Agriculture',
  ML: 'Ministry of Livestock and Fisheries',
  NE: 'Ministry of Livestock',
  NG: 'Federal Ministry of Agriculture and Food Security',
  SN: 'Ministry of Livestock and Animal Productions',
  SL: 'Ministry of Agriculture, Forestry and Food Security',
  TG: 'Ministry of Agriculture, Livestock and Rural Development',
  // Central Africa
  AO: 'Ministry of Agriculture and Fisheries',
  BI: 'Ministry of Environment, Agriculture and Livestock',
  CM: 'Ministry of Livestock, Fisheries and Animal Industries',
  CF: 'Ministry of Agriculture and Rural Development',
  TD: 'Ministry of Livestock and Animal Production',
  CG: 'Ministry of Agriculture, Livestock and Fisheries',
  CD: 'Ministry of Agriculture',
  GQ: 'Ministry of Agriculture, Livestock, Forests and Environment',
  GA: 'Ministry of Agriculture, Livestock and Rural Development',
  RW: 'Ministry of Agriculture and Animal Resources',
  ST: 'Ministry of Agriculture and Rural Development',
  // East Africa
  DJ: 'Ministry of Agriculture, Water, Fisheries and Livestock',
  ER: 'Ministry of Agriculture',
  ET: 'Ministry of Agriculture',
  KE: 'Ministry of Agriculture, Livestock, Fisheries and Cooperatives',
  SO: 'Ministry of Livestock, Forestry and Range',
  SS: 'Ministry of Livestock and Fisheries',
  SD: 'Ministry of Animal Resources',
  UG: 'Ministry of Agriculture, Animal Industry and Fisheries',
  TZ: 'Ministry of Livestock and Fisheries',
  // Southern Africa
  BW: 'Ministry of Agriculture',
  KM: 'Ministry of Agriculture, Fisheries and Environment',
  SZ: 'Ministry of Agriculture',
  LS: 'Ministry of Agriculture and Food Security',
  MG: 'Ministry of Agriculture and Livestock',
  MW: 'Ministry of Agriculture',
  MU: 'Ministry of Agro-Industry and Food Security',
  MZ: 'Ministry of Agriculture',
  NA: 'Ministry of Agriculture, Water and Land Reform',
  SC: 'Ministry of Agriculture, Climate Change and Environment',
  ZA: 'Department of Agriculture, Land Reform and Rural Development',
  ZM: 'Ministry of Fisheries and Livestock',
  ZW: 'Ministry of Lands, Agriculture, Fisheries, Water and Rural Development',
  // Other
  EG: 'Ministry of Agriculture and Land Reclamation',
  EH: 'Ministry of Agriculture',
};

/** Ministry names in French */
export const MINISTRIES_FR: Record<string, string> = {
  DZ: 'Ministère de l\u2019Agriculture, du Développement rural et de la Pêche',
  LY: 'Ministère de l\u2019Agriculture, de l\u2019Élevage et des Ressources marines',
  MR: 'Ministère de l\u2019Élevage',
  MA: 'Ministère de l\u2019Agriculture, de la Pêche maritime, du Développement rural, des Eaux et Forêts',
  TN: 'Ministère de l\u2019Agriculture, des Ressources hydrauliques et de la Pêche',
  BJ: 'Ministère de l\u2019Agriculture, de l\u2019Élevage et de la Pêche',
  BF: 'Ministère des Ressources animales et halieutiques',
  CV: 'Ministère de l\u2019Agriculture et de l\u2019Environnement',
  CI: 'Ministère des Ressources animales et halieutiques',
  GM: 'Ministère de l\u2019Agriculture',
  GH: 'Ministère de l\u2019Alimentation et de l\u2019Agriculture',
  GN: 'Ministère de l\u2019Élevage',
  GW: 'Ministère de l\u2019Agriculture et du Développement rural',
  LR: 'Ministère de l\u2019Agriculture',
  ML: 'Ministère de l\u2019Élevage et de la Pêche',
  NE: 'Ministère de l\u2019Élevage',
  NG: 'Ministère fédéral de l\u2019Agriculture et de la Sécurité alimentaire',
  SN: 'Ministère de l\u2019Élevage et des Productions animales',
  SL: 'Ministère de l\u2019Agriculture, des Forêts et de la Sécurité alimentaire',
  TG: 'Ministère de l\u2019Agriculture, de l\u2019Élevage et du Développement rural',
  AO: 'Ministère de l\u2019Agriculture et de la Pêche',
  BI: 'Ministère de l\u2019Environnement, de l\u2019Agriculture et de l\u2019Élevage',
  CM: 'Ministère de l\u2019Élevage, des Pêches et des Industries animales',
  CF: 'Ministère de l\u2019Agriculture et du Développement rural',
  TD: 'Ministère de l\u2019Élevage et des Productions animales',
  CG: 'Ministère de l\u2019Agriculture, de l\u2019Élevage et de la Pêche',
  CD: 'Ministère de l\u2019Agriculture',
  GQ: 'Ministère de l\u2019Agriculture, de l\u2019Élevage, des Forêts et de l\u2019Environnement',
  GA: 'Ministère de l\u2019Agriculture, de l\u2019Élevage et du Développement rural',
  RW: 'Ministère de l\u2019Agriculture et des Ressources animales',
  ST: 'Ministère de l\u2019Agriculture et du Développement rural',
  DJ: 'Ministère de l\u2019Agriculture, de l\u2019Eau, de la Pêche et de l\u2019Élevage',
  ER: 'Ministère de l\u2019Agriculture',
  ET: 'Ministère de l\u2019Agriculture',
  KE: 'Ministère de l\u2019Agriculture, de l\u2019Élevage, de la Pêche et des Coopératives',
  SO: 'Ministère de l\u2019Élevage, des Forêts et des Parcours',
  SS: 'Ministère de l\u2019Élevage et de la Pêche',
  SD: 'Ministère des Ressources animales',
  UG: 'Ministère de l\u2019Agriculture, de l\u2019Industrie animale et de la Pêche',
  TZ: 'Ministère de l\u2019Élevage et de la Pêche',
  BW: 'Ministère de l\u2019Agriculture',
  KM: 'Ministère de l\u2019Agriculture, de la Pêche et de l\u2019Environnement',
  SZ: 'Ministère de l\u2019Agriculture',
  LS: 'Ministère de l\u2019Agriculture et de la Sécurité alimentaire',
  MG: 'Ministère de l\u2019Agriculture et de l\u2019Élevage',
  MW: 'Ministère de l\u2019Agriculture',
  MU: 'Ministère de l\u2019Agro-industrie et de la Sécurité alimentaire',
  MZ: 'Ministère de l\u2019Agriculture',
  NA: 'Ministère de l\u2019Agriculture, de l\u2019Eau et de la Réforme foncière',
  SC: 'Ministère de l\u2019Agriculture, du Changement climatique et de l\u2019Environnement',
  ZA: 'Département de l\u2019Agriculture, de la Réforme foncière et du Développement rural',
  ZM: 'Ministère de la Pêche et de l\u2019Élevage',
  ZW: 'Ministère des Terres, de l\u2019Agriculture, de la Pêche, de l\u2019Eau et du Développement rural',
  EG: 'Ministère de l\u2019Agriculture et de la Bonification des terres',
  EH: 'Ministère de l\u2019Agriculture',
};

/** Ministry names in Portuguese */
export const MINISTRIES_PT: Record<string, string> = {
  DZ: 'Ministério da Agricultura, Desenvolvimento Rural e Pescas',
  LY: 'Ministério da Agricultura, Pecuária e Recursos Marinhos',
  MR: 'Ministério da Pecuária',
  MA: 'Ministério da Agricultura, Pescas Marítimas, Desenvolvimento Rural, Águas e Florestas',
  TN: 'Ministério da Agricultura, Recursos Hídricos e Pescas',
  BJ: 'Ministério da Agricultura, Pecuária e Pescas',
  BF: 'Ministério dos Recursos Animais e Haliêuticos',
  CV: 'Ministério da Agricultura e Ambiente',
  CI: 'Ministério dos Recursos Animais e Haliêuticos',
  GM: 'Ministério da Agricultura',
  GH: 'Ministério da Alimentação e Agricultura',
  GN: 'Ministério da Pecuária',
  GW: 'Ministério da Agricultura e Desenvolvimento Rural',
  LR: 'Ministério da Agricultura',
  ML: 'Ministério da Pecuária e Pescas',
  NE: 'Ministério da Pecuária',
  NG: 'Ministério Federal da Agricultura e Segurança Alimentar',
  SN: 'Ministério da Pecuária e Produções Animais',
  SL: 'Ministério da Agricultura, Florestas e Segurança Alimentar',
  TG: 'Ministério da Agricultura, Pecuária e Desenvolvimento Rural',
  AO: 'Ministério da Agricultura e Pescas',
  BI: 'Ministério do Ambiente, Agricultura e Pecuária',
  CM: 'Ministério da Pecuária, Pescas e Indústrias Animais',
  CF: 'Ministério da Agricultura e Desenvolvimento Rural',
  TD: 'Ministério da Pecuária e Produção Animal',
  CG: 'Ministério da Agricultura, Pecuária e Pescas',
  CD: 'Ministério da Agricultura',
  GQ: 'Ministério da Agricultura, Pecuária, Florestas e Ambiente',
  GA: 'Ministério da Agricultura, Pecuária e Desenvolvimento Rural',
  RW: 'Ministério da Agricultura e Recursos Animais',
  ST: 'Ministério da Agricultura e Desenvolvimento Rural',
  DJ: 'Ministério da Agricultura, Água, Pescas e Pecuária',
  ER: 'Ministério da Agricultura',
  ET: 'Ministério da Agricultura',
  KE: 'Ministério da Agricultura, Pecuária, Pescas e Cooperativas',
  SO: 'Ministério da Pecuária, Florestas e Pastagens',
  SS: 'Ministério da Pecuária e Pescas',
  SD: 'Ministério dos Recursos Animais',
  UG: 'Ministério da Agricultura, Indústria Animal e Pescas',
  TZ: 'Ministério da Pecuária e Pescas',
  BW: 'Ministério da Agricultura',
  KM: 'Ministério da Agricultura, Pescas e Ambiente',
  SZ: 'Ministério da Agricultura',
  LS: 'Ministério da Agricultura e Segurança Alimentar',
  MG: 'Ministério da Agricultura e Pecuária',
  MW: 'Ministério da Agricultura',
  MU: 'Ministério da Agro-Indústria e Segurança Alimentar',
  MZ: 'Ministério da Agricultura',
  NA: 'Ministério da Agricultura, Água e Reforma Fundiária',
  SC: 'Ministério da Agricultura, Alterações Climáticas e Ambiente',
  ZA: 'Departamento de Agricultura, Reforma Fundiária e Desenvolvimento Rural',
  ZM: 'Ministério das Pescas e Pecuária',
  ZW: 'Ministério das Terras, Agricultura, Pescas, Água e Desenvolvimento Rural',
  EG: 'Ministério da Agricultura e Recuperação de Terras',
  EH: 'Ministério da Agricultura',
};

/** Get ministry name by locale */
export function getMinistry(code: string, locale: string): string {
  if (locale === 'fr') return MINISTRIES_FR[code] ?? MINISTRIES[code] ?? '';
  if (locale === 'pt') return MINISTRIES_PT[code] ?? MINISTRIES[code] ?? '';
  return MINISTRIES[code] ?? '';
}

/** Get countries for a given REC code */
export function getCountriesByRec(recCode: string): CountryConfig[] {
  return Object.values(COUNTRIES)
    .filter((c) => c.recs.includes(recCode))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Get a single country by ISO code */
export function getCountry(code: string): CountryConfig | undefined {
  return COUNTRIES[code.toUpperCase()];
}

/** Total unique countries */
export const TOTAL_COUNTRIES = Object.keys(COUNTRIES).length;
