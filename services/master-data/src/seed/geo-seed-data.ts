// 55 AU Member States + 8 RECs + Admin Level 1 for 5 pilot countries

export interface GeoSeed {
  code: string;
  name: string;
  nameEn: string;
  nameFr: string;
  level: 'COUNTRY' | 'ADMIN1' | 'REC_ZONE';
  parentCode?: string;
  countryCode: string;
  centroidLat?: number;
  centroidLng?: number;
}

// ── 8 Regional Economic Communities ──
export const REC_SEEDS: GeoSeed[] = [
  { code: 'IGAD', name: 'IGAD', nameEn: 'Intergovernmental Authority on Development', nameFr: 'Autorité intergouvernementale pour le développement', level: 'REC_ZONE' as 'COUNTRY', countryCode: 'AU', centroidLat: 8.0, centroidLng: 38.0 },
  { code: 'ECOWAS', name: 'ECOWAS', nameEn: 'Economic Community of West African States', nameFr: 'Communauté économique des États de l\'Afrique de l\'Ouest', level: 'REC_ZONE' as 'COUNTRY', countryCode: 'AU', centroidLat: 10.0, centroidLng: -5.0 },
  { code: 'SADC', name: 'SADC', nameEn: 'Southern African Development Community', nameFr: 'Communauté de développement de l\'Afrique australe', level: 'REC_ZONE' as 'COUNTRY', countryCode: 'AU', centroidLat: -20.0, centroidLng: 28.0 },
  { code: 'EAC', name: 'EAC', nameEn: 'East African Community', nameFr: 'Communauté de l\'Afrique de l\'Est', level: 'REC_ZONE' as 'COUNTRY', countryCode: 'AU', centroidLat: -3.0, centroidLng: 33.0 },
  { code: 'ECCAS', name: 'ECCAS', nameEn: 'Economic Community of Central African States', nameFr: 'Communauté économique des États de l\'Afrique centrale', level: 'REC_ZONE' as 'COUNTRY', countryCode: 'AU', centroidLat: 2.0, centroidLng: 18.0 },
  { code: 'UMA', name: 'UMA', nameEn: 'Arab Maghreb Union', nameFr: 'Union du Maghreb arabe', level: 'REC_ZONE' as 'COUNTRY', countryCode: 'AU', centroidLat: 33.0, centroidLng: 5.0 },
  { code: 'CEN-SAD', name: 'CEN-SAD', nameEn: 'Community of Sahel-Saharan States', nameFr: 'Communauté des États sahélo-sahariens', level: 'REC_ZONE' as 'COUNTRY', countryCode: 'AU', centroidLat: 18.0, centroidLng: 15.0 },
  { code: 'COMESA', name: 'COMESA', nameEn: 'Common Market for Eastern and Southern Africa', nameFr: 'Marché commun de l\'Afrique orientale et australe', level: 'REC_ZONE' as 'COUNTRY', countryCode: 'AU', centroidLat: -5.0, centroidLng: 32.0 },
];

// ── 55 AU Member States ──
export const COUNTRY_SEEDS: GeoSeed[] = [
  { code: 'DZ', name: 'Algeria', nameEn: 'Algeria', nameFr: 'Algérie', level: 'COUNTRY', countryCode: 'DZ', centroidLat: 28.03, centroidLng: 1.66 },
  { code: 'AO', name: 'Angola', nameEn: 'Angola', nameFr: 'Angola', level: 'COUNTRY', countryCode: 'AO', centroidLat: -11.20, centroidLng: 17.87 },
  { code: 'BJ', name: 'Benin', nameEn: 'Benin', nameFr: 'Bénin', level: 'COUNTRY', countryCode: 'BJ', centroidLat: 9.31, centroidLng: 2.32 },
  { code: 'BW', name: 'Botswana', nameEn: 'Botswana', nameFr: 'Botswana', level: 'COUNTRY', countryCode: 'BW', centroidLat: -22.33, centroidLng: 24.68 },
  { code: 'BF', name: 'Burkina Faso', nameEn: 'Burkina Faso', nameFr: 'Burkina Faso', level: 'COUNTRY', countryCode: 'BF', centroidLat: 12.24, centroidLng: -1.56 },
  { code: 'BI', name: 'Burundi', nameEn: 'Burundi', nameFr: 'Burundi', level: 'COUNTRY', countryCode: 'BI', centroidLat: -3.37, centroidLng: 29.92 },
  { code: 'CV', name: 'Cabo Verde', nameEn: 'Cabo Verde', nameFr: 'Cabo Verde', level: 'COUNTRY', countryCode: 'CV', centroidLat: 16.00, centroidLng: -24.01 },
  { code: 'CM', name: 'Cameroon', nameEn: 'Cameroon', nameFr: 'Cameroun', level: 'COUNTRY', countryCode: 'CM', centroidLat: 7.37, centroidLng: 12.35 },
  { code: 'CF', name: 'Central African Republic', nameEn: 'Central African Republic', nameFr: 'République centrafricaine', level: 'COUNTRY', countryCode: 'CF', centroidLat: 6.61, centroidLng: 20.94 },
  { code: 'TD', name: 'Chad', nameEn: 'Chad', nameFr: 'Tchad', level: 'COUNTRY', countryCode: 'TD', centroidLat: 15.45, centroidLng: 18.73 },
  { code: 'KM', name: 'Comoros', nameEn: 'Comoros', nameFr: 'Comores', level: 'COUNTRY', countryCode: 'KM', centroidLat: -11.88, centroidLng: 43.87 },
  { code: 'CG', name: 'Congo', nameEn: 'Congo', nameFr: 'Congo', level: 'COUNTRY', countryCode: 'CG', centroidLat: -0.23, centroidLng: 15.83 },
  { code: 'CD', name: 'DR Congo', nameEn: 'Democratic Republic of the Congo', nameFr: 'République démocratique du Congo', level: 'COUNTRY', countryCode: 'CD', centroidLat: -4.04, centroidLng: 21.76 },
  { code: 'CI', name: "Côte d'Ivoire", nameEn: "Côte d'Ivoire", nameFr: "Côte d'Ivoire", level: 'COUNTRY', countryCode: 'CI', centroidLat: 7.54, centroidLng: -5.55 },
  { code: 'DJ', name: 'Djibouti', nameEn: 'Djibouti', nameFr: 'Djibouti', level: 'COUNTRY', countryCode: 'DJ', centroidLat: 11.59, centroidLng: 43.15 },
  { code: 'EG', name: 'Egypt', nameEn: 'Egypt', nameFr: 'Égypte', level: 'COUNTRY', countryCode: 'EG', centroidLat: 26.82, centroidLng: 30.80 },
  { code: 'GQ', name: 'Equatorial Guinea', nameEn: 'Equatorial Guinea', nameFr: 'Guinée équatoriale', level: 'COUNTRY', countryCode: 'GQ', centroidLat: 1.65, centroidLng: 10.27 },
  { code: 'ER', name: 'Eritrea', nameEn: 'Eritrea', nameFr: 'Érythrée', level: 'COUNTRY', countryCode: 'ER', centroidLat: 15.18, centroidLng: 39.78 },
  { code: 'SZ', name: 'Eswatini', nameEn: 'Eswatini', nameFr: 'Eswatini', level: 'COUNTRY', countryCode: 'SZ', centroidLat: -26.52, centroidLng: 31.47 },
  { code: 'ET', name: 'Ethiopia', nameEn: 'Ethiopia', nameFr: 'Éthiopie', level: 'COUNTRY', countryCode: 'ET', centroidLat: 9.15, centroidLng: 40.49 },
  { code: 'GA', name: 'Gabon', nameEn: 'Gabon', nameFr: 'Gabon', level: 'COUNTRY', countryCode: 'GA', centroidLat: -0.80, centroidLng: 11.61 },
  { code: 'GM', name: 'Gambia', nameEn: 'Gambia', nameFr: 'Gambie', level: 'COUNTRY', countryCode: 'GM', centroidLat: 13.44, centroidLng: -15.31 },
  { code: 'GH', name: 'Ghana', nameEn: 'Ghana', nameFr: 'Ghana', level: 'COUNTRY', countryCode: 'GH', centroidLat: 7.95, centroidLng: -1.02 },
  { code: 'GN', name: 'Guinea', nameEn: 'Guinea', nameFr: 'Guinée', level: 'COUNTRY', countryCode: 'GN', centroidLat: 9.95, centroidLng: -11.36 },
  { code: 'GW', name: 'Guinea-Bissau', nameEn: 'Guinea-Bissau', nameFr: 'Guinée-Bissau', level: 'COUNTRY', countryCode: 'GW', centroidLat: 11.80, centroidLng: -15.18 },
  { code: 'KE', name: 'Kenya', nameEn: 'Kenya', nameFr: 'Kenya', level: 'COUNTRY', countryCode: 'KE', centroidLat: -0.02, centroidLng: 37.91 },
  { code: 'LS', name: 'Lesotho', nameEn: 'Lesotho', nameFr: 'Lesotho', level: 'COUNTRY', countryCode: 'LS', centroidLat: -29.61, centroidLng: 28.23 },
  { code: 'LR', name: 'Liberia', nameEn: 'Liberia', nameFr: 'Libéria', level: 'COUNTRY', countryCode: 'LR', centroidLat: 6.43, centroidLng: -9.43 },
  { code: 'LY', name: 'Libya', nameEn: 'Libya', nameFr: 'Libye', level: 'COUNTRY', countryCode: 'LY', centroidLat: 26.34, centroidLng: 17.23 },
  { code: 'MG', name: 'Madagascar', nameEn: 'Madagascar', nameFr: 'Madagascar', level: 'COUNTRY', countryCode: 'MG', centroidLat: -18.77, centroidLng: 46.87 },
  { code: 'MW', name: 'Malawi', nameEn: 'Malawi', nameFr: 'Malawi', level: 'COUNTRY', countryCode: 'MW', centroidLat: -13.25, centroidLng: 34.30 },
  { code: 'ML', name: 'Mali', nameEn: 'Mali', nameFr: 'Mali', level: 'COUNTRY', countryCode: 'ML', centroidLat: 17.57, centroidLng: -4.00 },
  { code: 'MR', name: 'Mauritania', nameEn: 'Mauritania', nameFr: 'Mauritanie', level: 'COUNTRY', countryCode: 'MR', centroidLat: 21.01, centroidLng: -10.94 },
  { code: 'MU', name: 'Mauritius', nameEn: 'Mauritius', nameFr: 'Maurice', level: 'COUNTRY', countryCode: 'MU', centroidLat: -20.35, centroidLng: 57.55 },
  { code: 'MA', name: 'Morocco', nameEn: 'Morocco', nameFr: 'Maroc', level: 'COUNTRY', countryCode: 'MA', centroidLat: 31.79, centroidLng: -7.09 },
  { code: 'MZ', name: 'Mozambique', nameEn: 'Mozambique', nameFr: 'Mozambique', level: 'COUNTRY', countryCode: 'MZ', centroidLat: -18.67, centroidLng: 35.53 },
  { code: 'NA', name: 'Namibia', nameEn: 'Namibia', nameFr: 'Namibie', level: 'COUNTRY', countryCode: 'NA', centroidLat: -22.96, centroidLng: 18.49 },
  { code: 'NE', name: 'Niger', nameEn: 'Niger', nameFr: 'Niger', level: 'COUNTRY', countryCode: 'NE', centroidLat: 17.61, centroidLng: 8.08 },
  { code: 'NG', name: 'Nigeria', nameEn: 'Nigeria', nameFr: 'Nigéria', level: 'COUNTRY', countryCode: 'NG', centroidLat: 9.08, centroidLng: 8.68 },
  { code: 'RW', name: 'Rwanda', nameEn: 'Rwanda', nameFr: 'Rwanda', level: 'COUNTRY', countryCode: 'RW', centroidLat: -1.94, centroidLng: 29.87 },
  { code: 'ST', name: 'São Tomé and Príncipe', nameEn: 'São Tomé and Príncipe', nameFr: 'São Tomé-et-Príncipe', level: 'COUNTRY', countryCode: 'ST', centroidLat: 0.19, centroidLng: 6.61 },
  { code: 'SN', name: 'Senegal', nameEn: 'Senegal', nameFr: 'Sénégal', level: 'COUNTRY', countryCode: 'SN', centroidLat: 14.50, centroidLng: -14.45 },
  { code: 'SC', name: 'Seychelles', nameEn: 'Seychelles', nameFr: 'Seychelles', level: 'COUNTRY', countryCode: 'SC', centroidLat: -4.68, centroidLng: 55.49 },
  { code: 'SL', name: 'Sierra Leone', nameEn: 'Sierra Leone', nameFr: 'Sierra Leone', level: 'COUNTRY', countryCode: 'SL', centroidLat: 8.46, centroidLng: -11.78 },
  { code: 'SO', name: 'Somalia', nameEn: 'Somalia', nameFr: 'Somalie', level: 'COUNTRY', countryCode: 'SO', centroidLat: 5.15, centroidLng: 46.20 },
  { code: 'ZA', name: 'South Africa', nameEn: 'South Africa', nameFr: 'Afrique du Sud', level: 'COUNTRY', countryCode: 'ZA', centroidLat: -30.56, centroidLng: 22.94 },
  { code: 'SS', name: 'South Sudan', nameEn: 'South Sudan', nameFr: 'Soudan du Sud', level: 'COUNTRY', countryCode: 'SS', centroidLat: 6.88, centroidLng: 31.31 },
  { code: 'SD', name: 'Sudan', nameEn: 'Sudan', nameFr: 'Soudan', level: 'COUNTRY', countryCode: 'SD', centroidLat: 12.86, centroidLng: 30.22 },
  { code: 'TZ', name: 'Tanzania', nameEn: 'United Republic of Tanzania', nameFr: 'République-Unie de Tanzanie', level: 'COUNTRY', countryCode: 'TZ', centroidLat: -6.37, centroidLng: 34.89 },
  { code: 'TG', name: 'Togo', nameEn: 'Togo', nameFr: 'Togo', level: 'COUNTRY', countryCode: 'TG', centroidLat: 8.62, centroidLng: 0.82 },
  { code: 'TN', name: 'Tunisia', nameEn: 'Tunisia', nameFr: 'Tunisie', level: 'COUNTRY', countryCode: 'TN', centroidLat: 33.89, centroidLng: 9.54 },
  { code: 'UG', name: 'Uganda', nameEn: 'Uganda', nameFr: 'Ouganda', level: 'COUNTRY', countryCode: 'UG', centroidLat: 1.37, centroidLng: 32.29 },
  { code: 'ZM', name: 'Zambia', nameEn: 'Zambia', nameFr: 'Zambie', level: 'COUNTRY', countryCode: 'ZM', centroidLat: -13.13, centroidLng: 27.85 },
  { code: 'ZW', name: 'Zimbabwe', nameEn: 'Zimbabwe', nameFr: 'Zimbabwe', level: 'COUNTRY', countryCode: 'ZW', centroidLat: -19.02, centroidLng: 29.15 },
  { code: 'EH', name: 'Sahrawi Republic', nameEn: 'Sahrawi Arab Democratic Republic', nameFr: 'République arabe sahraouie démocratique', level: 'COUNTRY', countryCode: 'EH', centroidLat: 24.22, centroidLng: -12.89 },
];

// ── Admin Level 1 for 5 pilot countries ──
// Kenya, Ethiopia, Nigeria, Senegal, South Africa

export const ADMIN1_SEEDS: GeoSeed[] = [
  // Kenya (47 counties → top ones)
  { code: 'KE-01', name: 'Mombasa', nameEn: 'Mombasa', nameFr: 'Mombasa', level: 'ADMIN1', parentCode: 'KE', countryCode: 'KE', centroidLat: -4.05, centroidLng: 39.67 },
  { code: 'KE-02', name: 'Kwale', nameEn: 'Kwale', nameFr: 'Kwale', level: 'ADMIN1', parentCode: 'KE', countryCode: 'KE', centroidLat: -4.18, centroidLng: 39.46 },
  { code: 'KE-03', name: 'Kilifi', nameEn: 'Kilifi', nameFr: 'Kilifi', level: 'ADMIN1', parentCode: 'KE', countryCode: 'KE', centroidLat: -3.51, centroidLng: 39.91 },
  { code: 'KE-07', name: 'Garissa', nameEn: 'Garissa', nameFr: 'Garissa', level: 'ADMIN1', parentCode: 'KE', countryCode: 'KE', centroidLat: -0.45, centroidLng: 39.65 },
  { code: 'KE-10', name: 'Marsabit', nameEn: 'Marsabit', nameFr: 'Marsabit', level: 'ADMIN1', parentCode: 'KE', countryCode: 'KE', centroidLat: 2.33, centroidLng: 37.99 },
  { code: 'KE-12', name: 'Meru', nameEn: 'Meru', nameFr: 'Meru', level: 'ADMIN1', parentCode: 'KE', countryCode: 'KE', centroidLat: 0.05, centroidLng: 37.65 },
  { code: 'KE-22', name: 'Kiambu', nameEn: 'Kiambu', nameFr: 'Kiambu', level: 'ADMIN1', parentCode: 'KE', countryCode: 'KE', centroidLat: -1.17, centroidLng: 36.83 },
  { code: 'KE-30', name: 'Nairobi', nameEn: 'Nairobi', nameFr: 'Nairobi', level: 'ADMIN1', parentCode: 'KE', countryCode: 'KE', centroidLat: -1.29, centroidLng: 36.82 },
  { code: 'KE-32', name: 'Nakuru', nameEn: 'Nakuru', nameFr: 'Nakuru', level: 'ADMIN1', parentCode: 'KE', countryCode: 'KE', centroidLat: -0.30, centroidLng: 36.08 },
  { code: 'KE-42', name: 'Kisumu', nameEn: 'Kisumu', nameFr: 'Kisumu', level: 'ADMIN1', parentCode: 'KE', countryCode: 'KE', centroidLat: -0.09, centroidLng: 34.77 },

  // Ethiopia (11 regional states)
  { code: 'ET-AA', name: 'Addis Ababa', nameEn: 'Addis Ababa', nameFr: 'Addis-Abeba', level: 'ADMIN1', parentCode: 'ET', countryCode: 'ET', centroidLat: 9.01, centroidLng: 38.75 },
  { code: 'ET-AF', name: 'Afar', nameEn: 'Afar', nameFr: 'Afar', level: 'ADMIN1', parentCode: 'ET', countryCode: 'ET', centroidLat: 11.76, centroidLng: 40.96 },
  { code: 'ET-AM', name: 'Amhara', nameEn: 'Amhara', nameFr: 'Amhara', level: 'ADMIN1', parentCode: 'ET', countryCode: 'ET', centroidLat: 11.35, centroidLng: 38.35 },
  { code: 'ET-OR', name: 'Oromia', nameEn: 'Oromia', nameFr: 'Oromia', level: 'ADMIN1', parentCode: 'ET', countryCode: 'ET', centroidLat: 7.55, centroidLng: 40.64 },
  { code: 'ET-SO', name: 'Somali', nameEn: 'Somali', nameFr: 'Somali', level: 'ADMIN1', parentCode: 'ET', countryCode: 'ET', centroidLat: 6.66, centroidLng: 43.79 },
  { code: 'ET-TI', name: 'Tigray', nameEn: 'Tigray', nameFr: 'Tigray', level: 'ADMIN1', parentCode: 'ET', countryCode: 'ET', centroidLat: 13.90, centroidLng: 38.80 },
  { code: 'ET-SN', name: 'SNNPR', nameEn: 'Southern Nations, Nationalities, and Peoples', nameFr: 'Nations, nationalités et peuples du Sud', level: 'ADMIN1', parentCode: 'ET', countryCode: 'ET', centroidLat: 6.87, centroidLng: 37.58 },
  { code: 'ET-BE', name: 'Benishangul-Gumuz', nameEn: 'Benishangul-Gumuz', nameFr: 'Benishangul-Gumuz', level: 'ADMIN1', parentCode: 'ET', countryCode: 'ET', centroidLat: 10.78, centroidLng: 35.57 },
  { code: 'ET-GA', name: 'Gambela', nameEn: 'Gambela', nameFr: 'Gambela', level: 'ADMIN1', parentCode: 'ET', countryCode: 'ET', centroidLat: 7.92, centroidLng: 34.15 },
  { code: 'ET-HA', name: 'Harari', nameEn: 'Harari', nameFr: 'Harari', level: 'ADMIN1', parentCode: 'ET', countryCode: 'ET', centroidLat: 9.31, centroidLng: 42.12 },
  { code: 'ET-DD', name: 'Dire Dawa', nameEn: 'Dire Dawa', nameFr: 'Dire Dawa', level: 'ADMIN1', parentCode: 'ET', countryCode: 'ET', centroidLat: 9.60, centroidLng: 41.85 },

  // Nigeria (36 states + FCT → key ones)
  { code: 'NG-FC', name: 'FCT Abuja', nameEn: 'Federal Capital Territory', nameFr: 'Territoire de la capitale fédérale', level: 'ADMIN1', parentCode: 'NG', countryCode: 'NG', centroidLat: 9.06, centroidLng: 7.49 },
  { code: 'NG-LA', name: 'Lagos', nameEn: 'Lagos', nameFr: 'Lagos', level: 'ADMIN1', parentCode: 'NG', countryCode: 'NG', centroidLat: 6.52, centroidLng: 3.38 },
  { code: 'NG-KN', name: 'Kano', nameEn: 'Kano', nameFr: 'Kano', level: 'ADMIN1', parentCode: 'NG', countryCode: 'NG', centroidLat: 12.00, centroidLng: 8.52 },
  { code: 'NG-KD', name: 'Kaduna', nameEn: 'Kaduna', nameFr: 'Kaduna', level: 'ADMIN1', parentCode: 'NG', countryCode: 'NG', centroidLat: 10.52, centroidLng: 7.44 },
  { code: 'NG-RI', name: 'Rivers', nameEn: 'Rivers', nameFr: 'Rivers', level: 'ADMIN1', parentCode: 'NG', countryCode: 'NG', centroidLat: 4.84, centroidLng: 6.92 },
  { code: 'NG-OY', name: 'Oyo', nameEn: 'Oyo', nameFr: 'Oyo', level: 'ADMIN1', parentCode: 'NG', countryCode: 'NG', centroidLat: 8.12, centroidLng: 3.42 },
  { code: 'NG-BO', name: 'Borno', nameEn: 'Borno', nameFr: 'Borno', level: 'ADMIN1', parentCode: 'NG', countryCode: 'NG', centroidLat: 11.89, centroidLng: 13.15 },
  { code: 'NG-PL', name: 'Plateau', nameEn: 'Plateau', nameFr: 'Plateau', level: 'ADMIN1', parentCode: 'NG', countryCode: 'NG', centroidLat: 9.22, centroidLng: 9.52 },
  { code: 'NG-SO', name: 'Sokoto', nameEn: 'Sokoto', nameFr: 'Sokoto', level: 'ADMIN1', parentCode: 'NG', countryCode: 'NG', centroidLat: 13.06, centroidLng: 5.24 },
  { code: 'NG-ZA', name: 'Zamfara', nameEn: 'Zamfara', nameFr: 'Zamfara', level: 'ADMIN1', parentCode: 'NG', countryCode: 'NG', centroidLat: 12.17, centroidLng: 6.25 },

  // Senegal (14 regions)
  { code: 'SN-DK', name: 'Dakar', nameEn: 'Dakar', nameFr: 'Dakar', level: 'ADMIN1', parentCode: 'SN', countryCode: 'SN', centroidLat: 14.72, centroidLng: -17.47 },
  { code: 'SN-TH', name: 'Thiès', nameEn: 'Thiès', nameFr: 'Thiès', level: 'ADMIN1', parentCode: 'SN', countryCode: 'SN', centroidLat: 14.79, centroidLng: -16.93 },
  { code: 'SN-SL', name: 'Saint-Louis', nameEn: 'Saint-Louis', nameFr: 'Saint-Louis', level: 'ADMIN1', parentCode: 'SN', countryCode: 'SN', centroidLat: 15.95, centroidLng: -15.98 },
  { code: 'SN-KA', name: 'Kaolack', nameEn: 'Kaolack', nameFr: 'Kaolack', level: 'ADMIN1', parentCode: 'SN', countryCode: 'SN', centroidLat: 14.15, centroidLng: -16.07 },
  { code: 'SN-ZG', name: 'Ziguinchor', nameEn: 'Ziguinchor', nameFr: 'Ziguinchor', level: 'ADMIN1', parentCode: 'SN', countryCode: 'SN', centroidLat: 12.56, centroidLng: -16.26 },
  { code: 'SN-TC', name: 'Tambacounda', nameEn: 'Tambacounda', nameFr: 'Tambacounda', level: 'ADMIN1', parentCode: 'SN', countryCode: 'SN', centroidLat: 13.77, centroidLng: -13.67 },
  { code: 'SN-LG', name: 'Louga', nameEn: 'Louga', nameFr: 'Louga', level: 'ADMIN1', parentCode: 'SN', countryCode: 'SN', centroidLat: 15.62, centroidLng: -15.58 },
  { code: 'SN-DB', name: 'Diourbel', nameEn: 'Diourbel', nameFr: 'Diourbel', level: 'ADMIN1', parentCode: 'SN', countryCode: 'SN', centroidLat: 14.65, centroidLng: -16.23 },

  // South Africa (9 provinces)
  { code: 'ZA-GP', name: 'Gauteng', nameEn: 'Gauteng', nameFr: 'Gauteng', level: 'ADMIN1', parentCode: 'ZA', countryCode: 'ZA', centroidLat: -26.27, centroidLng: 28.11 },
  { code: 'ZA-KZN', name: 'KwaZulu-Natal', nameEn: 'KwaZulu-Natal', nameFr: 'KwaZulu-Natal', level: 'ADMIN1', parentCode: 'ZA', countryCode: 'ZA', centroidLat: -28.53, centroidLng: 30.90 },
  { code: 'ZA-WC', name: 'Western Cape', nameEn: 'Western Cape', nameFr: 'Cap-Occidental', level: 'ADMIN1', parentCode: 'ZA', countryCode: 'ZA', centroidLat: -33.23, centroidLng: 19.35 },
  { code: 'ZA-EC', name: 'Eastern Cape', nameEn: 'Eastern Cape', nameFr: 'Cap-Oriental', level: 'ADMIN1', parentCode: 'ZA', countryCode: 'ZA', centroidLat: -32.00, centroidLng: 26.50 },
  { code: 'ZA-LP', name: 'Limpopo', nameEn: 'Limpopo', nameFr: 'Limpopo', level: 'ADMIN1', parentCode: 'ZA', countryCode: 'ZA', centroidLat: -23.40, centroidLng: 29.42 },
  { code: 'ZA-MP', name: 'Mpumalanga', nameEn: 'Mpumalanga', nameFr: 'Mpumalanga', level: 'ADMIN1', parentCode: 'ZA', countryCode: 'ZA', centroidLat: -25.57, centroidLng: 30.53 },
  { code: 'ZA-NW', name: 'North West', nameEn: 'North West', nameFr: 'Nord-Ouest', level: 'ADMIN1', parentCode: 'ZA', countryCode: 'ZA', centroidLat: -26.17, centroidLng: 25.47 },
  { code: 'ZA-FS', name: 'Free State', nameEn: 'Free State', nameFr: 'État-Libre', level: 'ADMIN1', parentCode: 'ZA', countryCode: 'ZA', centroidLat: -29.08, centroidLng: 26.16 },
  { code: 'ZA-NC', name: 'Northern Cape', nameEn: 'Northern Cape', nameFr: 'Cap-du-Nord', level: 'ADMIN1', parentCode: 'ZA', countryCode: 'ZA', centroidLat: -29.05, centroidLng: 21.86 },
];
