// ─── Africa Country Centroids & Metadata ────────────────────────────────────
// Used for the dashboard choropleth map.
// Centroids (approximate geographic centers) for bubble/marker-based visualization.

export interface AfricaCountryGeo {
  code: string;    // ISO 3166-1 alpha-2
  code3: string;   // ISO 3166-1 alpha-3
  name: string;
  nameFr: string;
  lat: number;
  lng: number;
  rec: string;     // Primary REC
}

export const AFRICA_COUNTRIES: AfricaCountryGeo[] = [
  // North Africa
  { code: 'DZ', code3: 'DZA', name: 'Algeria', nameFr: 'Algérie', lat: 28.03, lng: 1.66, rec: 'uma' },
  { code: 'EG', code3: 'EGY', name: 'Egypt', nameFr: 'Égypte', lat: 26.82, lng: 30.80, rec: 'comesa' },
  { code: 'LY', code3: 'LBY', name: 'Libya', nameFr: 'Libye', lat: 26.34, lng: 17.23, rec: 'uma' },
  { code: 'MA', code3: 'MAR', name: 'Morocco', nameFr: 'Maroc', lat: 31.79, lng: -7.09, rec: 'uma' },
  { code: 'MR', code3: 'MRT', name: 'Mauritania', nameFr: 'Mauritanie', lat: 21.01, lng: -10.94, rec: 'uma' },
  { code: 'TN', code3: 'TUN', name: 'Tunisia', nameFr: 'Tunisie', lat: 33.89, lng: 9.54, rec: 'uma' },

  // West Africa
  { code: 'BJ', code3: 'BEN', name: 'Benin', nameFr: 'Bénin', lat: 9.31, lng: 2.32, rec: 'ecowas' },
  { code: 'BF', code3: 'BFA', name: 'Burkina Faso', nameFr: 'Burkina Faso', lat: 12.24, lng: -1.56, rec: 'ecowas' },
  { code: 'CV', code3: 'CPV', name: 'Cabo Verde', nameFr: 'Cap-Vert', lat: 16.00, lng: -24.01, rec: 'ecowas' },
  { code: 'CI', code3: 'CIV', name: "Côte d'Ivoire", nameFr: "Côte d'Ivoire", lat: 7.54, lng: -5.55, rec: 'ecowas' },
  { code: 'GM', code3: 'GMB', name: 'Gambia', nameFr: 'Gambie', lat: 13.44, lng: -15.31, rec: 'ecowas' },
  { code: 'GH', code3: 'GHA', name: 'Ghana', nameFr: 'Ghana', lat: 7.95, lng: -1.02, rec: 'ecowas' },
  { code: 'GN', code3: 'GIN', name: 'Guinea', nameFr: 'Guinée', lat: 9.95, lng: -11.80, rec: 'ecowas' },
  { code: 'GW', code3: 'GNB', name: 'Guinea-Bissau', nameFr: 'Guinée-Bissau', lat: 11.80, lng: -15.18, rec: 'ecowas' },
  { code: 'LR', code3: 'LBR', name: 'Liberia', nameFr: 'Libéria', lat: 6.43, lng: -9.43, rec: 'ecowas' },
  { code: 'ML', code3: 'MLI', name: 'Mali', nameFr: 'Mali', lat: 17.57, lng: -4.00, rec: 'ecowas' },
  { code: 'NE', code3: 'NER', name: 'Niger', nameFr: 'Niger', lat: 17.61, lng: 8.08, rec: 'ecowas' },
  { code: 'NG', code3: 'NGA', name: 'Nigeria', nameFr: 'Nigéria', lat: 9.08, lng: 8.68, rec: 'ecowas' },
  { code: 'SN', code3: 'SEN', name: 'Senegal', nameFr: 'Sénégal', lat: 14.50, lng: -14.45, rec: 'ecowas' },
  { code: 'SL', code3: 'SLE', name: 'Sierra Leone', nameFr: 'Sierra Leone', lat: 8.46, lng: -11.78, rec: 'ecowas' },
  { code: 'TG', code3: 'TGO', name: 'Togo', nameFr: 'Togo', lat: 8.62, lng: 0.82, rec: 'ecowas' },

  // Central Africa
  { code: 'AO', code3: 'AGO', name: 'Angola', nameFr: 'Angola', lat: -11.20, lng: 17.87, rec: 'sadc' },
  { code: 'BI', code3: 'BDI', name: 'Burundi', nameFr: 'Burundi', lat: -3.37, lng: 29.92, rec: 'eac' },
  { code: 'CM', code3: 'CMR', name: 'Cameroon', nameFr: 'Cameroun', lat: 7.37, lng: 12.35, rec: 'eccas' },
  { code: 'CF', code3: 'CAF', name: 'Central African Rep.', nameFr: 'Rép. centrafricaine', lat: 6.61, lng: 20.94, rec: 'eccas' },
  { code: 'TD', code3: 'TCD', name: 'Chad', nameFr: 'Tchad', lat: 15.45, lng: 18.73, rec: 'eccas' },
  { code: 'CG', code3: 'COG', name: 'Congo', nameFr: 'Congo', lat: -0.23, lng: 15.83, rec: 'eccas' },
  { code: 'CD', code3: 'COD', name: 'DR Congo', nameFr: 'RD Congo', lat: -4.04, lng: 21.76, rec: 'eccas' },
  { code: 'GQ', code3: 'GNQ', name: 'Equatorial Guinea', nameFr: 'Guinée équatoriale', lat: 1.65, lng: 10.27, rec: 'eccas' },
  { code: 'GA', code3: 'GAB', name: 'Gabon', nameFr: 'Gabon', lat: -0.80, lng: 11.61, rec: 'eccas' },
  { code: 'RW', code3: 'RWA', name: 'Rwanda', nameFr: 'Rwanda', lat: -1.94, lng: 29.87, rec: 'eac' },
  { code: 'ST', code3: 'STP', name: 'São Tomé', nameFr: 'São Tomé', lat: 0.19, lng: 6.61, rec: 'eccas' },

  // East Africa
  { code: 'DJ', code3: 'DJI', name: 'Djibouti', nameFr: 'Djibouti', lat: 11.59, lng: 43.15, rec: 'igad' },
  { code: 'ER', code3: 'ERI', name: 'Eritrea', nameFr: 'Érythrée', lat: 15.18, lng: 39.78, rec: 'igad' },
  { code: 'ET', code3: 'ETH', name: 'Ethiopia', nameFr: 'Éthiopie', lat: 9.15, lng: 40.49, rec: 'igad' },
  { code: 'KE', code3: 'KEN', name: 'Kenya', nameFr: 'Kenya', lat: -0.02, lng: 37.91, rec: 'igad' },
  { code: 'SO', code3: 'SOM', name: 'Somalia', nameFr: 'Somalie', lat: 5.15, lng: 46.20, rec: 'igad' },
  { code: 'SS', code3: 'SSD', name: 'South Sudan', nameFr: 'Soudan du Sud', lat: 6.88, lng: 31.31, rec: 'igad' },
  { code: 'SD', code3: 'SDN', name: 'Sudan', nameFr: 'Soudan', lat: 12.86, lng: 30.22, rec: 'igad' },
  { code: 'UG', code3: 'UGA', name: 'Uganda', nameFr: 'Ouganda', lat: 1.37, lng: 32.29, rec: 'igad' },
  { code: 'TZ', code3: 'TZA', name: 'Tanzania', nameFr: 'Tanzanie', lat: -6.37, lng: 34.89, rec: 'eac' },

  // Southern Africa
  { code: 'BW', code3: 'BWA', name: 'Botswana', nameFr: 'Botswana', lat: -22.33, lng: 24.68, rec: 'sadc' },
  { code: 'KM', code3: 'COM', name: 'Comoros', nameFr: 'Comores', lat: -11.88, lng: 43.87, rec: 'sadc' },
  { code: 'SZ', code3: 'SWZ', name: 'Eswatini', nameFr: 'Eswatini', lat: -26.52, lng: 31.47, rec: 'sadc' },
  { code: 'LS', code3: 'LSO', name: 'Lesotho', nameFr: 'Lesotho', lat: -29.61, lng: 28.23, rec: 'sadc' },
  { code: 'MG', code3: 'MDG', name: 'Madagascar', nameFr: 'Madagascar', lat: -18.77, lng: 46.87, rec: 'sadc' },
  { code: 'MW', code3: 'MWI', name: 'Malawi', nameFr: 'Malawi', lat: -13.25, lng: 34.30, rec: 'sadc' },
  { code: 'MU', code3: 'MUS', name: 'Mauritius', nameFr: 'Maurice', lat: -20.35, lng: 57.55, rec: 'sadc' },
  { code: 'MZ', code3: 'MOZ', name: 'Mozambique', nameFr: 'Mozambique', lat: -18.67, lng: 35.53, rec: 'sadc' },
  { code: 'NA', code3: 'NAM', name: 'Namibia', nameFr: 'Namibie', lat: -22.96, lng: 18.49, rec: 'sadc' },
  { code: 'SC', code3: 'SYC', name: 'Seychelles', nameFr: 'Seychelles', lat: -4.68, lng: 55.49, rec: 'sadc' },
  { code: 'ZA', code3: 'ZAF', name: 'South Africa', nameFr: 'Afrique du Sud', lat: -30.56, lng: 22.94, rec: 'sadc' },
  { code: 'ZM', code3: 'ZMB', name: 'Zambia', nameFr: 'Zambie', lat: -13.13, lng: 27.85, rec: 'sadc' },
  { code: 'ZW', code3: 'ZWE', name: 'Zimbabwe', nameFr: 'Zimbabwe', lat: -19.02, lng: 29.15, rec: 'sadc' },
];

// Lookup by code
export const AFRICA_COUNTRY_MAP = new Map(
  AFRICA_COUNTRIES.map((c) => [c.code, c]),
);

// ISO-alpha-2 set for filtering
export const AFRICA_ISO2_SET = new Set(AFRICA_COUNTRIES.map((c) => c.code));

// Numeric ISO 3166-1 → ISO alpha-2 mapping (used by world-atlas TopoJSON)
export const NUMERIC_TO_ISO2: Record<string, string> = {
  '012': 'DZ', '024': 'AO', '204': 'BJ', '072': 'BW', '854': 'BF',
  '108': 'BI', '120': 'CM', '132': 'CV', '140': 'CF', '148': 'TD',
  '174': 'KM', '178': 'CG', '180': 'CD', '384': 'CI', '262': 'DJ',
  '818': 'EG', '226': 'GQ', '232': 'ER', '231': 'ET', '748': 'SZ',
  '266': 'GA', '270': 'GM', '288': 'GH', '324': 'GN', '624': 'GW',
  '404': 'KE', '426': 'LS', '430': 'LR', '434': 'LY', '450': 'MG',
  '454': 'MW', '466': 'ML', '478': 'MR', '480': 'MU', '504': 'MA',
  '508': 'MZ', '516': 'NA', '562': 'NE', '566': 'NG', '646': 'RW',
  '678': 'ST', '686': 'SN', '690': 'SC', '694': 'SL', '706': 'SO',
  '710': 'ZA', '728': 'SS', '729': 'SD', '834': 'TZ', '768': 'TG',
  '788': 'TN', '800': 'UG', '894': 'ZM', '716': 'ZW',
};

// Color scale for outbreak density
export function getOutbreakColor(outbreaks: number): string {
  if (outbreaks === 0) return '#e5e7eb';
  if (outbreaks <= 5) return '#dcfce7';
  if (outbreaks <= 15) return '#fef3c7';
  if (outbreaks <= 30) return '#fed7aa';
  if (outbreaks <= 50) return '#fca5a5';
  if (outbreaks <= 75) return '#ef4444';
  return '#991b1b';
}

export function getOutbreakRadius(outbreaks: number): number {
  if (outbreaks === 0) return 4;
  if (outbreaks <= 5) return 6;
  if (outbreaks <= 15) return 9;
  if (outbreaks <= 30) return 12;
  if (outbreaks <= 50) return 16;
  if (outbreaks <= 75) return 20;
  return 24;
}
