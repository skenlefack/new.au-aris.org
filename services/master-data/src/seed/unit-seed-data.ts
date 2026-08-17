// Standard units: SI + sectoral (heads, doses, tonnes, liters, km², etc.)

export interface UnitSeed {
  code: string;
  nameEn: string;
  nameFr: string;
  namePt: string;
  nameAr: string;
  symbol: string;
  category: 'COUNT' | 'WEIGHT' | 'VOLUME' | 'AREA' | 'LENGTH' | 'DOSE' | 'CURRENCY' | 'PROPORTION' | 'TIME';
  siConversion: number | null;
}

export const UNIT_SEEDS: UnitSeed[] = [
  // Count
  { code: 'HEAD', nameEn: 'Head', nameFr: 'Tête', namePt: 'Cabeça', nameAr: 'رأس', symbol: 'head', category: 'COUNT', siConversion: 1 },
  { code: 'DOSE', nameEn: 'Dose', nameFr: 'Dose', namePt: 'Dose', nameAr: 'جرعة', symbol: 'dose', category: 'DOSE', siConversion: 1 },
  { code: 'COLONY', nameEn: 'Colony', nameFr: 'Colonie', namePt: 'Colónia', nameAr: 'مستعمرة', symbol: 'colony', category: 'COUNT', siConversion: 1 },
  { code: 'HIVE', nameEn: 'Hive', nameFr: 'Ruche', namePt: 'Colmeia', nameAr: 'خلية', symbol: 'hive', category: 'COUNT', siConversion: 1 },
  { code: 'SAMPLE', nameEn: 'Sample', nameFr: 'Échantillon', namePt: 'Amostra', nameAr: 'عينة', symbol: 'sample', category: 'COUNT', siConversion: 1 },
  { code: 'CASE', nameEn: 'Case', nameFr: 'Cas', namePt: 'Caso', nameAr: 'حالة', symbol: 'case', category: 'COUNT', siConversion: 1 },
  { code: 'OUTBREAK', nameEn: 'Outbreak', nameFr: 'Foyer', namePt: 'Foco', nameAr: 'بؤرة', symbol: 'outbreak', category: 'COUNT', siConversion: 1 },
  { code: 'LICENSE', nameEn: 'License', nameFr: 'Licence', namePt: 'Licença', nameAr: 'رخصة', symbol: 'license', category: 'COUNT', siConversion: 1 },
  { code: 'VESSEL', nameEn: 'Vessel', nameFr: 'Navire', namePt: 'Embarcação', nameAr: 'سفينة', symbol: 'vessel', category: 'COUNT', siConversion: 1 },
  { code: 'FACILITY', nameEn: 'Facility', nameFr: 'Installation', namePt: 'Instalação', nameAr: 'منشأة', symbol: 'facility', category: 'COUNT', siConversion: 1 },

  // Weight
  { code: 'KG', nameEn: 'Kilogram', nameFr: 'Kilogramme', namePt: 'Quilograma', nameAr: 'كيلوغرام', symbol: 'kg', category: 'WEIGHT', siConversion: 1 },
  { code: 'T', nameEn: 'Metric tonne', nameFr: 'Tonne métrique', namePt: 'Tonelada métrica', nameAr: 'طن متري', symbol: 't', category: 'WEIGHT', siConversion: 1000 },
  { code: 'G', nameEn: 'Gram', nameFr: 'Gramme', namePt: 'Grama', nameAr: 'غرام', symbol: 'g', category: 'WEIGHT', siConversion: 0.001 },
  { code: 'MG', nameEn: 'Milligram', nameFr: 'Milligramme', namePt: 'Miligrama', nameAr: 'ميليغرام', symbol: 'mg', category: 'WEIGHT', siConversion: 0.000001 },
  { code: 'MT', nameEn: 'Thousand tonnes', nameFr: 'Milliers de tonnes', namePt: 'Milhares de toneladas', nameAr: 'آلاف الأطنان', symbol: 'kt', category: 'WEIGHT', siConversion: 1000000 },

  // Volume
  { code: 'L', nameEn: 'Litre', nameFr: 'Litre', namePt: 'Litro', nameAr: 'لتر', symbol: 'L', category: 'VOLUME', siConversion: 0.001 },
  { code: 'ML', nameEn: 'Millilitre', nameFr: 'Millilitre', namePt: 'Mililitro', nameAr: 'ميلي لتر', symbol: 'mL', category: 'VOLUME', siConversion: 0.000001 },
  { code: 'M3', nameEn: 'Cubic metre', nameFr: 'Mètre cube', namePt: 'Metro cúbico', nameAr: 'متر مكعب', symbol: 'm³', category: 'VOLUME', siConversion: 1 },

  // Area
  { code: 'KM2', nameEn: 'Square kilometre', nameFr: 'Kilomètre carré', namePt: 'Quilómetro quadrado', nameAr: 'كيلومتر مربع', symbol: 'km²', category: 'AREA', siConversion: 1000000 },
  { code: 'HA', nameEn: 'Hectare', nameFr: 'Hectare', namePt: 'Hectare', nameAr: 'هكتار', symbol: 'ha', category: 'AREA', siConversion: 10000 },
  { code: 'M2', nameEn: 'Square metre', nameFr: 'Mètre carré', namePt: 'Metro quadrado', nameAr: 'متر مربع', symbol: 'm²', category: 'AREA', siConversion: 1 },

  // Length
  { code: 'KM', nameEn: 'Kilometre', nameFr: 'Kilomètre', namePt: 'Quilómetro', nameAr: 'كيلومتر', symbol: 'km', category: 'LENGTH', siConversion: 1000 },
  { code: 'M', nameEn: 'Metre', nameFr: 'Mètre', namePt: 'Metro', nameAr: 'متر', symbol: 'm', category: 'LENGTH', siConversion: 1 },

  // Proportion
  { code: 'PCT', nameEn: 'Percentage', nameFr: 'Pourcentage', namePt: 'Percentagem', nameAr: 'نسبة مئوية', symbol: '%', category: 'PROPORTION', siConversion: 0.01 },
  { code: 'RATIO', nameEn: 'Ratio', nameFr: 'Ratio', namePt: 'Rácio', nameAr: 'نسبة', symbol: 'ratio', category: 'PROPORTION', siConversion: 1 },
  { code: 'PER1000', nameEn: 'Per thousand', nameFr: 'Pour mille', namePt: 'Por mil', nameAr: 'لكل ألف', symbol: '‰', category: 'PROPORTION', siConversion: 0.001 },
  { code: 'PER100K', nameEn: 'Per 100,000', nameFr: 'Pour 100 000', namePt: 'Por 100 000', nameAr: 'لكل 100,000', symbol: '/100k', category: 'PROPORTION', siConversion: 0.00001 },

  // Currency
  { code: 'USD', nameEn: 'US Dollar', nameFr: 'Dollar américain', namePt: 'Dólar americano', nameAr: 'دولار أمريكي', symbol: '$', category: 'CURRENCY', siConversion: null },
  { code: 'EUR', nameEn: 'Euro', nameFr: 'Euro', namePt: 'Euro', nameAr: 'يورو', symbol: '€', category: 'CURRENCY', siConversion: null },
  { code: 'XOF', nameEn: 'CFA Franc (West)', nameFr: 'Franc CFA (Ouest)', namePt: 'Franco CFA (Oeste)', nameAr: 'فرنك غرب أفريقيا', symbol: 'FCFA', category: 'CURRENCY', siConversion: null },
  { code: 'XAF', nameEn: 'CFA Franc (Central)', nameFr: 'Franc CFA (Central)', namePt: 'Franco CFA (Central)', nameAr: 'فرنك وسط أفريقيا', symbol: 'FCFA', category: 'CURRENCY', siConversion: null },
  { code: 'KES', nameEn: 'Kenyan Shilling', nameFr: 'Shilling kényan', namePt: 'Xelim queniano', nameAr: 'شلن كيني', symbol: 'KSh', category: 'CURRENCY', siConversion: null },
  { code: 'NGN', nameEn: 'Nigerian Naira', nameFr: 'Naira nigérian', namePt: 'Naira nigeriana', nameAr: 'نيرة نيجيرية', symbol: '₦', category: 'CURRENCY', siConversion: null },
  { code: 'ZAR', nameEn: 'South African Rand', nameFr: 'Rand sud-africain', namePt: 'Rand sul-africano', nameAr: 'راند جنوب أفريقي', symbol: 'R', category: 'CURRENCY', siConversion: null },
  { code: 'ETB', nameEn: 'Ethiopian Birr', nameFr: 'Birr éthiopien', namePt: 'Birr etíope', nameAr: 'بر إثيوبي', symbol: 'Br', category: 'CURRENCY', siConversion: null },

  // Time
  { code: 'DAY', nameEn: 'Day', nameFr: 'Jour', namePt: 'Dia', nameAr: 'يوم', symbol: 'd', category: 'TIME', siConversion: 86400 },
  { code: 'WEEK', nameEn: 'Week', nameFr: 'Semaine', namePt: 'Semana', nameAr: 'أسبوع', symbol: 'wk', category: 'TIME', siConversion: 604800 },
  { code: 'MONTH', nameEn: 'Month', nameFr: 'Mois', namePt: 'Mês', nameAr: 'شهر', symbol: 'mo', category: 'TIME', siConversion: 2592000 },
  { code: 'YEAR', nameEn: 'Year', nameFr: 'Année', namePt: 'Ano', nameAr: 'سنة', symbol: 'yr', category: 'TIME', siConversion: 31536000 },
  { code: 'HOUR', nameEn: 'Hour', nameFr: 'Heure', namePt: 'Hora', nameAr: 'ساعة', symbol: 'h', category: 'TIME', siConversion: 3600 },

  // Dose (additional)
  { code: 'VDOSE', nameEn: 'Vaccine dose', nameFr: 'Dose vaccinale', namePt: 'Dose vacinal', nameAr: 'جرعة لقاح', symbol: 'vdose', category: 'DOSE', siConversion: 1 },
  { code: 'IU', nameEn: 'International unit', nameFr: 'Unité internationale', namePt: 'Unidade internacional', nameAr: 'وحدة دولية', symbol: 'IU', category: 'DOSE', siConversion: null },
  { code: 'TREAT', nameEn: 'Treatment course', nameFr: 'Cure de traitement', namePt: 'Curso de tratamento', nameAr: 'دورة علاجية', symbol: 'treat', category: 'DOSE', siConversion: 1 },

  // Additional count units
  { code: 'BATCH', nameEn: 'Batch', nameFr: 'Lot', namePt: 'Lote', nameAr: 'دفعة', symbol: 'batch', category: 'COUNT', siConversion: 1 },
  { code: 'TRIP', nameEn: 'Trip', nameFr: 'Voyage', namePt: 'Viagem', nameAr: 'رحلة', symbol: 'trip', category: 'COUNT', siConversion: 1 },
  { code: 'CERT', nameEn: 'Certificate', nameFr: 'Certificat', namePt: 'Certificado', nameAr: 'شهادة', symbol: 'cert', category: 'COUNT', siConversion: 1 },
  { code: 'HOLDING', nameEn: 'Holding / Farm', nameFr: 'Exploitation', namePt: 'Exploração', nameAr: 'مزرعة', symbol: 'holding', category: 'COUNT', siConversion: 1 },

  // Additional currencies
  { code: 'TZS', nameEn: 'Tanzanian Shilling', nameFr: 'Shilling tanzanien', namePt: 'Xelim tanzaniano', nameAr: 'شلن تنزاني', symbol: 'TSh', category: 'CURRENCY', siConversion: null },
  { code: 'EGP', nameEn: 'Egyptian Pound', nameFr: 'Livre égyptienne', namePt: 'Libra egípcia', nameAr: 'جنيه مصري', symbol: 'E£', category: 'CURRENCY', siConversion: null },
  { code: 'MAD', nameEn: 'Moroccan Dirham', nameFr: 'Dirham marocain', namePt: 'Dirham marroquino', nameAr: 'درهم مغربي', symbol: 'MAD', category: 'CURRENCY', siConversion: null },
  { code: 'GHS', nameEn: 'Ghanaian Cedi', nameFr: 'Cédi ghanéen', namePt: 'Cedi ganês', nameAr: 'سيدي غاني', symbol: 'GH₵', category: 'CURRENCY', siConversion: null },
];
