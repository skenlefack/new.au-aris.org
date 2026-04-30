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
for (const c of DEMO_COUNTRY_DATA) {
  COUNTRY_NAME_TO_CODE[c.name.toLowerCase()] = c.code;
  COUNTRY_CODE_TO_REC[c.code] = c.rec;
}
// Common variations in historical data
const COUNTRY_ALIASES: Record<string, string> = {
  'the gambia': 'GM', 'gambia': 'GM', 'cote d\'ivoire': 'CI', 'ivory coast': 'CI',
  'dr congo': 'CD', 'democratic republic of the congo': 'CD', 'congo (dem. rep.)': 'CD',
  'congo': 'CG', 'republic of the congo': 'CG',
  'south africa': 'ZA', 'tanzania': 'TZ', 'united republic of tanzania': 'TZ',
  'cabo verde': 'CV', 'cape verde': 'CV', 'eswatini': 'SZ', 'swaziland': 'SZ',
  'burkina faso': 'BF', 'guinea-bissau': 'GW', 'sierra leone': 'SL',
  'south sudan': 'SS', 'central african republic': 'CF', 'central african rep.': 'CF',
  'equatorial guinea': 'GQ', 'sao tome': 'ST', 'sao tome and principe': 'ST',
};

function resolveCountryCode(location: string): string | null {
  if (!location) return null;
  // admin_location format: "Country / Region" or "Country"
  const country = location.split('/')[0].trim().toLowerCase();
  return COUNTRY_NAME_TO_CODE[country] ?? COUNTRY_ALIASES[country] ?? null;
}

function resolveCountryName(location: string): string {
  const name = location.split('/')[0].trim();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ── Disease color palette ───────────────────────────────────────────────────

const DISEASE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e',
  '#fb923c', '#a3e635', '#2dd4bf', '#818cf8', '#e879f9',
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Stale time for all dashboard queries ────────────────────────────────────

const STALE_TIME = 5 * 60_000; // 5 min

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN HOOK
// ═════════════════════════════════════════════════════════════════════════════

export function useDashboardData(filters?: DashboardFilters) {
  // 1. Get all dataset IDs (needed for cross-query calls)
  const datasetsQuery = useQuery<{ data: Array<{ id: string; name: string; rowCount: number; status: string }> }>({
    queryKey: ['dashboard-datasets'],
    queryFn: () => histFetch(`${HIST_API_BASE}?status=READY&limit=100`),
    staleTime: STALE_TIME,
  });

  const datasetIds = (datasetsQuery.data?.data ?? []).map((d) => d.id);
  const hasDatasets = datasetIds.length > 0;

  // 2. KPIs from historical
  const kpisQuery = useQuery<{ data: Record<string, unknown> }>({
    queryKey: ['dashboard-hist-kpis', datasetIds],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (datasetIds.length) qs.set('datasetIds', datasetIds.join(','));
      return histFetch(`${HIST_API_BASE}/dashboard-kpis?${qs}`);
    },
    enabled: hasDatasets,
    staleTime: STALE_TIME,
  });

  // 3. Historical stats
  const statsQuery = useQuery<{ data: { totalDatasets: number; totalRows: number } }>({
    queryKey: ['dashboard-hist-stats'],
    queryFn: () => histFetch(`${HIST_API_BASE}/stats`),
    staleTime: STALE_TIME,
  });

  // 4. Cross-aggregate by country (for map + ranked)
  const countryAggQuery = useQuery<{ data: Array<{ group: string; count: number }> }>({
    queryKey: ['dashboard-country-agg', datasetIds],
    queryFn: () => histFetch(`${HIST_API_BASE}/cross-aggregate`, {
      method: 'POST',
      body: JSON.stringify({
        datasetIds,
        column: 'num_new_outbreaks',
        operation: 'count',
        groupBy: 'admin_location',
      }),
    }),
    enabled: hasDatasets,
    staleTime: STALE_TIME,
  });

  // 5. Cross-aggregate by disease
  const diseaseAggQuery = useQuery<{ data: Array<{ group: string; count: number }> }>({
    queryKey: ['dashboard-disease-agg', datasetIds],
    queryFn: () => histFetch(`${HIST_API_BASE}/cross-aggregate`, {
      method: 'POST',
      body: JSON.stringify({
        datasetIds,
        column: 'disease',
        operation: 'count',
        groupBy: 'disease',
      }),
    }),
    enabled: hasDatasets,
    staleTime: STALE_TIME,
  });

  // 6. Monthly time series
  const monthlyQuery = useQuery<{ data: Array<{ period: string; count: number }> }>({
    queryKey: ['dashboard-monthly-trend', datasetIds],
    queryFn: () => histFetch(`${HIST_API_BASE}/cross-query`, {
      method: 'POST',
      body: JSON.stringify({
        datasetIds,
        dateColumn: 'date_of_report',
        valueColumn: 'num_new_outbreaks',
        interval: 'month',
        operation: 'count',
      }),
    }),
    enabled: hasDatasets,
    staleTime: STALE_TIME,
  });

  // 7. Weekly time series (epi curve)
  const weeklyQuery = useQuery<{ data: Array<{ period: string; count: number }> }>({
    queryKey: ['dashboard-weekly-trend', datasetIds],
    queryFn: () => histFetch(`${HIST_API_BASE}/cross-query`, {
      method: 'POST',
      body: JSON.stringify({
        datasetIds,
        dateColumn: 'date_of_report',
        valueColumn: 'num_new_outbreaks',
        interval: 'week',
        operation: 'count',
      }),
    }),
    enabled: hasDatasets,
    staleTime: STALE_TIME,
  });

  // ── Transform results ────────────────────────────────────────────────────

  // KPIs
  const kpis: DashboardKpis = (() => {
    const raw = kpisQuery.data?.data;
    const stats = statsQuery.data?.data;
    if (!raw && !stats) return DEMO_KPIS;

    const uniqueCountries = new Set<string>();
    for (const row of countryAggQuery.data?.data ?? []) {
      const code = resolveCountryCode(row.group);
      if (code) uniqueCountries.add(code);
    }

    return {
      countriesReporting: uniqueCountries.size || DEMO_KPIS.countriesReporting,
      totalCountries: 55,
      totalReports: Number(raw?.totalReports ?? 0) || DEMO_KPIS.totalReports,
      reportsTrend: Number(raw?.pctChangeReports ?? 0),
      totalVaccinations: DEMO_KPIS.totalVaccinations, // no vaccination data in historical
      vaccinationsTrend: 0,
      totalTreated: DEMO_KPIS.totalTreated,
      treatedTrend: 0,
      totalTrained: DEMO_KPIS.totalTrained,
      trainedTrend: 0,
      validationRate: 55, // historical validation rate
      validationTrend: 0,
      datasetsImported: stats?.totalDatasets ?? DEMO_KPIS.datasetsImported,
      datasetsTrend: 0,
      totalRecords: stats?.totalRows ?? DEMO_KPIS.totalRecords,
      recordsTrend: 0,
    };
  })();

  // Country data for map + ranked
  const countryData: CountryOutbreakData[] = (() => {
    const raw = countryAggQuery.data?.data;
    if (!raw || raw.length === 0) return DEMO_COUNTRY_DATA;

    // Aggregate by country code (admin_location may have "Kenya / Nairobi")
    const byCountry = new Map<string, { name: string; outbreaks: number }>();
    for (const row of raw) {
      const code = resolveCountryCode(row.group);
      if (!code) continue;
      const name = resolveCountryName(row.group);
      const existing = byCountry.get(code);
      if (existing) {
        existing.outbreaks += row.count;
      } else {
        byCountry.set(code, { name, outbreaks: row.count });
      }
    }

    return Array.from(byCountry.entries()).map(([code, data]) => ({
      code,
      name: data.name,
      outbreaks: data.outbreaks,
      cases: data.outbreaks, // use outbreaks as proxy for cases
      deaths: 0,
      vaccinations: 0,
      submissions: data.outbreaks,
      rec: COUNTRY_CODE_TO_REC[code] ?? 'unknown',
    }));
  })();

  // Disease data
  const diseases: DiseaseData[] = (() => {
    const raw = diseaseAggQuery.data?.data;
    if (!raw || raw.length === 0) return DEMO_DISEASES;

    return raw
      .filter((d) => d.group && d.group.trim())
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map((d, i) => ({
        disease: d.group,
        code: d.group.length > 12 ? d.group.slice(0, 12) : d.group,
        cases: d.count,
        deaths: 0,
        countriesAffected: 0,
        color: DISEASE_COLORS[i % DISEASE_COLORS.length],
      }));
  })();

  // Monthly trends
  const monthlyTrends: MonthlyTrendPoint[] = (() => {
    const raw = monthlyQuery.data?.data;
    if (!raw || raw.length === 0) return DEMO_MONTHLY_TRENDS;

    // Take last 12 months, sorted
    const sorted = [...raw].sort((a, b) => a.period.localeCompare(b.period)).slice(-12);
    return sorted.map((d) => {
      const monthIdx = parseInt(d.period.split('-')[1] ?? '1', 10) - 1;
      return {
        month: d.period,
        label: MONTH_LABELS[monthIdx] ?? d.period,
        outbreaks: d.count,
        cases: d.count,
        deaths: 0,
        submissions: d.count,
        vaccinations: 0,
      };
    });
  })();

  // Heatmap (country × month) — derived from countryData + monthlyTrends
  const heatmapData: HeatmapCell[] = (() => {
    if (!countryAggQuery.data?.data || countryAggQuery.data.data.length === 0) return DEMO_HEATMAP_DATA;
    // For now, use demo heatmap since cross-aggregate doesn't support 2D groupBy
    // In a future phase, we can build this from per-country monthly queries
    return DEMO_HEATMAP_DATA;
  })();

  // Epi curve (weekly)
  const epiCurve: EpiCurvePoint[] = (() => {
    const raw = weeklyQuery.data?.data;
    if (!raw || raw.length === 0) return DEMO_EPI_CURVE;

    const sorted = [...raw].sort((a, b) => a.period.localeCompare(b.period)).slice(-52);
    let movingSum = 0;
    const windowSize = 4;
    return sorted.map((d, i) => {
      const cases = d.count;
      movingSum += cases;
      if (i >= windowSize) movingSum -= sorted[i - windowSize].count;
      const movingAvg = Math.round(movingSum / Math.min(i + 1, windowSize));
      return {
        week: `W${String(i + 1).padStart(2, '0')}`,
        weekNum: i + 1,
        cases,
        deaths: 0,
        movingAvg,
      };
    });
  })();

  // These stay as demo (no API)
  const alerts: AlertData[] = DEMO_ALERTS;
  const activities: ActivityItem[] = DEMO_ACTIVITIES;
  const rainfall: RainfallPoint[] = DEMO_RAINFALL;

  const isLoading = datasetsQuery.isLoading || kpisQuery.isLoading || countryAggQuery.isLoading;
  const isRealData = hasDatasets && !kpisQuery.isError;

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
    isLoading,
    isRealData,
  };
}
