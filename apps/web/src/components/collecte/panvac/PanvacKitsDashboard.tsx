'use client';

/**
 * PANVAC kit dashboard: country demand vs PANVAC allocation, the gap between them,
 * how long each step takes (decision within 15 days, shipment, delivery) and what is waiting.
 * Loads the campaign's requests once (same endpoint as the tracking tab) and filters in the browser.
 */
import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import {
  ClipboardList, Package, CheckCircle2, Truck, PackageCheck, Hourglass, Timer, TrendingDown, Download, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useKitRequests } from '@/lib/api/workflow-hooks';
import { RECS } from '@/data/recs-config';
import { Card, Kpi, BarList, ShareBar, Select, Segmented, useVizPalette, fmtInt, fmtPct, setNumberLocale, STATUS } from '../disease-mapping/ui';
import {
  NO_KIT_FILTERS, STAGES, STAGE_COLOR, PRODUCTS, filterRequests, filterShipments, indicators, byCountry, byRec, monthlyFlow,
  decisionBuckets, quarterlyPerformance, waitingList, countryName, recName, fmtDate, toCsv, downloadCsv,
  type KitFilters, type CountryRow,
} from './kit-model';
import { StageBadge } from './KitRequestsTab';

const KitMap = dynamic(() => import('./KitMap'), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });

type SortKey = 'gap' | 'requested' | 'shipped' | 'fulfilmentPct' | 'medianDecisionDays' | 'pending';

const days = (n: number | null, unit: string) => (n === null ? '—' : `${Math.round(n)} ${unit}`);

export default function PanvacKitsDashboard({ campaignId }: { campaignId: string }) {
  const t = useTranslations('panvacKits');
  const locale = useLocaleStore((s) => s.locale);
  setNumberLocale(locale);
  const pal = useVizPalette();
  const q = useKitRequests(campaignId);
  const [f, setF] = useState<KitFilters>(NO_KIT_FILTERS);
  const [sort, setSort] = useState<SortKey>('gap');

  const data = q.data;
  const sla = data?.viewer.slaDays ?? 15;
  const all = data?.requests ?? [];
  const reqs = useMemo(() => filterRequests(all, f), [all, f]);
  const ships = useMemo(() => filterShipments(reqs, data?.orphanShipments ?? [], f), [reqs, data, f]);
  const ind = useMemo(() => indicators(reqs, ships, sla), [reqs, ships, sla]);
  const countries = useMemo(() => byCountry(reqs, ships), [reqs, ships]);
  const recs = useMemo(() => byRec(countries), [countries]);
  const flow = useMemo(() => monthlyFlow(reqs, ships), [reqs, ships]);
  const buckets = useMemo(() => decisionBuckets(reqs), [reqs]);
  const quarters = useMemo(() => quarterlyPerformance(reqs), [reqs]);
  const waiting = useMemo(() => waitingList(reqs).slice(0, 12), [reqs]);

  const years = useMemo(() => {
    const ys = new Set<string>();
    for (const r of all) ys.add(r.requestedAt.slice(0, 4));
    for (const s of data?.orphanShipments ?? []) ys.add(s.shippedAt.slice(0, 4));
    return [...ys].sort().reverse();
  }, [all, data]);
  const countryOptions = useMemo(() => {
    const cs = new Set(all.map((r) => r.countryCode));
    for (const s of data?.orphanShipments ?? []) cs.add(s.countryCode);
    return [...cs].map((c) => ({ value: c, label: countryName(c, locale) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [all, data, locale]);

  const sorted = useMemo(() => [...countries].sort((a, b) => {
    const va = a[sort] ?? -1;
    const vb = b[sort] ?? -1;
    return (vb as number) - (va as number);
  }), [countries, sort]);

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  if (q.error) {
    return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{(q.error as Error).message}</p>;
  }

  const unit = t('daysShort');
  const cname = (c: string) => countryName(c, locale);
  const funnelMax = Math.max(ind.qtyRequested, ind.qtyShipped, 1);
  const funnel = [
    { key: 'requested', label: t('kpi.requested'), value: ind.qtyRequested, color: pal.series[0] },
    { key: 'approved', label: t('kpi.approved'), value: ind.qtyApproved, color: pal.ramp[5] },
    { key: 'shipped', label: t('kpi.shipped'), value: ind.qtyShipped, color: pal.series[1] },
    { key: 'received', label: t('kpi.received'), value: ind.qtyReceived, color: pal.series[2] },
  ];
  const stageParts = STAGES.map((s) => ({ key: s, label: t(`stage.${s}`), value: reqs.filter((r) => r.metrics.stage === s).length, color: STAGE_COLOR[s] }))
    .filter((p) => p.value > 0);

  const exportCsv = () => {
    const rows: (string | number | null)[][] = [[t('col.country'), t('col.requests'), t('col.requested'), t('col.approved'), t('col.shipped'), t('col.received'), t('col.gap'), t('col.fulfilment'), t('col.medianDecision'), t('col.pending')]];
    for (const r of sorted) rows.push([cname(r.code), r.requests, r.requested, r.approved, r.shipped, r.received, r.gap, r.fulfilmentPct === null ? null : Math.round(r.fulfilmentPct), r.medianDecisionDays, r.pending]);
    downloadCsv(`panvac-kits-by-country-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };

  return (
    <div className="space-y-5">
      {/* Filters — one row above everything */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <Select label={t('filter.year')} value={f.year} onChange={(v) => setF({ ...f, year: v })} options={[{ value: '', label: t('filter.all') }, ...years.map((y) => ({ value: y, label: y }))]} className="w-28" />
        <Select label="REC" value={f.rec} onChange={(v) => setF({ ...f, rec: v, country: '' })} options={[{ value: '', label: t('filter.all') }, ...Object.keys(RECS).map((r) => ({ value: r, label: recName(r, locale) }))]} className="w-36" />
        <Select label={t('filter.country')} value={f.country} onChange={(v) => setF({ ...f, country: v })} options={[{ value: '', label: t('filter.all') }, ...countryOptions]} className="w-44" />
        <Select label={t('filter.product')} value={f.product} onChange={(v) => setF({ ...f, product: v })} options={[{ value: '', label: t('filter.all') }, ...PRODUCTS.map((p) => ({ value: p, label: t(`product.${p}`) }))]} className="w-52" />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('filter.history')}</span>
          <Segmented value={f.history} onChange={(v) => setF({ ...f, history: v })} options={[{ value: 'include', label: t('filter.withHistory') }, { value: 'exclude', label: t('filter.only2027') }]} />
        </div>
        <div className="ml-auto flex gap-2">
          {(f.year || f.rec || f.country || f.product || f.history !== 'include') && (
            <button type="button" onClick={() => setF(NO_KIT_FILTERS)} className="h-8 rounded-md px-3 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">{t('filter.reset')}</button>
          )}
          <button type="button" onClick={exportCsv} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 px-3 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200"><Download className="h-3.5 w-3.5" /> CSV</button>
          <button type="button" onClick={() => q.refetch()} className="inline-flex h-8 items-center rounded-md border border-gray-200 px-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300" aria-label={t('refresh')}><RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {ind.mixedUnits && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {t('mixedUnits')}
        </p>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={ClipboardList} label={t('kpi.requests')} value={fmtInt(ind.requests)} sub={t('kpi.countries', { n: ind.countries })} />
        <Kpi icon={Package} label={t('kpi.requested')} value={fmtInt(ind.qtyRequested)} sub={t('kpi.kitsUnit')} />
        <Kpi icon={CheckCircle2} label={t('kpi.approved')} value={fmtInt(ind.qtyApproved)} sub={ind.approvalPct === null ? t('kpi.noDecisionYet') : t('kpi.approvalRate', { pct: fmtPct(ind.approvalPct) })} />
        <Kpi icon={Truck} label={t('kpi.shipped')} value={fmtInt(ind.qtyShipped)} sub={ind.fulfilmentPct === null ? '—' : t('kpi.fulfilment', { pct: fmtPct(ind.fulfilmentPct) })}
          tone={ind.fulfilmentPct === null ? 'neutral' : ind.fulfilmentPct >= 80 ? 'good' : ind.fulfilmentPct >= 50 ? 'warning' : 'critical'} />
        <Kpi icon={TrendingDown} label={t('kpi.gap')} value={fmtInt(Math.max(0, ind.qtyRequested - ind.qtyShipped))} sub={t('kpi.gapSub')} />
        <Kpi icon={Hourglass} label={t('kpi.pending')} value={fmtInt(ind.pending)} sub={ind.pendingOverdue ? t('kpi.overdue', { n: ind.pendingOverdue, days: sla }) : t('kpi.noneOverdue', { days: sla })}
          tone={ind.pendingOverdue ? 'critical' : ind.pending ? 'warning' : 'good'} />
        <Kpi icon={Timer} label={t('kpi.decisionDelay')} value={days(ind.medianDecisionDays, unit)} sub={ind.slaPct === null ? t('kpi.noDecisionYet') : t('kpi.withinSla', { pct: fmtPct(ind.slaPct), days: sla })}
          tone={ind.slaPct === null ? 'neutral' : ind.slaPct >= 80 ? 'good' : ind.slaPct >= 50 ? 'warning' : 'critical'} />
        <Kpi icon={PackageCheck} label={t('kpi.received')} value={fmtInt(ind.qtyReceived)} sub={ind.receptionPct === null ? t('kpi.noShipmentYet') : t('kpi.receptionRate', { pct: fmtPct(ind.receptionPct) })} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* From request to reception */}
        <Card className="lg:col-span-3" title={t('card.funnel')} subtitle={t('card.funnelSub')} info={t('card.funnelInfo')}>
          <div className="space-y-3">
            {funnel.map((s) => {
              // Gap shown against the previous comparable step: shipped vs requested, received vs shipped (current system).
              const lost = s.key === 'shipped' ? ind.qtyRequested - s.value : null;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-gray-700 dark:text-gray-300">{s.label}</span>
                  <span className="relative h-6 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                    <span className="absolute inset-y-0 left-0 rounded-r" style={{ width: `${Math.max(0.5, (s.value / funnelMax) * 100)}%`, backgroundColor: s.color }} />
                  </span>
                  <span className="w-28 shrink-0 text-right text-xs tabular-nums text-gray-900 dark:text-gray-100">
                    {fmtInt(s.value)}{lost !== null && lost > 0 && <span className="ml-1 text-gray-500">(−{fmtInt(lost)})</span>}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('card.stages')}</p>
            <ShareBar parts={stageParts} />
          </div>
        </Card>

        {/* PANVAC performance */}
        <Card className="lg:col-span-2" title={t('card.performance')} subtitle={t('card.performanceSub', { days: sla })}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            {[
              { label: t('perf.decision'), value: days(ind.medianDecisionDays, unit), tone: ind.medianDecisionDays === null ? null : ind.medianDecisionDays <= sla },
              { label: t('perf.sla', { days: sla }), value: ind.slaPct === null ? '—' : fmtPct(ind.slaPct), tone: ind.slaPct === null ? null : ind.slaPct >= 80 },
              { label: t('perf.toShipment'), value: days(ind.medianShipmentDays, unit), tone: null },
              { label: t('perf.onTime'), value: ind.onTimePct === null ? '—' : fmtPct(ind.onTimePct), tone: ind.onTimePct === null ? null : ind.onTimePct >= 80 },
              { label: t('perf.delivery'), value: days(ind.medianDeliveryDays, unit), tone: null },
              { label: t('perf.total'), value: days(ind.medianTotalDays, unit), tone: null },
            ].map((x) => (
              <div key={x.label}>
                <dt className="text-[11px] leading-tight text-gray-500 dark:text-gray-400">{x.label}</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                  {x.value}
                  {x.tone !== null && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: x.tone ? STATUS.good : STATUS.critical }} aria-hidden />}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[11px] text-gray-500 dark:text-gray-400">{t('perf.note')}</p>
        </Card>
      </div>

      {/* Monthly flow */}
      <Card title={t('card.flow')} subtitle={t('card.flowSub')}>
        {flow.length === 0 ? <p className="py-8 text-center text-xs italic text-gray-400">—</p> : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flow} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke={pal.grid} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: pal.muted }} tickLine={false} axisLine={{ stroke: pal.axis }}
                  tickFormatter={(m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' })} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: pal.muted }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: pal.grid, opacity: 0.4 }} contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  labelFormatter={(m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="requested" name={t('kpi.requested')} fill={pal.series[0]} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="approved" name={t('kpi.approved')} fill={pal.ramp[5]} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="shipped" name={t('kpi.shipped')} fill={pal.series[1]} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" title={t('card.map')} subtitle={t('card.mapSub')} bodyClassName="p-0">
          <div className="h-[420px]">
            <KitMap
              data={countries.map((c) => ({ code: c.code, name: cname(c.code), requested: c.requested, shipped: c.shipped, pending: c.pending }))}
              labels={{ requested: t('kpi.requested'), shipped: t('kpi.shipped'), pending: t('kpi.pending'), legend: t('card.mapLegend'), none: t('card.mapNone') }}
            />
          </div>
        </Card>
        <Card className="lg:col-span-2" title={t('card.gapTop')} subtitle={t('card.gapTopSub')}>
          <BarList
            items={[...countries].filter((c) => c.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 12)
              .map((c) => ({ key: c.code, label: cname(c.code), value: c.gap, note: `/ ${fmtInt(c.requested)}` }))}
            color={pal.series[1]}
            onSelect={(code) => setF({ ...f, country: f.country === code ? '' : code })}
            selected={f.country}
            empty={t('noGap')}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('card.decisionDelays')} subtitle={t('card.decisionDelaysSub', { days: sla })}>
          {buckets.every((b) => !b.decided && !b.pending) ? <p className="py-8 text-center text-xs italic text-gray-400">{t('kpi.noDecisionYet')}</p> : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets.map((b) => ({ ...b, label: t(`bucket.${b.key}`) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={pal.grid} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: pal.muted }} tickLine={false} axisLine={{ stroke: pal.axis }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: pal.muted }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: pal.grid, opacity: 0.4 }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="decided" stackId="a" name={t('bucket.decided')} fill={pal.series[0]} maxBarSize={36} />
                  <Bar dataKey="pending" stackId="a" name={t('bucket.pending')} fill={pal.series[1]} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title={t('card.quarterly')} subtitle={t('card.quarterlySub', { days: sla })}>
          {quarters.length === 0 ? <p className="py-8 text-center text-xs italic text-gray-400">{t('kpi.noDecisionYet')}</p> : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quarters} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={pal.grid} />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: pal.muted }} tickLine={false} axisLine={{ stroke: pal.axis }} />
                  <YAxis tick={{ fontSize: 11, fill: pal.muted }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: pal.grid, opacity: 0.4 }} contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number, _n, p: any) => [`${Math.round(v)} ${unit} · ${p.payload.slaPct === null ? '—' : fmtPct(p.payload.slaPct)} ${t('perf.inSla')} · n=${p.payload.decided}`, t('perf.decision')]} />
                  <ReferenceLine y={sla} stroke={STATUS.critical} strokeDasharray="4 4" label={{ value: `${sla} ${unit}`, fontSize: 11, fill: STATUS.critical, position: 'right' }} />
                  <Bar dataKey="medianDays" name={t('perf.decision')} fill={pal.series[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" title={t('card.waiting')} subtitle={t('card.waitingSub')}>
          {waiting.length === 0 ? <p className="py-6 text-center text-xs italic text-gray-400">{t('card.nothingWaiting')}</p> : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {waiting.map((r) => {
                const overdue = r.metrics.stage === 'PENDING_DECISION' && (r.metrics.waitingDays ?? 0) > sla;
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{cname(r.countryCode)} <span className="font-normal text-gray-500">· {fmtInt(r.quantityRequested ?? 0)} {t('kits')}</span></p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('requestedOn', { date: fmtDate(r.requestedAt, locale) })}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StageBadge stage={r.metrics.stage} />
                      <span className={`w-16 text-right text-xs tabular-nums ${overdue ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>{days(r.metrics.waitingDays, unit)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-2" title={t('card.byRec')} subtitle={t('card.byRecSub')}>
          <BarList
            items={recs.map((r) => ({ key: r.rec, label: recName(r.rec, locale), value: r.requested, note: r.requested ? `→ ${fmtPct((r.shipped / r.requested) * 100)}` : '', tooltip: `${recName(r.rec, locale)}: ${fmtInt(r.requested)} ${t('kpi.requested').toLowerCase()}, ${fmtInt(r.shipped)} ${t('kpi.shipped').toLowerCase()} (${r.countries})` }))}
            color={pal.series[0]}
            onSelect={(rec) => setF({ ...f, rec: f.rec === rec ? '' : rec, country: '' })}
            selected={f.rec}
            labelWidth="w-24"
          />
        </Card>
      </div>

      {/* Country table */}
      <Card title={t('card.byCountry')} subtitle={t('card.byCountrySub')} bodyClassName="p-0"
        actions={<Segmented size="xs" value={sort} onChange={setSort} options={[
          { value: 'gap', label: t('col.gap') }, { value: 'requested', label: t('col.requested') }, { value: 'fulfilmentPct', label: t('col.fulfilment') },
          { value: 'medianDecisionDays', label: t('col.medianDecision') }, { value: 'pending', label: t('col.pending') },
        ]} />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">{t('col.country')}</th>
                <th className="px-3 py-2 text-right">{t('col.requests')}</th>
                <th className="px-3 py-2 text-right">{t('col.requested')}</th>
                <th className="px-3 py-2 text-right">{t('col.approved')}</th>
                <th className="px-3 py-2 text-right">{t('col.shipped')}</th>
                <th className="px-3 py-2 text-right">{t('col.received')}</th>
                <th className="px-3 py-2 text-right">{t('col.gap')}</th>
                <th className="px-3 py-2">{t('col.fulfilment')}</th>
                <th className="px-3 py-2 text-right">{t('col.medianDecision')}</th>
                <th className="px-3 py-2 text-right">{t('col.pending')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-xs italic text-gray-400">{t('noRequests')}</td></tr>}
              {sorted.map((r: CountryRow) => (
                <tr key={r.code} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 ${f.country === r.code ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''}`} onClick={() => setF({ ...f, country: f.country === r.code ? '' : r.code })}>
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{cname(r.code)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.requests}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(r.requested)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.approved ? fmtInt(r.approved) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(r.shipped)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.received ? fmtInt(r.received) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{r.gap ? fmtInt(r.gap) : '0'}</td>
                  <td className="px-3 py-2">
                    {r.fulfilmentPct === null ? <span className="text-xs text-gray-400">—</span> : (
                      <div className="flex items-center gap-2">
                        <span className="relative h-2 w-20 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                          <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(100, r.fulfilmentPct)}%`, backgroundColor: pal.series[0] }} />
                        </span>
                        <span className="text-xs tabular-nums text-gray-700 dark:text-gray-300">{fmtPct(r.fulfilmentPct)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{days(r.medianDecisionDays, unit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.pending || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('historyNote')}</p>
    </div>
  );
}
