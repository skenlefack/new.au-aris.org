// ─── ARIS 4.0 — Dashboard Demo Data ─────────────────────────────────────────
// Realistic demonstration data for the continental dashboard.
// Used when backend APIs are unavailable or return empty datasets.

export interface CountryOutbreakData {
  code: string;
  name: string;
  outbreaks: number;
  cases: number;
  deaths: number;
  vaccinations: number;
  submissions: number;
  rec: string;
}

export const DEMO_COUNTRY_DATA: CountryOutbreakData[] = [
  { code: 'NG', name: 'Nigeria', outbreaks: 89, cases: 3456, deaths: 412, vaccinations: 1200000, submissions: 456, rec: 'ecowas' },
  { code: 'EG', name: 'Egypt', outbreaks: 71, cases: 2800, deaths: 320, vaccinations: 980000, submissions: 389, rec: 'comesa' },
  { code: 'ET', name: 'Ethiopia', outbreaks: 63, cases: 2100, deaths: 280, vaccinations: 850000, submissions: 345, rec: 'igad' },
  { code: 'ZA', name: 'South Africa', outbreaks: 54, cases: 1560, deaths: 190, vaccinations: 1100000, submissions: 412, rec: 'sadc' },
  { code: 'KE', name: 'Kenya', outbreaks: 47, cases: 1234, deaths: 156, vaccinations: 920000, submissions: 523, rec: 'igad' },
  { code: 'CD', name: 'DR Congo', outbreaks: 45, cases: 1100, deaths: 165, vaccinations: 320000, submissions: 187, rec: 'eccas' },
  { code: 'CM', name: 'Cameroon', outbreaks: 41, cases: 980, deaths: 115, vaccinations: 450000, submissions: 234, rec: 'eccas' },
  { code: 'SD', name: 'Sudan', outbreaks: 38, cases: 920, deaths: 135, vaccinations: 280000, submissions: 156, rec: 'igad' },
  { code: 'TZ', name: 'Tanzania', outbreaks: 35, cases: 890, deaths: 95, vaccinations: 780000, submissions: 367, rec: 'eac' },
  { code: 'UG', name: 'Uganda', outbreaks: 28, cases: 670, deaths: 78, vaccinations: 540000, submissions: 289, rec: 'igad' },
  { code: 'DZ', name: 'Algeria', outbreaks: 25, cases: 580, deaths: 67, vaccinations: 620000, submissions: 198, rec: 'uma' },
  { code: 'GH', name: 'Ghana', outbreaks: 22, cases: 445, deaths: 52, vaccinations: 390000, submissions: 267, rec: 'ecowas' },
  { code: 'MZ', name: 'Mozambique', outbreaks: 21, cases: 490, deaths: 58, vaccinations: 310000, submissions: 145, rec: 'sadc' },
  { code: 'MA', name: 'Morocco', outbreaks: 19, cases: 410, deaths: 45, vaccinations: 720000, submissions: 312, rec: 'uma' },
  { code: 'SN', name: 'Senegal', outbreaks: 15, cases: 320, deaths: 38, vaccinations: 280000, submissions: 234, rec: 'ecowas' },
  { code: 'CI', name: "Côte d'Ivoire", outbreaks: 18, cases: 390, deaths: 42, vaccinations: 350000, submissions: 198, rec: 'ecowas' },
  { code: 'ZM', name: 'Zambia', outbreaks: 14, cases: 290, deaths: 34, vaccinations: 260000, submissions: 167, rec: 'sadc' },
  { code: 'ZW', name: 'Zimbabwe', outbreaks: 12, cases: 250, deaths: 28, vaccinations: 220000, submissions: 145, rec: 'sadc' },
  { code: 'ML', name: 'Mali', outbreaks: 16, cases: 340, deaths: 41, vaccinations: 190000, submissions: 123, rec: 'ecowas' },
  { code: 'BF', name: 'Burkina Faso', outbreaks: 13, cases: 270, deaths: 32, vaccinations: 170000, submissions: 98, rec: 'ecowas' },
  { code: 'NE', name: 'Niger', outbreaks: 11, cases: 230, deaths: 29, vaccinations: 150000, submissions: 87, rec: 'ecowas' },
  { code: 'MW', name: 'Malawi', outbreaks: 10, cases: 210, deaths: 24, vaccinations: 180000, submissions: 134, rec: 'sadc' },
  { code: 'TD', name: 'Chad', outbreaks: 17, cases: 360, deaths: 48, vaccinations: 120000, submissions: 76, rec: 'eccas' },
  { code: 'SO', name: 'Somalia', outbreaks: 20, cases: 450, deaths: 62, vaccinations: 80000, submissions: 54, rec: 'igad' },
  { code: 'SS', name: 'South Sudan', outbreaks: 15, cases: 310, deaths: 45, vaccinations: 60000, submissions: 43, rec: 'igad' },
  { code: 'MG', name: 'Madagascar', outbreaks: 9, cases: 190, deaths: 22, vaccinations: 210000, submissions: 112, rec: 'sadc' },
  { code: 'AO', name: 'Angola', outbreaks: 8, cases: 170, deaths: 19, vaccinations: 250000, submissions: 89, rec: 'sadc' },
  { code: 'GN', name: 'Guinea', outbreaks: 7, cases: 150, deaths: 18, vaccinations: 130000, submissions: 67, rec: 'ecowas' },
  { code: 'RW', name: 'Rwanda', outbreaks: 4, cases: 85, deaths: 8, vaccinations: 340000, submissions: 234, rec: 'eac' },
  { code: 'BW', name: 'Botswana', outbreaks: 3, cases: 60, deaths: 5, vaccinations: 290000, submissions: 189, rec: 'sadc' },
  { code: 'NA', name: 'Namibia', outbreaks: 5, cases: 110, deaths: 12, vaccinations: 260000, submissions: 156, rec: 'sadc' },
  { code: 'TN', name: 'Tunisia', outbreaks: 6, cases: 130, deaths: 14, vaccinations: 410000, submissions: 234, rec: 'uma' },
  { code: 'LY', name: 'Libya', outbreaks: 4, cases: 90, deaths: 10, vaccinations: 180000, submissions: 67, rec: 'uma' },
  { code: 'ER', name: 'Eritrea', outbreaks: 3, cases: 65, deaths: 7, vaccinations: 90000, submissions: 34, rec: 'igad' },
  { code: 'DJ', name: 'Djibouti', outbreaks: 2, cases: 30, deaths: 3, vaccinations: 45000, submissions: 23, rec: 'igad' },
  { code: 'BI', name: 'Burundi', outbreaks: 6, cases: 130, deaths: 15, vaccinations: 110000, submissions: 56, rec: 'eac' },
  { code: 'BJ', name: 'Benin', outbreaks: 5, cases: 100, deaths: 11, vaccinations: 140000, submissions: 89, rec: 'ecowas' },
  { code: 'TG', name: 'Togo', outbreaks: 4, cases: 80, deaths: 9, vaccinations: 120000, submissions: 67, rec: 'ecowas' },
  { code: 'SL', name: 'Sierra Leone', outbreaks: 3, cases: 70, deaths: 8, vaccinations: 90000, submissions: 45, rec: 'ecowas' },
  { code: 'LR', name: 'Liberia', outbreaks: 2, cases: 45, deaths: 5, vaccinations: 70000, submissions: 34, rec: 'ecowas' },
  { code: 'CF', name: 'Central African Rep.', outbreaks: 8, cases: 180, deaths: 25, vaccinations: 50000, submissions: 28, rec: 'eccas' },
  { code: 'CG', name: 'Congo', outbreaks: 5, cases: 110, deaths: 13, vaccinations: 95000, submissions: 56, rec: 'eccas' },
  { code: 'GA', name: 'Gabon', outbreaks: 2, cases: 40, deaths: 4, vaccinations: 85000, submissions: 67, rec: 'eccas' },
  { code: 'GQ', name: 'Equatorial Guinea', outbreaks: 1, cases: 15, deaths: 1, vaccinations: 35000, submissions: 23, rec: 'eccas' },
  { code: 'ST', name: 'São Tomé', outbreaks: 0, cases: 0, deaths: 0, vaccinations: 12000, submissions: 12, rec: 'eccas' },
  { code: 'GM', name: 'Gambia', outbreaks: 1, cases: 20, deaths: 2, vaccinations: 45000, submissions: 34, rec: 'ecowas' },
  { code: 'GW', name: 'Guinea-Bissau', outbreaks: 1, cases: 25, deaths: 3, vaccinations: 30000, submissions: 19, rec: 'ecowas' },
  { code: 'CV', name: 'Cabo Verde', outbreaks: 0, cases: 0, deaths: 0, vaccinations: 25000, submissions: 18, rec: 'ecowas' },
  { code: 'LS', name: 'Lesotho', outbreaks: 1, cases: 15, deaths: 1, vaccinations: 55000, submissions: 34, rec: 'sadc' },
  { code: 'SZ', name: 'Eswatini', outbreaks: 2, cases: 35, deaths: 3, vaccinations: 65000, submissions: 45, rec: 'sadc' },
  { code: 'KM', name: 'Comoros', outbreaks: 0, cases: 0, deaths: 0, vaccinations: 15000, submissions: 8, rec: 'sadc' },
  { code: 'MU', name: 'Mauritius', outbreaks: 1, cases: 10, deaths: 0, vaccinations: 95000, submissions: 67, rec: 'sadc' },
  { code: 'SC', name: 'Seychelles', outbreaks: 0, cases: 0, deaths: 0, vaccinations: 12000, submissions: 15, rec: 'sadc' },
  { code: 'MR', name: 'Mauritania', outbreaks: 7, cases: 140, deaths: 16, vaccinations: 100000, submissions: 56, rec: 'uma' },
];

export interface MonthlyTrendPoint {
  month: string;
  label: string;
  outbreaks: number;
  cases: number;
  deaths: number;
  submissions: number;
  vaccinations: number;
}

export const DEMO_MONTHLY_TRENDS: MonthlyTrendPoint[] = [
  { month: '2025-01', label: 'Jan', outbreaks: 145, cases: 5600, deaths: 680, submissions: 2340, vaccinations: 4500000 },
  { month: '2025-02', label: 'Feb', outbreaks: 132, cases: 5100, deaths: 620, submissions: 2180, vaccinations: 4200000 },
  { month: '2025-03', label: 'Mar', outbreaks: 168, cases: 6400, deaths: 780, submissions: 2560, vaccinations: 3800000 },
  { month: '2025-04', label: 'Apr', outbreaks: 189, cases: 7200, deaths: 870, submissions: 2890, vaccinations: 3500000 },
  { month: '2025-05', label: 'May', outbreaks: 210, cases: 8100, deaths: 960, submissions: 3120, vaccinations: 3200000 },
  { month: '2025-06', label: 'Jun', outbreaks: 235, cases: 9000, deaths: 1080, submissions: 3450, vaccinations: 2900000 },
  { month: '2025-07', label: 'Jul', outbreaks: 247, cases: 9500, deaths: 1140, submissions: 3680, vaccinations: 2700000 },
  { month: '2025-08', label: 'Aug', outbreaks: 220, cases: 8400, deaths: 1010, submissions: 3290, vaccinations: 3100000 },
  { month: '2025-09', label: 'Sep', outbreaks: 195, cases: 7500, deaths: 900, submissions: 2980, vaccinations: 3600000 },
  { month: '2025-10', label: 'Oct', outbreaks: 178, cases: 6800, deaths: 820, submissions: 2760, vaccinations: 4000000 },
  { month: '2025-11', label: 'Nov', outbreaks: 160, cases: 6100, deaths: 740, submissions: 2540, vaccinations: 4300000 },
  { month: '2025-12', label: 'Dec', outbreaks: 152, cases: 5800, deaths: 700, submissions: 2400, vaccinations: 4600000 },
];

export interface DiseaseData {
  disease: string;
  code: string;
  cases: number;
  deaths: number;
  countriesAffected: number;
  color: string;
}

export const DEMO_DISEASES: DiseaseData[] = [
  { disease: 'Foot-and-Mouth Disease', code: 'FMD', cases: 4500, deaths: 320, countriesAffected: 32, color: '#ef4444' },
  { disease: 'Peste des Petits Ruminants', code: 'PPR', cases: 3200, deaths: 450, countriesAffected: 28, color: '#f97316' },
  { disease: 'Highly Path. Avian Influenza', code: 'HPAI', cases: 2800, deaths: 2100, countriesAffected: 15, color: '#eab308' },
  { disease: 'African Swine Fever', code: 'ASF', cases: 2100, deaths: 1800, countriesAffected: 22, color: '#84cc16' },
  { disease: 'Rift Valley Fever', code: 'RVF', cases: 1800, deaths: 290, countriesAffected: 12, color: '#22c55e' },
  { disease: 'Lumpy Skin Disease', code: 'LSD', cases: 1500, deaths: 120, countriesAffected: 25, color: '#06b6d4' },
  { disease: 'Contagious Bovine PP', code: 'CBPP', cases: 1200, deaths: 180, countriesAffected: 18, color: '#3b82f6' },
  { disease: 'Rabies', code: 'Rabies', cases: 980, deaths: 890, countriesAffected: 40, color: '#8b5cf6' },
  { disease: 'Newcastle Disease', code: 'ND', cases: 870, deaths: 650, countriesAffected: 35, color: '#d946ef' },
  { disease: 'Anthrax', code: 'Anthrax', cases: 560, deaths: 120, countriesAffected: 20, color: '#f43f5e' },
];

export interface AlertData {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  disease: string;
  country: string;
  countryCode: string;
  message: string;
  date: string;
}

export const DEMO_ALERTS: AlertData[] = [
  { id: 'a1', severity: 'critical', disease: 'ASF', country: 'Uganda', countryCode: 'UG', message: 'New ASF outbreak confirmed in Kampala District — 45 pigs culled', date: '2025-12-20' },
  { id: 'a2', severity: 'critical', disease: 'HPAI', country: 'Egypt', countryCode: 'EG', message: 'H5N1 detected in commercial poultry farm near Cairo', date: '2025-12-19' },
  { id: 'a3', severity: 'warning', disease: 'FMD', country: 'Kenya', countryCode: 'KE', message: 'FMD cases increasing in Rift Valley Province', date: '2025-12-18' },
  { id: 'a4', severity: 'warning', disease: 'RVF', country: 'Somalia', countryCode: 'SO', message: 'RVF risk elevated due to heavy rains in Jubbaland', date: '2025-12-17' },
  { id: 'a5', severity: 'warning', disease: 'PPR', country: 'Nigeria', countryCode: 'NG', message: 'PPR vaccination campaign delayed in Borno State', date: '2025-12-16' },
  { id: 'a6', severity: 'info', disease: 'LSD', country: 'Ethiopia', countryCode: 'ET', message: 'LSD vaccination campaign completed in Oromia — 85% coverage', date: '2025-12-16' },
  { id: 'a7', severity: 'info', disease: 'PPR', country: 'Niger', countryCode: 'NE', message: 'PPR surveillance report submitted for Q4 2025', date: '2025-12-15' },
  { id: 'a8', severity: 'info', disease: 'FMD', country: 'Tanzania', countryCode: 'TZ', message: 'FMD outbreak in Arusha declared controlled', date: '2025-12-14' },
];

export interface HeatmapCell {
  country: string;
  countryCode: string;
  month: string;
  value: number;
}

export const DEMO_HEATMAP_DATA: HeatmapCell[] = (() => {
  const countries = ['Kenya', 'Nigeria', 'Ethiopia', 'Tanzania', 'South Africa', 'Egypt', 'Ghana', 'Uganda', 'Senegal', 'Cameroon', 'Sudan', 'DR Congo', 'Morocco', 'Algeria', 'Mozambique'];
  const codes = ['KE', 'NG', 'ET', 'TZ', 'ZA', 'EG', 'GH', 'UG', 'SN', 'CM', 'SD', 'CD', 'MA', 'DZ', 'MZ'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const result: HeatmapCell[] = [];
  countries.forEach((country, ci) => {
    months.forEach((month, mi) => {
      // Seasonal pattern: peaks in rainy season (Apr-Aug)
      const base = 10 + ci * 3;
      const seasonal = Math.sin((mi - 1) * Math.PI / 6) * 15;
      const noise = Math.floor(Math.random() * 10);
      result.push({
        country,
        countryCode: codes[ci],
        month,
        value: Math.max(0, Math.round(base + seasonal + noise)),
      });
    });
  });
  return result;
})();

export interface EpiCurvePoint {
  week: string;
  weekNum: number;
  cases: number;
  deaths: number;
  movingAvg: number;
}

export const DEMO_EPI_CURVE: EpiCurvePoint[] = (() => {
  const points: EpiCurvePoint[] = [];
  let movingSum = 0;
  const window = 4;
  for (let w = 1; w <= 52; w++) {
    // Simulate FMD epi curve with peak around week 20-30
    const base = 40;
    const peak = 80 * Math.exp(-0.5 * ((w - 25) / 8) ** 2);
    const noise = Math.floor(Math.random() * 15);
    const cases = Math.round(base + peak + noise);
    const deaths = Math.round(cases * (0.06 + Math.random() * 0.04));
    movingSum += cases;
    if (w > window) movingSum -= points[w - window - 1].cases;
    const movingAvg = Math.round(movingSum / Math.min(w, window));
    points.push({
      week: `W${String(w).padStart(2, '0')}`,
      weekNum: w,
      cases,
      deaths,
      movingAvg,
    });
  }
  return points;
})();

export interface RainfallPoint {
  month: string;
  rainfall: number;
  rvfCases: number;
  normalRainfall: number;
}

export const DEMO_RAINFALL: RainfallPoint[] = [
  { month: 'Jan', rainfall: 45, rvfCases: 12, normalRainfall: 50 },
  { month: 'Feb', rainfall: 38, rvfCases: 8, normalRainfall: 42 },
  { month: 'Mar', rainfall: 85, rvfCases: 25, normalRainfall: 75 },
  { month: 'Apr', rainfall: 165, rvfCases: 78, normalRainfall: 140 },
  { month: 'May', rainfall: 210, rvfCases: 145, normalRainfall: 180 },
  { month: 'Jun', rainfall: 120, rvfCases: 92, normalRainfall: 110 },
  { month: 'Jul', rainfall: 55, rvfCases: 45, normalRainfall: 60 },
  { month: 'Aug', rainfall: 40, rvfCases: 22, normalRainfall: 45 },
  { month: 'Sep', rainfall: 35, rvfCases: 15, normalRainfall: 38 },
  { month: 'Oct', rainfall: 90, rvfCases: 38, normalRainfall: 85 },
  { month: 'Nov', rainfall: 180, rvfCases: 110, normalRainfall: 160 },
  { month: 'Dec', rainfall: 95, rvfCases: 55, normalRainfall: 90 },
];

export interface ActivityItem {
  id: string;
  type: 'submission' | 'validation' | 'import' | 'alert' | 'export' | 'campaign';
  action: string;
  detail: string;
  actor: string;
  country: string;
  timestamp: string;
}

export const DEMO_ACTIVITIES: ActivityItem[] = [
  { id: 'act-1', type: 'submission', action: 'Form Submitted', detail: 'Disease Surveillance Q4 2025 — FMD report', actor: 'Dr. Ochieng', country: 'Kenya', timestamp: '2025-12-20T14:32:00Z' },
  { id: 'act-2', type: 'validation', action: 'Report Validated', detail: 'Vaccination campaign report approved (Level 2)', actor: 'CVO Office', country: 'Nigeria', timestamp: '2025-12-20T13:45:00Z' },
  { id: 'act-3', type: 'import', action: 'Dataset Imported', detail: 'FAOSTAT Livestock Census 2024 — 12,450 records', actor: 'System', country: 'Continental', timestamp: '2025-12-20T12:15:00Z' },
  { id: 'act-4', type: 'alert', action: 'Alert Generated', detail: 'ASF outbreak detected in Kampala District', actor: 'Surveillance', country: 'Uganda', timestamp: '2025-12-20T11:30:00Z' },
  { id: 'act-5', type: 'validation', action: 'Report Validated', detail: 'Trade flow data Q3 2025 — SPS certificates', actor: 'Data Steward', country: 'Tanzania', timestamp: '2025-12-20T10:20:00Z' },
  { id: 'act-6', type: 'export', action: 'WAHIS Export', detail: 'WAHIS 6-monthly report exported for review', actor: 'WAHIS Focal', country: 'Ethiopia', timestamp: '2025-12-20T09:00:00Z' },
  { id: 'act-7', type: 'campaign', action: 'Campaign Started', detail: 'PPR vaccination campaign launched — Borno State', actor: 'Field Agent', country: 'Nigeria', timestamp: '2025-12-19T16:45:00Z' },
  { id: 'act-8', type: 'submission', action: 'Form Submitted', detail: 'Lab results — HPAI H5N1 confirmation', actor: 'Lab Director', country: 'Egypt', timestamp: '2025-12-19T15:30:00Z' },
  { id: 'act-9', type: 'import', action: 'Dataset Updated', detail: 'Species taxonomy refresh — 234 new entries', actor: 'System', country: 'Continental', timestamp: '2025-12-19T14:00:00Z' },
  { id: 'act-10', type: 'validation', action: 'Report Rejected', detail: 'Census data incomplete — missing 3 provinces', actor: 'REC Steward', country: 'DR Congo', timestamp: '2025-12-19T11:15:00Z' },
];

// ─── Aggregated KPIs ────────────────────────────────────────────────────────

export interface DashboardKpis {
  countriesReporting: number;
  totalCountries: number;
  totalReports: number;
  reportsTrend: number;
  totalVaccinations: number;
  vaccinationsTrend: number;
  totalTreated: number;
  treatedTrend: number;
  totalTrained: number;
  trainedTrend: number;
  validationRate: number;
  validationTrend: number;
  datasetsImported: number;
  datasetsTrend: number;
  totalRecords: number;
  recordsTrend: number;
}

export const DEMO_KPIS: DashboardKpis = {
  countriesReporting: 42,
  totalCountries: 55,
  totalReports: 831,
  reportsTrend: 12,
  totalVaccinations: 385400000,
  vaccinationsTrend: 8,
  totalTreated: 43700000,
  treatedTrend: 0,
  totalTrained: 1890000,
  trainedTrend: 15,
  validationRate: 87,
  validationTrend: 5,
  datasetsImported: 15,
  datasetsTrend: 2,
  totalRecords: 1700000000,
  recordsTrend: 23,
};

// ─── Admin1 (sub-national) data ─────────────────────────────────────────────

export interface Admin1OutbreakData {
  code: string;       // e.g. 'KE-01'
  name: string;       // e.g. 'Nairobi'
  outbreaks: number;
  cases: number;
  countryCode: string; // parent country ISO code
}

/** Deterministic Admin1 data per country. */
export const DEMO_ADMIN1_DATA: Record<string, Admin1OutbreakData[]> = {
  NG: [
    { code: 'NG-BO', name: 'Borno', outbreaks: 14, cases: 540, countryCode: 'NG' },
    { code: 'NG-KN', name: 'Kano', outbreaks: 12, cases: 480, countryCode: 'NG' },
    { code: 'NG-KD', name: 'Kaduna', outbreaks: 10, cases: 380, countryCode: 'NG' },
    { code: 'NG-PL', name: 'Plateau', outbreaks: 9, cases: 350, countryCode: 'NG' },
    { code: 'NG-OY', name: 'Oyo', outbreaks: 8, cases: 310, countryCode: 'NG' },
    { code: 'NG-LA', name: 'Lagos', outbreaks: 7, cases: 290, countryCode: 'NG' },
    { code: 'NG-BA', name: 'Bauchi', outbreaks: 6, cases: 240, countryCode: 'NG' },
    { code: 'NG-SO', name: 'Sokoto', outbreaks: 6, cases: 210, countryCode: 'NG' },
    { code: 'NG-AD', name: 'Adamawa', outbreaks: 5, cases: 200, countryCode: 'NG' },
    { code: 'NG-NI', name: 'Niger', outbreaks: 5, cases: 180, countryCode: 'NG' },
    { code: 'NG-BE', name: 'Benue', outbreaks: 4, cases: 150, countryCode: 'NG' },
    { code: 'NG-ZA', name: 'Zamfara', outbreaks: 3, cases: 126, countryCode: 'NG' },
  ],
  EG: [
    { code: 'EG-C', name: 'Cairo', outbreaks: 12, cases: 480, countryCode: 'EG' },
    { code: 'EG-SHR', name: 'Sharqia', outbreaks: 10, cases: 390, countryCode: 'EG' },
    { code: 'EG-GH', name: 'Gharbia', outbreaks: 9, cases: 350, countryCode: 'EG' },
    { code: 'EG-DK', name: 'Dakahlia', outbreaks: 8, cases: 320, countryCode: 'EG' },
    { code: 'EG-FYM', name: 'Fayoum', outbreaks: 7, cases: 280, countryCode: 'EG' },
    { code: 'EG-MN', name: 'Minya', outbreaks: 7, cases: 260, countryCode: 'EG' },
    { code: 'EG-BH', name: 'Beheira', outbreaks: 6, cases: 230, countryCode: 'EG' },
    { code: 'EG-ASN', name: 'Aswan', outbreaks: 5, cases: 200, countryCode: 'EG' },
    { code: 'EG-AST', name: 'Asyut', outbreaks: 4, cases: 160, countryCode: 'EG' },
    { code: 'EG-SHG', name: 'Sohag', outbreaks: 3, cases: 130, countryCode: 'EG' },
  ],
  ET: [
    { code: 'ET-OR', name: 'Oromia', outbreaks: 15, cases: 520, countryCode: 'ET' },
    { code: 'ET-AM', name: 'Amhara', outbreaks: 12, cases: 410, countryCode: 'ET' },
    { code: 'ET-SN', name: 'SNNPR', outbreaks: 9, cases: 340, countryCode: 'ET' },
    { code: 'ET-SO', name: 'Somali', outbreaks: 8, cases: 280, countryCode: 'ET' },
    { code: 'ET-TI', name: 'Tigray', outbreaks: 6, cases: 190, countryCode: 'ET' },
    { code: 'ET-AF', name: 'Afar', outbreaks: 5, cases: 160, countryCode: 'ET' },
    { code: 'ET-GA', name: 'Gambella', outbreaks: 4, cases: 110, countryCode: 'ET' },
    { code: 'ET-BE', name: 'Benishangul-G.', outbreaks: 3, cases: 70, countryCode: 'ET' },
    { code: 'ET-AA', name: 'Addis Ababa', outbreaks: 1, cases: 20, countryCode: 'ET' },
  ],
  ZA: [
    { code: 'ZA-LP', name: 'Limpopo', outbreaks: 12, cases: 380, countryCode: 'ZA' },
    { code: 'ZA-MP', name: 'Mpumalanga', outbreaks: 9, cases: 280, countryCode: 'ZA' },
    { code: 'ZA-KZN', name: 'KwaZulu-Natal', outbreaks: 8, cases: 260, countryCode: 'ZA' },
    { code: 'ZA-NW', name: 'North West', outbreaks: 7, cases: 210, countryCode: 'ZA' },
    { code: 'ZA-FS', name: 'Free State', outbreaks: 6, cases: 170, countryCode: 'ZA' },
    { code: 'ZA-EC', name: 'Eastern Cape', outbreaks: 5, cases: 120, countryCode: 'ZA' },
    { code: 'ZA-GT', name: 'Gauteng', outbreaks: 4, cases: 80, countryCode: 'ZA' },
    { code: 'ZA-WC', name: 'Western Cape', outbreaks: 2, cases: 40, countryCode: 'ZA' },
    { code: 'ZA-NC', name: 'Northern Cape', outbreaks: 1, cases: 20, countryCode: 'ZA' },
  ],
  KE: [
    { code: 'KE-RV', name: 'Rift Valley', outbreaks: 12, cases: 340, countryCode: 'KE' },
    { code: 'KE-NE', name: 'North Eastern', outbreaks: 8, cases: 240, countryCode: 'KE' },
    { code: 'KE-CO', name: 'Coast', outbreaks: 7, cases: 200, countryCode: 'KE' },
    { code: 'KE-EA', name: 'Eastern', outbreaks: 6, cases: 170, countryCode: 'KE' },
    { code: 'KE-NY', name: 'Nyanza', outbreaks: 5, cases: 120, countryCode: 'KE' },
    { code: 'KE-WE', name: 'Western', outbreaks: 4, cases: 90, countryCode: 'KE' },
    { code: 'KE-CE', name: 'Central', outbreaks: 3, cases: 50, countryCode: 'KE' },
    { code: 'KE-NB', name: 'Nairobi', outbreaks: 2, cases: 24, countryCode: 'KE' },
  ],
  CD: [
    { code: 'CD-KN', name: 'Kinshasa', outbreaks: 6, cases: 160, countryCode: 'CD' },
    { code: 'CD-EQ', name: 'Équateur', outbreaks: 7, cases: 180, countryCode: 'CD' },
    { code: 'CD-KA', name: 'Katanga', outbreaks: 8, cases: 200, countryCode: 'CD' },
    { code: 'CD-OR', name: 'Orientale', outbreaks: 6, cases: 150, countryCode: 'CD' },
    { code: 'CD-SK', name: 'Sud-Kivu', outbreaks: 5, cases: 130, countryCode: 'CD' },
    { code: 'CD-NK', name: 'Nord-Kivu', outbreaks: 5, cases: 120, countryCode: 'CD' },
    { code: 'CD-KW', name: 'Kwilu', outbreaks: 4, cases: 90, countryCode: 'CD' },
    { code: 'CD-MA', name: 'Maniema', outbreaks: 4, cases: 70, countryCode: 'CD' },
  ],
  CM: [
    { code: 'CM-AD', name: 'Adamawa', outbreaks: 8, cases: 210, countryCode: 'CM' },
    { code: 'CM-NO', name: 'North', outbreaks: 7, cases: 180, countryCode: 'CM' },
    { code: 'CM-EN', name: 'Far North', outbreaks: 7, cases: 170, countryCode: 'CM' },
    { code: 'CM-NW', name: 'North-West', outbreaks: 5, cases: 120, countryCode: 'CM' },
    { code: 'CM-CE', name: 'Centre', outbreaks: 5, cases: 110, countryCode: 'CM' },
    { code: 'CM-LT', name: 'Littoral', outbreaks: 4, cases: 90, countryCode: 'CM' },
    { code: 'CM-SU', name: 'South', outbreaks: 3, cases: 60, countryCode: 'CM' },
    { code: 'CM-SW', name: 'South-West', outbreaks: 2, cases: 40, countryCode: 'CM' },
  ],
  SD: [
    { code: 'SD-KH', name: 'Khartoum', outbreaks: 6, cases: 150, countryCode: 'SD' },
    { code: 'SD-DN', name: 'North Darfur', outbreaks: 7, cases: 180, countryCode: 'SD' },
    { code: 'SD-DS', name: 'South Darfur', outbreaks: 6, cases: 160, countryCode: 'SD' },
    { code: 'SD-KA', name: 'Kassala', outbreaks: 5, cases: 130, countryCode: 'SD' },
    { code: 'SD-GD', name: 'Gedaref', outbreaks: 5, cases: 120, countryCode: 'SD' },
    { code: 'SD-KS', name: 'South Kordofan', outbreaks: 4, cases: 100, countryCode: 'SD' },
    { code: 'SD-NB', name: 'Blue Nile', outbreaks: 3, cases: 50, countryCode: 'SD' },
    { code: 'SD-NO', name: 'Northern', outbreaks: 2, cases: 30, countryCode: 'SD' },
  ],
  TZ: [
    { code: 'TZ-AR', name: 'Arusha', outbreaks: 7, cases: 180, countryCode: 'TZ' },
    { code: 'TZ-DS', name: 'Dar es Salaam', outbreaks: 4, cases: 90, countryCode: 'TZ' },
    { code: 'TZ-DO', name: 'Dodoma', outbreaks: 5, cases: 130, countryCode: 'TZ' },
    { code: 'TZ-MN', name: 'Manyara', outbreaks: 5, cases: 120, countryCode: 'TZ' },
    { code: 'TZ-SH', name: 'Shinyanga', outbreaks: 4, cases: 110, countryCode: 'TZ' },
    { code: 'TZ-MW', name: 'Mwanza', outbreaks: 4, cases: 100, countryCode: 'TZ' },
    { code: 'TZ-MR', name: 'Morogoro', outbreaks: 3, cases: 90, countryCode: 'TZ' },
    { code: 'TZ-KI', name: 'Kilimanjaro', outbreaks: 3, cases: 70, countryCode: 'TZ' },
  ],
  UG: [
    { code: 'UG-KA', name: 'Kampala', outbreaks: 5, cases: 120, countryCode: 'UG' },
    { code: 'UG-WE', name: 'Western', outbreaks: 6, cases: 150, countryCode: 'UG' },
    { code: 'UG-NO', name: 'Northern', outbreaks: 5, cases: 130, countryCode: 'UG' },
    { code: 'UG-EA', name: 'Eastern', outbreaks: 5, cases: 120, countryCode: 'UG' },
    { code: 'UG-CE', name: 'Central', outbreaks: 4, cases: 90, countryCode: 'UG' },
    { code: 'UG-KG', name: 'Karamoja', outbreaks: 3, cases: 60, countryCode: 'UG' },
  ],
  GH: [
    { code: 'GH-AA', name: 'Greater Accra', outbreaks: 4, cases: 90, countryCode: 'GH' },
    { code: 'GH-AH', name: 'Ashanti', outbreaks: 4, cases: 80, countryCode: 'GH' },
    { code: 'GH-NO', name: 'Northern', outbreaks: 4, cases: 75, countryCode: 'GH' },
    { code: 'GH-UE', name: 'Upper East', outbreaks: 3, cases: 65, countryCode: 'GH' },
    { code: 'GH-UW', name: 'Upper West', outbreaks: 3, cases: 60, countryCode: 'GH' },
    { code: 'GH-VR', name: 'Volta', outbreaks: 2, cases: 45, countryCode: 'GH' },
    { code: 'GH-EP', name: 'Eastern', outbreaks: 2, cases: 30, countryCode: 'GH' },
  ],
  SN: [
    { code: 'SN-DK', name: 'Dakar', outbreaks: 3, cases: 65, countryCode: 'SN' },
    { code: 'SN-SL', name: 'Saint-Louis', outbreaks: 3, cases: 60, countryCode: 'SN' },
    { code: 'SN-TC', name: 'Tambacounda', outbreaks: 2, cases: 55, countryCode: 'SN' },
    { code: 'SN-KL', name: 'Kaolack', outbreaks: 2, cases: 50, countryCode: 'SN' },
    { code: 'SN-TH', name: 'Thiès', outbreaks: 2, cases: 45, countryCode: 'SN' },
    { code: 'SN-ZG', name: 'Ziguinchor', outbreaks: 2, cases: 30, countryCode: 'SN' },
    { code: 'SN-KD', name: 'Kolda', outbreaks: 1, cases: 15, countryCode: 'SN' },
  ],
  SO: [
    { code: 'SO-BN', name: 'Banaadir', outbreaks: 4, cases: 90, countryCode: 'SO' },
    { code: 'SO-JH', name: 'Jubbaland', outbreaks: 4, cases: 85, countryCode: 'SO' },
    { code: 'SO-HI', name: 'Hirshabelle', outbreaks: 3, cases: 70, countryCode: 'SO' },
    { code: 'SO-GA', name: 'Galmudug', outbreaks: 3, cases: 65, countryCode: 'SO' },
    { code: 'SO-SW', name: 'South West', outbreaks: 3, cases: 75, countryCode: 'SO' },
    { code: 'SO-PL', name: 'Puntland', outbreaks: 3, cases: 65, countryCode: 'SO' },
  ],
  DZ: [
    { code: 'DZ-AL', name: 'Algiers', outbreaks: 4, cases: 95, countryCode: 'DZ' },
    { code: 'DZ-OR', name: 'Oran', outbreaks: 4, cases: 85, countryCode: 'DZ' },
    { code: 'DZ-BL', name: 'Blida', outbreaks: 3, cases: 75, countryCode: 'DZ' },
    { code: 'DZ-SE', name: 'Sétif', outbreaks: 3, cases: 70, countryCode: 'DZ' },
    { code: 'DZ-CO', name: 'Constantine', outbreaks: 3, cases: 65, countryCode: 'DZ' },
    { code: 'DZ-TI', name: 'Tiaret', outbreaks: 3, cases: 95, countryCode: 'DZ' },
    { code: 'DZ-MS', name: 'M\'Sila', outbreaks: 3, cases: 55, countryCode: 'DZ' },
    { code: 'DZ-BJ', name: 'Béjaïa', outbreaks: 2, cases: 40, countryCode: 'DZ' },
  ],
  MA: [
    { code: 'MA-CAS', name: 'Casablanca-Settat', outbreaks: 4, cases: 85, countryCode: 'MA' },
    { code: 'MA-RAB', name: 'Rabat-Salé-K.', outbreaks: 3, cases: 65, countryCode: 'MA' },
    { code: 'MA-FES', name: 'Fès-Meknès', outbreaks: 3, cases: 70, countryCode: 'MA' },
    { code: 'MA-MAR', name: 'Marrakech-Safi', outbreaks: 3, cases: 65, countryCode: 'MA' },
    { code: 'MA-TAN', name: 'Tanger-Tétouan', outbreaks: 3, cases: 60, countryCode: 'MA' },
    { code: 'MA-SOK', name: 'Souss-Massa', outbreaks: 2, cases: 40, countryCode: 'MA' },
    { code: 'MA-BM', name: 'Béni Mellal-K.', outbreaks: 1, cases: 25, countryCode: 'MA' },
  ],
};

// ─── Filter helpers ─────────────────────────────────────────────────────────

export function filterCountryData(
  data: CountryOutbreakData[],
  filters: { rec?: string; country?: string },
): CountryOutbreakData[] {
  let filtered = data;
  if (filters.rec && filters.rec !== 'all') {
    filtered = filtered.filter((d) => d.rec === filters.rec);
  }
  if (filters.country && filters.country !== 'all') {
    filtered = filtered.filter((d) => d.code === filters.country);
  }
  return filtered;
}
