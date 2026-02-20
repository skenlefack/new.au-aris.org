// Standard units: SI + sectoral (heads, doses, tonnes, liters, km², etc.)

export interface UnitSeed {
  code: string;
  nameEn: string;
  nameFr: string;
  symbol: string;
  category: 'COUNT' | 'WEIGHT' | 'VOLUME' | 'AREA' | 'LENGTH' | 'DOSE' | 'CURRENCY' | 'PROPORTION' | 'TIME';
  siConversion: number | null;
}

export const UNIT_SEEDS: UnitSeed[] = [
  // Count
  { code: 'HEAD', nameEn: 'Head', nameFr: 'Tête', symbol: 'head', category: 'COUNT', siConversion: 1 },
  { code: 'DOSE', nameEn: 'Dose', nameFr: 'Dose', symbol: 'dose', category: 'DOSE', siConversion: 1 },
  { code: 'COLONY', nameEn: 'Colony', nameFr: 'Colonie', symbol: 'colony', category: 'COUNT', siConversion: 1 },
  { code: 'HIVE', nameEn: 'Hive', nameFr: 'Ruche', symbol: 'hive', category: 'COUNT', siConversion: 1 },
  { code: 'SAMPLE', nameEn: 'Sample', nameFr: 'Échantillon', symbol: 'sample', category: 'COUNT', siConversion: 1 },
  { code: 'CASE', nameEn: 'Case', nameFr: 'Cas', symbol: 'case', category: 'COUNT', siConversion: 1 },
  { code: 'OUTBREAK', nameEn: 'Outbreak', nameFr: 'Foyer', symbol: 'outbreak', category: 'COUNT', siConversion: 1 },
  { code: 'LICENSE', nameEn: 'License', nameFr: 'Licence', symbol: 'license', category: 'COUNT', siConversion: 1 },
  { code: 'VESSEL', nameEn: 'Vessel', nameFr: 'Navire', symbol: 'vessel', category: 'COUNT', siConversion: 1 },
  { code: 'FACILITY', nameEn: 'Facility', nameFr: 'Installation', symbol: 'facility', category: 'COUNT', siConversion: 1 },

  // Weight
  { code: 'KG', nameEn: 'Kilogram', nameFr: 'Kilogramme', symbol: 'kg', category: 'WEIGHT', siConversion: 1 },
  { code: 'T', nameEn: 'Metric tonne', nameFr: 'Tonne métrique', symbol: 't', category: 'WEIGHT', siConversion: 1000 },
  { code: 'G', nameEn: 'Gram', nameFr: 'Gramme', symbol: 'g', category: 'WEIGHT', siConversion: 0.001 },
  { code: 'MG', nameEn: 'Milligram', nameFr: 'Milligramme', symbol: 'mg', category: 'WEIGHT', siConversion: 0.000001 },
  { code: 'MT', nameEn: 'Thousand tonnes', nameFr: 'Milliers de tonnes', symbol: 'kt', category: 'WEIGHT', siConversion: 1000000 },

  // Volume
  { code: 'L', nameEn: 'Litre', nameFr: 'Litre', symbol: 'L', category: 'VOLUME', siConversion: 0.001 },
  { code: 'ML', nameEn: 'Millilitre', nameFr: 'Millilitre', symbol: 'mL', category: 'VOLUME', siConversion: 0.000001 },
  { code: 'M3', nameEn: 'Cubic metre', nameFr: 'Mètre cube', symbol: 'm³', category: 'VOLUME', siConversion: 1 },

  // Area
  { code: 'KM2', nameEn: 'Square kilometre', nameFr: 'Kilomètre carré', symbol: 'km²', category: 'AREA', siConversion: 1000000 },
  { code: 'HA', nameEn: 'Hectare', nameFr: 'Hectare', symbol: 'ha', category: 'AREA', siConversion: 10000 },
  { code: 'M2', nameEn: 'Square metre', nameFr: 'Mètre carré', symbol: 'm²', category: 'AREA', siConversion: 1 },

  // Length
  { code: 'KM', nameEn: 'Kilometre', nameFr: 'Kilomètre', symbol: 'km', category: 'LENGTH', siConversion: 1000 },
  { code: 'M', nameEn: 'Metre', nameFr: 'Mètre', symbol: 'm', category: 'LENGTH', siConversion: 1 },

  // Proportion
  { code: 'PCT', nameEn: 'Percentage', nameFr: 'Pourcentage', symbol: '%', category: 'PROPORTION', siConversion: 0.01 },
  { code: 'RATIO', nameEn: 'Ratio', nameFr: 'Ratio', symbol: 'ratio', category: 'PROPORTION', siConversion: 1 },
  { code: 'PER1000', nameEn: 'Per thousand', nameFr: 'Pour mille', symbol: '‰', category: 'PROPORTION', siConversion: 0.001 },
  { code: 'PER100K', nameEn: 'Per 100,000', nameFr: 'Pour 100 000', symbol: '/100k', category: 'PROPORTION', siConversion: 0.00001 },

  // Currency
  { code: 'USD', nameEn: 'US Dollar', nameFr: 'Dollar américain', symbol: '$', category: 'CURRENCY', siConversion: null },
  { code: 'EUR', nameEn: 'Euro', nameFr: 'Euro', symbol: '€', category: 'CURRENCY', siConversion: null },
  { code: 'XOF', nameEn: 'CFA Franc (West)', nameFr: 'Franc CFA (Ouest)', symbol: 'FCFA', category: 'CURRENCY', siConversion: null },
  { code: 'XAF', nameEn: 'CFA Franc (Central)', nameFr: 'Franc CFA (Central)', symbol: 'FCFA', category: 'CURRENCY', siConversion: null },
  { code: 'KES', nameEn: 'Kenyan Shilling', nameFr: 'Shilling kényan', symbol: 'KSh', category: 'CURRENCY', siConversion: null },
  { code: 'NGN', nameEn: 'Nigerian Naira', nameFr: 'Naira nigérian', symbol: '₦', category: 'CURRENCY', siConversion: null },
  { code: 'ZAR', nameEn: 'South African Rand', nameFr: 'Rand sud-africain', symbol: 'R', category: 'CURRENCY', siConversion: null },
  { code: 'ETB', nameEn: 'Ethiopian Birr', nameFr: 'Birr éthiopien', symbol: 'Br', category: 'CURRENCY', siConversion: null },

  // Time
  { code: 'DAY', nameEn: 'Day', nameFr: 'Jour', symbol: 'd', category: 'TIME', siConversion: 86400 },
  { code: 'WEEK', nameEn: 'Week', nameFr: 'Semaine', symbol: 'wk', category: 'TIME', siConversion: 604800 },
  { code: 'MONTH', nameEn: 'Month', nameFr: 'Mois', symbol: 'mo', category: 'TIME', siConversion: 2592000 },
  { code: 'YEAR', nameEn: 'Year', nameFr: 'Année', symbol: 'yr', category: 'TIME', siConversion: 31536000 },
];
