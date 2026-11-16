'use client';

/**
 * Disease Mapping & Risk Profiling — campaign dashboard.
 * Loads the whole campaign once (GET /collecte/campaigns/:id/dataset) and computes
 * every view in the browser, so filters and cross-filters respond instantly.
 */
import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, Legend, Cell as CellFill,
} from 'recharts';
import {
  Activity, AlertTriangle, Download, Filter, Map as MapIcon, RefreshCw, ShieldCheck, Skull, Syringe,
  Users, X, Stethoscope, Truck, Gauge, GitCompare, ClipboardCheck, Beef,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCampaignDataset, type CampaignDataset } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import {
  buildHerds, indicators, counts, groupBy, crossTab, relativeRisks, dailySeries, weekOf, toCsv, riskLevelOf,
  RISK_FACTORS, RISK_WEIGHTS, RISK_LEVELS, SIZE_CLASSES,
  type Herd, type DimensionKey, type Indicators, type RiskLevel, type RiskFactor,
} from './model';
import {
  Card, Kpi, BarList, ShareBar, Segmented, Select, RiskBadge, useVizPalette, rampColor,
  fmtInt, fmtPct, setNumberLocale, RISK_COLORS, STATUS, type BarItem, type VizPalette,
} from './ui';
import type { MapPoint } from './HerdMap';

const HerdMap = dynamic(() => import('./HerdMap'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

type TabKey = 'overview' | 'disease' | 'vaccination' | 'movement' | 'risk' | 'compare' | 'collection';

interface Filters {
  country: string;
  l1: string;
  l2: string;
  system: string;
  status: string;
  agent: string;
  riskLevel: string;
  from: string;
  to: string;
}
const NO_FILTERS: Filters = { country: '', l1: '', l2: '', system: '', status: '', agent: '', riskLevel: '', from: '', to: '' };

/** Field codes of the form, used to label option values. */
const OPTION_FIELD: Partial<Record<DimensionKey, string>> = {
  system: 'production_system',
  coverage: 'vaccination_coverage',
  neighbour: 'neighbor_disease',
  lab: 'lab_confirmation',
  signs: 'clinical_signs',
  water: 'water_sources',
  biosecurity: 'biosecurity_measures',
  ages: 'age_distribution',
  moveReasons: 'movement_reasons',
  sharedWhat: 'shared_what',
};
const YES_NO_DIMS: DimensionKey[] = ['anySign', 'pprSuspect', 'vaccinated', 'vetAccess', 'moves', 'sharedGrazing', 'recentAdditions'];

/* ════════════════════════════════════════════════════════════════════ */

interface Ctx {
  locale: string;
  ds: CampaignDataset;
  all: Herd[];
  herds: Herd[];
  ind: Indicators;
  t: (k: string, p?: Record<string, string | number>) => string;
  pal: VizPalette & { dark: boolean };
  dimLabel: (d: DimensionKey) => string;
  valueLabel: (d: DimensionKey, v: string) => string;
  countryColor: (code: string) => string;
  countries: string[];
  filters: Filters;
  toggleFilter: (k: keyof Filters, v: string) => void;
}

export default function DiseaseMappingDashboard({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const t = useTranslations('diseaseMapping');
  const locale = useLocaleStore((s) => s.locale);
  setNumberLocale(locale);
  const pal = useVizPalette();
  const q = useCampaignDataset(campaignId);
  const ds = q.data;

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [tab, setTab] = useState<TabKey>('overview');

  const all = useMemo(() => (ds ? buildHerds(ds) : []), [ds]);

  const herds = useMemo(() => all.filter((h) =>
    (!filters.country || h.country === filters.country)
    && (!filters.l1 || h.l1 === filters.l1)
    && (!filters.l2 || h.l2 === filters.l2)
    && (!filters.system || h.system === filters.system)
    && (!filters.status || h.status === filters.status)
    && (!filters.agent || h.agentId === filters.agent)
    && (!filters.riskLevel || h.riskLevel === filters.riskLevel)
    && (!filters.from || h.day >= filters.from)
    && (!filters.to || h.day <= filters.to)), [all, filters]);

  const ind = useMemo(() => indicators(herds), [herds]);

  const countries = useMemo(() => counts(all, 'country').map((c) => c.key), [all]);

  const ctx: Ctx | null = useMemo(() => {
    if (!ds) return null;
    const optionLabel = (field: string, v: string): string | undefined => {
      const o = ds.fields[field]?.options?.[v];
      return o ? (o[locale] || o.en || Object.values(o).find(Boolean)) : undefined;
    };
    const countryName: Record<string, string> = {};
    for (const tn of Object.values(ds.tenants)) if (tn.code) countryName[tn.code] = tn.name;
    const humanize = (s: string) => s.replace(/_+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
    const geoName = (id: string | null | undefined) => {
      const g = id ? ds.geo[id] : undefined;
      return g ? (locale === 'fr' ? g.fr : g.en) || g.en : '';
    };
    // Two places with the same name at the same level get their parent's name appended.
    const nameUse = new Map<string, number>();
    for (const g of Object.values(ds.geo)) nameUse.set(`${g.level}|${g.en}`, (nameUse.get(`${g.level}|${g.en}`) ?? 0) + 1);

    const valueLabel = (d: DimensionKey, v: string): string => {
      if (v === '') return t('notAnswered');
      switch (d) {
        case 'country': return countryName[v] ?? v;
        case 'l1': case 'l2': case 'l3': {
          const g = ds.geo[v];
          if (!g) return t('unknownPlace');
          const name = geoName(v);
          const parent = (nameUse.get(`${g.level}|${g.en}`) ?? 0) > 1 ? geoName(g.parentId) : '';
          return parent ? `${name} (${parent})` : name;
        }
        case 'agent': return ds.agents[v] ?? '—';
        case 'status': return t(`statusValue.${v}`);
        case 'riskLevel': return t(`risk.${v}`);
        case 'sizeClass': return v === '0' ? t('sizeNone') : t('sizeHeads', { range: v });
        case 'month': return new Date(`${v}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
        default:
          if (YES_NO_DIMS.includes(d)) return v === 'yes' ? t('yes') : v === 'no' ? t('no') : v;
          if (d === 'signs' && v === 'none') return t('noSigns');
          return (OPTION_FIELD[d] && optionLabel(OPTION_FIELD[d]!, v)) || (v === 'yes' ? t('yes') : v === 'no' ? t('no') : v === 'unknown' ? t('unknown') : humanize(v));
      }
    };
    const countryColor = (code: string) => {
      const i = countries.indexOf(code);
      return i >= 0 && i < pal.series.length ? pal.series[i] : pal.other;
    };
    return {
      locale, ds, all, herds, ind, t, pal,
      dimLabel: (d) => t(`dim.${d}`),
      valueLabel, countryColor, countries, filters,
      toggleFilter: (k, v) => setFilters((f) => ({ ...f, [k]: f[k] === v ? '' : v, ...(k === 'country' ? { l1: '', l2: '' } : k === 'l1' ? { l2: '' } : {}) })),
    };
  }, [ds, all, herds, ind, t, pal, locale, countries, filters]);

  const exportCsv = () => {
    if (!ctx) return;
    const header = [
      'id', 'submitted_at', 'status', 'agent', 'country', 'admin1', 'admin2', 'admin3', 'lat', 'lng', 'production_system',
      'goats', 'sheep', 'clinical_signs', 'ppr_suspect', 'animals_affected', 'animals_died', 'vaccinated_ppr', 'vaccination_coverage',
      'vet_access', 'animals_move', 'shared_grazing', 'recent_additions', 'neighbour_disease', 'risk_score', 'risk_level',
    ];
    const yn = (v: boolean | null) => (v == null ? '' : v ? 'yes' : 'no');
    const rows = herds.map((h) => [
      h.id, h.at.toISOString(), h.status, h.agent, ctx.valueLabel('country', h.country), ctx.valueLabel('l1', h.l1), ctx.valueLabel('l2', h.l2), ctx.valueLabel('l3', h.l3),
      h.lat ?? '', h.lng ?? '', h.system, h.goats, h.sheep, h.signs.join('|'), h.pprSuspect ? 'yes' : 'no', h.affected, h.died,
      yn(h.vaccinated), h.coverage, yn(h.vetAccess), yn(h.moves), yn(h.sharedGrazing), yn(h.recentAdditions), h.neighbour, h.risk, h.riskLevel,
    ]);
    const blob = new Blob([toCsv([header, ...rows])], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `disease-mapping-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'overview', label: t('tab.overview'), icon: MapIcon },
    { key: 'disease', label: t('tab.disease'), icon: Stethoscope },
    { key: 'vaccination', label: t('tab.vaccination'), icon: Syringe },
    { key: 'movement', label: t('tab.movement'), icon: Truck },
    { key: 'risk', label: t('tab.risk'), icon: Gauge },
    { key: 'compare', label: t('tab.compare'), icon: GitCompare },
    { key: 'collection', label: t('tab.collection'), icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{campaignName}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('subtitle')}
            {ds && <> · {t('updatedAt', { time: new Date(ds.generatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!ctx || herds.length === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#1F4E79] px-3 text-xs font-medium text-white hover:bg-[#183e60] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {t('exportCsv')}
          </button>
        </div>
      </div>

      {q.isLoading || !ctx ? (
        q.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {t('loadError')}: {(q.error as Error)?.message}
          </div>
        ) : (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-[460px] w-full rounded-xl" />
          </div>
        )
      ) : all.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-20 text-center text-sm italic text-gray-400 dark:border-gray-800 dark:bg-gray-900">
          {t('noData')}
        </div>
      ) : (
        <>
          <FilterBar ctx={ctx} setFilters={setFilters} />
          <KpiRow ctx={ctx} />

          <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-gray-200 px-1 dark:border-gray-800" role="tablist">
            {tabs.map((tb) => {
              const Icon = tb.icon;
              const active = tab === tb.key;
              return (
                <button
                  key={tb.key}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setTab(tb.key)}
                  className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                    active
                      ? 'border-[#1F4E79] text-[#1F4E79] dark:border-blue-400 dark:text-blue-300'
                      : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tb.label}
                </button>
              );
            })}
          </nav>

          {herds.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm italic text-gray-400 dark:border-gray-800 dark:bg-gray-900">
              {t('noMatch')}
            </div>
          ) : (
            <>
              {tab === 'overview' && <OverviewTab ctx={ctx} />}
              {tab === 'disease' && <DiseaseTab ctx={ctx} />}
              {tab === 'vaccination' && <VaccinationTab ctx={ctx} />}
              {tab === 'movement' && <MovementTab ctx={ctx} />}
              {tab === 'risk' && <RiskTab ctx={ctx} />}
              {tab === 'compare' && <CompareTab ctx={ctx} />}
              {tab === 'collection' && <CollectionTab ctx={ctx} />}
            </>
          )}

          <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{t('disclaimer')}</p>
        </>
      )}
    </div>
  );
}

/* ── Filters ── */

function FilterBar({ ctx, setFilters }: { ctx: Ctx; setFilters: React.Dispatch<React.SetStateAction<Filters>> }) {
  const { t, all, filters, valueLabel } = ctx;
  const scoped = (k: keyof Filters) => all.filter((h) =>
    (k === 'country' || !filters.country || h.country === filters.country)
    && (k === 'country' || k === 'l1' || !filters.l1 || h.l1 === filters.l1));
  const opts = (dim: DimensionKey, base: Herd[]) => [
    { value: '', label: t('all') },
    ...counts(base, dim).map((c) => ({ value: c.key, label: `${valueLabel(dim, c.key)} (${c.value})` }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
  const set = (k: keyof Filters) => (v: string) => setFilters((f) => ({
    ...f, [k]: v, ...(k === 'country' ? { l1: '', l2: '' } : k === 'l1' ? { l2: '' } : {}),
  }));
  const active = (Object.keys(filters) as (keyof Filters)[]).filter((k) => filters[k]);
  const days = [...new Set(all.map((h) => h.day))].sort();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
        <Select label={t('dim.country')} value={filters.country} onChange={set('country')} options={opts('country', all)} />
        <Select label={t('dim.l1')} value={filters.l1} onChange={set('l1')} options={opts('l1', scoped('l1'))} />
        <Select label={t('dim.l2')} value={filters.l2} onChange={set('l2')} options={opts('l2', scoped('l2'))} />
        <Select label={t('dim.system')} value={filters.system} onChange={set('system')} options={opts('system', all)} />
        <Select label={t('dim.riskLevel')} value={filters.riskLevel} onChange={set('riskLevel')} options={[{ value: '', label: t('all') }, ...RISK_LEVELS.map((r) => ({ value: r, label: t(`risk.${r}`) }))]} />
        <Select label={t('dim.status')} value={filters.status} onChange={set('status')} options={opts('status', all)} />
        <Select label={t('dim.agent')} value={filters.agent} onChange={set('agent')} options={opts('agent', all)} />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('from')}</span>
          <input type="date" value={filters.from} min={days[0]} max={days[days.length - 1]} onChange={(e) => set('from')(e.target.value)}
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('to')}</span>
          <input type="date" value={filters.to} min={days[0]} max={days[days.length - 1]} onChange={(e) => set('to')(e.target.value)}
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
        </label>
      </div>
      {active.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          {active.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => set(k)('')}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-800 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-200"
            >
              {k === 'from' || k === 'to' ? `${t(k)}: ${filters[k]}` : `${t(`dim.${k}`)}: ${k === 'riskLevel' ? t(`risk.${filters[k]}`) : valueLabel(k as DimensionKey, filters[k])}`}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button type="button" onClick={() => setFilters(NO_FILTERS)} className="ml-1 text-[11px] font-medium text-gray-500 underline-offset-2 hover:underline">
            {t('clearFilters')}
          </button>
          <span className="ml-auto text-[11px] text-gray-500">{t('showingOf', { n: fmtInt(ctx.herds.length), total: fmtInt(all.length) })}</span>
        </div>
      )}
    </div>
  );
}

/* ── KPIs ── */

function KpiRow({ ctx }: { ctx: Ctx }) {
  const { t, ind } = ctx;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
      <Kpi icon={ClipboardCheck} label={t('kpi.herds')} value={fmtInt(ind.herds)} sub={t('kpi.herdsSub', { agents: ind.agents, days: ind.days })} />
      <Kpi icon={Beef} label={t('kpi.animals')} value={fmtInt(ind.animals)} sub={t('kpi.animalsSub', { goats: fmtInt(ind.goats), sheep: fmtInt(ind.sheep) })} />
      <Kpi icon={Stethoscope} label={t('kpi.signs')} value={fmtPct(ind.pctSigns)} sub={t('kpi.signsSub', { n: fmtInt(ind.withSigns) })} tone={ind.pctSigns >= 30 ? 'warning' : 'neutral'} />
      <Kpi icon={AlertTriangle} label={t('kpi.suspects')} value={fmtInt(ind.suspects)} sub={t('kpi.suspectsSub', { pct: fmtPct(ind.pctSuspect, 1) })} tone={ind.suspects > 0 ? 'critical' : 'good'} />
      <Kpi icon={Skull} label={t('kpi.deaths')} value={fmtInt(ind.died)} sub={t('kpi.deathsSub', { affected: fmtInt(ind.affected), cfr: fmtPct(ind.caseFatality) })} />
      <Kpi icon={Syringe} label={t('kpi.vaccinated')} value={fmtPct(ind.pctVaccinated)} sub={t('kpi.vaccinatedSub')} tone={ind.pctVaccinated >= 70 ? 'good' : 'warning'} />
      <Kpi icon={ShieldCheck} label={t('kpi.vet')} value={fmtPct(ind.pctVetAccess)} sub={t('kpi.vetSub')} />
      <Kpi icon={Gauge} label={t('kpi.highRisk')} value={fmtPct(ind.pctHighRisk)} sub={t('kpi.highRiskSub', { score: ind.meanRisk.toFixed(0) })} tone={ind.pctHighRisk >= 25 ? 'critical' : ind.pctHighRisk >= 10 ? 'warning' : 'good'} />
    </div>
  );
}

/* ── Shared helpers ── */

function itemsFor(ctx: Ctx, dim: DimensionKey, hs: Herd[], opts?: { color?: string; asPct?: boolean; limit?: number }): BarItem[] {
  const total = hs.length;
  return counts(hs, dim).slice(0, opts?.limit ?? 12).map((c) => ({
    key: c.key,
    label: ctx.valueLabel(dim, c.key),
    value: opts?.asPct ? (c.value / Math.max(1, total)) * 100 : c.value,
    note: opts?.asPct ? `(${fmtInt(c.value)})` : `(${fmtPct((c.value / Math.max(1, total)) * 100)})`,
    color: opts?.color,
  }));
}

function yesNoParts(ctx: Ctx, hs: Herd[], get: (h: Herd) => boolean | null, yesColor: string, noColor: string) {
  let yes = 0, no = 0, na = 0;
  for (const h of hs) { const v = get(h); if (v == null) na++; else if (v) yes++; else no++; }
  return [
    { key: 'yes', label: ctx.t('yes'), value: yes, color: yesColor },
    { key: 'no', label: ctx.t('no'), value: no, color: noColor },
    ...(na ? [{ key: 'na', label: ctx.t('notAnswered'), value: na, color: ctx.pal.dark ? '#383835' : '#e1e0d9' }] : []),
  ];
}

/** Indicator computed per group, sorted, for "by district" style bar lists. */
function rankBy(ctx: Ctx, dim: DimensionKey, metric: (i: Indicators) => number, opts: { min?: number; limit?: number; asc?: boolean } = {}): BarItem[] {
  const out: BarItem[] = [];
  for (const [key, hs] of groupBy(ctx.herds, dim)) {
    if (!key || hs.length < (opts.min ?? 5)) continue;
    const v = metric(indicators(hs));
    out.push({ key, label: ctx.valueLabel(dim, key), value: v, note: `n=${hs.length}` });
  }
  out.sort((a, b) => (opts.asc ? a.value - b.value : b.value - a.value));
  return out.slice(0, opts.limit ?? 10);
}

function ChartTooltip({ active, payload, label, title }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-1 font-semibold text-gray-900 dark:text-gray-100">{title ? title(label) : label}</div>
      {payload.filter((p: any) => p.value).map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 tabular-nums text-gray-900 dark:text-gray-100">{fmtInt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Legend labels stay in text ink; the swatch carries the series colour. */
const legendText = (pal: VizPalette & { dark: boolean }) => (value: string) => (
  <span style={{ color: pal.dark ? '#c3c2b7' : '#52514e' }}>{value}</span>
);

const axisProps = (pal: VizPalette) => ({
  tick: { fontSize: 11, fill: pal.muted },
  axisLine: { stroke: pal.axis },
  tickLine: false,
});

/* ════════════════════════════ Tabs ════════════════════════════ */

function OverviewTab({ ctx }: { ctx: Ctx }) {
  const { t, herds, pal, valueLabel } = ctx;
  const [mode, setMode] = useState<'risk' | 'suspect' | 'vaccination'>('risk');

  const map = useMemo(() => {
    const pts: MapPoint[] = [];
    const legendCounts = new Map<string, number>();
    const colorOf = (h: Herd): { color: string; label: string } => {
      if (mode === 'risk') return { color: RISK_COLORS[h.riskLevel], label: t(`risk.${h.riskLevel}`) };
      if (mode === 'suspect') {
        if (h.pprSuspect) return { color: STATUS.critical, label: t('legend.suspect') };
        if (h.anySign) return { color: STATUS.warning, label: t('legend.signs') };
        return { color: STATUS.good, label: t('legend.noSigns') };
      }
      if (h.vaccinated === true) return { color: pal.series[0], label: t('legend.vaccinated') };
      if (h.vaccinated === false) return { color: pal.series[1], label: t('legend.notVaccinated') };
      return { color: pal.other, label: t('notAnswered') };
    };
    for (const h of herds) {
      if (h.lat == null || h.lng == null) continue;
      const c = colorOf(h);
      legendCounts.set(c.label, (legendCounts.get(c.label) ?? 0) + 1);
      pts.push({
        id: h.id, lat: h.lat, lng: h.lng, color: c.color, weight: Math.log10(Math.max(1, h.animals)) * 2,
        title: `${valueLabel('l2', h.l2)} · ${valueLabel('l3', h.l3)}`,
        lines: [
          `${t('kpi.animals')}: ${fmtInt(h.animals)} (${fmtInt(h.goats)} / ${fmtInt(h.sheep)})`,
          `${t('dim.riskLevel')}: ${t(`risk.${h.riskLevel}`)} (${h.risk}/100)`,
          `${t('dim.signs')}: ${h.signs.length ? h.signs.map((s) => valueLabel('signs', s)).join(', ') : t('noSigns')}`,
          `${t('dim.vaccinated')}: ${valueLabel('vaccinated', h.vaccinated == null ? '' : h.vaccinated ? 'yes' : 'no')}`,
          `${h.agent} · ${h.at.toLocaleDateString(ctx.locale)}`,
        ],
      });
    }
    const legendDefs = mode === 'risk'
      ? RISK_LEVELS.map((r) => ({ label: t(`risk.${r}`), color: RISK_COLORS[r] }))
      : mode === 'suspect'
        ? [{ label: t('legend.noSigns'), color: STATUS.good }, { label: t('legend.signs'), color: STATUS.warning }, { label: t('legend.suspect'), color: STATUS.critical }]
        : [{ label: t('notAnswered'), color: pal.other }, { label: t('legend.notVaccinated'), color: pal.series[1] }, { label: t('legend.vaccinated'), color: pal.series[0] }];
    return { pts, legend: legendDefs.map((l) => ({ ...l, count: legendCounts.get(l.label) ?? 0 })).filter((l) => l.count > 0) };
  }, [herds, mode, pal, t, valueLabel]);

  const noGps = herds.length - map.pts.length;
  const riskParts = RISK_LEVELS.map((r) => ({ key: r, label: t(`risk.${r}`), value: herds.filter((h) => h.riskLevel === r).length, color: RISK_COLORS[r] }));
  const hotspots = rankBy(ctx, 'l2', (i) => i.meanRisk, { min: 5, limit: 8 });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          bodyClassName="h-[480px] p-0"
          title={t('map.title')}
          subtitle={t('map.subtitle', { n: fmtInt(map.pts.length), missing: fmtInt(noGps) })}
          actions={<Segmented size="xs" value={mode} onChange={setMode} options={[
            { value: 'risk', label: t('map.byRisk') },
            { value: 'suspect', label: t('map.bySigns') },
            { value: 'vaccination', label: t('map.byVaccination') },
          ]} />}
        >
          <HerdMap points={map.pts} legend={map.legend} dark={pal.dark} />
        </Card>
        <div className="flex flex-col gap-4">
          <Card title={t('risk.distribution')} info={t('risk.scoreInfo')}>
            <ShareBar parts={riskParts} />
          </Card>
          <Card title={t('hotspots.title')} subtitle={t('hotspots.subtitle')} className="flex-1">
            <BarList
              items={hotspots.map((h) => ({ ...h, color: RISK_COLORS[(h.value >= 75 ? 'veryHigh' : h.value >= 50 ? 'high' : h.value >= 25 ? 'moderate' : 'low') as RiskLevel] }))}
              color={pal.series[0]} max={100} valueFormat={(n) => n.toFixed(0)}
              onSelect={(k) => ctx.toggleFilter('l2', k)} selected={ctx.filters.l2} labelWidth="w-28"
            />
          </Card>
        </div>
      </div>
      <Insights ctx={ctx} />
      <Timeline ctx={ctx} />
    </div>
  );
}

function Insights({ ctx }: { ctx: Ctx }) {
  const { t, herds, valueLabel } = ctx;
  const notes: { tone: 'critical' | 'warning' | 'good'; text: string }[] = [];

  const bySuspect = [...groupBy(herds.filter((h) => h.pprSuspect), 'l2').entries()].sort((a, b) => b[1].length - a[1].length);
  if (bySuspect.length) {
    const [k, hs] = bySuspect[0];
    notes.push({ tone: 'critical', text: t('insight.suspects', { n: hs.length, place: valueLabel('l2', k) }) });
  }
  const rr = relativeRisks(herds).filter((r) => r.rr != null && r.low != null && r.low > 1).sort((a, b) => (b.rr ?? 0) - (a.rr ?? 0));
  if (rr.length) notes.push({ tone: 'warning', text: t('insight.rr', { factor: t(`factor.${rr[0].factor}`), rr: rr[0].rr!.toFixed(1) }) });
  const lowVacc = rankBy(ctx, 'l2', (i) => i.pctVaccinated, { min: 10, asc: true, limit: 1 });
  if (lowVacc.length && lowVacc[0].value < 50) notes.push({ tone: 'warning', text: t('insight.lowVacc', { place: lowVacc[0].label, pct: fmtPct(lowVacc[0].value) }) });
  const ind = ctx.ind;
  if (ind.pctNoBiosecurity >= 50) notes.push({ tone: 'warning', text: t('insight.noBio', { pct: fmtPct(ind.pctNoBiosecurity) }) });
  if (ind.died > 0) notes.push({ tone: 'critical', text: t('insight.deaths', { died: fmtInt(ind.died), cfr: fmtPct(ind.caseFatality) }) });
  if (notes.length === 0) return null;

  const icon = { critical: STATUS.critical, warning: STATUS.warning, good: STATUS.good };
  return (
    <Card title={t('insight.title')} subtitle={t('insight.subtitle')}>
      <ul className="grid gap-2 md:grid-cols-2">
        {notes.map((n, i) => (
          <li key={i} className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:bg-gray-800/60 dark:text-gray-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: icon[n.tone] }} />
            {n.text}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Timeline({ ctx }: { ctx: Ctx }) {
  const { t, herds, pal, countries, countryColor, valueLabel, locale } = ctx;
  const [mode, setMode] = useState<'daily' | 'cumulative'>('daily');
  const series = countries.filter((c) => herds.some((h) => h.country === c));
  const data = useMemo(() => {
    const d = dailySeries(herds, (h) => h.country);
    if (mode === 'daily') return d;
    const acc: Record<string, number> = {};
    return d.map((row) => {
      const out: { day: string; [k: string]: number | string } = { day: row.day };
      for (const s of series) { acc[s] = (acc[s] ?? 0) + Number(row[s] ?? 0); out[s] = acc[s]; }
      return out;
    });
  }, [herds, mode, series]);
  const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' });

  return (
    <Card
      title={t('timeline.title')}
      subtitle={t('timeline.subtitle')}
      actions={<Segmented size="xs" value={mode} onChange={setMode} options={[{ value: 'daily', label: t('timeline.daily') }, { value: 'cumulative', label: t('timeline.cumulative') }]} />}
    >
      <div className="h-64">
        <ResponsiveContainer>
          {mode === 'daily' ? (
            <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke={pal.grid} />
              <XAxis dataKey="day" tickFormatter={fmtDay} {...axisProps(pal)} minTickGap={24} />
              <YAxis allowDecimals={false} {...axisProps(pal)} axisLine={false} />
              <Tooltip content={<ChartTooltip title={fmtDay} />} cursor={{ fill: pal.dark ? '#ffffff10' : '#0000000a' }} />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendText(pal)} />}
              {series.map((s, i) => (
                <Bar key={s} dataKey={s} name={valueLabel('country', s)} stackId="a" fill={countryColor(s)} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} />
              ))}
            </BarChart>
          ) : (
            <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={pal.grid} />
              <XAxis dataKey="day" tickFormatter={fmtDay} {...axisProps(pal)} minTickGap={24} />
              <YAxis allowDecimals={false} {...axisProps(pal)} axisLine={false} />
              <Tooltip content={<ChartTooltip title={fmtDay} />} />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendText(pal)} />}
              {series.map((s) => (
                <Area key={s} type="monotone" dataKey={s} name={valueLabel('country', s)} stackId="a" stroke={countryColor(s)} strokeWidth={2} fill={countryColor(s)} fillOpacity={0.25} />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ── Disease ── */

function DiseaseTab({ ctx }: { ctx: Ctx }) {
  const { t, herds, pal, valueLabel, ind, locale } = ctx;
  const signs = itemsFor(ctx, 'signs', herds, { asPct: true }).filter((i) => i.key !== 'none');

  const epi = useMemo(() => {
    const byWeek = new Map<string, { week: string; suspect: number; other: number }>();
    for (const h of herds) {
      if (!h.firstCase || !h.anySign) continue;
      const w = weekOf(h.firstCase);
      if (!w) continue;
      const row = byWeek.get(w) ?? { week: w, suspect: 0, other: 0 };
      if (h.pprSuspect) row.suspect++; else row.other++;
      byWeek.set(w, row);
    }
    return [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week)).slice(-52);
  }, [herds]);
  const fmtWeek = (w: string) => new Date(`${w}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' });

  const district = useMemo(() => {
    const rows: { key: string; n: number; sick: number; suspects: number; affected: number; died: number; animals: number }[] = [];
    for (const [key, hs] of groupBy(herds, 'l2')) {
      if (!key) continue;
      const i = indicators(hs);
      rows.push({ key, n: hs.length, sick: i.withSigns, suspects: i.suspects, affected: i.affected, died: i.died, animals: i.animals });
    }
    return rows.sort((a, b) => b.sick - a.sick).slice(0, 15);
  }, [herds]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('disease.signs')} subtitle={t('disease.signsSub')}>
          <BarList items={signs} color={pal.series[0]} max={100} valueFormat={(n) => fmtPct(n)} />
        </Card>
        <Card title={t('disease.suspectDef')} info={t('disease.suspectInfo')}>
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-gray-900 dark:text-gray-50">{fmtInt(ind.suspects)}</span>
              <span className="text-xs text-gray-500">{t('disease.suspectOf', { pct: fmtPct(ind.pctSuspect, 1), n: fmtInt(ind.herds) })}</span>
            </div>
            <ShareBar parts={[
              { key: 'none', label: t('legend.noSigns'), value: ind.herds - ind.withSigns, color: STATUS.good },
              { key: 'signs', label: t('legend.signs'), value: ind.withSigns - ind.suspects, color: STATUS.warning },
              { key: 'suspect', label: t('legend.suspect'), value: ind.suspects, color: STATUS.critical },
            ]} />
            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
              <div><div className="text-gray-500">{t('disease.attackRate')}</div><div className="text-lg font-semibold">{fmtPct(ind.attackRate, 1)}</div></div>
              <div><div className="text-gray-500">{t('disease.cfr')}</div><div className="text-lg font-semibold">{fmtPct(ind.caseFatality, 1)}</div></div>
            </div>
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card title={t('disease.lab')} subtitle={t('disease.labSub')}>
            <BarList items={itemsFor(ctx, 'lab', herds.filter((h) => h.anySign))} color={pal.series[0]} />
          </Card>
          <Card title={t('disease.neighbour')}>
            <BarList items={itemsFor(ctx, 'neighbour', herds)} color={pal.series[1]} />
          </Card>
        </div>
      </div>

      <Card title={t('disease.epicurve')} subtitle={t('disease.epicurveSub')}>
        {epi.length === 0 ? <p className="py-8 text-center text-xs italic text-gray-400">—</p> : (
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={epi} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke={pal.grid} />
                <XAxis dataKey="week" tickFormatter={fmtWeek} {...axisProps(pal)} minTickGap={20} />
                <YAxis allowDecimals={false} {...axisProps(pal)} axisLine={false} />
                <Tooltip content={<ChartTooltip title={(w: string) => t('disease.weekOf', { date: fmtWeek(w) })} />} cursor={{ fill: pal.dark ? '#ffffff10' : '#0000000a' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendText(pal)} />
                <Bar dataKey="other" name={t('legend.signs')} stackId="a" fill={STATUS.warning} />
                <Bar dataKey="suspect" name={t('legend.suspect')} stackId="a" fill={STATUS.critical} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title={t('disease.byDistrict')} subtitle={t('disease.byDistrictSub')} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">{t('dim.l2')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('col.herds')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('col.withSigns')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('col.suspects')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('col.affected')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('col.died')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('col.cfr')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 tabular-nums dark:divide-gray-800">
              {district.map((r) => (
                <tr key={r.key} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40" onClick={() => ctx.toggleFilter('l2', r.key)}>
                  <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200">{valueLabel('l2', r.key)}</td>
                  <td className="px-3 py-1.5 text-right">{fmtInt(r.n)}</td>
                  <td className="px-3 py-1.5 text-right">{fmtInt(r.sick)} <span className="text-gray-400">({fmtPct((r.sick / r.n) * 100)})</span></td>
                  <td className="px-3 py-1.5 text-right">{r.suspects ? <span className="font-semibold" style={{ color: STATUS.critical }}>{r.suspects}</span> : '0'}</td>
                  <td className="px-3 py-1.5 text-right">{fmtInt(r.affected)}</td>
                  <td className="px-3 py-1.5 text-right">{fmtInt(r.died)}</td>
                  <td className="px-3 py-1.5 text-right">{r.affected ? fmtPct((r.died / r.affected) * 100) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── Vaccination ── */

function VaccinationTab({ ctx }: { ctx: Ctx }) {
  const { t, herds, pal } = ctx;
  const vaccinated = herds.filter((h) => h.vaccinated === true);
  const buckets = ['0-3', '4-6', '7-9', '10-12', '>12'];
  const bucketOf = (m: number) => (m <= 3 ? '0-3' : m <= 6 ? '4-6' : m <= 9 ? '7-9' : m <= 12 ? '10-12' : '>12');
  const ages = buckets.map((b) => ({ key: b, label: t('vacc.months', { range: b }), value: vaccinated.filter((h) => h.monthsSinceVaccination != null && bucketOf(h.monthsSinceVaccination) === b).length }));

  const signsBy = (get: (h: Herd) => boolean) => {
    const hs = herds.filter(get);
    return hs.length ? (hs.filter((h) => h.anySign).length / hs.length) * 100 : 0;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('vacc.status')} subtitle={t('vacc.statusSub')}>
          <ShareBar parts={yesNoParts(ctx, herds, (h) => h.vaccinated, pal.series[0], pal.series[1])} />
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('vacc.coverage')}</p>
            <BarList items={itemsFor(ctx, 'coverage', vaccinated)} color={pal.series[0]} />
          </div>
        </Card>
        <Card title={t('vacc.lowest')} subtitle={t('vacc.lowestSub')}>
          <BarList
            items={rankBy(ctx, 'l2', (i) => i.pctVaccinated, { min: 5, asc: true, limit: 10 })}
            color={pal.series[1]} max={100} valueFormat={(n) => fmtPct(n)}
            onSelect={(k) => ctx.toggleFilter('l2', k)} selected={ctx.filters.l2} labelWidth="w-28"
          />
        </Card>
        <Card title={t('vacc.age')} subtitle={t('vacc.ageSub')}>
          <BarList items={ages} color={pal.series[0]} />
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('vacc.effect')} info={t('vacc.effectInfo')}>
          <BarList
            items={[
              { key: 'v', label: t('legend.vaccinated'), value: signsBy((h) => h.vaccinated === true), color: pal.series[0] },
              { key: 'n', label: t('legend.notVaccinated'), value: signsBy((h) => h.vaccinated === false), color: pal.series[1] },
            ]}
            color={pal.series[0]} max={100} valueFormat={(n) => fmtPct(n)}
          />
          <p className="mt-3 text-[11px] text-gray-500">{t('vacc.effectNote')}</p>
        </Card>
        <Card title={t('vacc.vet')} subtitle={t('vacc.vetSub')}>
          <ShareBar parts={yesNoParts(ctx, herds, (h) => h.vetAccess, pal.series[0], pal.series[1])} />
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('vacc.vetLowest')}</p>
            <BarList items={rankBy(ctx, 'l2', (i) => i.pctVetAccess, { min: 5, asc: true, limit: 5 })} color={pal.series[1]} max={100} valueFormat={(n) => fmtPct(n)} labelWidth="w-28" />
          </div>
        </Card>
        <Card title={t('vacc.biosecurity')} subtitle={t('vacc.biosecuritySub')}>
          <BarList items={itemsFor(ctx, 'biosecurity', herds.filter((h) => h.biosecurity.length > 0), { asPct: true })} color={pal.series[0]} max={100} valueFormat={(n) => fmtPct(n)} />
        </Card>
      </div>
    </div>
  );
}

/* ── Movement ── */

function MovementTab({ ctx }: { ctx: Ctx }) {
  const { t, herds, pal, ds } = ctx;
  const movers = herds.filter((h) => h.moves === true);
  const sharers = herds.filter((h) => h.sharedGrazing === true);
  const origins = useMemo(() => {
    const m = new Map<string, number>();
    const ids = new Set(herds.map((h) => h.id));
    for (const r of ds.rows) {
      if (!ids.has(r.id)) continue;
      const v = String(r.data['additions_origin'] ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,]+$/, '');
      if (v) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([k, v]) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1), value: v }));
  }, [ds.rows, herds]);

  const dirCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of movers) for (const d of h.moveDirections) m.set(d, (m.get(d) ?? 0) + 1);
    const lbl = (d: string) => ds.fields['movement_direction']?.options?.[d]?.en ?? d;
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: lbl(k), value: v }));
  }, [movers, ds.fields]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('move.moves')} subtitle={t('move.movesSub')}>
          <ShareBar parts={yesNoParts(ctx, herds, (h) => h.moves, pal.series[1], pal.series[0])} />
          <div className="mt-5 space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('move.reasons')}</p>
              <BarList items={itemsFor(ctx, 'moveReasons', movers, { asPct: true })} color={pal.series[1]} max={100} valueFormat={(n) => fmtPct(n)} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('move.direction')}</p>
              <BarList items={dirCounts} color={pal.series[1]} />
            </div>
          </div>
        </Card>
        <Card title={t('move.shared')} subtitle={t('move.sharedSub')}>
          <ShareBar parts={yesNoParts(ctx, herds, (h) => h.sharedGrazing, pal.series[1], pal.series[0])} />
          <div className="mt-5 space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('move.sharedWhat')}</p>
              <BarList items={itemsFor(ctx, 'sharedWhat', sharers, { asPct: true })} color={pal.series[1]} max={100} valueFormat={(n) => fmtPct(n)} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('move.water')}</p>
              <BarList items={itemsFor(ctx, 'water', herds, { asPct: true })} color={pal.series[0]} max={100} valueFormat={(n) => fmtPct(n)} />
            </div>
          </div>
        </Card>
        <Card title={t('move.additions')} subtitle={t('move.additionsSub')}>
          <ShareBar parts={yesNoParts(ctx, herds, (h) => h.recentAdditions, pal.series[1], pal.series[0])} />
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('move.origins')}</p>
            <BarList items={origins} color={pal.series[1]} />
          </div>
        </Card>
      </div>
      <Card title={t('move.byDistrict')} subtitle={t('move.byDistrictSub')}>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('move.movesShort')}</p>
            <BarList items={rankBy(ctx, 'l2', (i) => i.pctMoves, { min: 5, limit: 10 })} color={pal.series[1]} max={100} valueFormat={(n) => fmtPct(n)} onSelect={(k) => ctx.toggleFilter('l2', k)} selected={ctx.filters.l2} labelWidth="w-28" />
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('move.sharedShort')}</p>
            <BarList items={rankBy(ctx, 'l2', (i) => i.pctShared, { min: 5, limit: 10 })} color={pal.series[1]} max={100} valueFormat={(n) => fmtPct(n)} onSelect={(k) => ctx.toggleFilter('l2', k)} selected={ctx.filters.l2} labelWidth="w-28" />
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── Risk ── */

function RiskTab({ ctx }: { ctx: Ctx }) {
  const { t, herds, pal, valueLabel } = ctx;
  const [outcome, setOutcome] = useState<'signs' | 'suspect'>('signs');
  const rrs = useMemo(() => relativeRisks(herds, outcome === 'signs' ? (h) => h.anySign : (h) => h.pprSuspect), [herds, outcome]);
  const prevalence = RISK_FACTORS.map((f) => ({
    key: f, label: t(`factor.${f}`), value: (herds.filter((h) => h.factors[f]).length / Math.max(1, herds.length)) * 100,
    note: `+${RISK_WEIGHTS[f]}`, tooltip: t('risk.weightTip', { w: RISK_WEIGHTS[f] }),
  })).sort((a, b) => b.value - a.value);

  // Scores are sums of 5/10/15-point weights, so 5-point bins map onto exactly one risk level.
  const hist = Array.from({ length: 21 }, (_, i) => ({ bin: String(i * 5), n: 0, level: riskLevelOf(i * 5) }));
  for (const h of herds) hist[Math.min(20, Math.round(h.risk / 5))].n++;

  const districts = useMemo(() => {
    const rows: { key: string; n: number; parts: Record<RiskLevel, number>; mean: number }[] = [];
    for (const [key, hs] of groupBy(herds, 'l2')) {
      if (!key || hs.length < 3) continue;
      const parts = { low: 0, moderate: 0, high: 0, veryHigh: 0 } as Record<RiskLevel, number>;
      for (const h of hs) parts[h.riskLevel]++;
      rows.push({ key, n: hs.length, parts, mean: hs.reduce((s, h) => s + h.risk, 0) / hs.length });
    }
    return rows.sort((a, b) => b.mean - a.mean).slice(0, 15);
  }, [herds]);

  // Log-scale positions for the RR plot (0.25 .. 4)
  const lo = Math.log(0.25), hi = Math.log(4);
  const pos = (v: number) => `${((Math.log(Math.min(4, Math.max(0.25, v))) - lo) / (hi - lo)) * 100}%`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('risk.factors')} subtitle={t('risk.factorsSub')} info={t('risk.scoreInfo')}>
          <BarList items={prevalence} color={pal.series[1]} max={100} valueFormat={(n) => fmtPct(n)} labelWidth="w-48" />
        </Card>
        <Card title={t('risk.histogram')} subtitle={t('risk.histogramSub')}>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={hist} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke={pal.grid} />
                <XAxis dataKey="bin" {...axisProps(pal)} interval={1} tick={{ fontSize: 10, fill: pal.muted }} />
                <YAxis allowDecimals={false} {...axisProps(pal)} axisLine={false} />
                <Tooltip content={<ChartTooltip title={(b: string) => `${t('risk.score')} ${b}`} />} cursor={{ fill: pal.dark ? '#ffffff10' : '#0000000a' }} />
                <Bar dataKey="n" name={t('col.herds')} radius={[4, 4, 0, 0]}>
                  {hist.map((h) => <CellFill key={h.bin} fill={RISK_COLORS[h.level]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {RISK_LEVELS.map((r) => <RiskBadge key={r} level={r} label={`${t(`risk.${r}`)} · ${t(`risk.range.${r}`)}`} />)}
          </div>
        </Card>
        <Card title={t('risk.method')}>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {RISK_FACTORS.map((f) => (
                <tr key={f}><td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">{t(`factor.${f}`)}</td><td className="py-1.5 text-right tabular-nums font-semibold">{RISK_WEIGHTS[f]}</td></tr>
              ))}
              <tr><td className="py-1.5 pr-2 font-semibold">{t('risk.total')}</td><td className="py-1.5 text-right font-semibold">100</td></tr>
            </tbody>
          </table>
          <p className="mt-3 text-[11px] leading-relaxed text-gray-500">{t('risk.methodNote')}</p>
        </Card>
      </div>

      <Card
        title={t('rr.title')}
        subtitle={t('rr.subtitle')}
        info={t('rr.info')}
        actions={<Segmented size="xs" value={outcome} onChange={setOutcome} options={[{ value: 'signs', label: t('rr.outcomeSigns') }, { value: 'suspect', label: t('rr.outcomeSuspect') }]} />}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">{t('rr.factor')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('rr.exposed')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('rr.riskExposed')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('rr.riskUnexposed')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('rr.rr')}</th>
                <th className="w-[34%] px-3 py-2 text-left font-semibold">
                  <div className="relative flex justify-between text-[9px] font-normal normal-case"><span>0.25</span><span>1</span><span>4</span></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 tabular-nums dark:divide-gray-800">
              {rrs.map((r) => {
                const sig = r.low != null && r.high != null && (r.low > 1 || r.high < 1);
                const color = !sig ? pal.other : (r.rr ?? 1) > 1 ? STATUS.critical : STATUS.good;
                return (
                  <tr key={r.factor}>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{t(`factor.${r.factor}`)}</td>
                    <td className="px-3 py-2 text-right">{fmtInt(r.exposed)}</td>
                    <td className="px-3 py-2 text-right">{fmtPct(r.riskExposed)}</td>
                    <td className="px-3 py-2 text-right">{fmtPct(r.riskUnexposed)}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {r.rr == null ? '—' : <>{r.rr.toFixed(2)} <span className="font-normal text-gray-400">[{r.low!.toFixed(2)}–{r.high!.toFixed(2)}]</span></>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative h-4" title={r.rr == null ? '' : `RR ${r.rr.toFixed(2)} (95% CI ${r.low!.toFixed(2)}–${r.high!.toFixed(2)})`}>
                        <span className="absolute inset-y-0 w-px" style={{ left: pos(1), backgroundColor: pal.axis }} />
                        {r.rr != null && (
                          <>
                            <span className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded" style={{ left: pos(r.low!), width: `calc(${pos(r.high!)} - ${pos(r.low!)})`, backgroundColor: color }} />
                            <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-gray-900" style={{ left: pos(r.rr), backgroundColor: color }} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-500 dark:border-gray-800">{t('rr.note')}</p>
      </Card>

      <Card title={t('risk.byDistrict')} subtitle={t('risk.byDistrictSub')}>
        <ul className="space-y-2">
          {districts.map((d) => (
            <li key={d.key}>
              <button type="button" onClick={() => ctx.toggleFilter('l2', d.key)} className="grid w-full grid-cols-[9rem_1fr_4rem] items-center gap-3 rounded px-1 py-0.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <span className="truncate text-xs text-gray-700 dark:text-gray-300">{valueLabel('l2', d.key)} <span className="text-gray-400">n={d.n}</span></span>
                <span className="flex h-3 gap-[2px] overflow-hidden rounded">
                  {RISK_LEVELS.filter((r) => d.parts[r] > 0).map((r) => (
                    <span key={r} title={`${t(`risk.${r}`)}: ${d.parts[r]}`} style={{ width: `${(d.parts[r] / d.n) * 100}%`, backgroundColor: RISK_COLORS[r] }} />
                  ))}
                </span>
                <span className="text-right text-xs tabular-nums text-gray-900 dark:text-gray-100">{d.mean.toFixed(0)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {RISK_LEVELS.map((r) => <RiskBadge key={r} level={r} label={t(`risk.${r}`)} />)}
          <span className="ml-auto text-[11px] text-gray-500">{t('risk.meanScore')}</span>
        </div>
      </Card>
    </div>
  );
}

/* ── Comparison & cross analysis ── */

const COMPARE_DIMS: DimensionKey[] = ['country', 'l1', 'l2', 'system', 'sizeClass', 'agent', 'month'];
const CROSS_DIMS: DimensionKey[] = [
  'country', 'l1', 'l2', 'system', 'sizeClass', 'riskLevel', 'anySign', 'pprSuspect', 'vaccinated', 'coverage',
  'vetAccess', 'moves', 'sharedGrazing', 'recentAdditions', 'neighbour', 'lab', 'signs', 'water', 'biosecurity',
  'ages', 'moveReasons', 'agent', 'status', 'month',
];

type MetricKey = 'herds' | 'animals' | 'pctSigns' | 'pctSuspect' | 'caseFatality' | 'pctVaccinated' | 'pctVetAccess' | 'pctMoves' | 'pctShared' | 'pctNoBiosecurity' | 'pctNeighbour' | 'meanRisk' | 'pctHighRisk';
const METRICS: { key: MetricKey; pct: boolean; higherIsWorse: boolean }[] = [
  { key: 'herds', pct: false, higherIsWorse: false },
  { key: 'animals', pct: false, higherIsWorse: false },
  { key: 'pctSigns', pct: true, higherIsWorse: true },
  { key: 'pctSuspect', pct: true, higherIsWorse: true },
  { key: 'caseFatality', pct: true, higherIsWorse: true },
  { key: 'pctVaccinated', pct: true, higherIsWorse: false },
  { key: 'pctVetAccess', pct: true, higherIsWorse: false },
  { key: 'pctMoves', pct: true, higherIsWorse: true },
  { key: 'pctShared', pct: true, higherIsWorse: true },
  { key: 'pctNoBiosecurity', pct: true, higherIsWorse: true },
  { key: 'pctNeighbour', pct: true, higherIsWorse: true },
  { key: 'meanRisk', pct: false, higherIsWorse: true },
  { key: 'pctHighRisk', pct: true, higherIsWorse: true },
];

function CompareTab({ ctx }: { ctx: Ctx }) {
  const { t, herds, pal, valueLabel, dimLabel } = ctx;
  const [dim, setDim] = useState<DimensionKey>(ctx.countries.length > 1 ? 'country' : 'l1');
  const [sort, setSort] = useState<MetricKey>('herds');
  const [minN, setMinN] = useState('5');

  const rows = useMemo(() => {
    const out: { key: string; ind: Indicators }[] = [];
    for (const [key, hs] of groupBy(herds, dim)) {
      if (!key || hs.length < Number(minN)) continue;
      out.push({ key, ind: indicators(hs) });
    }
    return out.sort((a, b) => (b.ind[sort] as number) - (a.ind[sort] as number)).slice(0, 40);
  }, [herds, dim, sort, minN]);

  const ranges = useMemo(() => {
    const r: Record<string, [number, number]> = {};
    for (const m of METRICS) {
      const vals = rows.map((x) => x.ind[m.key] as number);
      r[m.key] = [Math.min(...vals), Math.max(...vals)];
    }
    return r;
  }, [rows]);
  const total = ctx.ind;

  return (
    <div className="space-y-4">
      <Card
        title={t('compare.title')}
        subtitle={t('compare.subtitle')}
        actions={
          <div className="flex items-end gap-2">
            <Select label={t('compare.by')} value={dim} onChange={(v) => setDim(v as DimensionKey)} options={COMPARE_DIMS.map((d) => ({ value: d, label: dimLabel(d) }))} />
            <Select label={t('compare.minN')} value={minN} onChange={setMinN} options={['1', '5', '10', '20'].map((v) => ({ value: v, label: `n ≥ ${v}` }))} />
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-semibold dark:bg-gray-800">{dimLabel(dim)}</th>
                {METRICS.map((m) => (
                  <th key={m.key} className="px-2 py-2 text-right font-semibold">
                    <button type="button" onClick={() => setSort(m.key)} className={`uppercase ${sort === m.key ? 'text-gray-900 underline underline-offset-2 dark:text-gray-50' : ''}`}>
                      {t(`metric.${m.key}`)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="sticky left-0 z-10 max-w-[180px] truncate bg-white px-3 py-1.5 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                    {dim === 'country' && <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: ctx.countryColor(r.key) }} />}
                    {valueLabel(dim, r.key)}
                  </td>
                  {METRICS.map((m) => {
                    const v = r.ind[m.key] as number;
                    const [mn, mx] = ranges[m.key];
                    const tNorm = mx > mn ? (v - mn) / (mx - mn) : 0;
                    const shade = m.key === 'herds' || m.key === 'animals' ? null : rampColor(pal, tNorm * 0.85);
                    return (
                      <td key={m.key} className="px-1 py-1 text-right">
                        <span className="block rounded px-1.5 py-0.5" style={shade ? { backgroundColor: shade.bg, color: shade.fg } : undefined}>
                          {m.pct ? fmtPct(v) : m.key === 'meanRisk' ? v.toFixed(0) : fmtInt(v)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 font-semibold dark:border-gray-700">
                <td className="sticky left-0 bg-white px-3 py-1.5 dark:bg-gray-900">{t('compare.total')}</td>
                {METRICS.map((m) => {
                  const v = total[m.key] as number;
                  return <td key={m.key} className="px-2.5 py-1.5 text-right">{m.pct ? fmtPct(v) : m.key === 'meanRisk' ? v.toFixed(0) : fmtInt(v)}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-500 dark:border-gray-800">{t('compare.note')}</p>
      </Card>

      <CrossTabCard ctx={ctx} />
    </div>
  );
}

function CrossTabCard({ ctx }: { ctx: Ctx }) {
  const { t, herds, pal, valueLabel, dimLabel } = ctx;
  const [rowDim, setRowDim] = useState<DimensionKey>('system');
  const [colDim, setColDim] = useState<DimensionKey>('riskLevel');
  const [mode, setMode] = useState<'count' | 'row' | 'col'>('row');
  const ct = useMemo(() => crossTab(herds, rowDim, colDim), [herds, rowDim, colDim]);
  const cols = colDim === 'riskLevel' ? RISK_LEVELS.filter((r) => ct.cols.includes(r)) : colDim === 'sizeClass' ? SIZE_CLASSES.filter((s) => ct.cols.includes(s)) : ct.cols;

  const rowSum = (r: string) => cols.reduce((s, c) => s + (ct.cells[r]?.[c] ?? 0), 0);
  const colSum = (c: string) => ct.rows.reduce((s, r) => s + (ct.cells[r]?.[c] ?? 0), 0);
  const cellValue = (r: string, c: string) => {
    const n = ct.cells[r]?.[c] ?? 0;
    if (mode === 'count') return n;
    const d = mode === 'row' ? rowSum(r) : colSum(c);
    return d ? (n / d) * 100 : 0;
  };
  const max = Math.max(1, ...ct.rows.flatMap((r) => cols.map((c) => cellValue(r, c))));
  const pText = ct.chi2 ? (ct.chi2.p < 0.001 ? 'p < 0.001' : `p = ${ct.chi2.p.toFixed(3)}`) : null;

  return (
    <Card
      title={t('cross.title')}
      subtitle={t('cross.subtitle')}
      info={t('cross.info')}
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <Select label={t('cross.rows')} value={rowDim} onChange={(v) => setRowDim(v as DimensionKey)} options={CROSS_DIMS.map((d) => ({ value: d, label: dimLabel(d) }))} />
          <Select label={t('cross.cols')} value={colDim} onChange={(v) => setColDim(v as DimensionKey)} options={CROSS_DIMS.map((d) => ({ value: d, label: dimLabel(d) }))} />
          <Segmented size="xs" value={mode} onChange={setMode} options={[{ value: 'count', label: 'N' }, { value: 'row', label: t('cross.rowPct') }, { value: 'col', label: t('cross.colPct') }]} />
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">{dimLabel(rowDim)} \ {dimLabel(colDim)}</th>
              {cols.map((c) => <th key={c} className="px-2 py-2 text-right font-semibold normal-case">{valueLabel(colDim, c)}</th>)}
              <th className="px-3 py-2 text-right font-semibold">{t('cross.total')}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {ct.rows.map((r) => (
              <tr key={r} className="border-t border-gray-100 dark:border-gray-800">
                <td className="max-w-[200px] truncate px-3 py-1.5 text-gray-800 dark:text-gray-200">{valueLabel(rowDim, r)}</td>
                {cols.map((c) => {
                  const v = cellValue(r, c);
                  const shade = rampColor(pal, (v / max) * 0.9);
                  return (
                    <td key={c} className="px-1 py-1 text-right" title={`${valueLabel(rowDim, r)} × ${valueLabel(colDim, c)}: ${ct.cells[r]?.[c] ?? 0}`}>
                      <span className="block rounded px-1.5 py-0.5" style={{ backgroundColor: v ? shade.bg : 'transparent', color: v ? shade.fg : undefined }}>
                        {mode === 'count' ? fmtInt(v) : fmtPct(v)}
                      </span>
                    </td>
                  );
                })}
                <td className="px-3 py-1.5 text-right font-semibold">{fmtInt(rowSum(r))}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-200 font-semibold dark:border-gray-700">
              <td className="px-3 py-1.5">{t('cross.total')}</td>
              {cols.map((c) => <td key={c} className="px-2.5 py-1.5 text-right">{fmtInt(colSum(c))}</td>)}
              <td className="px-3 py-1.5 text-right">{fmtInt(ct.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-500 dark:border-gray-800">
        {ct.chi2
          ? t('cross.chi2', { x: ct.chi2.value.toFixed(1), df: ct.chi2.df, p: pText ?? '' }) + ' ' + (ct.chi2.p < 0.05 ? t('cross.significant') : t('cross.notSignificant'))
          : t('cross.multiNote')}
      </p>
    </Card>
  );
}

/* ── Collection & data quality ── */

function CollectionTab({ ctx }: { ctx: Ctx }) {
  const { t, herds, pal, valueLabel, ind } = ctx;
  const agents = useMemo(() => {
    const rows: { id: string; country: string; n: number; days: number; first: string; last: string; gps: number; validated: number; high: number }[] = [];
    for (const [id, hs] of groupBy(herds, 'agent')) {
      const days = new Set(hs.map((h) => h.day));
      const sorted = [...days].sort();
      rows.push({
        id,
        country: hs[0].country,
        n: hs.length,
        days: days.size,
        first: sorted[0],
        last: sorted[sorted.length - 1],
        gps: (hs.filter((h) => h.lat != null).length / hs.length) * 100,
        validated: (hs.filter((h) => h.status === 'VALIDATED').length / hs.length) * 100,
        high: (hs.filter((h) => h.riskLevel === 'high' || h.riskLevel === 'veryHigh').length / hs.length) * 100,
      });
    }
    return rows.sort((a, b) => b.n - a.n);
  }, [herds]);

  const completeness = useMemo(() => {
    const fields: { key: string; label: string; ok: (h: Herd) => boolean; applies?: (h: Herd) => boolean }[] = [
      { key: 'gps', label: t('quality.gps'), ok: (h) => h.lat != null },
      { key: 'l3', label: t('quality.admin3'), ok: (h) => !!h.l3 },
      { key: 'system', label: t('dim.system'), ok: (h) => !!h.system },
      { key: 'animals', label: t('quality.herdSize'), ok: (h) => h.animals > 0 },
      { key: 'vacc', label: t('dim.vaccinated'), ok: (h) => h.vaccinated != null },
      { key: 'vaccDate', label: t('quality.vaccDate'), ok: (h) => !!h.vaccinationDate, applies: (h) => h.vaccinated === true },
      { key: 'firstCase', label: t('quality.firstCase'), ok: (h) => !!h.firstCase, applies: (h) => h.anySign },
      { key: 'affected', label: t('quality.affected'), ok: (h) => h.affected > 0, applies: (h) => h.anySign },
      { key: 'neighbour', label: t('dim.neighbour'), ok: (h) => !!h.neighbour },
      { key: 'bio', label: t('dim.biosecurity'), ok: (h) => h.biosecurity.length > 0 },
    ];
    return fields.map((f) => {
      const base = f.applies ? herds.filter(f.applies) : herds;
      return { key: f.key, label: f.label, value: base.length ? (base.filter(f.ok).length / base.length) * 100 : 0, note: `n=${base.length}` };
    });
  }, [herds, t]);

  const statusParts = counts(herds, 'status').map((c, i) => ({ key: c.key, label: valueLabel('status', c.key), value: c.value, color: c.key === 'VALIDATED' ? STATUS.good : c.key === 'REJECTED' ? STATUS.critical : pal.series[i % 3] }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={Users} label={t('collect.agents')} value={fmtInt(ind.agents)} />
        <Kpi icon={Activity} label={t('collect.perAgentDay')} value={(agents.reduce((s, a) => s + a.n, 0) / Math.max(1, agents.reduce((s, a) => s + a.days, 0))).toFixed(1)} />
        <Kpi icon={MapIcon} label={t('quality.gps')} value={fmtPct(ind.pctGps)} tone={ind.pctGps >= 90 ? 'good' : 'warning'} />
        <Kpi icon={ClipboardCheck} label={t('collect.validated')} value={fmtPct(ind.pctValidated)} tone={ind.pctValidated >= 50 ? 'good' : 'warning'} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('collect.agentsTable')} className="lg:col-span-2" bodyClassName="p-0">
          <div className="max-h-[440px] overflow-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">{t('dim.agent')}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t('dim.country')}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t('col.herds')}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t('collect.days')}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t('collect.perDay')}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t('collect.period')}</th>
                  <th className="px-3 py-2 text-right font-semibold">GPS</th>
                  <th className="px-3 py-2 text-right font-semibold">{t('collect.validatedShort')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 tabular-nums dark:divide-gray-800">
                {agents.map((a) => (
                  <tr key={a.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40" onClick={() => ctx.toggleFilter('agent', a.id)}>
                    <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200">{valueLabel('agent', a.id)}</td>
                    <td className="px-3 py-1.5">{a.country}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{fmtInt(a.n)}</td>
                    <td className="px-3 py-1.5 text-right">{a.days}</td>
                    <td className="px-3 py-1.5 text-right">{(a.n / a.days).toFixed(1)}</td>
                    <td className="px-3 py-1.5 text-gray-500">{a.first === a.last ? a.first : `${a.first} → ${a.last}`}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: a.gps < 80 ? STATUS.critical : undefined }}>{fmtPct(a.gps)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtPct(a.validated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card title={t('collect.status')}>
            <ShareBar parts={statusParts} />
          </Card>
          <Card title={t('quality.completeness')} subtitle={t('quality.completenessSub')}>
            <BarList items={completeness} color={pal.series[2]} max={100} valueFormat={(n) => fmtPct(n)} labelWidth="w-32" />
          </Card>
        </div>
      </div>
    </div>
  );
}
