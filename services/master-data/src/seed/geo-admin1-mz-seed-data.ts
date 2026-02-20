// ADMIN1 for AU Member States M-Z + Sahrawi Republic
// Kenya, Ethiopia, Nigeria, Senegal, South Africa already covered in geo-seed-data.ts
// Tanzania (TZ) already covered in geo-seed-data.ts — SKIPPED
// Countries A-L already covered in geo-admin1-seed-data.ts

import type { GeoSeed } from './geo-seed-data';

export const ADMIN1_MZ_SEEDS: GeoSeed[] = [
  // ── Madagascar (MG) — 6 key regions ──
  { code: 'MG-T', name: 'Analamanga', nameEn: 'Analamanga', nameFr: 'Analamanga', level: 'ADMIN1', parentCode: 'MG', countryCode: 'MG', centroidLat: -18.92, centroidLng: 47.52 },
  { code: 'MG-U', name: 'Vakinankaratra', nameEn: 'Vakinankaratra', nameFr: 'Vakinankaratra', level: 'ADMIN1', parentCode: 'MG', countryCode: 'MG', centroidLat: -19.87, centroidLng: 46.98 },
  { code: 'MG-A', name: 'Diana', nameEn: 'Diana', nameFr: 'Diana', level: 'ADMIN1', parentCode: 'MG', countryCode: 'MG', centroidLat: -13.17, centroidLng: 49.05 },
  { code: 'MG-M', name: 'Atsinanana', nameEn: 'Atsinanana', nameFr: 'Atsinanana', level: 'ADMIN1', parentCode: 'MG', countryCode: 'MG', centroidLat: -18.15, centroidLng: 49.40 },
  { code: 'MG-F', name: 'Boeny', nameEn: 'Boeny', nameFr: 'Boeny', level: 'ADMIN1', parentCode: 'MG', countryCode: 'MG', centroidLat: -16.00, centroidLng: 46.58 },
  { code: 'MG-D', name: 'Atsimo-Andrefana', nameEn: 'Atsimo-Andrefana', nameFr: 'Atsimo-Andrefana', level: 'ADMIN1', parentCode: 'MG', countryCode: 'MG', centroidLat: -23.35, centroidLng: 43.68 },

  // ── Malawi (MW) — 3 regions, 8 key entries ──
  { code: 'MW-N', name: 'Northern Region', nameEn: 'Northern Region', nameFr: 'Région du Nord', level: 'ADMIN1', parentCode: 'MW', countryCode: 'MW', centroidLat: -11.46, centroidLng: 33.80 },
  { code: 'MW-C', name: 'Central Region', nameEn: 'Central Region', nameFr: 'Région du Centre', level: 'ADMIN1', parentCode: 'MW', countryCode: 'MW', centroidLat: -13.25, centroidLng: 33.79 },
  { code: 'MW-S', name: 'Southern Region', nameEn: 'Southern Region', nameFr: 'Région du Sud', level: 'ADMIN1', parentCode: 'MW', countryCode: 'MW', centroidLat: -15.38, centroidLng: 35.30 },
  { code: 'MW-LI', name: 'Lilongwe', nameEn: 'Lilongwe', nameFr: 'Lilongwe', level: 'ADMIN1', parentCode: 'MW', countryCode: 'MW', centroidLat: -14.00, centroidLng: 33.78 },
  { code: 'MW-BL', name: 'Blantyre', nameEn: 'Blantyre', nameFr: 'Blantyre', level: 'ADMIN1', parentCode: 'MW', countryCode: 'MW', centroidLat: -15.79, centroidLng: 35.01 },
  { code: 'MW-MZ', name: 'Mzimba', nameEn: 'Mzimba', nameFr: 'Mzimba', level: 'ADMIN1', parentCode: 'MW', countryCode: 'MW', centroidLat: -11.90, centroidLng: 33.60 },
  { code: 'MW-ZO', name: 'Zomba', nameEn: 'Zomba', nameFr: 'Zomba', level: 'ADMIN1', parentCode: 'MW', countryCode: 'MW', centroidLat: -15.39, centroidLng: 35.32 },
  { code: 'MW-MG', name: 'Mangochi', nameEn: 'Mangochi', nameFr: 'Mangochi', level: 'ADMIN1', parentCode: 'MW', countryCode: 'MW', centroidLat: -14.48, centroidLng: 35.26 },

  // ── Mali (ML) — 10 regions ──
  { code: 'ML-BKO', name: 'Bamako', nameEn: 'Bamako', nameFr: 'Bamako', level: 'ADMIN1', parentCode: 'ML', countryCode: 'ML', centroidLat: 12.65, centroidLng: -8.00 },
  { code: 'ML-1', name: 'Kayes', nameEn: 'Kayes', nameFr: 'Kayes', level: 'ADMIN1', parentCode: 'ML', countryCode: 'ML', centroidLat: 13.44, centroidLng: -10.60 },
  { code: 'ML-2', name: 'Koulikoro', nameEn: 'Koulikoro', nameFr: 'Koulikoro', level: 'ADMIN1', parentCode: 'ML', countryCode: 'ML', centroidLat: 13.20, centroidLng: -7.56 },
  { code: 'ML-3', name: 'Sikasso', nameEn: 'Sikasso', nameFr: 'Sikasso', level: 'ADMIN1', parentCode: 'ML', countryCode: 'ML', centroidLat: 11.32, centroidLng: -5.66 },
  { code: 'ML-4', name: 'Ségou', nameEn: 'Ségou', nameFr: 'Ségou', level: 'ADMIN1', parentCode: 'ML', countryCode: 'ML', centroidLat: 13.44, centroidLng: -5.44 },
  { code: 'ML-5', name: 'Mopti', nameEn: 'Mopti', nameFr: 'Mopti', level: 'ADMIN1', parentCode: 'ML', countryCode: 'ML', centroidLat: 14.49, centroidLng: -4.19 },
  { code: 'ML-6', name: 'Tombouctou', nameEn: 'Timbuktu', nameFr: 'Tombouctou', level: 'ADMIN1', parentCode: 'ML', countryCode: 'ML', centroidLat: 16.77, centroidLng: -3.01 },
  { code: 'ML-7', name: 'Gao', nameEn: 'Gao', nameFr: 'Gao', level: 'ADMIN1', parentCode: 'ML', countryCode: 'ML', centroidLat: 16.27, centroidLng: -0.04 },
  { code: 'ML-8', name: 'Kidal', nameEn: 'Kidal', nameFr: 'Kidal', level: 'ADMIN1', parentCode: 'ML', countryCode: 'ML', centroidLat: 18.44, centroidLng: 1.41 },
  { code: 'ML-9', name: 'Ménaka', nameEn: 'Ménaka', nameFr: 'Ménaka', level: 'ADMIN1', parentCode: 'ML', countryCode: 'ML', centroidLat: 15.92, centroidLng: 2.40 },

  // ── Mauritania (MR) — 8 regions ──
  { code: 'MR-NKC', name: 'Nouakchott', nameEn: 'Nouakchott', nameFr: 'Nouakchott', level: 'ADMIN1', parentCode: 'MR', countryCode: 'MR', centroidLat: 18.09, centroidLng: -15.98 },
  { code: 'MR-03', name: 'Assaba', nameEn: 'Assaba', nameFr: 'Assaba', level: 'ADMIN1', parentCode: 'MR', countryCode: 'MR', centroidLat: 16.77, centroidLng: -11.53 },
  { code: 'MR-05', name: 'Brakna', nameEn: 'Brakna', nameFr: 'Brakna', level: 'ADMIN1', parentCode: 'MR', countryCode: 'MR', centroidLat: 17.23, centroidLng: -13.17 },
  { code: 'MR-08', name: 'Hodh Ech Chargui', nameEn: 'Hodh Ech Chargui', nameFr: 'Hodh Ech Chargui', level: 'ADMIN1', parentCode: 'MR', countryCode: 'MR', centroidLat: 18.24, centroidLng: -7.09 },
  { code: 'MR-07', name: 'Hodh El Gharbi', nameEn: 'Hodh El Gharbi', nameFr: 'Hodh El Gharbi', level: 'ADMIN1', parentCode: 'MR', countryCode: 'MR', centroidLat: 16.57, centroidLng: -9.33 },
  { code: 'MR-04', name: 'Gorgol', nameEn: 'Gorgol', nameFr: 'Gorgol', level: 'ADMIN1', parentCode: 'MR', countryCode: 'MR', centroidLat: 15.97, centroidLng: -12.62 },
  { code: 'MR-10', name: 'Guidimaka', nameEn: 'Guidimaka', nameFr: 'Guidimaka', level: 'ADMIN1', parentCode: 'MR', countryCode: 'MR', centroidLat: 15.25, centroidLng: -12.25 },
  { code: 'MR-01', name: 'Adrar', nameEn: 'Adrar', nameFr: 'Adrar', level: 'ADMIN1', parentCode: 'MR', countryCode: 'MR', centroidLat: 19.87, centroidLng: -12.25 },

  // ── Mauritius (MU) — 4 districts ──
  { code: 'MU-PL', name: 'Port Louis', nameEn: 'Port Louis', nameFr: 'Port-Louis', level: 'ADMIN1', parentCode: 'MU', countryCode: 'MU', centroidLat: -20.16, centroidLng: 57.50 },
  { code: 'MU-PA', name: 'Plaines Wilhems', nameEn: 'Plaines Wilhems', nameFr: 'Plaines Wilhems', level: 'ADMIN1', parentCode: 'MU', countryCode: 'MU', centroidLat: -20.31, centroidLng: 57.51 },
  { code: 'MU-FL', name: 'Flacq', nameEn: 'Flacq', nameFr: 'Flacq', level: 'ADMIN1', parentCode: 'MU', countryCode: 'MU', centroidLat: -20.19, centroidLng: 57.72 },
  { code: 'MU-GP', name: 'Grand Port', nameEn: 'Grand Port', nameFr: 'Grand Port', level: 'ADMIN1', parentCode: 'MU', countryCode: 'MU', centroidLat: -20.37, centroidLng: 57.66 },

  // ── Morocco (MA) — 12 regions ──
  { code: 'MA-01', name: 'Tanger-Tétouan-Al Hoceïma', nameEn: 'Tanger-Tétouan-Al Hoceïma', nameFr: 'Tanger-Tétouan-Al Hoceïma', level: 'ADMIN1', parentCode: 'MA', countryCode: 'MA', centroidLat: 35.26, centroidLng: -5.09 },
  { code: 'MA-02', name: 'Oriental', nameEn: 'Oriental', nameFr: 'Oriental', level: 'ADMIN1', parentCode: 'MA', countryCode: 'MA', centroidLat: 34.31, centroidLng: -2.37 },
  { code: 'MA-03', name: 'Fès-Meknès', nameEn: 'Fès-Meknès', nameFr: 'Fès-Meknès', level: 'ADMIN1', parentCode: 'MA', countryCode: 'MA', centroidLat: 33.89, centroidLng: -4.73 },
  { code: 'MA-04', name: 'Rabat-Salé-Kénitra', nameEn: 'Rabat-Salé-Kénitra', nameFr: 'Rabat-Salé-Kénitra', level: 'ADMIN1', parentCode: 'MA', countryCode: 'MA', centroidLat: 34.02, centroidLng: -6.58 },
  { code: 'MA-05', name: 'Béni Mellal-Khénifra', nameEn: 'Béni Mellal-Khénifra', nameFr: 'Béni Mellal-Khénifra', level: 'ADMIN1', parentCode: 'MA', countryCode: 'MA', centroidLat: 32.34, centroidLng: -6.36 },
  { code: 'MA-06', name: 'Casablanca-Settat', nameEn: 'Casablanca-Settat', nameFr: 'Casablanca-Settat', level: 'ADMIN1', parentCode: 'MA', countryCode: 'MA', centroidLat: 33.37, centroidLng: -7.58 },
  { code: 'MA-07', name: 'Marrakech-Safi', nameEn: 'Marrakech-Safi', nameFr: 'Marrakech-Safi', level: 'ADMIN1', parentCode: 'MA', countryCode: 'MA', centroidLat: 31.63, centroidLng: -8.01 },
  { code: 'MA-08', name: 'Drâa-Tafilalet', nameEn: 'Drâa-Tafilalet', nameFr: 'Drâa-Tafilalet', level: 'ADMIN1', parentCode: 'MA', countryCode: 'MA', centroidLat: 31.15, centroidLng: -5.39 },
  { code: 'MA-09', name: 'Souss-Massa', nameEn: 'Souss-Massa', nameFr: 'Souss-Massa', level: 'ADMIN1', parentCode: 'MA', countryCode: 'MA', centroidLat: 30.28, centroidLng: -8.89 },
  { code: 'MA-10', name: 'Guelmim-Oued Noun', nameEn: 'Guelmim-Oued Noun', nameFr: 'Guelmim-Oued Noun', level: 'ADMIN1', parentCode: 'MA', countryCode: 'MA', centroidLat: 28.98, centroidLng: -10.06 },
  { code: 'MA-11', name: 'Laâyoune-Sakia El Hamra', nameEn: 'Laâyoune-Sakia El Hamra', nameFr: 'Laâyoune-Sakia El Hamra', level: 'ADMIN1', parentCode: 'MA', countryCode: 'MA', centroidLat: 26.84, centroidLng: -12.68 },
  { code: 'MA-12', name: 'Dakhla-Oued Ed-Dahab', nameEn: 'Dakhla-Oued Ed-Dahab', nameFr: 'Dakhla-Oued Ed-Dahab', level: 'ADMIN1', parentCode: 'MA', countryCode: 'MA', centroidLat: 23.72, centroidLng: -15.95 },

  // ── Mozambique (MZ) — 10 provinces ──
  { code: 'MZ-MPM', name: 'Maputo Cidade', nameEn: 'Maputo City', nameFr: 'Maputo Ville', level: 'ADMIN1', parentCode: 'MZ', countryCode: 'MZ', centroidLat: -25.97, centroidLng: 32.57 },
  { code: 'MZ-L', name: 'Maputo', nameEn: 'Maputo Province', nameFr: 'Maputo', level: 'ADMIN1', parentCode: 'MZ', countryCode: 'MZ', centroidLat: -26.07, centroidLng: 32.46 },
  { code: 'MZ-G', name: 'Gaza', nameEn: 'Gaza', nameFr: 'Gaza', level: 'ADMIN1', parentCode: 'MZ', countryCode: 'MZ', centroidLat: -23.04, centroidLng: 33.66 },
  { code: 'MZ-I', name: 'Inhambane', nameEn: 'Inhambane', nameFr: 'Inhambane', level: 'ADMIN1', parentCode: 'MZ', countryCode: 'MZ', centroidLat: -22.86, centroidLng: 35.10 },
  { code: 'MZ-B', name: 'Sofala', nameEn: 'Sofala', nameFr: 'Sofala', level: 'ADMIN1', parentCode: 'MZ', countryCode: 'MZ', centroidLat: -19.21, centroidLng: 34.86 },
  { code: 'MZ-S', name: 'Manica', nameEn: 'Manica', nameFr: 'Manica', level: 'ADMIN1', parentCode: 'MZ', countryCode: 'MZ', centroidLat: -19.51, centroidLng: 33.44 },
  { code: 'MZ-T', name: 'Tete', nameEn: 'Tete', nameFr: 'Tete', level: 'ADMIN1', parentCode: 'MZ', countryCode: 'MZ', centroidLat: -15.46, centroidLng: 33.59 },
  { code: 'MZ-Q', name: 'Zambezia', nameEn: 'Zambezia', nameFr: 'Zambézia', level: 'ADMIN1', parentCode: 'MZ', countryCode: 'MZ', centroidLat: -16.56, centroidLng: 36.97 },
  { code: 'MZ-N', name: 'Nampula', nameEn: 'Nampula', nameFr: 'Nampula', level: 'ADMIN1', parentCode: 'MZ', countryCode: 'MZ', centroidLat: -14.76, centroidLng: 39.25 },
  { code: 'MZ-P', name: 'Cabo Delgado', nameEn: 'Cabo Delgado', nameFr: 'Cabo Delgado', level: 'ADMIN1', parentCode: 'MZ', countryCode: 'MZ', centroidLat: -12.34, centroidLng: 39.85 },

  // ── Namibia (NA) — 8 regions ──
  { code: 'NA-KH', name: 'Khomas', nameEn: 'Khomas', nameFr: 'Khomas', level: 'ADMIN1', parentCode: 'NA', countryCode: 'NA', centroidLat: -22.57, centroidLng: 17.08 },
  { code: 'NA-ER', name: 'Erongo', nameEn: 'Erongo', nameFr: 'Erongo', level: 'ADMIN1', parentCode: 'NA', countryCode: 'NA', centroidLat: -22.26, centroidLng: 15.19 },
  { code: 'NA-OD', name: 'Oshana', nameEn: 'Oshana', nameFr: 'Oshana', level: 'ADMIN1', parentCode: 'NA', countryCode: 'NA', centroidLat: -18.49, centroidLng: 15.69 },
  { code: 'NA-OH', name: 'Ohangwena', nameEn: 'Ohangwena', nameFr: 'Ohangwena', level: 'ADMIN1', parentCode: 'NA', countryCode: 'NA', centroidLat: -17.68, centroidLng: 16.83 },
  { code: 'NA-ON', name: 'Oshikoto', nameEn: 'Oshikoto', nameFr: 'Oshikoto', level: 'ADMIN1', parentCode: 'NA', countryCode: 'NA', centroidLat: -18.79, centroidLng: 17.06 },
  { code: 'NA-OW', name: 'Omusati', nameEn: 'Omusati', nameFr: 'Omusati', level: 'ADMIN1', parentCode: 'NA', countryCode: 'NA', centroidLat: -18.41, centroidLng: 14.85 },
  { code: 'NA-KA', name: 'Kavango East', nameEn: 'Kavango East', nameFr: 'Kavango Est', level: 'ADMIN1', parentCode: 'NA', countryCode: 'NA', centroidLat: -18.50, centroidLng: 20.00 },
  { code: 'NA-HA', name: 'Hardap', nameEn: 'Hardap', nameFr: 'Hardap', level: 'ADMIN1', parentCode: 'NA', countryCode: 'NA', centroidLat: -24.23, centroidLng: 17.67 },

  // ── Niger (NE) — 8 regions ──
  { code: 'NE-8', name: 'Niamey', nameEn: 'Niamey', nameFr: 'Niamey', level: 'ADMIN1', parentCode: 'NE', countryCode: 'NE', centroidLat: 13.51, centroidLng: 2.11 },
  { code: 'NE-1', name: 'Agadez', nameEn: 'Agadez', nameFr: 'Agadez', level: 'ADMIN1', parentCode: 'NE', countryCode: 'NE', centroidLat: 19.16, centroidLng: 9.46 },
  { code: 'NE-2', name: 'Diffa', nameEn: 'Diffa', nameFr: 'Diffa', level: 'ADMIN1', parentCode: 'NE', countryCode: 'NE', centroidLat: 13.85, centroidLng: 12.61 },
  { code: 'NE-3', name: 'Dosso', nameEn: 'Dosso', nameFr: 'Dosso', level: 'ADMIN1', parentCode: 'NE', countryCode: 'NE', centroidLat: 12.83, centroidLng: 3.20 },
  { code: 'NE-4', name: 'Maradi', nameEn: 'Maradi', nameFr: 'Maradi', level: 'ADMIN1', parentCode: 'NE', countryCode: 'NE', centroidLat: 13.66, centroidLng: 7.10 },
  { code: 'NE-5', name: 'Tahoua', nameEn: 'Tahoua', nameFr: 'Tahoua', level: 'ADMIN1', parentCode: 'NE', countryCode: 'NE', centroidLat: 15.95, centroidLng: 5.27 },
  { code: 'NE-6', name: 'Tillabéri', nameEn: 'Tillabéri', nameFr: 'Tillabéri', level: 'ADMIN1', parentCode: 'NE', countryCode: 'NE', centroidLat: 14.21, centroidLng: 1.45 },
  { code: 'NE-7', name: 'Zinder', nameEn: 'Zinder', nameFr: 'Zinder', level: 'ADMIN1', parentCode: 'NE', countryCode: 'NE', centroidLat: 14.17, centroidLng: 9.00 },

  // ── Rwanda (RW) — 5 provinces ──
  { code: 'RW-01', name: 'Kigali', nameEn: 'City of Kigali', nameFr: 'Ville de Kigali', level: 'ADMIN1', parentCode: 'RW', countryCode: 'RW', centroidLat: -1.94, centroidLng: 30.06 },
  { code: 'RW-02', name: 'Est', nameEn: 'Eastern Province', nameFr: 'Province de l\'Est', level: 'ADMIN1', parentCode: 'RW', countryCode: 'RW', centroidLat: -1.78, centroidLng: 30.44 },
  { code: 'RW-03', name: 'Nord', nameEn: 'Northern Province', nameFr: 'Province du Nord', level: 'ADMIN1', parentCode: 'RW', countryCode: 'RW', centroidLat: -1.58, centroidLng: 29.88 },
  { code: 'RW-04', name: 'Ouest', nameEn: 'Western Province', nameFr: 'Province de l\'Ouest', level: 'ADMIN1', parentCode: 'RW', countryCode: 'RW', centroidLat: -2.17, centroidLng: 29.34 },
  { code: 'RW-05', name: 'Sud', nameEn: 'Southern Province', nameFr: 'Province du Sud', level: 'ADMIN1', parentCode: 'RW', countryCode: 'RW', centroidLat: -2.59, centroidLng: 29.74 },

  // ── São Tomé and Príncipe (ST) — 2 districts ──
  { code: 'ST-S', name: 'São Tomé', nameEn: 'São Tomé', nameFr: 'São Tomé', level: 'ADMIN1', parentCode: 'ST', countryCode: 'ST', centroidLat: 0.25, centroidLng: 6.61 },
  { code: 'ST-P', name: 'Príncipe', nameEn: 'Príncipe', nameFr: 'Príncipe', level: 'ADMIN1', parentCode: 'ST', countryCode: 'ST', centroidLat: 1.62, centroidLng: 7.41 },

  // ── Sahrawi Republic (EH) — 3 regions ──
  { code: 'EH-01', name: 'Oued Ed-Dahab', nameEn: 'Oued Ed-Dahab', nameFr: 'Oued Ed-Dahab', level: 'ADMIN1', parentCode: 'EH', countryCode: 'EH', centroidLat: 22.73, centroidLng: -14.33 },
  { code: 'EH-02', name: 'Saguia el-Hamra', nameEn: 'Saguia el-Hamra', nameFr: 'Saguia el-Hamra', level: 'ADMIN1', parentCode: 'EH', countryCode: 'EH', centroidLat: 26.16, centroidLng: -12.02 },
  { code: 'EH-03', name: 'Tiris Zemmour', nameEn: 'Tiris Zemmour', nameFr: 'Tiris Zemmour', level: 'ADMIN1', parentCode: 'EH', countryCode: 'EH', centroidLat: 24.58, centroidLng: -13.10 },

  // ── Seychelles (SC) — 3 key districts ──
  { code: 'SC-01', name: 'Victoria', nameEn: 'Victoria (English River)', nameFr: 'Victoria (English River)', level: 'ADMIN1', parentCode: 'SC', countryCode: 'SC', centroidLat: -4.62, centroidLng: 55.45 },
  { code: 'SC-02', name: 'Anse Royale', nameEn: 'Anse Royale', nameFr: 'Anse Royale', level: 'ADMIN1', parentCode: 'SC', countryCode: 'SC', centroidLat: -4.73, centroidLng: 55.52 },
  { code: 'SC-03', name: 'Baie Lazare', nameEn: 'Baie Lazare', nameFr: 'Baie Lazare', level: 'ADMIN1', parentCode: 'SC', countryCode: 'SC', centroidLat: -4.75, centroidLng: 55.48 },

  // ── Sierra Leone (SL) — 5 provinces ──
  { code: 'SL-W', name: 'Western Area', nameEn: 'Western Area', nameFr: 'Zone occidentale', level: 'ADMIN1', parentCode: 'SL', countryCode: 'SL', centroidLat: 8.47, centroidLng: -13.23 },
  { code: 'SL-N', name: 'Northern Province', nameEn: 'Northern Province', nameFr: 'Province du Nord', level: 'ADMIN1', parentCode: 'SL', countryCode: 'SL', centroidLat: 9.18, centroidLng: -11.90 },
  { code: 'SL-S', name: 'Southern Province', nameEn: 'Southern Province', nameFr: 'Province du Sud', level: 'ADMIN1', parentCode: 'SL', countryCode: 'SL', centroidLat: 7.56, centroidLng: -11.78 },
  { code: 'SL-E', name: 'Eastern Province', nameEn: 'Eastern Province', nameFr: 'Province de l\'Est', level: 'ADMIN1', parentCode: 'SL', countryCode: 'SL', centroidLat: 7.90, centroidLng: -11.04 },
  { code: 'SL-NW', name: 'North West Province', nameEn: 'North West Province', nameFr: 'Province du Nord-Ouest', level: 'ADMIN1', parentCode: 'SL', countryCode: 'SL', centroidLat: 9.05, centroidLng: -12.51 },

  // ── Somalia (SO) — 8 key regions ──
  { code: 'SO-BN', name: 'Banaadir', nameEn: 'Banaadir (Mogadishu)', nameFr: 'Banaadir (Mogadiscio)', level: 'ADMIN1', parentCode: 'SO', countryCode: 'SO', centroidLat: 2.05, centroidLng: 45.32 },
  { code: 'SO-BR', name: 'Bari', nameEn: 'Bari', nameFr: 'Bari', level: 'ADMIN1', parentCode: 'SO', countryCode: 'SO', centroidLat: 10.96, centroidLng: 50.37 },
  { code: 'SO-BY', name: 'Bay', nameEn: 'Bay', nameFr: 'Bay', level: 'ADMIN1', parentCode: 'SO', countryCode: 'SO', centroidLat: 2.33, centroidLng: 43.53 },
  { code: 'SO-GA', name: 'Galguduud', nameEn: 'Galguduud', nameFr: 'Galguduud', level: 'ADMIN1', parentCode: 'SO', countryCode: 'SO', centroidLat: 5.19, centroidLng: 46.82 },
  { code: 'SO-HI', name: 'Hiiraan', nameEn: 'Hiiraan', nameFr: 'Hiiraan', level: 'ADMIN1', parentCode: 'SO', countryCode: 'SO', centroidLat: 4.32, centroidLng: 45.30 },
  { code: 'SO-JH', name: 'Jubbada Hoose', nameEn: 'Lower Juba', nameFr: 'Juba inférieur', level: 'ADMIN1', parentCode: 'SO', countryCode: 'SO', centroidLat: 0.22, centroidLng: 41.77 },
  { code: 'SO-NU', name: 'Nugaal', nameEn: 'Nugaal', nameFr: 'Nugaal', level: 'ADMIN1', parentCode: 'SO', countryCode: 'SO', centroidLat: 8.36, centroidLng: 49.18 },
  { code: 'SO-WO', name: 'Woqooyi Galbeed', nameEn: 'Woqooyi Galbeed', nameFr: 'Woqooyi Galbeed', level: 'ADMIN1', parentCode: 'SO', countryCode: 'SO', centroidLat: 9.77, centroidLng: 44.06 },

  // ── South Sudan (SS) — 10 states ──
  { code: 'SS-CE', name: 'Central Equatoria', nameEn: 'Central Equatoria', nameFr: 'Équatoria-Central', level: 'ADMIN1', parentCode: 'SS', countryCode: 'SS', centroidLat: 4.61, centroidLng: 31.61 },
  { code: 'SS-EE', name: 'Eastern Equatoria', nameEn: 'Eastern Equatoria', nameFr: 'Équatoria-Oriental', level: 'ADMIN1', parentCode: 'SS', countryCode: 'SS', centroidLat: 4.22, centroidLng: 33.23 },
  { code: 'SS-JG', name: 'Jonglei', nameEn: 'Jonglei', nameFr: 'Jonglei', level: 'ADMIN1', parentCode: 'SS', countryCode: 'SS', centroidLat: 7.18, centroidLng: 32.36 },
  { code: 'SS-LK', name: 'Lakes', nameEn: 'Lakes', nameFr: 'Lacs', level: 'ADMIN1', parentCode: 'SS', countryCode: 'SS', centroidLat: 6.80, centroidLng: 30.20 },
  { code: 'SS-BN', name: 'Northern Bahr el Ghazal', nameEn: 'Northern Bahr el Ghazal', nameFr: 'Bahr el-Ghazal du Nord', level: 'ADMIN1', parentCode: 'SS', countryCode: 'SS', centroidLat: 8.53, centroidLng: 28.40 },
  { code: 'SS-UY', name: 'Unity', nameEn: 'Unity', nameFr: 'Unité', level: 'ADMIN1', parentCode: 'SS', countryCode: 'SS', centroidLat: 8.24, centroidLng: 30.11 },
  { code: 'SS-NU', name: 'Upper Nile', nameEn: 'Upper Nile', nameFr: 'Haut-Nil', level: 'ADMIN1', parentCode: 'SS', countryCode: 'SS', centroidLat: 9.88, centroidLng: 32.08 },
  { code: 'SS-WR', name: 'Warrap', nameEn: 'Warrap', nameFr: 'Warrap', level: 'ADMIN1', parentCode: 'SS', countryCode: 'SS', centroidLat: 7.72, centroidLng: 28.65 },
  { code: 'SS-BW', name: 'Western Bahr el Ghazal', nameEn: 'Western Bahr el Ghazal', nameFr: 'Bahr el-Ghazal occidental', level: 'ADMIN1', parentCode: 'SS', countryCode: 'SS', centroidLat: 8.47, centroidLng: 25.30 },
  { code: 'SS-EW', name: 'Western Equatoria', nameEn: 'Western Equatoria', nameFr: 'Équatoria-Occidental', level: 'ADMIN1', parentCode: 'SS', countryCode: 'SS', centroidLat: 4.87, centroidLng: 28.67 },

  // ── Sudan (SD) — 10 key states ──
  { code: 'SD-KH', name: 'Khartoum', nameEn: 'Khartoum', nameFr: 'Khartoum', level: 'ADMIN1', parentCode: 'SD', countryCode: 'SD', centroidLat: 15.59, centroidLng: 32.53 },
  { code: 'SD-GZ', name: 'Al Jazirah', nameEn: 'Al Jazirah', nameFr: 'Al-Jazira', level: 'ADMIN1', parentCode: 'SD', countryCode: 'SD', centroidLat: 14.53, centroidLng: 33.35 },
  { code: 'SD-NO', name: 'Northern', nameEn: 'Northern', nameFr: 'Nord', level: 'ADMIN1', parentCode: 'SD', countryCode: 'SD', centroidLat: 19.59, centroidLng: 30.49 },
  { code: 'SD-DW', name: 'West Darfur', nameEn: 'West Darfur', nameFr: 'Darfour occidental', level: 'ADMIN1', parentCode: 'SD', countryCode: 'SD', centroidLat: 12.84, centroidLng: 23.00 },
  { code: 'SD-DS', name: 'South Darfur', nameEn: 'South Darfur', nameFr: 'Darfour méridional', level: 'ADMIN1', parentCode: 'SD', countryCode: 'SD', centroidLat: 11.15, centroidLng: 25.18 },
  { code: 'SD-DN', name: 'North Darfur', nameEn: 'North Darfur', nameFr: 'Darfour septentrional', level: 'ADMIN1', parentCode: 'SD', countryCode: 'SD', centroidLat: 15.77, centroidLng: 24.91 },
  { code: 'SD-KS', name: 'South Kordofan', nameEn: 'South Kordofan', nameFr: 'Kordofan du Sud', level: 'ADMIN1', parentCode: 'SD', countryCode: 'SD', centroidLat: 11.20, centroidLng: 29.42 },
  { code: 'SD-KN', name: 'North Kordofan', nameEn: 'North Kordofan', nameFr: 'Kordofan du Nord', level: 'ADMIN1', parentCode: 'SD', countryCode: 'SD', centroidLat: 13.83, centroidLng: 29.42 },
  { code: 'SD-RS', name: 'Red Sea', nameEn: 'Red Sea', nameFr: 'Mer Rouge', level: 'ADMIN1', parentCode: 'SD', countryCode: 'SD', centroidLat: 19.64, centroidLng: 36.55 },
  { code: 'SD-GD', name: 'Gedaref', nameEn: 'Gedaref', nameFr: 'Gedaref', level: 'ADMIN1', parentCode: 'SD', countryCode: 'SD', centroidLat: 14.02, centroidLng: 35.38 },

  // ── Togo (TG) — 5 regions ──
  { code: 'TG-M', name: 'Maritime', nameEn: 'Maritime', nameFr: 'Maritime', level: 'ADMIN1', parentCode: 'TG', countryCode: 'TG', centroidLat: 6.33, centroidLng: 1.33 },
  { code: 'TG-P', name: 'Plateaux', nameEn: 'Plateaux', nameFr: 'Plateaux', level: 'ADMIN1', parentCode: 'TG', countryCode: 'TG', centroidLat: 7.20, centroidLng: 1.10 },
  { code: 'TG-C', name: 'Centrale', nameEn: 'Centrale', nameFr: 'Centrale', level: 'ADMIN1', parentCode: 'TG', countryCode: 'TG', centroidLat: 8.67, centroidLng: 1.05 },
  { code: 'TG-K', name: 'Kara', nameEn: 'Kara', nameFr: 'Kara', level: 'ADMIN1', parentCode: 'TG', countryCode: 'TG', centroidLat: 9.55, centroidLng: 1.00 },
  { code: 'TG-S', name: 'Savanes', nameEn: 'Savanes', nameFr: 'Savanes', level: 'ADMIN1', parentCode: 'TG', countryCode: 'TG', centroidLat: 10.40, centroidLng: 0.30 },

  // ── Tunisia (TN) — 10 governorates ──
  { code: 'TN-11', name: 'Tunis', nameEn: 'Tunis', nameFr: 'Tunis', level: 'ADMIN1', parentCode: 'TN', countryCode: 'TN', centroidLat: 36.80, centroidLng: 10.18 },
  { code: 'TN-12', name: "L'Ariana", nameEn: 'Ariana', nameFr: "L'Ariana", level: 'ADMIN1', parentCode: 'TN', countryCode: 'TN', centroidLat: 36.87, centroidLng: 10.16 },
  { code: 'TN-13', name: 'Ben Arous', nameEn: 'Ben Arous', nameFr: 'Ben Arous', level: 'ADMIN1', parentCode: 'TN', countryCode: 'TN', centroidLat: 36.75, centroidLng: 10.22 },
  { code: 'TN-31', name: 'Béja', nameEn: 'Béja', nameFr: 'Béja', level: 'ADMIN1', parentCode: 'TN', countryCode: 'TN', centroidLat: 36.73, centroidLng: 9.18 },
  { code: 'TN-34', name: 'Siliana', nameEn: 'Siliana', nameFr: 'Siliana', level: 'ADMIN1', parentCode: 'TN', countryCode: 'TN', centroidLat: 36.08, centroidLng: 9.37 },
  { code: 'TN-41', name: 'Kairouan', nameEn: 'Kairouan', nameFr: 'Kairouan', level: 'ADMIN1', parentCode: 'TN', countryCode: 'TN', centroidLat: 35.68, centroidLng: 10.10 },
  { code: 'TN-51', name: 'Sousse', nameEn: 'Sousse', nameFr: 'Sousse', level: 'ADMIN1', parentCode: 'TN', countryCode: 'TN', centroidLat: 35.83, centroidLng: 10.64 },
  { code: 'TN-61', name: 'Sfax', nameEn: 'Sfax', nameFr: 'Sfax', level: 'ADMIN1', parentCode: 'TN', countryCode: 'TN', centroidLat: 34.74, centroidLng: 10.76 },
  { code: 'TN-81', name: 'Gabès', nameEn: 'Gabès', nameFr: 'Gabès', level: 'ADMIN1', parentCode: 'TN', countryCode: 'TN', centroidLat: 33.88, centroidLng: 10.10 },
  { code: 'TN-82', name: 'Médenine', nameEn: 'Médenine', nameFr: 'Médenine', level: 'ADMIN1', parentCode: 'TN', countryCode: 'TN', centroidLat: 33.35, centroidLng: 10.50 },

  // ── Uganda (UG) — 8 key regions ──
  { code: 'UG-C', name: 'Central Region', nameEn: 'Central Region', nameFr: 'Région centrale', level: 'ADMIN1', parentCode: 'UG', countryCode: 'UG', centroidLat: 0.56, centroidLng: 32.44 },
  { code: 'UG-E', name: 'Eastern Region', nameEn: 'Eastern Region', nameFr: 'Région de l\'Est', level: 'ADMIN1', parentCode: 'UG', countryCode: 'UG', centroidLat: 1.58, centroidLng: 33.93 },
  { code: 'UG-N', name: 'Northern Region', nameEn: 'Northern Region', nameFr: 'Région du Nord', level: 'ADMIN1', parentCode: 'UG', countryCode: 'UG', centroidLat: 3.14, centroidLng: 32.44 },
  { code: 'UG-W', name: 'Western Region', nameEn: 'Western Region', nameFr: 'Région de l\'Ouest', level: 'ADMIN1', parentCode: 'UG', countryCode: 'UG', centroidLat: 0.46, centroidLng: 30.44 },
  { code: 'UG-102', name: 'Kampala', nameEn: 'Kampala', nameFr: 'Kampala', level: 'ADMIN1', parentCode: 'UG', countryCode: 'UG', centroidLat: 0.35, centroidLng: 32.58 },
  { code: 'UG-302', name: 'Gulu', nameEn: 'Gulu', nameFr: 'Gulu', level: 'ADMIN1', parentCode: 'UG', countryCode: 'UG', centroidLat: 2.77, centroidLng: 32.30 },
  { code: 'UG-211', name: 'Jinja', nameEn: 'Jinja', nameFr: 'Jinja', level: 'ADMIN1', parentCode: 'UG', countryCode: 'UG', centroidLat: 0.44, centroidLng: 33.20 },
  { code: 'UG-401', name: 'Fort Portal', nameEn: 'Fort Portal', nameFr: 'Fort Portal', level: 'ADMIN1', parentCode: 'UG', countryCode: 'UG', centroidLat: 0.66, centroidLng: 30.27 },

  // ── Zambia (ZM) — 10 provinces ──
  { code: 'ZM-01', name: 'Central', nameEn: 'Central Province', nameFr: 'Province centrale', level: 'ADMIN1', parentCode: 'ZM', countryCode: 'ZM', centroidLat: -14.05, centroidLng: 28.73 },
  { code: 'ZM-02', name: 'Copperbelt', nameEn: 'Copperbelt Province', nameFr: 'Province du Copperbelt', level: 'ADMIN1', parentCode: 'ZM', countryCode: 'ZM', centroidLat: -12.80, centroidLng: 28.24 },
  { code: 'ZM-03', name: 'Eastern', nameEn: 'Eastern Province', nameFr: 'Province de l\'Est', level: 'ADMIN1', parentCode: 'ZM', countryCode: 'ZM', centroidLat: -13.00, centroidLng: 31.95 },
  { code: 'ZM-04', name: 'Luapula', nameEn: 'Luapula Province', nameFr: 'Province de Luapula', level: 'ADMIN1', parentCode: 'ZM', countryCode: 'ZM', centroidLat: -11.56, centroidLng: 29.01 },
  { code: 'ZM-09', name: 'Lusaka', nameEn: 'Lusaka Province', nameFr: 'Province de Lusaka', level: 'ADMIN1', parentCode: 'ZM', countryCode: 'ZM', centroidLat: -15.39, centroidLng: 28.32 },
  { code: 'ZM-05', name: 'Northern', nameEn: 'Northern Province', nameFr: 'Province du Nord', level: 'ADMIN1', parentCode: 'ZM', countryCode: 'ZM', centroidLat: -10.28, centroidLng: 30.66 },
  { code: 'ZM-06', name: 'North-Western', nameEn: 'North-Western Province', nameFr: 'Province du Nord-Ouest', level: 'ADMIN1', parentCode: 'ZM', countryCode: 'ZM', centroidLat: -12.17, centroidLng: 25.82 },
  { code: 'ZM-07', name: 'Southern', nameEn: 'Southern Province', nameFr: 'Province du Sud', level: 'ADMIN1', parentCode: 'ZM', countryCode: 'ZM', centroidLat: -16.50, centroidLng: 26.00 },
  { code: 'ZM-08', name: 'Western', nameEn: 'Western Province', nameFr: 'Province de l\'Ouest', level: 'ADMIN1', parentCode: 'ZM', countryCode: 'ZM', centroidLat: -15.42, centroidLng: 23.48 },
  { code: 'ZM-10', name: 'Muchinga', nameEn: 'Muchinga Province', nameFr: 'Province de Muchinga', level: 'ADMIN1', parentCode: 'ZM', countryCode: 'ZM', centroidLat: -11.53, centroidLng: 31.33 },

  // ── Zimbabwe (ZW) — 10 provinces ──
  { code: 'ZW-HA', name: 'Harare', nameEn: 'Harare', nameFr: 'Harare', level: 'ADMIN1', parentCode: 'ZW', countryCode: 'ZW', centroidLat: -17.83, centroidLng: 31.05 },
  { code: 'ZW-BU', name: 'Bulawayo', nameEn: 'Bulawayo', nameFr: 'Bulawayo', level: 'ADMIN1', parentCode: 'ZW', countryCode: 'ZW', centroidLat: -20.15, centroidLng: 28.58 },
  { code: 'ZW-MA', name: 'Manicaland', nameEn: 'Manicaland', nameFr: 'Manicaland', level: 'ADMIN1', parentCode: 'ZW', countryCode: 'ZW', centroidLat: -19.08, centroidLng: 32.50 },
  { code: 'ZW-MC', name: 'Mashonaland Central', nameEn: 'Mashonaland Central', nameFr: 'Mashonaland Central', level: 'ADMIN1', parentCode: 'ZW', countryCode: 'ZW', centroidLat: -16.76, centroidLng: 31.08 },
  { code: 'ZW-ME', name: 'Mashonaland East', nameEn: 'Mashonaland East', nameFr: 'Mashonaland Est', level: 'ADMIN1', parentCode: 'ZW', countryCode: 'ZW', centroidLat: -18.00, centroidLng: 31.58 },
  { code: 'ZW-MW', name: 'Mashonaland West', nameEn: 'Mashonaland West', nameFr: 'Mashonaland Ouest', level: 'ADMIN1', parentCode: 'ZW', countryCode: 'ZW', centroidLat: -17.48, centroidLng: 29.60 },
  { code: 'ZW-MV', name: 'Masvingo', nameEn: 'Masvingo', nameFr: 'Masvingo', level: 'ADMIN1', parentCode: 'ZW', countryCode: 'ZW', centroidLat: -20.67, centroidLng: 30.83 },
  { code: 'ZW-MN', name: 'Matabeleland North', nameEn: 'Matabeleland North', nameFr: 'Matabeleland Nord', level: 'ADMIN1', parentCode: 'ZW', countryCode: 'ZW', centroidLat: -19.08, centroidLng: 27.92 },
  { code: 'ZW-MS', name: 'Matabeleland South', nameEn: 'Matabeleland South', nameFr: 'Matabeleland Sud', level: 'ADMIN1', parentCode: 'ZW', countryCode: 'ZW', centroidLat: -21.42, centroidLng: 29.25 },
  { code: 'ZW-MI', name: 'Midlands', nameEn: 'Midlands', nameFr: 'Midlands', level: 'ADMIN1', parentCode: 'ZW', countryCode: 'ZW', centroidLat: -19.42, centroidLng: 29.83 },
];
