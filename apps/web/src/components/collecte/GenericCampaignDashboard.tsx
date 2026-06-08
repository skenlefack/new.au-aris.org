'use client';

import React, { useMemo } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCampaignSubmissions } from '@/lib/api/workflow-hooks';
import { BarChart3, Database, Calendar, Globe2, Hash } from 'lucide-react';

/* ── Color palettes ── */
const CHART_COLORS = [
  '#1F4E79', '#059669', '#EA580C', '#7C3AED', '#DC2626',
  '#D97706', '#0891B2', '#4F46E5', '#BE185D', '#65A30D',
  '#0D9488', '#6D28D9', '#B91C1C', '#CA8A04',
];
const HEADER_BG = '#1F4E79';

/* ── Field type classification ── */
type FieldType = 'numeric' | 'categorical' | 'country' | 'date' | 'text';

const COUNTRY_KEYWORDS = ['country', 'pays', 'nation', 'state', 'etat', 'membre'];
const DATE_KEYWORDS = ['date', 'time', 'timestamp', 'created', 'updated', 'submitted', 'jour', 'mois'];
const SKIP_FIELDS = ['id', '_id', 'submissionId', 'campaignId', 'tenantId', 'userId', 'formTemplateId', 'status', 'createdAt', 'updatedAt'];

function classifyField(key: string, samples: any[]): FieldType {
  const lower = key.toLowerCase();
  if (SKIP_FIELDS.includes(key)) return 'text';
  if (COUNTRY_KEYWORDS.some((kw) => lower.includes(kw))) return 'country';
  if (DATE_KEYWORDS.some((kw) => lower.includes(kw))) return 'date';

  const nonEmpty = samples.filter((v) => v != null && v !== '');
  if (nonEmpty.length === 0) return 'text';

  const numericCount = nonEmpty.filter((v) => {
    if (typeof v === 'number') return true;
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return true;
    return false;
  }).length;
  if (numericCount / nonEmpty.length > 0.7) return 'numeric';

  const uniqueValues = new Set(nonEmpty.map((v) => String(v).trim().toLowerCase()));
  if (uniqueValues.size <= 20 && uniqueValues.size < nonEmpty.length * 0.8) return 'categorical';

  return 'text';
}

function extractDataFields(subs: any[]): Record<string, any[]> {
  const fields: Record<string, any[]> = {};
  for (const sub of subs) {
    const d = sub.data || sub;
    for (const [k, v] of Object.entries(d)) {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) continue;
      if (Array.isArray(v)) continue;
      if (!fields[k]) fields[k] = [];
      fields[k].push(v);
    }
  }
  return fields;
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/* ── Pie chart (conic-gradient, same as DigitalToolsDashboard) ── */
function PieChart({ entries, colors, size = 150 }: {
  entries: { label: string; value: number }[];
  colors: string[];
  size?: number;
}) {
  const total = entries.reduce((s, e) => s + e.value, 0) || 1;
  let acc = 0;
  const stops = entries.map((e, i) => {
    const start = (acc / total) * 360;
    acc += e.value;
    const end = (acc / total) * 360;
    return `${colors[i % colors.length]} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
  });
  return (
    <div className="flex items-center gap-4">
      <div
        className="shrink-0 rounded-full shadow-lg"
        style={{
          width: size,
          height: size,
          background: entries.length > 0 ? `conic-gradient(${stops.join(', ')})` : '#e5e7eb',
        }}
      />
      <div className="space-y-1.5 min-w-0 flex-1">
        {entries.map((e, i) => (
          <div key={e.label} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
              {e.label}: <strong>{e.value}</strong>
              <span className="ml-1 text-xs text-gray-400">({Math.round((e.value / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Horizontal bar chart ── */
function HBarChart({ entries, color }: {
  entries: { label: string; value: number }[];
  color: string;
}) {
  const max = Math.max(...entries.map((e) => e.value), 1);
  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div key={e.label} className="flex items-center gap-2">
          <span className="text-xs text-gray-600 dark:text-gray-400 w-28 truncate text-right shrink-0">{e.label}</span>
          <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
            <div
              className="h-full rounded transition-all"
              style={{ width: `${(e.value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-12 text-right">{typeof e.value === 'number' && !Number.isInteger(e.value) ? e.value.toFixed(1) : e.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  GenericCampaignDashboard                                           */
/* ================================================================== */

export default function GenericCampaignDashboard({
  campaignId,
  campaignName,
}: {
  campaignId: string;
  campaignName: string;
}) {
  const sQ = useCampaignSubmissions(campaignId, { limit: 5000 });
  const rawSubs: any[] = Array.isArray(sQ.data?.data) ? sQ.data.data : [];
  const loading = sQ.isLoading;

  const analysis = useMemo(() => {
    if (rawSubs.length === 0) return null;

    const fields = extractDataFields(rawSubs);
    const classified: { key: string; type: FieldType; label: string; samples: any[] }[] = [];

    for (const [key, samples] of Object.entries(fields)) {
      if (SKIP_FIELDS.includes(key)) continue;
      const type = classifyField(key, samples);
      classified.push({ key, type, label: humanizeKey(key), samples });
    }

    /* ── KPIs ── */
    const totalSubmissions = rawSubs.length;

    // Distinct countries
    const countryFields = classified.filter((f) => f.type === 'country');
    const countrySet = new Set<string>();
    for (const cf of countryFields) {
      for (const v of cf.samples) {
        if (v != null && String(v).trim()) countrySet.add(String(v).trim().toLowerCase());
      }
    }
    const distinctCountries = countrySet.size;

    // Completion rate
    let filledCount = 0;
    let totalCells = 0;
    for (const sub of rawSubs) {
      const d = sub.data || sub;
      const keys = Object.keys(d).filter((k) => !SKIP_FIELDS.includes(k));
      totalCells += keys.length;
      filledCount += keys.filter((k) => d[k] != null && d[k] !== '').length;
    }
    const completionRate = totalCells > 0 ? Math.round((filledCount / totalCells) * 100) : 0;

    // Latest submission date
    let latestDate = '';
    const dateFields = classified.filter((f) => f.type === 'date');
    for (const df of dateFields) {
      for (const v of df.samples) {
        if (v) {
          const d = new Date(v);
          if (!isNaN(d.getTime())) {
            const iso = d.toISOString();
            if (iso > latestDate) latestDate = iso;
          }
        }
      }
    }
    // Fallback: check createdAt on submissions
    if (!latestDate) {
      for (const sub of rawSubs) {
        const ca = sub.createdAt || sub.created_at;
        if (ca) {
          const d = new Date(ca);
          if (!isNaN(d.getTime())) {
            const iso = d.toISOString();
            if (iso > latestDate) latestDate = iso;
          }
        }
      }
    }

    /* ── Charts ── */
    const charts: { key: string; label: string; type: 'pie' | 'bar'; entries: { label: string; value: number }[] }[] = [];

    // Categorical fields -> pie charts
    const categoricals = classified.filter((f) => f.type === 'categorical');
    for (const cf of categoricals) {
      if (charts.length >= 6) break;
      const counts = new Map<string, number>();
      for (const v of cf.samples) {
        const s = v != null ? String(v).trim() : '';
        if (s) counts.set(s, (counts.get(s) || 0) + 1);
      }
      const entries = Array.from(counts.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15);
      if (entries.length >= 2) {
        charts.push({ key: cf.key, label: cf.label, type: 'pie', entries });
      }
    }

    // Numeric fields -> bar charts (top values by first categorical or country, or just top submissions)
    const numerics = classified.filter((f) => f.type === 'numeric');
    const groupByField = countryFields[0] || categoricals[0];
    for (const nf of numerics) {
      if (charts.length >= 6) break;
      if (groupByField) {
        const grouped = new Map<string, number>();
        for (let i = 0; i < rawSubs.length; i++) {
          const d = rawSubs[i].data || rawSubs[i];
          const groupVal = d[groupByField.key];
          const numVal = Number(d[nf.key]);
          if (groupVal && !isNaN(numVal)) {
            const g = String(groupVal).trim();
            grouped.set(g, (grouped.get(g) || 0) + numVal);
          }
        }
        const entries = Array.from(grouped.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
        if (entries.length >= 2) {
          charts.push({ key: nf.key, label: `${nf.label} par ${groupByField.label}`, type: 'bar', entries });
        }
      } else {
        // No group field: show distribution as bar chart of top values
        const valueCounts = new Map<string, number>();
        for (const v of nf.samples) {
          if (v != null && v !== '') {
            const s = String(v);
            valueCounts.set(s, (valueCounts.get(s) || 0) + 1);
          }
        }
        const entries = Array.from(valueCounts.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
        if (entries.length >= 2) {
          charts.push({ key: nf.key, label: nf.label, type: 'bar', entries });
        }
      }
    }

    /* ── Table columns ── */
    const tableColumns = classified
      .filter((f) => f.type !== 'text' || f.samples.some((v) => v != null && v !== ''))
      .slice(0, 12)
      .map((f) => ({ key: f.key, label: f.label }));

    return {
      totalSubmissions,
      distinctCountries,
      completionRate,
      latestDate,
      charts,
      tableColumns,
    };
  }, [rawSubs]);

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-950">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: HEADER_BG }}>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-white/80" />
          <span className="text-sm font-bold tracking-wide text-white">{campaignName}</span>
        </div>
        <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
          {analysis?.totalSubmissions ?? 0} soumissions
        </span>
      </div>

      {/* 4 KPI ROW */}
      <div className="grid grid-cols-4 divide-x divide-gray-200 border-b border-gray-300 bg-white dark:divide-gray-700 dark:bg-gray-900">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)
        ) : (
          [
            { icon: Hash, val: analysis?.totalSubmissions ?? 0, label: 'Total soumissions', color: '#1F4E79', bg: '#EFF6FF' },
            { icon: Globe2, val: analysis?.distinctCountries ?? 0, label: 'Pays couverts', color: '#059669', bg: '#ECFDF5' },
            { icon: BarChart3, val: `${analysis?.completionRate ?? 0}%`, label: 'Taux de compl\u00e9tion', color: '#7C3AED', bg: '#F5F3FF' },
            {
              icon: Calendar,
              val: analysis?.latestDate
                ? new Date(analysis.latestDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                : '\u2014',
              label: 'Derni\u00e8re soumission',
              color: '#EA580C',
              bg: '#FFF7ED',
            },
          ].map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: k.bg }}>
                  <Icon className="h-5 w-5" style={{ color: k.color }} />
                </div>
                <div>
                  <p className="text-2xl font-black" style={{ color: k.color }}>{k.val}</p>
                  <p className="text-[10px] leading-tight text-gray-500">{k.label}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MAIN CONTENT */}
      {loading ? (
        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="min-h-[300px] rounded-xl" />)}
        </div>
      ) : !analysis || analysis.totalSubmissions === 0 ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-400 dark:text-gray-500 text-sm italic">Aucune soumission disponible pour cette campagne.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* AUTO-GENERATED CHARTS */}
          {analysis.charts.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {analysis.charts.map((chart, ci) => (
                <div
                  key={chart.key}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="flex items-center gap-2 mb-4">
                    {chart.type === 'pie' ? (
                      <BarChart3 className="h-4 w-4" style={{ color: CHART_COLORS[ci % CHART_COLORS.length] }} />
                    ) : (
                      <Hash className="h-4 w-4" style={{ color: CHART_COLORS[ci % CHART_COLORS.length] }} />
                    )}
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">{chart.label}</h3>
                  </div>
                  {chart.type === 'pie' ? (
                    <PieChart entries={chart.entries} colors={CHART_COLORS} size={140} />
                  ) : (
                    <HBarChart entries={chart.entries} color={CHART_COLORS[ci % CHART_COLORS.length]} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* DATA TABLE */}
          {analysis.tableColumns.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <Database className="h-4 w-4" style={{ color: HEADER_BG }} />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  Donn\u00e9es de soumission ({analysis.totalSubmissions})
                </h3>
              </div>
              <div className="overflow-auto max-h-[420px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                    <tr className="text-[11px] uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-2 text-left font-semibold">#</th>
                      {analysis.tableColumns.map((col) => (
                        <th key={col.key} className="px-4 py-2 text-left font-semibold whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rawSubs.slice(0, 100).map((sub, si) => {
                      const d = sub.data || sub;
                      return (
                        <tr key={si} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-2 text-gray-400 text-xs">{si + 1}</td>
                          {analysis.tableColumns.map((col) => (
                            <td key={col.key} className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap max-w-[200px] truncate">
                              {d[col.key] != null && d[col.key] !== '' ? String(d[col.key]) : '\u2014'}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    {rawSubs.length === 0 && (
                      <tr>
                        <td colSpan={analysis.tableColumns.length + 1} className="px-4 py-6 text-center text-gray-400 italic">
                          Aucune donn\u00e9e
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {rawSubs.length > 100 && (
                  <div className="px-4 py-2 text-xs text-gray-400 text-center border-t border-gray-100 dark:border-gray-800">
                    Affichage limit\u00e9 aux 100 premi\u00e8res lignes sur {rawSubs.length}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FOOTER */}
      <div className="px-4 py-1.5 text-[9px] leading-snug text-white/90" style={{ backgroundColor: HEADER_BG }}>
        <strong>Source :</strong> {campaignName} — AU-IBAR ARIS 4.0. Donn\u00e9es issues de {analysis?.totalSubmissions ?? 0} soumissions.
      </div>
    </div>
  );
}
