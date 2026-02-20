// Seed data for Identifiers: labs, markets, border points, protected areas,
// slaughterhouses, quarantine stations across 5 pilot countries.

export interface IdentifierSeed {
  code: string;
  nameEn: string;
  nameFr: string;
  type: 'LAB' | 'MARKET' | 'BORDER_POINT' | 'PROTECTED_AREA' | 'SLAUGHTERHOUSE' | 'QUARANTINE_STATION';
  geoEntityCode?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export const IDENTIFIER_SEEDS: IdentifierSeed[] = [
  // ── LABs (8) ──────────────────────────────────────────────────────────────────

  // Kenya
  { code: 'LAB-KE-KABETE', nameEn: 'Central Veterinary Laboratory — Kabete', nameFr: 'Laboratoire vétérinaire central — Kabete', type: 'LAB', geoEntityCode: 'KE', latitude: -1.2580, longitude: 36.7273, address: 'Kapenguria Road, Kabete, Nairobi, Kenya' },
  { code: 'LAB-KE-KARI', nameEn: 'Kenya Agricultural & Livestock Research Organization (KALRO) — Muguga', nameFr: 'Organisation kenyane de recherche agricole et animale (KALRO) — Muguga', type: 'LAB', geoEntityCode: 'KE', latitude: -1.1960, longitude: 36.6330, address: 'Muguga South, Kikuyu, Kenya' },

  // Ethiopia
  { code: 'LAB-ET-NAHDIC', nameEn: 'National Animal Health Diagnostic and Investigation Center (NAHDIC)', nameFr: 'Centre national de diagnostic et d\'investigation en santé animale (NAHDIC)', type: 'LAB', geoEntityCode: 'ET', latitude: 8.9487, longitude: 38.7325, address: 'Sebeta, Oromia Region, Ethiopia' },
  { code: 'LAB-ET-NVI', nameEn: 'National Veterinary Institute (NVI) — Debre Zeit', nameFr: 'Institut national vétérinaire (NVI) — Debre Zeit', type: 'LAB', geoEntityCode: 'ET', latitude: 8.7340, longitude: 38.9855, address: 'Bishoftu (Debre Zeit), Oromia Region, Ethiopia' },

  // Senegal
  { code: 'LAB-SN-LNERV', nameEn: 'Laboratoire National de l\'Elevage et de Recherches Vétérinaires (LNERV)', nameFr: 'Laboratoire national de l\'élevage et de recherches vétérinaires (LNERV)', type: 'LAB', geoEntityCode: 'SN', latitude: 14.7215, longitude: -17.4422, address: 'Route du Front de Terre, Hann, Dakar, Sénégal' },

  // Nigeria
  { code: 'LAB-NG-NVRI', nameEn: 'National Veterinary Research Institute (NVRI) — Vom', nameFr: 'Institut national de recherche vétérinaire (NVRI) — Vom', type: 'LAB', geoEntityCode: 'NG', latitude: 9.7230, longitude: 8.7780, address: 'Vom, Jos South LGA, Plateau State, Nigeria' },
  { code: 'LAB-NG-FVMA', nameEn: 'Federal College of Veterinary and Medical Laboratory Technology — Vom', nameFr: 'Collège fédéral de technologie de laboratoire vétérinaire et médical — Vom', type: 'LAB', geoEntityCode: 'NG', latitude: 9.7270, longitude: 8.7810, address: 'FCVMLT, Vom, Plateau State, Nigeria' },

  // Tanzania
  { code: 'LAB-TZ-TVLA', nameEn: 'Tanzania Veterinary Laboratory Agency (TVLA) — Temeke', nameFr: 'Agence de laboratoire vétérinaire de Tanzanie (TVLA) — Temeke', type: 'LAB', geoEntityCode: 'TZ', latitude: -6.8630, longitude: 39.2750, address: 'Nelson Mandela Road, Temeke, Dar es Salaam, Tanzania' },

  // ── MARKETs (6) ───────────────────────────────────────────────────────────────

  // Kenya
  { code: 'MKT-KE-GARISSA', nameEn: 'Garissa Livestock Market', nameFr: 'Marché de bétail de Garissa', type: 'MARKET', geoEntityCode: 'KE', latitude: -0.4532, longitude: 39.6461, address: 'Garissa Town, Garissa County, Kenya' },

  // Ethiopia
  { code: 'MKT-ET-ADAMA', nameEn: 'Adama Livestock Market', nameFr: 'Marché de bétail d\'Adama', type: 'MARKET', geoEntityCode: 'ET', latitude: 8.5400, longitude: 39.2675, address: 'Adama (Nazret), East Shewa Zone, Oromia, Ethiopia' },
  { code: 'MKT-ET-BORENA', nameEn: 'Yabello Livestock Market', nameFr: 'Marché de bétail de Yabello', type: 'MARKET', geoEntityCode: 'ET', latitude: 4.8914, longitude: 38.0960, address: 'Yabello, Borena Zone, Oromia, Ethiopia' },

  // Senegal
  { code: 'MKT-SN-DAHRA', nameEn: 'Dahra Djoloff Livestock Market', nameFr: 'Marché de bétail de Dahra Djoloff', type: 'MARKET', geoEntityCode: 'SN', latitude: 15.3410, longitude: -15.4780, address: 'Dahra Djoloff, Louga Region, Sénégal' },

  // Nigeria
  { code: 'MKT-NG-MAIGATARI', nameEn: 'Maigatari International Livestock Market', nameFr: 'Marché international de bétail de Maigatari', type: 'MARKET', geoEntityCode: 'NG', latitude: 12.7936, longitude: 9.4348, address: 'Maigatari, Jigawa State, Nigeria' },

  // Tanzania
  { code: 'MKT-TZ-PUGU', nameEn: 'Pugu Livestock Market', nameFr: 'Marché de bétail de Pugu', type: 'MARKET', geoEntityCode: 'TZ', latitude: -6.8820, longitude: 39.1630, address: 'Pugu Road, Ilala District, Dar es Salaam, Tanzania' },

  // ── BORDER_POINTs (6) ─────────────────────────────────────────────────────────

  // Kenya
  { code: 'BRD-KE-MOYALE', nameEn: 'Moyale One-Stop Border Post (Kenya–Ethiopia)', nameFr: 'Poste-frontière de Moyale (Kenya–Éthiopie)', type: 'BORDER_POINT', geoEntityCode: 'KE', latitude: 3.5273, longitude: 39.0565, address: 'Moyale, Marsabit County, Kenya' },
  { code: 'BRD-KE-NAMANGA', nameEn: 'Namanga One-Stop Border Post (Kenya–Tanzania)', nameFr: 'Poste-frontière de Namanga (Kenya–Tanzanie)', type: 'BORDER_POINT', geoEntityCode: 'KE', latitude: -2.5456, longitude: 36.7893, address: 'Namanga, Kajiado County, Kenya' },

  // Ethiopia
  { code: 'BRD-ET-GALAFI', nameEn: 'Galafi Border Post (Ethiopia–Djibouti)', nameFr: 'Poste-frontière de Galafi (Éthiopie–Djibouti)', type: 'BORDER_POINT', geoEntityCode: 'ET', latitude: 11.3972, longitude: 42.2575, address: 'Galafi, Afar Region, Ethiopia' },

  // Senegal
  { code: 'BRD-SN-ROSSO', nameEn: 'Rosso Border Post (Senegal–Mauritania)', nameFr: 'Poste-frontière de Rosso (Sénégal–Mauritanie)', type: 'BORDER_POINT', geoEntityCode: 'SN', latitude: 16.5130, longitude: -15.8050, address: 'Rosso, Saint-Louis Region, Sénégal' },

  // Nigeria
  { code: 'BRD-NG-SEME', nameEn: 'Seme Border Post (Nigeria–Benin)', nameFr: 'Poste-frontière de Seme (Nigeria–Bénin)', type: 'BORDER_POINT', geoEntityCode: 'NG', latitude: 6.3808, longitude: 2.7157, address: 'Seme, Badagry LGA, Lagos State, Nigeria' },

  // Tanzania
  { code: 'BRD-TZ-HOROHORO', nameEn: 'Horohoro Border Post (Tanzania–Kenya)', nameFr: 'Poste-frontière d\'Horohoro (Tanzanie–Kenya)', type: 'BORDER_POINT', geoEntityCode: 'TZ', latitude: -4.5570, longitude: 39.2080, address: 'Horohoro, Tanga Region, Tanzania' },

  // ── PROTECTED_AREAs (5) ───────────────────────────────────────────────────────

  // Kenya
  { code: 'PA-KE-MAASAI', nameEn: 'Maasai Mara National Reserve', nameFr: 'Réserve nationale du Maasai Mara', type: 'PROTECTED_AREA', geoEntityCode: 'KE', latitude: -1.5000, longitude: 35.1500, address: 'Narok County, Kenya' },

  // Ethiopia
  { code: 'PA-ET-SIMIEN', nameEn: 'Simien Mountains National Park', nameFr: 'Parc national du Simien', type: 'PROTECTED_AREA', geoEntityCode: 'ET', latitude: 13.2500, longitude: 38.0667, address: 'North Gondar Zone, Amhara Region, Ethiopia' },

  // Senegal
  { code: 'PA-SN-NIOKOLO', nameEn: 'Niokolo-Koba National Park', nameFr: 'Parc national du Niokolo-Koba', type: 'PROTECTED_AREA', geoEntityCode: 'SN', latitude: 13.0700, longitude: -12.7300, address: 'Tambacounda Region, Sénégal' },

  // Nigeria
  { code: 'PA-NG-YANKARI', nameEn: 'Yankari National Park', nameFr: 'Parc national de Yankari', type: 'PROTECTED_AREA', geoEntityCode: 'NG', latitude: 9.7500, longitude: 10.5000, address: 'Alkaleri LGA, Bauchi State, Nigeria' },

  // Tanzania
  { code: 'PA-TZ-SERENGETI', nameEn: 'Serengeti National Park', nameFr: 'Parc national du Serengeti', type: 'PROTECTED_AREA', geoEntityCode: 'TZ', latitude: -2.3333, longitude: 34.8333, address: 'Mara Region, Tanzania' },

  // ── SLAUGHTERHOUSEs (3) ───────────────────────────────────────────────────────

  // Kenya
  { code: 'SLH-KE-DAGORETTI', nameEn: 'Dagoretti Slaughterhouse', nameFr: 'Abattoir de Dagoretti', type: 'SLAUGHTERHOUSE', geoEntityCode: 'KE', latitude: -1.2947, longitude: 36.7310, address: 'Dagoretti Corner, Nairobi, Kenya' },

  // Ethiopia
  { code: 'SLH-ET-ELFORA', nameEn: 'Elfora Agro-Industries Abattoir — Debre Zeit', nameFr: 'Abattoir Elfora Agro-Industries — Debre Zeit', type: 'SLAUGHTERHOUSE', geoEntityCode: 'ET', latitude: 8.7425, longitude: 38.9930, address: 'Bishoftu (Debre Zeit), Oromia Region, Ethiopia' },

  // Nigeria
  { code: 'SLH-NG-BODIJA', nameEn: 'Bodija Abattoir', nameFr: 'Abattoir de Bodija', type: 'SLAUGHTERHOUSE', geoEntityCode: 'NG', latitude: 7.4185, longitude: 3.9160, address: 'Bodija Market Area, Ibadan, Oyo State, Nigeria' },

  // ── QUARANTINE_STATIONs (2) ───────────────────────────────────────────────────

  // Kenya
  { code: 'QST-KE-GILGIL', nameEn: 'Gilgil Animal Quarantine Station', nameFr: 'Station de quarantaine animale de Gilgil', type: 'QUARANTINE_STATION', geoEntityCode: 'KE', latitude: -0.4929, longitude: 36.3217, address: 'Gilgil, Nakuru County, Kenya' },

  // Tanzania
  { code: 'QST-TZ-KOROGWE', nameEn: 'Korogwe Quarantine Station', nameFr: 'Station de quarantaine de Korogwe', type: 'QUARANTINE_STATION', geoEntityCode: 'TZ', latitude: -5.1547, longitude: 38.4578, address: 'Korogwe, Tanga Region, Tanzania' },
];
