// ─── All 55 African Union Member States ───────────────────────────────────────
// ISO 3166-1 alpha-2 codes, flags as emoji, organized for the ARIS landing page.

export interface CountryConfig {
  code: string;          // ISO 3166-1 alpha-2
  name: string;          // English name
  nameFr: string;        // French name
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
  DZ: { code: 'DZ', name: 'Algeria', nameFr: 'Alg\u00e9rie', capital: 'Algiers', flag: '\ud83c\udde9\ud83c\uddff', population: 45.6, languages: ['Arabic', 'Berber', 'French'], timezone: 'Africa/Algiers', recs: ['uma', 'censad'] },
  LY: { code: 'LY', name: 'Libya', nameFr: 'Libye', capital: 'Tripoli', flag: '\ud83c\uddf1\ud83c\uddfe', population: 7.0, languages: ['Arabic'], timezone: 'Africa/Tripoli', recs: ['uma', 'censad', 'comesa'] },
  MR: { code: 'MR', name: 'Mauritania', nameFr: 'Mauritanie', capital: 'Nouakchott', flag: '\ud83c\uddf2\ud83c\uddf7', population: 4.9, languages: ['Arabic', 'French'], timezone: 'Africa/Nouakchott', recs: ['uma', 'censad'] },
  MA: { code: 'MA', name: 'Morocco', nameFr: 'Maroc', capital: 'Rabat', flag: '\ud83c\uddf2\ud83c\udde6', population: 37.8, languages: ['Arabic', 'Berber', 'French'], timezone: 'Africa/Casablanca', recs: ['uma', 'censad'] },
  TN: { code: 'TN', name: 'Tunisia', nameFr: 'Tunisie', capital: 'Tunis', flag: '\ud83c\uddf9\ud83c\uddf3', population: 12.0, languages: ['Arabic', 'French'], timezone: 'Africa/Tunis', recs: ['uma', 'censad', 'comesa'] },

  // ── West Africa (ECOWAS) ──
  BJ: { code: 'BJ', name: 'Benin', nameFr: 'B\u00e9nin', capital: 'Porto-Novo', flag: '\ud83c\udde7\ud83c\uddef', population: 13.4, languages: ['French'], timezone: 'Africa/Porto-Novo', recs: ['ecowas', 'censad'] },
  BF: { code: 'BF', name: 'Burkina Faso', nameFr: 'Burkina Faso', capital: 'Ouagadougou', flag: '\ud83c\udde7\ud83c\uddeb', population: 22.7, languages: ['French'], timezone: 'Africa/Ouagadougou', recs: ['ecowas', 'censad'] },
  CV: { code: 'CV', name: 'Cabo Verde', nameFr: 'Cap-Vert', capital: 'Praia', flag: '\ud83c\udde8\ud83c\uddfb', population: 0.6, languages: ['Portuguese'], timezone: 'Atlantic/Cape_Verde', recs: ['ecowas'] },
  CI: { code: 'CI', name: "C\u00f4te d'Ivoire", nameFr: "C\u00f4te d'Ivoire", capital: 'Yamoussoukro', flag: '\ud83c\udde8\ud83c\uddee', population: 28.2, languages: ['French'], timezone: 'Africa/Abidjan', recs: ['ecowas', 'censad'] },
  GM: { code: 'GM', name: 'Gambia', nameFr: 'Gambie', capital: 'Banjul', flag: '\ud83c\uddec\ud83c\uddf2', population: 2.7, languages: ['English'], timezone: 'Africa/Banjul', recs: ['ecowas', 'censad'] },
  GH: { code: 'GH', name: 'Ghana', nameFr: 'Ghana', capital: 'Accra', flag: '\ud83c\uddec\ud83c\udded', population: 33.5, languages: ['English'], timezone: 'Africa/Accra', recs: ['ecowas', 'censad'] },
  GN: { code: 'GN', name: 'Guinea', nameFr: 'Guin\u00e9e', capital: 'Conakry', flag: '\ud83c\uddec\ud83c\uddf3', population: 14.2, languages: ['French'], timezone: 'Africa/Conakry', recs: ['ecowas', 'censad'] },
  GW: { code: 'GW', name: 'Guinea-Bissau', nameFr: 'Guin\u00e9e-Bissau', capital: 'Bissau', flag: '\ud83c\uddec\ud83c\uddfc', population: 2.1, languages: ['Portuguese'], timezone: 'Africa/Bissau', recs: ['ecowas', 'censad'] },
  LR: { code: 'LR', name: 'Liberia', nameFr: 'Lib\u00e9ria', capital: 'Monrovia', flag: '\ud83c\uddf1\ud83c\uddf7', population: 5.4, languages: ['English'], timezone: 'Africa/Monrovia', recs: ['ecowas', 'censad'] },
  ML: { code: 'ML', name: 'Mali', nameFr: 'Mali', capital: 'Bamako', flag: '\ud83c\uddf2\ud83c\uddf1', population: 22.4, languages: ['French'], timezone: 'Africa/Bamako', recs: ['ecowas', 'censad'] },
  NE: { code: 'NE', name: 'Niger', nameFr: 'Niger', capital: 'Niamey', flag: '\ud83c\uddf3\ud83c\uddea', population: 26.2, languages: ['French'], timezone: 'Africa/Niamey', recs: ['ecowas', 'censad'] },
  NG: { code: 'NG', name: 'Nigeria', nameFr: 'Nig\u00e9ria', capital: 'Abuja', flag: '\ud83c\uddf3\ud83c\uddec', population: 223.8, languages: ['English'], timezone: 'Africa/Lagos', recs: ['ecowas', 'censad'], tenantId: '00000000-0000-4000-a000-000000000201' },
  SN: { code: 'SN', name: 'Senegal', nameFr: 'S\u00e9n\u00e9gal', capital: 'Dakar', flag: '\ud83c\uddf8\ud83c\uddf3', population: 17.7, languages: ['French'], timezone: 'Africa/Dakar', recs: ['ecowas', 'censad'], tenantId: '00000000-0000-4000-a000-000000000202' },
  SL: { code: 'SL', name: 'Sierra Leone', nameFr: 'Sierra Leone', capital: 'Freetown', flag: '\ud83c\uddf8\ud83c\uddf1', population: 8.6, languages: ['English'], timezone: 'Africa/Freetown', recs: ['ecowas', 'censad'] },
  TG: { code: 'TG', name: 'Togo', nameFr: 'Togo', capital: 'Lom\u00e9', flag: '\ud83c\uddf9\ud83c\uddec', population: 8.8, languages: ['French'], timezone: 'Africa/Lome', recs: ['ecowas', 'censad'] },

  // ── Central Africa (ECCAS) ──
  AO: { code: 'AO', name: 'Angola', nameFr: 'Angola', capital: 'Luanda', flag: '\ud83c\udde6\ud83c\uddf4', population: 35.6, languages: ['Portuguese'], timezone: 'Africa/Luanda', recs: ['eccas', 'sadc'] },
  BI: { code: 'BI', name: 'Burundi', nameFr: 'Burundi', capital: 'Gitega', flag: '\ud83c\udde7\ud83c\uddee', population: 13.2, languages: ['Kirundi', 'French', 'English'], timezone: 'Africa/Bujumbura', recs: ['eccas', 'eac', 'comesa'] },
  CM: { code: 'CM', name: 'Cameroon', nameFr: 'Cameroun', capital: 'Yaound\u00e9', flag: '\ud83c\udde8\ud83c\uddf2', population: 28.6, languages: ['French', 'English'], timezone: 'Africa/Douala', recs: ['eccas', 'censad'] },
  CF: { code: 'CF', name: 'Central African Republic', nameFr: 'R\u00e9publique centrafricaine', capital: 'Bangui', flag: '\ud83c\udde8\ud83c\uddeb', population: 5.5, languages: ['French', 'Sango'], timezone: 'Africa/Bangui', recs: ['eccas', 'censad'] },
  TD: { code: 'TD', name: 'Chad', nameFr: 'Tchad', capital: "N'Djamena", flag: '\ud83c\uddf9\ud83c\udde9', population: 18.3, languages: ['French', 'Arabic'], timezone: 'Africa/Ndjamena', recs: ['eccas', 'censad'] },
  CG: { code: 'CG', name: 'Congo', nameFr: 'Congo', capital: 'Brazzaville', flag: '\ud83c\udde8\ud83c\uddec', population: 6.1, languages: ['French'], timezone: 'Africa/Brazzaville', recs: ['eccas'] },
  CD: { code: 'CD', name: 'DR Congo', nameFr: 'RD Congo', capital: 'Kinshasa', flag: '\ud83c\udde8\ud83c\udde9', population: 102.3, languages: ['French'], timezone: 'Africa/Kinshasa', recs: ['eccas', 'eac', 'sadc', 'comesa'] },
  GQ: { code: 'GQ', name: 'Equatorial Guinea', nameFr: 'Guin\u00e9e \u00e9quatoriale', capital: 'Malabo', flag: '\ud83c\uddec\ud83c\uddf6', population: 1.7, languages: ['Spanish', 'French', 'Portuguese'], timezone: 'Africa/Malabo', recs: ['eccas'] },
  GA: { code: 'GA', name: 'Gabon', nameFr: 'Gabon', capital: 'Libreville', flag: '\ud83c\uddec\ud83c\udde6', population: 2.4, languages: ['French'], timezone: 'Africa/Libreville', recs: ['eccas'] },
  RW: { code: 'RW', name: 'Rwanda', nameFr: 'Rwanda', capital: 'Kigali', flag: '\ud83c\uddf7\ud83c\uddfc', population: 14.1, languages: ['Kinyarwanda', 'French', 'English'], timezone: 'Africa/Kigali', recs: ['eccas', 'eac', 'comesa'] },
  ST: { code: 'ST', name: 'S\u00e3o Tom\u00e9 and Pr\u00edncipe', nameFr: 'Sao Tom\u00e9-et-Pr\u00edncipe', capital: 'S\u00e3o Tom\u00e9', flag: '\ud83c\uddf8\ud83c\uddf9', population: 0.2, languages: ['Portuguese'], timezone: 'Africa/Sao_Tome', recs: ['eccas', 'censad'] },

  // ── East Africa (EAC / IGAD) ──
  DJ: { code: 'DJ', name: 'Djibouti', nameFr: 'Djibouti', capital: 'Djibouti', flag: '\ud83c\udde9\ud83c\uddef', population: 1.1, languages: ['French', 'Arabic'], timezone: 'Africa/Djibouti', recs: ['igad', 'comesa', 'censad'] },
  ER: { code: 'ER', name: 'Eritrea', nameFr: '\u00c9rythr\u00e9e', capital: 'Asmara', flag: '\ud83c\uddea\ud83c\uddf7', population: 3.7, languages: ['Tigrinya', 'Arabic', 'English'], timezone: 'Africa/Asmara', recs: ['igad', 'comesa', 'censad'] },
  ET: { code: 'ET', name: 'Ethiopia', nameFr: '\u00c9thiopie', capital: 'Addis Ababa', flag: '\ud83c\uddea\ud83c\uddf9', population: 126.5, languages: ['Amharic'], timezone: 'Africa/Addis_Ababa', recs: ['igad', 'comesa'], tenantId: '00000000-0000-4000-a000-000000000102' },
  KE: { code: 'KE', name: 'Kenya', nameFr: 'Kenya', capital: 'Nairobi', flag: '\ud83c\uddf0\ud83c\uddea', population: 55.1, languages: ['Swahili', 'English'], timezone: 'Africa/Nairobi', recs: ['igad', 'eac', 'comesa', 'censad'], tenantId: '00000000-0000-4000-a000-000000000101' },
  SO: { code: 'SO', name: 'Somalia', nameFr: 'Somalie', capital: 'Mogadishu', flag: '\ud83c\uddf8\ud83c\uddf4', population: 18.1, languages: ['Somali', 'Arabic'], timezone: 'Africa/Mogadishu', recs: ['igad', 'comesa', 'censad'] },
  SS: { code: 'SS', name: 'South Sudan', nameFr: 'Soudan du Sud', capital: 'Juba', flag: '\ud83c\uddf8\ud83c\uddf8', population: 11.1, languages: ['English'], timezone: 'Africa/Juba', recs: ['igad', 'eac'] },
  SD: { code: 'SD', name: 'Sudan', nameFr: 'Soudan', capital: 'Khartoum', flag: '\ud83c\uddf8\ud83c\udde9', population: 47.9, languages: ['Arabic', 'English'], timezone: 'Africa/Khartoum', recs: ['igad', 'comesa', 'censad'] },
  UG: { code: 'UG', name: 'Uganda', nameFr: 'Ouganda', capital: 'Kampala', flag: '\ud83c\uddfa\ud83c\uddec', population: 48.6, languages: ['English', 'Swahili'], timezone: 'Africa/Kampala', recs: ['igad', 'eac', 'comesa'] },
  TZ: { code: 'TZ', name: 'Tanzania', nameFr: 'Tanzanie', capital: 'Dodoma', flag: '\ud83c\uddf9\ud83c\uddff', population: 65.5, languages: ['Swahili', 'English'], timezone: 'Africa/Dar_es_Salaam', recs: ['eac', 'sadc'] },

  // ── Southern Africa (SADC) ──
  BW: { code: 'BW', name: 'Botswana', nameFr: 'Botswana', capital: 'Gaborone', flag: '\ud83c\udde7\ud83c\uddfc', population: 2.6, languages: ['English', 'Setswana'], timezone: 'Africa/Gaborone', recs: ['sadc'] },
  KM: { code: 'KM', name: 'Comoros', nameFr: 'Comores', capital: 'Moroni', flag: '\ud83c\uddf0\ud83c\uddf2', population: 0.9, languages: ['Comorian', 'Arabic', 'French'], timezone: 'Indian/Comoro', recs: ['sadc', 'comesa', 'censad'] },
  SZ: { code: 'SZ', name: 'Eswatini', nameFr: 'Eswatini', capital: 'Mbabane', flag: '\ud83c\uddf8\ud83c\uddff', population: 1.2, languages: ['English', 'Swazi'], timezone: 'Africa/Mbabane', recs: ['sadc', 'comesa'] },
  LS: { code: 'LS', name: 'Lesotho', nameFr: 'Lesotho', capital: 'Maseru', flag: '\ud83c\uddf1\ud83c\uddf8', population: 2.3, languages: ['Sesotho', 'English'], timezone: 'Africa/Maseru', recs: ['sadc'] },
  MG: { code: 'MG', name: 'Madagascar', nameFr: 'Madagascar', capital: 'Antananarivo', flag: '\ud83c\uddf2\ud83c\uddec', population: 30.3, languages: ['Malagasy', 'French'], timezone: 'Indian/Antananarivo', recs: ['sadc', 'comesa'] },
  MW: { code: 'MW', name: 'Malawi', nameFr: 'Malawi', capital: 'Lilongwe', flag: '\ud83c\uddf2\ud83c\uddfc', population: 20.9, languages: ['English', 'Chichewa'], timezone: 'Africa/Blantyre', recs: ['sadc', 'comesa'] },
  MU: { code: 'MU', name: 'Mauritius', nameFr: 'Maurice', capital: 'Port Louis', flag: '\ud83c\uddf2\ud83c\uddfa', population: 1.3, languages: ['English', 'French', 'Creole'], timezone: 'Indian/Mauritius', recs: ['sadc', 'comesa'] },
  MZ: { code: 'MZ', name: 'Mozambique', nameFr: 'Mozambique', capital: 'Maputo', flag: '\ud83c\uddf2\ud83c\uddff', population: 33.9, languages: ['Portuguese'], timezone: 'Africa/Maputo', recs: ['sadc'] },
  NA: { code: 'NA', name: 'Namibia', nameFr: 'Namibie', capital: 'Windhoek', flag: '\ud83c\uddf3\ud83c\udde6', population: 2.6, languages: ['English'], timezone: 'Africa/Windhoek', recs: ['sadc'] },
  SC: { code: 'SC', name: 'Seychelles', nameFr: 'Seychelles', capital: 'Victoria', flag: '\ud83c\uddf8\ud83c\udde8', population: 0.1, languages: ['Creole', 'English', 'French'], timezone: 'Indian/Mahe', recs: ['sadc', 'comesa'] },
  ZA: { code: 'ZA', name: 'South Africa', nameFr: 'Afrique du Sud', capital: 'Pretoria', flag: '\ud83c\uddff\ud83c\udde6', population: 60.4, languages: ['English', 'Zulu', 'Xhosa', 'Afrikaans'], timezone: 'Africa/Johannesburg', recs: ['sadc'], tenantId: '00000000-0000-4000-a000-000000000301' },
  ZM: { code: 'ZM', name: 'Zambia', nameFr: 'Zambie', capital: 'Lusaka', flag: '\ud83c\uddff\ud83c\uddf2', population: 20.6, languages: ['English'], timezone: 'Africa/Lusaka', recs: ['sadc', 'comesa'] },
  ZW: { code: 'ZW', name: 'Zimbabwe', nameFr: 'Zimbabwe', capital: 'Harare', flag: '\ud83c\uddff\ud83c\uddfc', population: 16.7, languages: ['English', 'Shona', 'Ndebele'], timezone: 'Africa/Harare', recs: ['sadc', 'comesa'] },

  // ── Other (Egypt is AU member, belongs to multiple RECs) ──
  EG: { code: 'EG', name: 'Egypt', nameFr: '\u00c9gypte', capital: 'Cairo', flag: '\ud83c\uddea\ud83c\uddec', population: 112.7, languages: ['Arabic'], timezone: 'Africa/Cairo', recs: ['comesa', 'censad'] },
};

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
