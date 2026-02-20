// ADMIN2 seed data for 5 pilot countries:
// Kenya (47 counties), Ethiopia (~40 zones/woredas), Senegal (45 departments),
// Nigeria (~40 LGAs), Tanzania (~30 districts)
//
// Total: ~202 entries

import type { GeoSeed } from './geo-seed-data';

export const ADMIN2_SEEDS: GeoSeed[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // KENYA (KE) — 47 Counties (all 47)
  // Counties are the primary sub-national unit since the 2010 Constitution.
  // parentCode = 'KE' (country level, since counties report directly)
  // ISO 3166-2:KE codes used where available
  // ═══════════════════════════════════════════════════════════════════════════

  // -- Coast Region --
  { code: 'KE-01', name: 'Mombasa', nameEn: 'Mombasa', nameFr: 'Mombasa', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -4.05, centroidLng: 39.67 },
  { code: 'KE-02', name: 'Kwale', nameEn: 'Kwale', nameFr: 'Kwale', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -4.17, centroidLng: 39.45 },
  { code: 'KE-03', name: 'Kilifi', nameEn: 'Kilifi', nameFr: 'Kilifi', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -3.51, centroidLng: 39.91 },
  { code: 'KE-04', name: 'Tana River', nameEn: 'Tana River', nameFr: 'Tana River', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -1.75, centroidLng: 39.65 },
  { code: 'KE-05', name: 'Lamu', nameEn: 'Lamu', nameFr: 'Lamu', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -2.27, centroidLng: 40.90 },
  { code: 'KE-06', name: 'Taita-Taveta', nameEn: 'Taita-Taveta', nameFr: 'Taita-Taveta', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -3.40, centroidLng: 38.35 },

  // -- North Eastern Region --
  { code: 'KE-07', name: 'Garissa', nameEn: 'Garissa', nameFr: 'Garissa', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.45, centroidLng: 39.65 },
  { code: 'KE-08', name: 'Wajir', nameEn: 'Wajir', nameFr: 'Wajir', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 1.75, centroidLng: 40.07 },
  { code: 'KE-09', name: 'Mandera', nameEn: 'Mandera', nameFr: 'Mandera', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 3.37, centroidLng: 40.96 },

  // -- Eastern Region --
  { code: 'KE-10', name: 'Marsabit', nameEn: 'Marsabit', nameFr: 'Marsabit', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 2.33, centroidLng: 37.99 },
  { code: 'KE-11', name: 'Isiolo', nameEn: 'Isiolo', nameFr: 'Isiolo', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 0.35, centroidLng: 38.48 },
  { code: 'KE-12', name: 'Meru', nameEn: 'Meru', nameFr: 'Meru', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 0.05, centroidLng: 37.65 },
  { code: 'KE-13', name: 'Tharaka-Nithi', nameEn: 'Tharaka-Nithi', nameFr: 'Tharaka-Nithi', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.30, centroidLng: 37.85 },
  { code: 'KE-14', name: 'Embu', nameEn: 'Embu', nameFr: 'Embu', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.53, centroidLng: 37.46 },
  { code: 'KE-15', name: 'Kitui', nameEn: 'Kitui', nameFr: 'Kitui', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -1.37, centroidLng: 38.01 },
  { code: 'KE-16', name: 'Machakos', nameEn: 'Machakos', nameFr: 'Machakos', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -1.52, centroidLng: 37.26 },
  { code: 'KE-17', name: 'Makueni', nameEn: 'Makueni', nameFr: 'Makueni', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -2.25, centroidLng: 37.62 },

  // -- Central Region --
  { code: 'KE-18', name: 'Nyandarua', nameEn: 'Nyandarua', nameFr: 'Nyandarua', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.18, centroidLng: 36.52 },
  { code: 'KE-19', name: 'Nyeri', nameEn: 'Nyeri', nameFr: 'Nyeri', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.42, centroidLng: 36.95 },
  { code: 'KE-20', name: 'Kirinyaga', nameEn: 'Kirinyaga', nameFr: 'Kirinyaga', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.53, centroidLng: 37.28 },
  { code: 'KE-21', name: 'Murang\'a', nameEn: 'Murang\'a', nameFr: 'Murang\'a', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.72, centroidLng: 37.15 },
  { code: 'KE-22', name: 'Kiambu', nameEn: 'Kiambu', nameFr: 'Kiambu', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -1.17, centroidLng: 36.83 },

  // -- Rift Valley Region --
  { code: 'KE-23', name: 'Turkana', nameEn: 'Turkana', nameFr: 'Turkana', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 3.12, centroidLng: 35.60 },
  { code: 'KE-24', name: 'West Pokot', nameEn: 'West Pokot', nameFr: 'West Pokot', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 1.62, centroidLng: 35.12 },
  { code: 'KE-25', name: 'Samburu', nameEn: 'Samburu', nameFr: 'Samburu', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 1.17, centroidLng: 36.95 },
  { code: 'KE-26', name: 'Trans-Nzoia', nameEn: 'Trans-Nzoia', nameFr: 'Trans-Nzoia', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 1.06, centroidLng: 34.95 },
  { code: 'KE-27', name: 'Uasin Gishu', nameEn: 'Uasin Gishu', nameFr: 'Uasin Gishu', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 0.55, centroidLng: 35.30 },
  { code: 'KE-28', name: 'Elgeyo-Marakwet', nameEn: 'Elgeyo-Marakwet', nameFr: 'Elgeyo-Marakwet', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 0.82, centroidLng: 35.52 },
  { code: 'KE-29', name: 'Nandi', nameEn: 'Nandi', nameFr: 'Nandi', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 0.18, centroidLng: 35.18 },
  { code: 'KE-30', name: 'Baringo', nameEn: 'Baringo', nameFr: 'Baringo', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 0.67, centroidLng: 35.97 },
  { code: 'KE-31', name: 'Laikipia', nameEn: 'Laikipia', nameFr: 'Laikipia', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 0.18, centroidLng: 36.78 },
  { code: 'KE-32', name: 'Nakuru', nameEn: 'Nakuru', nameFr: 'Nakuru', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.30, centroidLng: 36.08 },
  { code: 'KE-33', name: 'Narok', nameEn: 'Narok', nameFr: 'Narok', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -1.50, centroidLng: 35.87 },
  { code: 'KE-34', name: 'Kajiado', nameEn: 'Kajiado', nameFr: 'Kajiado', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -2.10, centroidLng: 36.78 },
  { code: 'KE-35', name: 'Kericho', nameEn: 'Kericho', nameFr: 'Kericho', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.37, centroidLng: 35.28 },
  { code: 'KE-36', name: 'Bomet', nameEn: 'Bomet', nameFr: 'Bomet', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.78, centroidLng: 35.35 },

  // -- Western Region --
  { code: 'KE-37', name: 'Kakamega', nameEn: 'Kakamega', nameFr: 'Kakamega', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 0.28, centroidLng: 34.75 },
  { code: 'KE-38', name: 'Vihiga', nameEn: 'Vihiga', nameFr: 'Vihiga', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 0.07, centroidLng: 34.72 },
  { code: 'KE-39', name: 'Bungoma', nameEn: 'Bungoma', nameFr: 'Bungoma', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 0.57, centroidLng: 34.56 },
  { code: 'KE-40', name: 'Busia', nameEn: 'Busia', nameFr: 'Busia', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: 0.43, centroidLng: 34.11 },

  // -- Nyanza Region --
  { code: 'KE-41', name: 'Siaya', nameEn: 'Siaya', nameFr: 'Siaya', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.06, centroidLng: 34.29 },
  { code: 'KE-42', name: 'Kisumu', nameEn: 'Kisumu', nameFr: 'Kisumu', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.09, centroidLng: 34.77 },
  { code: 'KE-43', name: 'Homa Bay', nameEn: 'Homa Bay', nameFr: 'Homa Bay', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.52, centroidLng: 34.46 },
  { code: 'KE-44', name: 'Migori', nameEn: 'Migori', nameFr: 'Migori', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -1.06, centroidLng: 34.47 },
  { code: 'KE-45', name: 'Kisii', nameEn: 'Kisii', nameFr: 'Kisii', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.68, centroidLng: 34.78 },
  { code: 'KE-46', name: 'Nyamira', nameEn: 'Nyamira', nameFr: 'Nyamira', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -0.57, centroidLng: 34.93 },

  // -- Nairobi --
  { code: 'KE-47', name: 'Nairobi', nameEn: 'Nairobi City', nameFr: 'Nairobi', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'KE', countryCode: 'KE', centroidLat: -1.29, centroidLng: 36.82 },

  // ═══════════════════════════════════════════════════════════════════════════
  // ETHIOPIA (ET) — ~40 key zones/woredas across major regions
  // parentCode references ADMIN1 region codes (ET-AA, ET-OR, ET-AM, etc.)
  // ═══════════════════════════════════════════════════════════════════════════

  // -- Addis Ababa (ET-AA) — 10 Sub-Cities --
  { code: 'ET-AA-01', name: 'Arada', nameEn: 'Arada', nameFr: 'Arada', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AA', countryCode: 'ET', centroidLat: 9.03, centroidLng: 38.75 },
  { code: 'ET-AA-02', name: 'Addis Ketema', nameEn: 'Addis Ketema', nameFr: 'Addis Ketema', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AA', countryCode: 'ET', centroidLat: 9.02, centroidLng: 38.73 },
  { code: 'ET-AA-03', name: 'Bole', nameEn: 'Bole', nameFr: 'Bole', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AA', countryCode: 'ET', centroidLat: 8.99, centroidLng: 38.80 },
  { code: 'ET-AA-04', name: 'Yeka', nameEn: 'Yeka', nameFr: 'Yeka', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AA', countryCode: 'ET', centroidLat: 9.04, centroidLng: 38.80 },
  { code: 'ET-AA-05', name: 'Kirkos', nameEn: 'Kirkos', nameFr: 'Kirkos', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AA', countryCode: 'ET', centroidLat: 9.01, centroidLng: 38.76 },
  { code: 'ET-AA-06', name: 'Lideta', nameEn: 'Lideta', nameFr: 'Lideta', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AA', countryCode: 'ET', centroidLat: 9.01, centroidLng: 38.72 },
  { code: 'ET-AA-07', name: 'Kolfe Keranio', nameEn: 'Kolfe Keranio', nameFr: 'Kolfe Keranio', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AA', countryCode: 'ET', centroidLat: 9.00, centroidLng: 38.69 },
  { code: 'ET-AA-08', name: 'Gulele', nameEn: 'Gulele', nameFr: 'Gulele', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AA', countryCode: 'ET', centroidLat: 9.07, centroidLng: 38.74 },
  { code: 'ET-AA-09', name: 'Nifas Silk-Lafto', nameEn: 'Nifas Silk-Lafto', nameFr: 'Nifas Silk-Lafto', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AA', countryCode: 'ET', centroidLat: 8.96, centroidLng: 38.74 },
  { code: 'ET-AA-10', name: 'Akaky Kaliti', nameEn: 'Akaky Kaliti', nameFr: 'Akaky Kaliti', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AA', countryCode: 'ET', centroidLat: 8.91, centroidLng: 38.78 },

  // -- Oromia (ET-OR) — 8 key zones --
  { code: 'ET-OR-ADAMA', name: 'East Shewa', nameEn: 'East Shewa Zone', nameFr: 'Zone du Shewa oriental', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-OR', countryCode: 'ET', centroidLat: 8.54, centroidLng: 39.27 },
  { code: 'ET-OR-JIMMA', name: 'Jimma', nameEn: 'Jimma Zone', nameFr: 'Zone de Jimma', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-OR', countryCode: 'ET', centroidLat: 7.67, centroidLng: 36.83 },
  { code: 'ET-OR-WSHEW', name: 'West Shewa', nameEn: 'West Shewa Zone', nameFr: 'Zone du Shewa occidental', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-OR', countryCode: 'ET', centroidLat: 9.07, centroidLng: 38.12 },
  { code: 'ET-OR-ARSI', name: 'Arsi', nameEn: 'Arsi Zone', nameFr: 'Zone d\'Arsi', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-OR', countryCode: 'ET', centroidLat: 7.77, centroidLng: 39.60 },
  { code: 'ET-OR-BALE', name: 'Bale', nameEn: 'Bale Zone', nameFr: 'Zone de Bale', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-OR', countryCode: 'ET', centroidLat: 6.76, centroidLng: 40.00 },
  { code: 'ET-OR-BORENA', name: 'Borena', nameEn: 'Borena Zone', nameFr: 'Zone de Borena', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-OR', countryCode: 'ET', centroidLat: 4.63, centroidLng: 38.17 },
  { code: 'ET-OR-WELLEGA', name: 'East Wellega', nameEn: 'East Wellega Zone', nameFr: 'Zone du Wellega oriental', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-OR', countryCode: 'ET', centroidLat: 9.17, centroidLng: 36.60 },
  { code: 'ET-OR-HARARGHE', name: 'East Hararghe', nameEn: 'East Hararghe Zone', nameFr: 'Zone du Hararghe oriental', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-OR', countryCode: 'ET', centroidLat: 9.00, centroidLng: 42.10 },

  // -- Amhara (ET-AM) — 6 key zones --
  { code: 'ET-AM-BAHIRDAR', name: 'West Gojjam', nameEn: 'West Gojjam Zone', nameFr: 'Zone du Gojjam occidental', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AM', countryCode: 'ET', centroidLat: 10.99, centroidLng: 37.39 },
  { code: 'ET-AM-DESSIE', name: 'South Wollo', nameEn: 'South Wollo Zone', nameFr: 'Zone du Wollo du sud', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AM', countryCode: 'ET', centroidLat: 11.13, centroidLng: 39.63 },
  { code: 'ET-AM-GONDOR', name: 'North Gondar', nameEn: 'North Gondar Zone', nameFr: 'Zone du Gondar nord', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AM', countryCode: 'ET', centroidLat: 12.60, centroidLng: 37.47 },
  { code: 'ET-AM-EGOJJAM', name: 'East Gojjam', nameEn: 'East Gojjam Zone', nameFr: 'Zone du Gojjam oriental', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AM', countryCode: 'ET', centroidLat: 10.33, centroidLng: 38.20 },
  { code: 'ET-AM-NWOLLO', name: 'North Wollo', nameEn: 'North Wollo Zone', nameFr: 'Zone du Wollo nord', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AM', countryCode: 'ET', centroidLat: 12.00, centroidLng: 39.67 },
  { code: 'ET-AM-NSHEWA', name: 'North Shewa', nameEn: 'North Shewa Zone (Amhara)', nameFr: 'Zone du Shewa du nord (Amhara)', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AM', countryCode: 'ET', centroidLat: 9.97, centroidLng: 39.50 },

  // -- Tigray (ET-TI) — 4 key zones --
  { code: 'ET-TI-MEKELLE', name: 'Southern Tigray', nameEn: 'Southern Tigray Zone', nameFr: 'Zone sud du Tigray', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-TI', countryCode: 'ET', centroidLat: 13.17, centroidLng: 39.17 },
  { code: 'ET-TI-CENTRAL', name: 'Central Tigray', nameEn: 'Central Tigray Zone', nameFr: 'Zone centrale du Tigray', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-TI', countryCode: 'ET', centroidLat: 13.70, centroidLng: 38.82 },
  { code: 'ET-TI-EAST', name: 'Eastern Tigray', nameEn: 'Eastern Tigray Zone', nameFr: 'Zone est du Tigray', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-TI', countryCode: 'ET', centroidLat: 13.90, centroidLng: 39.50 },
  { code: 'ET-TI-WEST', name: 'Western Tigray', nameEn: 'Western Tigray Zone', nameFr: 'Zone ouest du Tigray', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-TI', countryCode: 'ET', centroidLat: 14.05, centroidLng: 37.78 },

  // -- SNNPR (ET-SN) — 5 key zones --
  { code: 'ET-SN-HAWASSA', name: 'Sidama', nameEn: 'Sidama Zone', nameFr: 'Zone de Sidama', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-SN', countryCode: 'ET', centroidLat: 6.87, centroidLng: 38.47 },
  { code: 'ET-SN-GURAGE', name: 'Gurage', nameEn: 'Gurage Zone', nameFr: 'Zone de Gurage', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-SN', countryCode: 'ET', centroidLat: 8.12, centroidLng: 37.97 },
  { code: 'ET-SN-WOLAYITA', name: 'Wolayita', nameEn: 'Wolayita Zone', nameFr: 'Zone de Wolayita', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-SN', countryCode: 'ET', centroidLat: 6.87, centroidLng: 37.77 },
  { code: 'ET-SN-HADIYA', name: 'Hadiya', nameEn: 'Hadiya Zone', nameFr: 'Zone de Hadiya', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-SN', countryCode: 'ET', centroidLat: 7.47, centroidLng: 37.82 },
  { code: 'ET-SN-KAMBATA', name: 'Kembata Tembaro', nameEn: 'Kembata Tembaro Zone', nameFr: 'Zone de Kembata Tembaro', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-SN', countryCode: 'ET', centroidLat: 7.27, centroidLng: 37.87 },

  // -- Somali (ET-SO) — 3 key zones --
  { code: 'ET-SO-JIGJIGA', name: 'Fafan', nameEn: 'Fafan Zone', nameFr: 'Zone de Fafan', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-SO', countryCode: 'ET', centroidLat: 9.35, centroidLng: 42.80 },
  { code: 'ET-SO-LIBEN', name: 'Liben', nameEn: 'Liben Zone', nameFr: 'Zone de Liben', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-SO', countryCode: 'ET', centroidLat: 5.28, centroidLng: 40.52 },
  { code: 'ET-SO-SHINILE', name: 'Shinile', nameEn: 'Shinile Zone', nameFr: 'Zone de Shinile', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-SO', countryCode: 'ET', centroidLat: 10.03, centroidLng: 41.83 },

  // -- Afar (ET-AF) — 2 key zones --
  { code: 'ET-AF-ZONE1', name: 'Afar Zone 1', nameEn: 'Afar Zone 1 (Awsi Rasu)', nameFr: 'Afar Zone 1 (Awsi Rasu)', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AF', countryCode: 'ET', centroidLat: 11.60, centroidLng: 41.00 },
  { code: 'ET-AF-ZONE3', name: 'Afar Zone 3', nameEn: 'Afar Zone 3 (Gabi Rasu)', nameFr: 'Afar Zone 3 (Gabi Rasu)', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-AF', countryCode: 'ET', centroidLat: 10.17, centroidLng: 40.67 },

  // -- Gambela (ET-GA) — 1 key zone --
  { code: 'ET-GA-ANYWAA', name: 'Anywaa', nameEn: 'Anywaa Zone', nameFr: 'Zone d\'Anywaa', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-GA', countryCode: 'ET', centroidLat: 7.93, centroidLng: 34.20 },

  // -- Dire Dawa (ET-DD) — 1 entry --
  { code: 'ET-DD-URBAN', name: 'Dire Dawa Urban', nameEn: 'Dire Dawa Urban', nameFr: 'Dire Dawa Urbain', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'ET-DD', countryCode: 'ET', centroidLat: 9.60, centroidLng: 41.85 },

  // ═══════════════════════════════════════════════════════════════════════════
  // SENEGAL (SN) — 45 Departments (all 45)
  // parentCode references ADMIN1 region codes (SN-DK, SN-TH, etc.)
  // Codes follow pattern: SN-{region}-{dept}
  // ═══════════════════════════════════════════════════════════════════════════

  // -- Dakar Region (SN-DK) — 4 departments --
  { code: 'SN-DK-DAK', name: 'Dakar', nameEn: 'Dakar', nameFr: 'Dakar', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-DK', countryCode: 'SN', centroidLat: 14.72, centroidLng: -17.47 },
  { code: 'SN-DK-GUE', name: 'Guédiawaye', nameEn: 'Guédiawaye', nameFr: 'Guédiawaye', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-DK', countryCode: 'SN', centroidLat: 14.78, centroidLng: -17.39 },
  { code: 'SN-DK-PIK', name: 'Pikine', nameEn: 'Pikine', nameFr: 'Pikine', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-DK', countryCode: 'SN', centroidLat: 14.76, centroidLng: -17.40 },
  { code: 'SN-DK-RUF', name: 'Rufisque', nameEn: 'Rufisque', nameFr: 'Rufisque', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-DK', countryCode: 'SN', centroidLat: 14.72, centroidLng: -17.27 },

  // -- Thiès Region (SN-TH) — 3 departments --
  { code: 'SN-TH-THI', name: 'Thiès', nameEn: 'Thiès', nameFr: 'Thiès', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-TH', countryCode: 'SN', centroidLat: 14.79, centroidLng: -16.93 },
  { code: 'SN-TH-MBR', name: 'Mbour', nameEn: 'Mbour', nameFr: 'Mbour', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-TH', countryCode: 'SN', centroidLat: 14.42, centroidLng: -16.97 },
  { code: 'SN-TH-TIV', name: 'Tivaouane', nameEn: 'Tivaouane', nameFr: 'Tivaouane', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-TH', countryCode: 'SN', centroidLat: 14.95, centroidLng: -16.82 },

  // -- Saint-Louis Region (SN-SL) — 3 departments --
  { code: 'SN-SL-STL', name: 'Saint-Louis', nameEn: 'Saint-Louis', nameFr: 'Saint-Louis', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-SL', countryCode: 'SN', centroidLat: 16.02, centroidLng: -16.49 },
  { code: 'SN-SL-DAG', name: 'Dagana', nameEn: 'Dagana', nameFr: 'Dagana', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-SL', countryCode: 'SN', centroidLat: 16.52, centroidLng: -15.51 },
  { code: 'SN-SL-POD', name: 'Podor', nameEn: 'Podor', nameFr: 'Podor', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-SL', countryCode: 'SN', centroidLat: 16.66, centroidLng: -14.97 },

  // -- Ziguinchor Region (SN-ZG) — 3 departments --
  { code: 'SN-ZG-ZIG', name: 'Ziguinchor', nameEn: 'Ziguinchor', nameFr: 'Ziguinchor', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-ZG', countryCode: 'SN', centroidLat: 12.56, centroidLng: -16.26 },
  { code: 'SN-ZG-BIG', name: 'Bignona', nameEn: 'Bignona', nameFr: 'Bignona', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-ZG', countryCode: 'SN', centroidLat: 12.81, centroidLng: -16.23 },
  { code: 'SN-ZG-OUS', name: 'Oussouye', nameEn: 'Oussouye', nameFr: 'Oussouye', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-ZG', countryCode: 'SN', centroidLat: 12.49, centroidLng: -16.55 },

  // -- Kaolack Region (SN-KA) — 3 departments --
  { code: 'SN-KA-KAO', name: 'Kaolack', nameEn: 'Kaolack', nameFr: 'Kaolack', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-KA', countryCode: 'SN', centroidLat: 14.15, centroidLng: -16.07 },
  { code: 'SN-KA-GUN', name: 'Guinguinéo', nameEn: 'Guinguinéo', nameFr: 'Guinguinéo', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-KA', countryCode: 'SN', centroidLat: 14.27, centroidLng: -15.95 },
  { code: 'SN-KA-NIO', name: 'Nioro du Rip', nameEn: 'Nioro du Rip', nameFr: 'Nioro du Rip', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-KA', countryCode: 'SN', centroidLat: 13.75, centroidLng: -15.80 },

  // -- Louga Region (SN-LG) — 3 departments --
  { code: 'SN-LG-LOU', name: 'Louga', nameEn: 'Louga', nameFr: 'Louga', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-LG', countryCode: 'SN', centroidLat: 15.62, centroidLng: -15.58 },
  { code: 'SN-LG-KEB', name: 'Kébémer', nameEn: 'Kébémer', nameFr: 'Kébémer', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-LG', countryCode: 'SN', centroidLat: 15.37, centroidLng: -16.45 },
  { code: 'SN-LG-LIN', name: 'Linguère', nameEn: 'Linguère', nameFr: 'Linguère', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-LG', countryCode: 'SN', centroidLat: 15.40, centroidLng: -15.12 },

  // -- Diourbel Region (SN-DB) — 3 departments --
  { code: 'SN-DB-DIO', name: 'Diourbel', nameEn: 'Diourbel', nameFr: 'Diourbel', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-DB', countryCode: 'SN', centroidLat: 14.65, centroidLng: -16.23 },
  { code: 'SN-DB-BAM', name: 'Bambey', nameEn: 'Bambey', nameFr: 'Bambey', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-DB', countryCode: 'SN', centroidLat: 14.70, centroidLng: -16.45 },
  { code: 'SN-DB-MBK', name: 'Mbacké', nameEn: 'Mbacké', nameFr: 'Mbacké', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-DB', countryCode: 'SN', centroidLat: 14.79, centroidLng: -15.91 },

  // -- Tambacounda Region (SN-TC) — 4 departments --
  { code: 'SN-TC-TAM', name: 'Tambacounda', nameEn: 'Tambacounda', nameFr: 'Tambacounda', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-TC', countryCode: 'SN', centroidLat: 13.77, centroidLng: -13.67 },
  { code: 'SN-TC-BAK', name: 'Bakel', nameEn: 'Bakel', nameFr: 'Bakel', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-TC', countryCode: 'SN', centroidLat: 14.90, centroidLng: -12.47 },
  { code: 'SN-TC-GOU', name: 'Goudiry', nameEn: 'Goudiry', nameFr: 'Goudiry', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-TC', countryCode: 'SN', centroidLat: 14.18, centroidLng: -12.72 },
  { code: 'SN-TC-KOU', name: 'Koumpentoum', nameEn: 'Koumpentoum', nameFr: 'Koumpentoum', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-TC', countryCode: 'SN', centroidLat: 13.98, centroidLng: -14.55 },

  // -- Fatick Region (SN-FK) — 3 departments --
  { code: 'SN-FK-FAT', name: 'Fatick', nameEn: 'Fatick', nameFr: 'Fatick', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-FK', countryCode: 'SN', centroidLat: 14.33, centroidLng: -16.40 },
  { code: 'SN-FK-FOU', name: 'Foundiougne', nameEn: 'Foundiougne', nameFr: 'Foundiougne', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-FK', countryCode: 'SN', centroidLat: 14.13, centroidLng: -16.47 },
  { code: 'SN-FK-GOS', name: 'Gossas', nameEn: 'Gossas', nameFr: 'Gossas', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-FK', countryCode: 'SN', centroidLat: 14.49, centroidLng: -16.07 },

  // -- Kolda Region (SN-KL) — 3 departments --
  { code: 'SN-KL-KOL', name: 'Kolda', nameEn: 'Kolda', nameFr: 'Kolda', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-KL', countryCode: 'SN', centroidLat: 12.89, centroidLng: -14.95 },
  { code: 'SN-KL-MED', name: 'Médina Yoro Foulah', nameEn: 'Médina Yoro Foulah', nameFr: 'Médina Yoro Foulah', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-KL', countryCode: 'SN', centroidLat: 12.73, centroidLng: -14.46 },
  { code: 'SN-KL-VEL', name: 'Vélingara', nameEn: 'Vélingara', nameFr: 'Vélingara', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-KL', countryCode: 'SN', centroidLat: 12.78, centroidLng: -14.11 },

  // -- Kaffrine Region (SN-KD) — 4 departments --
  { code: 'SN-KD-KAF', name: 'Kaffrine', nameEn: 'Kaffrine', nameFr: 'Kaffrine', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-KD', countryCode: 'SN', centroidLat: 14.10, centroidLng: -15.55 },
  { code: 'SN-KD-BIR', name: 'Birkelane', nameEn: 'Birkelane', nameFr: 'Birkelane', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-KD', countryCode: 'SN', centroidLat: 14.08, centroidLng: -15.75 },
  { code: 'SN-KD-MAL', name: 'Malem-Hodar', nameEn: 'Malem-Hodar', nameFr: 'Malem-Hodar', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-KD', countryCode: 'SN', centroidLat: 13.87, centroidLng: -15.22 },
  { code: 'SN-KD-KOG', name: 'Koungheul', nameEn: 'Koungheul', nameFr: 'Koungheul', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-KD', countryCode: 'SN', centroidLat: 13.98, centroidLng: -14.80 },

  // -- Matam Region (SN-MT) — 3 departments --
  { code: 'SN-MT-MAT', name: 'Matam', nameEn: 'Matam', nameFr: 'Matam', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-MT', countryCode: 'SN', centroidLat: 15.66, centroidLng: -13.26 },
  { code: 'SN-MT-KAN', name: 'Kanel', nameEn: 'Kanel', nameFr: 'Kanel', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-MT', countryCode: 'SN', centroidLat: 15.49, centroidLng: -13.18 },
  { code: 'SN-MT-RAN', name: 'Ranérou', nameEn: 'Ranérou', nameFr: 'Ranérou', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-MT', countryCode: 'SN', centroidLat: 15.30, centroidLng: -13.97 },

  // -- Sédhiou Region (SN-SE) — 3 departments --
  { code: 'SN-SE-SED', name: 'Sédhiou', nameEn: 'Sédhiou', nameFr: 'Sédhiou', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-SE', countryCode: 'SN', centroidLat: 12.71, centroidLng: -15.56 },
  { code: 'SN-SE-BOU', name: 'Bounkiling', nameEn: 'Bounkiling', nameFr: 'Bounkiling', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-SE', countryCode: 'SN', centroidLat: 12.88, centroidLng: -15.68 },
  { code: 'SN-SE-GOU', name: 'Goudomp', nameEn: 'Goudomp', nameFr: 'Goudomp', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-SE', countryCode: 'SN', centroidLat: 12.58, centroidLng: -15.87 },

  // -- Kédougou Region (SN-KE) — 3 departments --
  { code: 'SN-KE-KED', name: 'Kédougou', nameEn: 'Kédougou', nameFr: 'Kédougou', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-KE', countryCode: 'SN', centroidLat: 12.56, centroidLng: -12.18 },
  { code: 'SN-KE-SAR', name: 'Saraya', nameEn: 'Saraya', nameFr: 'Saraya', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-KE', countryCode: 'SN', centroidLat: 12.83, centroidLng: -11.78 },
  { code: 'SN-KE-SAL', name: 'Salémata', nameEn: 'Salémata', nameFr: 'Salémata', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'SN-KE', countryCode: 'SN', centroidLat: 12.63, centroidLng: -12.62 },

  // ═══════════════════════════════════════════════════════════════════════════
  // NIGERIA (NG) — ~40 key Local Government Areas (LGAs)
  // parentCode references ADMIN1 state codes (NG-LA, NG-FC, NG-KN, etc.)
  // ═══════════════════════════════════════════════════════════════════════════

  // -- Lagos State (NG-LA) — 6 key LGAs --
  { code: 'NG-LA-IKJ', name: 'Ikeja', nameEn: 'Ikeja', nameFr: 'Ikeja', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-LA', countryCode: 'NG', centroidLat: 6.60, centroidLng: 3.35 },
  { code: 'NG-LA-ETI', name: 'Eti-Osa', nameEn: 'Eti-Osa', nameFr: 'Eti-Osa', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-LA', countryCode: 'NG', centroidLat: 6.46, centroidLng: 3.57 },
  { code: 'NG-LA-ALI', name: 'Alimosho', nameEn: 'Alimosho', nameFr: 'Alimosho', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-LA', countryCode: 'NG', centroidLat: 6.62, centroidLng: 3.26 },
  { code: 'NG-LA-SUR', name: 'Surulere', nameEn: 'Surulere', nameFr: 'Surulere', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-LA', countryCode: 'NG', centroidLat: 6.50, centroidLng: 3.35 },
  { code: 'NG-LA-LIS', name: 'Lagos Island', nameEn: 'Lagos Island', nameFr: 'Ile de Lagos', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-LA', countryCode: 'NG', centroidLat: 6.45, centroidLng: 3.40 },
  { code: 'NG-LA-EPE', name: 'Epe', nameEn: 'Epe', nameFr: 'Epe', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-LA', countryCode: 'NG', centroidLat: 6.58, centroidLng: 3.98 },

  // -- FCT Abuja (NG-FC) — 4 key LGAs --
  { code: 'NG-FC-ABM', name: 'Abuja Municipal', nameEn: 'Abuja Municipal Area Council', nameFr: 'Conseil municipal d\'Abuja', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-FC', countryCode: 'NG', centroidLat: 9.06, centroidLng: 7.49 },
  { code: 'NG-FC-GWA', name: 'Gwagwalada', nameEn: 'Gwagwalada', nameFr: 'Gwagwalada', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-FC', countryCode: 'NG', centroidLat: 8.94, centroidLng: 7.08 },
  { code: 'NG-FC-KUJ', name: 'Kuje', nameEn: 'Kuje', nameFr: 'Kuje', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-FC', countryCode: 'NG', centroidLat: 8.88, centroidLng: 7.23 },
  { code: 'NG-FC-BWR', name: 'Bwari', nameEn: 'Bwari', nameFr: 'Bwari', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-FC', countryCode: 'NG', centroidLat: 9.28, centroidLng: 7.38 },

  // -- Kano State (NG-KN) — 5 key LGAs --
  { code: 'NG-KN-KMC', name: 'Kano Municipal', nameEn: 'Kano Municipal', nameFr: 'Kano Municipal', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-KN', countryCode: 'NG', centroidLat: 12.00, centroidLng: 8.52 },
  { code: 'NG-KN-NAS', name: 'Nassarawa', nameEn: 'Nassarawa', nameFr: 'Nassarawa', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-KN', countryCode: 'NG', centroidLat: 11.99, centroidLng: 8.53 },
  { code: 'NG-KN-UNG', name: 'Ungogo', nameEn: 'Ungogo', nameFr: 'Ungogo', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-KN', countryCode: 'NG', centroidLat: 12.06, centroidLng: 8.49 },
  { code: 'NG-KN-GWL', name: 'Gwale', nameEn: 'Gwale', nameFr: 'Gwale', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-KN', countryCode: 'NG', centroidLat: 11.96, centroidLng: 8.50 },
  { code: 'NG-KN-DLA', name: 'Dala', nameEn: 'Dala', nameFr: 'Dala', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-KN', countryCode: 'NG', centroidLat: 11.97, centroidLng: 8.48 },

  // -- Kaduna State (NG-KD) — 4 key LGAs --
  { code: 'NG-KD-KDN', name: 'Kaduna North', nameEn: 'Kaduna North', nameFr: 'Kaduna Nord', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-KD', countryCode: 'NG', centroidLat: 10.55, centroidLng: 7.44 },
  { code: 'NG-KD-KDS', name: 'Kaduna South', nameEn: 'Kaduna South', nameFr: 'Kaduna Sud', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-KD', countryCode: 'NG', centroidLat: 10.48, centroidLng: 7.43 },
  { code: 'NG-KD-ZAR', name: 'Zaria', nameEn: 'Zaria', nameFr: 'Zaria', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-KD', countryCode: 'NG', centroidLat: 11.07, centroidLng: 7.71 },
  { code: 'NG-KD-CHK', name: 'Chikun', nameEn: 'Chikun', nameFr: 'Chikun', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-KD', countryCode: 'NG', centroidLat: 10.36, centroidLng: 7.35 },

  // -- Rivers State (NG-RI) — 4 key LGAs --
  { code: 'NG-RI-PHC', name: 'Port Harcourt', nameEn: 'Port Harcourt', nameFr: 'Port Harcourt', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-RI', countryCode: 'NG', centroidLat: 4.82, centroidLng: 7.03 },
  { code: 'NG-RI-OBI', name: 'Obio-Akpor', nameEn: 'Obio-Akpor', nameFr: 'Obio-Akpor', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-RI', countryCode: 'NG', centroidLat: 4.87, centroidLng: 6.98 },
  { code: 'NG-RI-ELC', name: 'Eleme', nameEn: 'Eleme', nameFr: 'Eleme', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-RI', countryCode: 'NG', centroidLat: 4.80, centroidLng: 7.11 },
  { code: 'NG-RI-OKR', name: 'Okrika', nameEn: 'Okrika', nameFr: 'Okrika', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-RI', countryCode: 'NG', centroidLat: 4.74, centroidLng: 7.08 },

  // -- Oyo State (NG-OY) — 4 key LGAs --
  { code: 'NG-OY-IBN', name: 'Ibadan North', nameEn: 'Ibadan North', nameFr: 'Ibadan Nord', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-OY', countryCode: 'NG', centroidLat: 7.43, centroidLng: 3.92 },
  { code: 'NG-OY-IBS', name: 'Ibadan South-West', nameEn: 'Ibadan South-West', nameFr: 'Ibadan Sud-Ouest', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-OY', countryCode: 'NG', centroidLat: 7.37, centroidLng: 3.87 },
  { code: 'NG-OY-OGB', name: 'Ogbomosho North', nameEn: 'Ogbomosho North', nameFr: 'Ogbomosho Nord', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-OY', countryCode: 'NG', centroidLat: 8.13, centroidLng: 4.25 },
  { code: 'NG-OY-OYO', name: 'Oyo West', nameEn: 'Oyo West', nameFr: 'Oyo Ouest', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-OY', countryCode: 'NG', centroidLat: 7.84, centroidLng: 3.93 },

  // -- Borno State (NG-BO) — 4 key LGAs --
  { code: 'NG-BO-MAI', name: 'Maiduguri', nameEn: 'Maiduguri', nameFr: 'Maiduguri', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-BO', countryCode: 'NG', centroidLat: 11.85, centroidLng: 13.16 },
  { code: 'NG-BO-JER', name: 'Jere', nameEn: 'Jere', nameFr: 'Jere', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-BO', countryCode: 'NG', centroidLat: 11.82, centroidLng: 13.09 },
  { code: 'NG-BO-BIU', name: 'Biu', nameEn: 'Biu', nameFr: 'Biu', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-BO', countryCode: 'NG', centroidLat: 10.61, centroidLng: 12.19 },
  { code: 'NG-BO-KND', name: 'Konduga', nameEn: 'Konduga', nameFr: 'Konduga', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-BO', countryCode: 'NG', centroidLat: 11.65, centroidLng: 13.27 },

  // -- Plateau State (NG-PL) — 3 key LGAs --
  { code: 'NG-PL-JOS', name: 'Jos North', nameEn: 'Jos North', nameFr: 'Jos Nord', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-PL', countryCode: 'NG', centroidLat: 9.93, centroidLng: 8.89 },
  { code: 'NG-PL-JSS', name: 'Jos South', nameEn: 'Jos South', nameFr: 'Jos Sud', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-PL', countryCode: 'NG', centroidLat: 9.82, centroidLng: 8.87 },
  { code: 'NG-PL-BKK', name: 'Barkin Ladi', nameEn: 'Barkin Ladi', nameFr: 'Barkin Ladi', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-PL', countryCode: 'NG', centroidLat: 9.53, centroidLng: 8.90 },

  // -- Sokoto State (NG-SO) — 3 key LGAs --
  { code: 'NG-SO-SOK', name: 'Sokoto North', nameEn: 'Sokoto North', nameFr: 'Sokoto Nord', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-SO', countryCode: 'NG', centroidLat: 13.08, centroidLng: 5.24 },
  { code: 'NG-SO-SOS', name: 'Sokoto South', nameEn: 'Sokoto South', nameFr: 'Sokoto Sud', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-SO', countryCode: 'NG', centroidLat: 13.04, centroidLng: 5.22 },
  { code: 'NG-SO-WUR', name: 'Wurno', nameEn: 'Wurno', nameFr: 'Wurno', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-SO', countryCode: 'NG', centroidLat: 13.29, centroidLng: 5.43 },

  // -- Zamfara State (NG-ZA) — 3 key LGAs --
  { code: 'NG-ZA-GUS', name: 'Gusau', nameEn: 'Gusau', nameFr: 'Gusau', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-ZA', countryCode: 'NG', centroidLat: 12.17, centroidLng: 6.66 },
  { code: 'NG-ZA-KAU', name: 'Kaura Namoda', nameEn: 'Kaura Namoda', nameFr: 'Kaura Namoda', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-ZA', countryCode: 'NG', centroidLat: 12.59, centroidLng: 6.59 },
  { code: 'NG-ZA-TLM', name: 'Talata Mafara', nameEn: 'Talata Mafara', nameFr: 'Talata Mafara', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'NG-ZA', countryCode: 'NG', centroidLat: 12.57, centroidLng: 6.07 },

  // ═══════════════════════════════════════════════════════════════════════════
  // TANZANIA (TZ) — ~30 key districts across major regions
  // parentCode references ADMIN1 region codes (TZ-02, TZ-03, etc.)
  // Note: Tanzania uses numbered region codes per ISO 3166-2:TZ
  // ═══════════════════════════════════════════════════════════════════════════

  // -- Dar es Salaam Region (TZ-02) — 5 districts --
  { code: 'TZ-02-ILA', name: 'Ilala', nameEn: 'Ilala', nameFr: 'Ilala', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-02', countryCode: 'TZ', centroidLat: -6.83, centroidLng: 39.24 },
  { code: 'TZ-02-KIN', name: 'Kinondoni', nameEn: 'Kinondoni', nameFr: 'Kinondoni', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-02', countryCode: 'TZ', centroidLat: -6.77, centroidLng: 39.24 },
  { code: 'TZ-02-TEM', name: 'Temeke', nameEn: 'Temeke', nameFr: 'Temeke', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-02', countryCode: 'TZ', centroidLat: -6.87, centroidLng: 39.27 },
  { code: 'TZ-02-UBG', name: 'Ubungo', nameEn: 'Ubungo', nameFr: 'Ubungo', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-02', countryCode: 'TZ', centroidLat: -6.79, centroidLng: 39.19 },
  { code: 'TZ-02-KIG', name: 'Kigamboni', nameEn: 'Kigamboni', nameFr: 'Kigamboni', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-02', countryCode: 'TZ', centroidLat: -6.89, centroidLng: 39.33 },

  // -- Dodoma Region (TZ-03) — 2 key districts --
  { code: 'TZ-03-DOD', name: 'Dodoma Urban', nameEn: 'Dodoma Urban', nameFr: 'Dodoma Urbain', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-03', countryCode: 'TZ', centroidLat: -6.17, centroidLng: 35.75 },
  { code: 'TZ-03-KON', name: 'Kondoa', nameEn: 'Kondoa', nameFr: 'Kondoa', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-03', countryCode: 'TZ', centroidLat: -4.90, centroidLng: 35.78 },

  // -- Arusha Region (TZ-01) — 3 key districts --
  { code: 'TZ-01-ARU', name: 'Arusha City', nameEn: 'Arusha City', nameFr: 'Ville d\'Arusha', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-01', countryCode: 'TZ', centroidLat: -3.37, centroidLng: 36.68 },
  { code: 'TZ-01-MER', name: 'Meru', nameEn: 'Meru', nameFr: 'Meru', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-01', countryCode: 'TZ', centroidLat: -3.40, centroidLng: 36.78 },
  { code: 'TZ-01-MON', name: 'Monduli', nameEn: 'Monduli', nameFr: 'Monduli', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-01', countryCode: 'TZ', centroidLat: -3.31, centroidLng: 36.27 },

  // -- Mwanza Region (TZ-18) — 2 key districts --
  { code: 'TZ-18-NYM', name: 'Nyamagana', nameEn: 'Nyamagana', nameFr: 'Nyamagana', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-18', countryCode: 'TZ', centroidLat: -2.52, centroidLng: 32.90 },
  { code: 'TZ-18-ILE', name: 'Ilemela', nameEn: 'Ilemela', nameFr: 'Ilemela', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-18', countryCode: 'TZ', centroidLat: -2.48, centroidLng: 32.87 },

  // -- Kilimanjaro Region (TZ-09) — 2 key districts --
  { code: 'TZ-09-MOS', name: 'Moshi Urban', nameEn: 'Moshi Urban', nameFr: 'Moshi Urbain', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-09', countryCode: 'TZ', centroidLat: -3.34, centroidLng: 37.34 },
  { code: 'TZ-09-HAI', name: 'Hai', nameEn: 'Hai', nameFr: 'Hai', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-09', countryCode: 'TZ', centroidLat: -3.23, centroidLng: 37.17 },

  // -- Mbeya Region (TZ-14) — 2 key districts --
  { code: 'TZ-14-MBY', name: 'Mbeya City', nameEn: 'Mbeya City', nameFr: 'Ville de Mbeya', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-14', countryCode: 'TZ', centroidLat: -8.90, centroidLng: 33.44 },
  { code: 'TZ-14-RUN', name: 'Rungwe', nameEn: 'Rungwe', nameFr: 'Rungwe', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-14', countryCode: 'TZ', centroidLat: -9.13, centroidLng: 33.67 },

  // -- Tanga Region (TZ-25) — 2 key districts --
  { code: 'TZ-25-TNG', name: 'Tanga City', nameEn: 'Tanga City', nameFr: 'Ville de Tanga', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-25', countryCode: 'TZ', centroidLat: -5.07, centroidLng: 39.10 },
  { code: 'TZ-25-MUH', name: 'Muheza', nameEn: 'Muheza', nameFr: 'Muheza', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-25', countryCode: 'TZ', centroidLat: -5.17, centroidLng: 38.78 },

  // -- Morogoro Region (TZ-16) — 2 key districts --
  { code: 'TZ-16-MRG', name: 'Morogoro Urban', nameEn: 'Morogoro Urban', nameFr: 'Morogoro Urbain', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-16', countryCode: 'TZ', centroidLat: -6.82, centroidLng: 37.66 },
  { code: 'TZ-16-KIL', name: 'Kilombero', nameEn: 'Kilombero', nameFr: 'Kilombero', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-16', countryCode: 'TZ', centroidLat: -8.08, centroidLng: 36.68 },

  // -- Kagera Region (TZ-05) — 2 key districts --
  { code: 'TZ-05-BUK', name: 'Bukoba Urban', nameEn: 'Bukoba Urban', nameFr: 'Bukoba Urbain', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-05', countryCode: 'TZ', centroidLat: -1.33, centroidLng: 31.81 },
  { code: 'TZ-05-MUL', name: 'Muleba', nameEn: 'Muleba', nameFr: 'Muleba', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-05', countryCode: 'TZ', centroidLat: -1.75, centroidLng: 31.67 },

  // -- Mara Region (TZ-13) — 2 key districts --
  { code: 'TZ-13-MUS', name: 'Musoma Urban', nameEn: 'Musoma Urban', nameFr: 'Musoma Urbain', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-13', countryCode: 'TZ', centroidLat: -1.50, centroidLng: 33.80 },
  { code: 'TZ-13-TAR', name: 'Tarime', nameEn: 'Tarime', nameFr: 'Tarime', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-13', countryCode: 'TZ', centroidLat: -1.35, centroidLng: 34.38 },

  // -- Iringa Region (TZ-04) — 2 key districts --
  { code: 'TZ-04-IRG', name: 'Iringa Urban', nameEn: 'Iringa Urban', nameFr: 'Iringa Urbain', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-04', countryCode: 'TZ', centroidLat: -7.77, centroidLng: 35.69 },
  { code: 'TZ-04-MUF', name: 'Mufindi', nameEn: 'Mufindi', nameFr: 'Mufindi', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-04', countryCode: 'TZ', centroidLat: -8.60, centroidLng: 35.27 },

  // -- Zanzibar (TZ-11) — 2 key districts --
  { code: 'TZ-11-ZNJ', name: 'Zanzibar Urban', nameEn: 'Zanzibar Urban/West', nameFr: 'Zanzibar Urbain/Ouest', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-11', countryCode: 'TZ', centroidLat: -6.16, centroidLng: 39.19 },
  { code: 'TZ-11-ZNN', name: 'Zanzibar North', nameEn: 'Zanzibar North', nameFr: 'Zanzibar Nord', level: 'ADMIN2' as GeoSeed['level'], parentCode: 'TZ-11', countryCode: 'TZ', centroidLat: -5.97, centroidLng: 39.28 },
];
