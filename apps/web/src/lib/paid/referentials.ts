/**
 * PAID (Programme Activity Information Database) — Referential Data
 * Extracted from AU-IBAR_PAID.xlsx
 */

/* ------------------------------------------------------------------ */
/*  Sectors of Production                                              */
/* ------------------------------------------------------------------ */

export interface PaidSector {
  id: string;
  name: { en: string; fr: string; es: string };
}

export const PAID_SECTORS: PaidSector[] = [
  { id: 'SP_1', name: { en: 'Agriculture', fr: 'Agriculture', es: 'Agricultura' } },
  { id: 'SP_2', name: { en: 'Environment', fr: 'Environnement', es: 'Ambiente' } },
  { id: 'SP_3', name: { en: 'Fishery', fr: 'Pêche', es: 'Pesca' } },
  { id: 'SP_4', name: { en: 'Forestry', fr: 'Sylviculture', es: 'Silvicultura' } },
  { id: 'SP_5', name: { en: 'Land and Water', fr: 'Terre et eau', es: 'Tierra y agua' } },
  { id: 'SP_6', name: { en: 'Livelihoods and cash', fr: 'Moyens de subsistance et cash', es: 'Medios de vida y cash' } },
  { id: 'SP_7', name: { en: 'Livestock', fr: 'Élevage', es: 'Ganadería' } },
  { id: 'SP_8', name: { en: 'Nutrition and Human health', fr: 'Nutrition et santé humaine', es: 'Nutrición y salud humana' } },
  { id: 'SP_9', name: { en: 'Social protection', fr: 'Protection sociale', es: 'Protección social' } },
];

/* ------------------------------------------------------------------ */
/*  Country metadata (HH size + disability %)                          */
/* ------------------------------------------------------------------ */

export interface PaidCountryMeta {
  code: string;     // ISO 3166-1 alpha-2
  name: string;
  hhSize: number;   // Average household size
  disabilityPct: number; // % disabled population (0-1 range)
  language: string;
  isHrp: boolean;   // Humanitarian Response Plan country
  region: string;
  subRegion: string;
}

export const PAID_COUNTRIES: PaidCountryMeta[] = [
  { code: 'AO', name: 'Angola', hhSize: 4.8, disabilityPct: 0.144, language: 'fr', isHrp: false, region: 'RAF', subRegion: 'SFS' },
  { code: 'BJ', name: 'Benin', hhSize: 5.2, disabilityPct: 0.11, language: 'fr', isHrp: false, region: 'RAF', subRegion: 'SFW' },
  { code: 'BW', name: 'Botswana', hhSize: 3.5, disabilityPct: 0.138, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFS' },
  { code: 'BF', name: 'Burkina Faso', hhSize: 5.9, disabilityPct: 0.134, language: 'fr', isHrp: true, region: 'RAF', subRegion: 'SFW' },
  { code: 'BI', name: 'Burundi', hhSize: 6.0, disabilityPct: 0.135, language: 'fr', isHrp: true, region: 'RAF', subRegion: 'SFE' },
  { code: 'CM', name: 'Cameroon', hhSize: 5.2, disabilityPct: 0.129, language: 'fr', isHrp: true, region: 'RAF', subRegion: 'SFC' },
  { code: 'CV', name: 'Cabo Verde', hhSize: 4.2, disabilityPct: 0.12, language: 'pt', isHrp: false, region: 'RAF', subRegion: 'SFW' },
  { code: 'CF', name: 'Central African Republic', hhSize: 5.7, disabilityPct: 0.141, language: 'fr', isHrp: true, region: 'RAF', subRegion: 'SFC' },
  { code: 'TD', name: 'Chad', hhSize: 5.8, disabilityPct: 0.136, language: 'fr', isHrp: true, region: 'RAF', subRegion: 'SFC' },
  { code: 'KM', name: 'Comoros', hhSize: 5.5, disabilityPct: 0.12, language: 'fr', isHrp: false, region: 'RAF', subRegion: 'SFE' },
  { code: 'CG', name: 'Congo', hhSize: 5.1, disabilityPct: 0.126, language: 'fr', isHrp: false, region: 'RAF', subRegion: 'SFC' },
  { code: 'CI', name: "Côte d'Ivoire", hhSize: 5.4, disabilityPct: 0.122, language: 'fr', isHrp: false, region: 'RAF', subRegion: 'SFW' },
  { code: 'CD', name: 'DR Congo', hhSize: 5.3, disabilityPct: 0.137, language: 'fr', isHrp: true, region: 'RAF', subRegion: 'SFC' },
  { code: 'DJ', name: 'Djibouti', hhSize: 6.2, disabilityPct: 0.13, language: 'fr', isHrp: true, region: 'RNE', subRegion: 'SNE' },
  { code: 'EG', name: 'Egypt', hhSize: 4.2, disabilityPct: 0.107, language: 'ar', isHrp: false, region: 'RNE', subRegion: 'SNE' },
  { code: 'GQ', name: 'Equatorial Guinea', hhSize: 5.0, disabilityPct: 0.13, language: 'es', isHrp: false, region: 'RAF', subRegion: 'SFC' },
  { code: 'ER', name: 'Eritrea', hhSize: 5.5, disabilityPct: 0.14, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFE' },
  { code: 'SZ', name: 'Eswatini', hhSize: 4.7, disabilityPct: 0.135, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFS' },
  { code: 'ET', name: 'Ethiopia', hhSize: 4.6, disabilityPct: 0.175, language: 'en', isHrp: true, region: 'RAF', subRegion: 'SFE' },
  { code: 'GA', name: 'Gabon', hhSize: 4.5, disabilityPct: 0.12, language: 'fr', isHrp: false, region: 'RAF', subRegion: 'SFC' },
  { code: 'GM', name: 'Gambia', hhSize: 8.0, disabilityPct: 0.125, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFW' },
  { code: 'GH', name: 'Ghana', hhSize: 3.9, disabilityPct: 0.122, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFW' },
  { code: 'GN', name: 'Guinea', hhSize: 7.5, disabilityPct: 0.135, language: 'fr', isHrp: false, region: 'RAF', subRegion: 'SFW' },
  { code: 'GW', name: 'Guinea-Bissau', hhSize: 7.0, disabilityPct: 0.13, language: 'pt', isHrp: false, region: 'RAF', subRegion: 'SFW' },
  { code: 'KE', name: 'Kenya', hhSize: 6.0, disabilityPct: 0.108, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFE' },
  { code: 'LS', name: 'Lesotho', hhSize: 4.1, disabilityPct: 0.135, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFS' },
  { code: 'LR', name: 'Liberia', hhSize: 5.1, disabilityPct: 0.16, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFW' },
  { code: 'LY', name: 'Libya', hhSize: 5.5, disabilityPct: 0.12, language: 'ar', isHrp: true, region: 'RNE', subRegion: 'SNE' },
  { code: 'MG', name: 'Madagascar', hhSize: 4.8, disabilityPct: 0.15, language: 'fr', isHrp: true, region: 'RAF', subRegion: 'SFE' },
  { code: 'MW', name: 'Malawi', hhSize: 4.4, disabilityPct: 0.127, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFS' },
  { code: 'ML', name: 'Mali', hhSize: 6.4, disabilityPct: 0.136, language: 'fr', isHrp: true, region: 'RAF', subRegion: 'SFW' },
  { code: 'MR', name: 'Mauritania', hhSize: 7.2, disabilityPct: 0.136, language: 'fr', isHrp: true, region: 'RAF', subRegion: 'SFW' },
  { code: 'MU', name: 'Mauritius', hhSize: 3.5, disabilityPct: 0.12, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFE' },
  { code: 'MZ', name: 'Mozambique', hhSize: 4.3, disabilityPct: 0.127, language: 'pt', isHrp: true, region: 'RAF', subRegion: 'SFS' },
  { code: 'NA', name: 'Namibia', hhSize: 4.0, disabilityPct: 0.135, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFS' },
  { code: 'NE', name: 'Niger', hhSize: 6.0, disabilityPct: 0.134, language: 'fr', isHrp: true, region: 'RAF', subRegion: 'SFW' },
  { code: 'NG', name: 'Nigeria', hhSize: 4.7, disabilityPct: 0.132, language: 'en', isHrp: true, region: 'RAF', subRegion: 'SFW' },
  { code: 'RW', name: 'Rwanda', hhSize: 4.3, disabilityPct: 0.13, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFE' },
  { code: 'ST', name: 'São Tomé and Príncipe', hhSize: 4.5, disabilityPct: 0.12, language: 'pt', isHrp: false, region: 'RAF', subRegion: 'SFC' },
  { code: 'SN', name: 'Senegal', hhSize: 8.3, disabilityPct: 0.131, language: 'fr', isHrp: false, region: 'RAF', subRegion: 'SFW' },
  { code: 'SC', name: 'Seychelles', hhSize: 3.5, disabilityPct: 0.12, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFE' },
  { code: 'SL', name: 'Sierra Leone', hhSize: 5.8, disabilityPct: 0.14, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFW' },
  { code: 'SO', name: 'Somalia', hhSize: 6.0, disabilityPct: 0.143, language: 'en', isHrp: true, region: 'RAF', subRegion: 'SFE' },
  { code: 'ZA', name: 'South Africa', hhSize: 3.3, disabilityPct: 0.139, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFS' },
  { code: 'SS', name: 'South Sudan', hhSize: 6.5, disabilityPct: 0.16, language: 'en', isHrp: true, region: 'RAF', subRegion: 'SFE' },
  { code: 'SD', name: 'Sudan', hhSize: 6.1, disabilityPct: 0.14, language: 'ar', isHrp: true, region: 'RNE', subRegion: 'SNE' },
  { code: 'TZ', name: 'Tanzania', hhSize: 4.7, disabilityPct: 0.127, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFE' },
  { code: 'TG', name: 'Togo', hhSize: 4.8, disabilityPct: 0.12, language: 'fr', isHrp: false, region: 'RAF', subRegion: 'SFW' },
  { code: 'TN', name: 'Tunisia', hhSize: 4.3, disabilityPct: 0.11, language: 'ar', isHrp: false, region: 'RNE', subRegion: 'SNE' },
  { code: 'UG', name: 'Uganda', hhSize: 4.7, disabilityPct: 0.127, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFE' },
  { code: 'ZM', name: 'Zambia', hhSize: 5.1, disabilityPct: 0.12, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFS' },
  { code: 'ZW', name: 'Zimbabwe', hhSize: 5.0, disabilityPct: 0.123, language: 'en', isHrp: false, region: 'RAF', subRegion: 'SFS' },
];

/** Lookup country metadata by name or ISO code */
export function getCountryMeta(nameOrCode: string): PaidCountryMeta | undefined {
  const q = nameOrCode.trim().toLowerCase();
  return PAID_COUNTRIES.find(
    (c) => c.code.toLowerCase() === q || c.name.toLowerCase() === q,
  );
}

/* ------------------------------------------------------------------ */
/*  Projects                                                           */
/* ------------------------------------------------------------------ */

export interface PaidProject {
  id: string;
  symbol: string;       // e.g. AU_IBAR/FISHGOV/KEN
  title: string;
  projectCode: string;  // e.g. FISHGOV
  donor?: string;
  country: string;
}

export const PAID_PROJECT_CODES = [
  { code: 'AQBIOD', title: 'Aquatic Biodiversity (FISH GOV 2)' },
  { code: 'RAFFS', title: 'Regional Animal Feed and Fodder Systems (RAFFS)' },
  { code: 'ANGR', title: 'Animal Genetics Resources (AnGR)' },
  { code: 'LIVESYS', title: 'Climate Resilient and Sustainable Livestock Systems' },
  { code: 'APMD', title: 'African Pastoral Markets Development (APMD)' },
  { code: 'PPPS_RVLC', title: 'Producers-Public-Private Partnerships & Regional Value Chains (PPPPs-RVLC)' },
  { code: 'AH_VET_GOV', title: 'Animal Health, One Health, Disease Control & Veterinary Governance' },
] as const;

/* ------------------------------------------------------------------ */
/*  Cash & Voucher types                                               */
/* ------------------------------------------------------------------ */

export const PAID_CVA_TYPES = [
  'Cash - Cash For Work',
  'Cash - Conditional Cash Transfer',
  'Cash - Unconditional Cash Transfer',
  'Cash - Voucher @ Fairs',
  'Cash - Voucher @ voucher scheme',
] as const;

export const PAID_CASH_MECHANISMS = [
  'Bank transfer',
  'Electronic voucher',
  'Mobile money',
  'Other electronic cash',
  'Paper voucher',
  'Physical cash',
] as const;

export const PAID_CASH_PLUS = ['Yes', 'No', 'Not specified'] as const;

/* ------------------------------------------------------------------ */
/*  Reporting periods                                                  */
/* ------------------------------------------------------------------ */

export const PAID_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

/* ------------------------------------------------------------------ */
/*  Dashboard tab definitions (matching FAO dashboard image)           */
/* ------------------------------------------------------------------ */

export const PAID_DASHBOARD_TABS = [
  { key: 'overview', color: '#1565C0' },
  { key: 'vaccination', color: '#2E7D32' },
  { key: 'treatment', color: '#00838F' },
  { key: 'restocking', color: '#E65100' },
  { key: 'agriculture', color: '#6A1B9A' },
  { key: 'monitoring', color: '#C62828' },
] as const;

/* ------------------------------------------------------------------ */
/*  Sector color palette                                               */
/* ------------------------------------------------------------------ */

export const SECTOR_COLORS: Record<string, string> = {
  Agriculture: '#4CAF50',
  Environment: '#26A69A',
  Fishery: '#00838F',
  Forestry: '#33691E',
  'Land and Water': '#1565C0',
  'Livelihoods and cash': '#E65100',
  Livestock: '#8D6E63',
  'Nutrition and Human health': '#AD1457',
  'Social protection': '#6A1B9A',
};
