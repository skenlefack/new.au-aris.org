'use client';

import { useQuery } from '@tanstack/react-query';
import { histFetch, HIST_API_BASE } from '@/lib/api/historical-hooks';
import type { DashboardFilters } from './GlobalFilterContext';
import {
  DEMO_KPIS,
  DEMO_COUNTRY_DATA,
  DEMO_MONTHLY_TRENDS,
  DEMO_DISEASES,
  DEMO_ALERTS,
  DEMO_HEATMAP_DATA,
  DEMO_EPI_CURVE,
  DEMO_RAINFALL,
  DEMO_ACTIVITIES,
  type DashboardKpis,
  type CountryOutbreakData,
  type MonthlyTrendPoint,
  type DiseaseData,
  type AlertData,
  type HeatmapCell,
  type EpiCurvePoint,
  type RainfallPoint,
  type ActivityItem,
} from './demo-data';

// ── Country name → ISO code lookup ──────────────────────────────────────────

const COUNTRY_NAME_TO_CODE: Record<string, string> = {};
const COUNTRY_CODE_TO_REC: Record<string, string> = {};
const COUNTRY_CODE_TO_NAME: Record<string, string> = {};
for (const c of DEMO_COUNTRY_DATA) {
  COUNTRY_NAME_TO_CODE[c.name.toLowerCase()] = c.code;
  COUNTRY_CODE_TO_REC[c.code] = c.rec;
  COUNTRY_CODE_TO_NAME[c.code] = c.name;
}
const COUNTRY_ALIASES: Record<string, string> = {
  'the gambia': 'GM', 'gambia': 'GM', "cote d'ivoire": 'CI', 'ivory coast': 'CI',
  'dr congo': 'CD', 'democratic republic of the congo': 'CD', 'congo (dem. rep.)': 'CD',
  'congo': 'CG', 'republic of the congo': 'CG',
  'south africa': 'ZA', 'tanzania': 'TZ', 'united republic of tanzania': 'TZ',
  'cabo verde': 'CV', 'cape verde': 'CV', 'eswatini': 'SZ', 'swaziland': 'SZ',
  'burkina faso': 'BF', 'guinea-bissau': 'GW', 'sierra leone': 'SL',
  'south sudan': 'SS', 'central african republic': 'CF', 'central african rep.': 'CF',
  'equatorial guinea': 'GQ', 'sao tome': 'ST', 'sao tome and principe': 'ST',
  'lesotho': 'LS', 'botswana': 'BW', 'namibia': 'NA', 'zimbabwe': 'ZW',
  'zambia': 'ZM', 'malawi': 'MW', 'mozambique': 'MZ', 'madagascar': 'MG',
  'mauritius': 'MU', 'comoros': 'KM', 'seychelles': 'SC', 'djibouti': 'DJ',
  'eritrea': 'ER', 'somalia': 'SO', 'sudan': 'SD', 'uganda': 'UG',
  'rwanda': 'RW', 'burundi': 'BI', 'kenya': 'KE', 'ethiopia': 'ET',
  'nigeria': 'NG', 'ghana': 'GH', 'senegal': 'SN', 'mali': 'ML',
  'niger': 'NE', 'chad': 'TD', 'cameroon': 'CM', 'gabon': 'GA',
  'angola': 'AO', 'guinea': 'GN', 'benin': 'BJ', 'togo': 'TG',
  'liberia': 'LR', 'mauritania': 'MR', 'egypt': 'EG', 'libya': 'LY',
  'tunisia': 'TN', 'algeria': 'DZ', 'morocco': 'MA',
};

function resolveCountryCode(location: string): string | null {
  if (!location) return null;
  const country = location.split('/')[0].trim().toLowerCase();
  return COUNTRY_NAME_TO_CODE[country] ?? COUNTRY_ALIASES[country] ?? null;
}

// ── Disease color palette ───────────────────────────────────────────────────

const DISEASE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e',
  '#fb923c', '#a3e635', '#2dd4bf', '#818cf8', '#e879f9',
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STALE_TIME = 5 * 60_000;

// ── Dataset categorization ──────────────────────────────────────────────────

interface DatasetInfo {
  id: string;
  name: string;
  rowCount: number;
  type: 'health' | 'vaccination' | 'mass_vacc' | 'population' | 'other';
}

function categorizeDataset(d: { id: string; name: string; rowCount: number }): DatasetInfo {
  const n = d.name.toLowerCase();
  let type: DatasetInfo['type'] = 'other';
  if (n.includes('animal health report')) type = 'health';
  else if (n.includes('monthly vaccination')) type = 'vaccination';
  else if (n.includes('mass vaccination')) type = 'mass_vacc';
  else if (n.includes('animal population')) type = 'population';
  return { ...d, type };
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN HOOK
// ═════════════════════════════════════════════════════════════════════════════

export function useDashboardData(filters?: DashboardFilters) {
  // ── Build API filters from dashboard filters ────────────────────────────
  const apiFilters: Record<string, string> = {};
  if (filters?.country && filters.country !== 'all') {
    // Map ISO code back to country name for admin_location ILIKE filter
    apiFilters['admin_location'] = COUNTRY_CODE_TO_NAME[filters.country] ?? filters.country;
  }
  if (filters?.disease && filters.disease !== 'all') {
    apiFilters['disease'] = filters.disease;
  }
  // Period → date range (all = no filter)
  if (filters?.period && filters.period !== 'all') {
    const now = new Date();
    if (filters.period === 'last_12_months') {
      const d = new Date(now); d.setMonth(d.getMonth() - 12);
      apiFilters['dateFrom'] = d.toISOString().slice(0, 10);
    } else if (filters.period === 'last_6_months') {
      const d = new Date(now); d.setMonth(d.getMonth() - 6);
      apiFilters['dateFrom'] = d.toISOString().slice(0, 10);
    } else if (filters.period === 'last_30_days') {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      apiFilters['dateFrom'] = d.toISOString().slice(0, 10);
    } else if (/^\d{4}$/.test(filters.period)) {
      apiFilters['dateFrom'] = `${filters.period}-01-01`;
      apiFilters['dateTo'] = `${filters.period}-12-31`;
    }
  }
  // REC filter → expand to country names for client-side filtering (API doesn't know RECs)
  const recFilter = filters?.rec && filters.rec !== 'all' ? filters.rec : null;

  const hasApiFilters = Object.keys(apiFilters).length > 0;
  const filterKey = JSON.stringify(apiFilters);

  // Filters WITHOUT disease (for the disease distribution query itself)
  const { disease: _excludeDisease, ...apiFiltersNoDisease } = apiFilters;
  const hasFiltersNoDisease = Object.keys(apiFiltersNoDisease).length > 0;
  const filterKeyNoDisease = JSON.stringify(apiFiltersNoDisease);

  // 1. Get all datasets
  const datasetsQuery = useQuery<{ data: Array<{ id: string; name: string; rowCount: number; status: string }> }>({
    queryKey: ['dashboard-datasets'],
    queryFn: () => histFetch(`${HIST_API_BASE}?status=READY&limit=100`),
    staleTime: STALE_TIME,
  });

  const allDatasets = (datasetsQuery.data?.data ?? []).map(categorizeDataset);
  const healthIds = allDatasets.filter((d) => d.type === 'health').map((d) => d.id);
  const vaccIds = allDatasets.filter((d) => d.type === 'vaccination').map((d) => d.id);
  const massVaccIds = allDatasets.filter((d) => d.type === 'mass_vacc').map((d) => d.id);
  const popIds = allDatasets.filter((d) => d.type === 'population').map((d) => d.id);
  const hasHealth = healthIds.length > 0;

  // 2. Country distribution
  const countryDistQuery = useQuery<{ data: Array<{ label: string; value: number }> }>({
    queryKey: ['dashboard-country-dist', healthIds, filterKey],
    queryFn: () => histFetch(`${HIST_API_BASE}/cross-aggregate`, {
      method: 'POST',
      body: JSON.stringify({
        datasetIds: healthIds,
        column: 'admin_location',
        operation: 'distribution',
        ...(hasApiFilters && { filters: apiFilters }),
      }),
    }),
    enabled: hasHealth,
    staleTime: STALE_TIME,
  });

  // 3. Disease distribution (exclude disease filter to show all diseases)
  const diseaseDistQuery = useQuery<{ data: Array<{ label: string; value: number }> }>({
    queryKey: ['dashboard-disease-dist', healthIds, filterKeyNoDisease],
    queryFn: () => histFetch(`${HIST_API_BASE}/cross-aggregate`, {
      method: 'POST',
      body: JSON.stringify({
        datasetIds: healthIds,
        column: 'disease',
        operation: 'distribution',
        ...(hasFiltersNoDisease && { filters: apiFiltersNoDisease }),
      }),
    }),
    enabled: hasHealth,
    staleTime: STALE_TIME,
  });

  // 4. Sum of outbreaks
  const outbreaksSumQuery = useQuery<{ data: Array<{ value: number }> }>({
    queryKey: ['dashboard-outbreaks-sum', healthIds, filterKey],
    queryFn: () => histFetch(`${HIST_API_BASE}/cross-aggregate`, {
      method: 'POST',
      body: JSON.stringify({
        datasetIds: healthIds,
        column: 'num_new_outbreaks',
        operation: 'sum',
        ...(hasApiFilters && { filters: apiFilters }),
      }),
    }),
    enabled: hasHealth,
    staleTime: STALE_TIME,
  });

  // 5. Sum of animals vaccinated
  const vaccSumQuery = useQuery<{ data: Array<{ value: number }> }>({
    queryKey: ['dashboard-vacc-sum', vaccIds, filterKey],
    queryFn: () => histFetch(`${HIST_API_BASE}/cross-aggregate`, {
      method: 'POST',
      body: JSON.stringify({
        datasetIds: vaccIds,
        column: 'num_animals_vaccinated',
        operation: 'sum',
        ...(hasApiFilters && { filters: apiFilters }),
      }),
    }),
    enabled: vaccIds.length > 0,
    staleTime: STALE_TIME,
  });

  // 6. Sum of livestock population
  const popSumQuery = useQuery<{ data: Array<{ value: number }> }>({
    queryKey: ['dashboard-pop-sum', popIds, filterKey],
    queryFn: () => histFetch(`${HIST_API_BASE}/cross-aggregate`, {
      method: 'POST',
      body: JSON.stringify({
        datasetIds: popIds,
        column: 'num_animals',
        operation: 'sum',
        ...(hasApiFilters && { filters: apiFilters }),
      }),
    }),
    enabled: popIds.length > 0,
    staleTime: STALE_TIME,
  });

  // 7. Monthly time series
  const monthlyQuery = useQuery<{ data: Array<{ period: string; value: number }> }>({
    queryKey: ['dashboard-monthly-trend', healthIds, filterKey],
    queryFn: () => histFetch(`${HIST_API_BASE}/cross-query`, {
      method: 'POST',
      body: JSON.stringify({
        datasetIds: healthIds,
        dateColumn: 'date_of_report',
        valueColumn: 'num_new_outbreaks',
        interval: 'month',
        operation: 'count',
        ...(hasApiFilters && { filters: apiFilters }),
      }),
    }),
    enabled: hasHealth,
    staleTime: STALE_TIME,
  });

  // 8. Weekly time series (epi curve)
  const weeklyQuery = useQuery<{ data: Array<{ period: string; value: number }> }>({
    queryKey: ['dashboard-weekly-trend', healthIds, filterKey],
    queryFn: () => histFetch(`${HIST_API_BASE}/cross-query`, {
      method: 'POST',
      body: JSON.stringify({
        datasetIds: healthIds,
        dateColumn: 'date_of_report',
        valueColumn: 'num_new_outbreaks',
        interval: 'week',
        operation: 'count',
        ...(hasApiFilters && { filters: apiFilters }),
      }),
    }),
    enabled: hasHealth,
    staleTime: STALE_TIME,
  });

  // 9. Yearly time series (for annual outbreak bar chart)
  const yearlyQuery = useQuery<{ data: Array<{ period: string; value: number }> }>({
    queryKey: ['dashboard-yearly-trend', healthIds, filterKey],
    queryFn: () => histFetch(`${HIST_API_BASE}/cross-query`, {
      method: 'POST',
      body: JSON.stringify({
        datasetIds: healthIds,
        dateColumn: 'date_of_report',
        valueColumn: 'num_new_outbreaks',
        interval: 'year',
        operation: 'count',
        ...(hasApiFilters && { filters: apiFilters }),
      }),
    }),
    enabled: hasHealth,
    staleTime: STALE_TIME,
  });

  // ── Transform: KPIs ──────────────────────────────────────────────────────

  const kpis: DashboardKpis = (() => {
    const countryRaw = countryDistQuery.data?.data ?? [];
    const diseaseRaw = diseaseDistQuery.data?.data ?? [];

    // Unique countries
    const uniqueCountries = new Set<string>();
    for (const row of countryRaw) {
      const code = resolveCountryCode(row.label);
      if (code) uniqueCountries.add(code);
    }

    const totalReports = allDatasets
      .filter((d) => d.type === 'health')
      .reduce((s, d) => s + d.rowCount, 0);

    const totalOutbreaks = outbreaksSumQuery.data?.data?.[0]?.value ?? 0;
    const diseasesMonitored = diseaseRaw.filter((d) => d.label && d.value > 0
      && d.label !== 'ZERO-CAS' && !d.label.match(/^[0-9a-f]{8}-/)).length;
    const animalsVaccinated = vaccSumQuery.data?.data?.[0]?.value ?? 0;
    const massVaccRows = allDatasets
      .filter((d) => d.type === 'mass_vacc')
      .reduce((s, d) => s + d.rowCount, 0);
    const livestockCensused = popSumQuery.data?.data?.[0]?.value ?? 0;

    if (!hasHealth) return DEMO_KPIS;

    return {
      countriesReporting: uniqueCountries.size || DEMO_KPIS.countriesReporting,
      totalCountries: 55,
      totalReports,
      totalOutbreaks: Math.round(totalOutbreaks),
      diseasesMonitored,
      animalsVaccinated: Math.round(animalsVaccinated),
      vaccinationCampaigns: massVaccRows,
      livestockCensused: Math.round(livestockCensused),
      datasetsImported: allDatasets.length,
      totalRecords: allDatasets.reduce((s, d) => s + d.rowCount, 0),
      periodStart: '2007',
      periodEnd: '2025',
    };
  })();

  // ── Transform: Country data ──────────────────────────────────────────────

  const countryData: CountryOutbreakData[] = (() => {
    const raw = countryDistQuery.data?.data;
    if (!raw || raw.length === 0) return DEMO_COUNTRY_DATA;

    const byCountry = new Map<string, { name: string; reports: number }>();
    for (const row of raw) {
      const code = resolveCountryCode(row.label);
      if (!code) continue;
      const existing = byCountry.get(code);
      if (existing) {
        existing.reports += row.value;
      } else {
        byCountry.set(code, {
          name: COUNTRY_CODE_TO_NAME[code] ?? row.label.split('/')[0].trim(),
          reports: row.value,
        });
      }
    }

    return Array.from(byCountry.entries())
      .map(([code, data]) => ({
        code,
        name: data.name,
        outbreaks: data.reports,
        cases: data.reports,
        deaths: 0,
        vaccinations: 0,
        submissions: data.reports,
        rec: COUNTRY_CODE_TO_REC[code] ?? 'unknown',
      }))
      .filter((c) => !recFilter || c.rec === recFilter)
      .sort((a, b) => b.outbreaks - a.outbreaks);
  })();

  // ── Transform: Disease data ──────────────────────────────────────────────

  const diseases: DiseaseData[] = (() => {
    const raw = diseaseDistQuery.data?.data;
    if (!raw || raw.length === 0) return DEMO_DISEASES;

    return raw
      .filter((d) => d.label && d.label.trim() && d.value > 0
        && d.label !== 'ZERO-CAS' && !d.label.match(/^[0-9a-f]{8}-/))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15)
      .map((d, i) => ({
        disease: d.label,
        code: d.label.length > 15 ? d.label.slice(0, 15) : d.label,
        cases: d.value,
        deaths: 0,
        countriesAffected: 0,
        color: DISEASE_COLORS[i % DISEASE_COLORS.length],
      }));
  })();

  // ── Transform: Monthly trends ────────────────────────────────────────────

  const monthlyTrends: MonthlyTrendPoint[] = (() => {
    const raw = monthlyQuery.data?.data;
    if (!raw || raw.length === 0) return DEMO_MONTHLY_TRENDS;

    const sorted = [...raw].sort((a, b) => a.period.localeCompare(b.period)).slice(-24);
    return sorted.map((d) => {
      // period is ISO date like "2009-01-01T00:00:00.000Z"
      const date = new Date(d.period);
      const monthIdx = date.getMonth();
      const yearMonth = `${date.getFullYear()}-${String(monthIdx + 1).padStart(2, '0')}`;
      return {
        month: yearMonth,
        label: `${MONTH_LABELS[monthIdx]} ${date.getFullYear()}`,
        outbreaks: d.value ?? 0,
        cases: d.value ?? 0,
        deaths: 0,
        submissions: d.value ?? 0,
        vaccinations: 0,
      };
    });
  })();

  // ── Transform: Heatmap ───────────────────────────────────────────────────

  const heatmapData: HeatmapCell[] = DEMO_HEATMAP_DATA; // TODO: needs 2D groupBy

  // ── Transform: Epi curve ─────────────────────────────────────────────────

  const epiCurve: EpiCurvePoint[] = (() => {
    const raw = weeklyQuery.data?.data;
    if (!raw || raw.length === 0) return DEMO_EPI_CURVE;

    const sorted = [...raw].sort((a, b) => a.period.localeCompare(b.period)).slice(-52);
    let movingSum = 0;
    const windowSize = 4;
    return sorted.map((d, i) => {
      const cases = d.value ?? 0;
      movingSum += cases;
      if (i >= windowSize) movingSum -= (sorted[i - windowSize].value ?? 0);
      return {
        week: `W${String(i + 1).padStart(2, '0')}`,
        weekNum: i + 1,
        cases,
        deaths: 0,
        movingAvg: Math.round(movingSum / Math.min(i + 1, windowSize)),
      };
    });
  })();

  // These stay as demo
  const alerts: AlertData[] = DEMO_ALERTS;
  const activities: ActivityItem[] = DEMO_ACTIVITIES;
  const rainfall: RainfallPoint[] = DEMO_RAINFALL;

  // ── Transform: Yearly outbreaks ──────────────────────────────────────────

  const yearlyOutbreaks: Array<{ year: string; outbreaks: number }> = (() => {
    const raw = yearlyQuery.data?.data;
    if (!raw || raw.length === 0) return [];
    return raw
      .map((d) => {
        const date = new Date(d.period);
        const year = date.getFullYear();
        return { year: String(year), outbreaks: d.value ?? 0 };
      })
      .filter((d) => parseInt(d.year) >= 2007 && parseInt(d.year) <= 2025)
      .sort((a, b) => a.year.localeCompare(b.year));
  })();

  // All disease names for the filter dropdown (from unfiltered distribution)
  const allDiseaseNames: Array<{ value: string; label: string }> = (() => {
    const raw = diseaseDistQuery.data?.data;
    if (!raw) return [];
    return raw
      .filter((d) => d.label && d.label.trim() && d.value > 0
        && d.label !== 'ZERO-CAS' && !d.label.match(/^[0-9a-f]{8}-/))
      .sort((a, b) => b.value - a.value)
      .map((d) => ({ value: d.label, label: `${d.label} (${d.value.toLocaleString()})` }));
  })();

  const isLoading = datasetsQuery.isLoading;
  const isRealData = hasHealth && !countryDistQuery.isError;

  return {
    kpis,
    countryData,
    monthlyTrends,
    diseases,
    heatmapData,
    epiCurve,
    alerts,
    activities,
    rainfall,
    yearlyOutbreaks,
    allDiseaseNames,
    isLoading,
    isRealData,
  };
}
