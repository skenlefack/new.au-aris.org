'use client';

/**
 * CampaignDataDashboard — Intelligent campaign data visualization.
 *
 * Analyses the form template schema and submission data to auto-generate:
 *  - Statistics cards for numeric fields
 *  - A map placeholder with GPS markers count
 *  - Time-series curve from submission dates
 *  - Field value distributions (top values for select/text fields)
 *
 * Displays a campaign selector so users can switch between campaigns.
 */

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  MapPin,
  TrendingUp,
  ChevronDown,
  Activity,
  Hash,
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useCollectionCampaigns, useCampaignSubmissions } from '@/lib/api/workflow-hooks';
import { Skeleton } from '@/components/ui/Skeleton';

interface CampaignDataDashboardProps {
  domain: string;
  showMap?: boolean;
  showStats?: boolean;
  showCurve?: boolean;
}

interface FieldAnalysis {
  code: string;
  label: string;
  type: string;
  values: any[];
  numericStats?: { sum: number; avg: number; min: number; max: number; count: number };
  topValues?: { value: string; count: number }[];
}

function analyseName(name: any): string {
  if (!name) return '—';
  if (typeof name === 'string') return name;
  return name.en ?? name.fr ?? Object.values(name)[0] ?? '—';
}

export function CampaignDataDashboard({ domain, showMap, showStats, showCurve }: CampaignDataDashboardProps) {
  const t = useTranslations('domain');
  const campaignsQuery = useCollectionCampaigns({ domain, limit: 50 });
  const campaigns: any[] = Array.isArray(campaignsQuery.data?.data) ? campaignsQuery.data.data : [];

  // Default to latest campaign (by creation date)
  const sorted = useMemo(() => [...campaigns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [campaigns]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const activeCampaignId = selectedId ?? sorted[0]?.id;
  const activeCampaign = sorted.find((c) => c.id === activeCampaignId);

  // Fetch submissions for the selected campaign
  const subsQuery = useCampaignSubmissions(activeCampaignId, { limit: 100 });
  const submissions: any[] = Array.isArray(subsQuery.data?.data) ? subsQuery.data.data : [];

  // Analyse form template schema to understand field types
  const formSchema = activeCampaign?.formTemplate?.schema as any;
  const fields: { code: string; label: string; type: string }[] = useMemo(() => {
    if (!formSchema?.sections) return [];
    const result: { code: string; label: string; type: string }[] = [];
    for (const section of formSchema.sections) {
      for (const field of section.fields ?? []) {
        result.push({
          code: field.code ?? field.id ?? '',
          label: analyseName(field.label) || field.code || '',
          type: field.type ?? 'text',
        });
      }
    }
    return result;
  }, [formSchema]);

  // Analyse submission data
  const analysis = useMemo<FieldAnalysis[]>(() => {
    if (fields.length === 0 || submissions.length === 0) return [];

    return fields.map((field) => {
      const values = submissions
        .map((s) => s.data?.[field.code])
        .filter((v) => v !== undefined && v !== null && v !== '');

      const result: FieldAnalysis = { code: field.code, label: field.label, type: field.type, values };

      // Numeric analysis
      const nums = values.map(Number).filter((n) => !isNaN(n));
      if (nums.length > 0 && (field.type === 'number' || nums.length > values.length * 0.7)) {
        result.numericStats = {
          sum: nums.reduce((a, b) => a + b, 0),
          avg: Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10,
          min: Math.min(...nums),
          max: Math.max(...nums),
          count: nums.length,
        };
      }

      // Categorical analysis (top values)
      if (field.type === 'select' || field.type === 'radio' || field.type === 'text' || field.type === 'multi-select') {
        const freq: Record<string, number> = {};
        for (const v of values) {
          const key = String(v);
          freq[key] = (freq[key] ?? 0) + 1;
        }
        result.topValues = Object.entries(freq)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 6)
          .map(([value, count]) => ({ value, count }));
      }

      return result;
    }).filter((a) => a.values.length > 0);
  }, [fields, submissions]);

  // Time series: submissions per day
  const timeSeries = useMemo(() => {
    if (submissions.length === 0) return [];
    const byDay: Record<string, number> = {};
    for (const s of submissions) {
      const day = (s.submittedAt ?? s.createdAt ?? '').slice(0, 10);
      if (day) byDay[day] = (byDay[day] ?? 0) + 1;
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [submissions]);

  // GPS markers
  const gpsPoints = useMemo(() => {
    return submissions
      .filter((s) => (s.gpsLat && s.gpsLng) || s.geoLocation)
      .map((s) => ({
        lat: s.gpsLat ?? s.geoLocation?.lat,
        lng: s.gpsLng ?? s.geoLocation?.lng,
      }));
  }, [submissions]);

  // Numeric fields for stat cards
  const numericFields = analysis.filter((a) => a.numericStats);
  // Categorical fields for distributions
  const categoricalFields = analysis.filter((a) => a.topValues && a.topValues.length > 1);

  // Status breakdown
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of submissions) {
      const st = s.status ?? 'UNKNOWN';
      counts[st] = (counts[st] ?? 0) + 1;
    }
    return counts;
  }, [submissions]);

  if (campaignsQuery.isLoading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  if (campaigns.length === 0) {
    return null;
  }

  const isLoading = subsQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* ── Campaign Selector ───────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{t('campaignDataSource')}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {activeCampaign ? analyseName(activeCampaign.name) : t('noCampaignSelected')}
            </p>
          </div>
        </div>
        <div className="relative">
          <select
            value={activeCampaignId ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="appearance-none rounded-lg border border-gray-200 bg-gray-50 py-2 pl-3 pr-8 text-sm font-medium text-gray-700 focus:border-red-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            {sorted.map((c) => (
              <option key={c.id} value={c.id}>
                {analyseName(c.name)} ({c.totalSubmissions ?? 0} {t('submissions')})
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center dark:border-gray-700 dark:bg-gray-900/30">
          <FileText className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">{t('noSubmissionsYet')}</p>
          <p className="mt-1 text-xs text-gray-300">{t('noSubmissionsHint')}</p>
        </div>
      ) : (
        <>
          {/* ── Statistics ───────────────────────────────── */}
          {showStats && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('statistics')}</h3>
                <span className="ml-auto text-xs text-gray-400">{submissions.length} {t('submissions')}</span>
              </div>

              {/* Status breakdown */}
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat icon={<FileText className="h-4 w-4" />} label={t('total')} value={submissions.length} color="#6366f1" />
                <MiniStat icon={<CheckCircle2 className="h-4 w-4" />} label={t('validated')} value={statusBreakdown['VALIDATED'] ?? 0} color="#16a34a" />
                <MiniStat icon={<Clock className="h-4 w-4" />} label={t('pending')} value={(statusBreakdown['SUBMITTED'] ?? 0) + (statusBreakdown['VALIDATING'] ?? 0)} color="#ca8a04" />
                <MiniStat icon={<XCircle className="h-4 w-4" />} label={t('rejected')} value={statusBreakdown['REJECTED'] ?? 0} color="#dc2626" />
              </div>

              {/* Numeric field aggregations */}
              {numericFields.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {numericFields.slice(0, 6).map((f) => (
                    <div key={f.code} className="rounded-lg border border-gray-100 p-3 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-500 truncate">{f.label}</p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-xl font-bold text-gray-900 dark:text-white">{f.numericStats!.sum.toLocaleString()}</span>
                        <span className="text-[10px] text-gray-400">total</span>
                      </div>
                      <div className="mt-1 flex gap-3 text-[10px] text-gray-400">
                        <span>avg: {f.numericStats!.avg}</span>
                        <span>min: {f.numericStats!.min}</span>
                        <span>max: {f.numericStats!.max}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Categorical distributions */}
              {categoricalFields.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {categoricalFields.slice(0, 4).map((f) => {
                    const maxCount = Math.max(...(f.topValues?.map((v) => v.count) ?? [1]));
                    return (
                      <div key={f.code} className="rounded-lg border border-gray-100 p-3 dark:border-gray-700">
                        <p className="mb-2 text-xs font-medium text-gray-500">{f.label}</p>
                        <div className="space-y-1.5">
                          {f.topValues!.map((tv) => (
                            <div key={tv.value} className="flex items-center gap-2">
                              <div className="h-2 flex-1 rounded-full bg-gray-100 dark:bg-gray-700">
                                <div
                                  className="h-full rounded-full bg-red-400 transition-all"
                                  style={{ width: `${(tv.count / maxCount) * 100}%` }}
                                />
                              </div>
                              <span className="w-20 truncate text-[10px] text-gray-600 dark:text-gray-400">{tv.value}</span>
                              <span className="text-[10px] font-medium text-gray-500">{tv.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Map ─────────────────────────────────────── */}
          {showMap && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('map')}</h3>
                <span className="ml-auto text-xs text-gray-400">{gpsPoints.length} {t('gpsPoints')}</span>
              </div>

              {gpsPoints.length > 0 ? (
                <div className="relative h-64 overflow-hidden rounded-lg bg-gradient-to-br from-blue-50 to-emerald-50 dark:from-blue-950 dark:to-emerald-950">
                  {/* Simple dot map visualization */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative h-48 w-full max-w-md">
                      {gpsPoints.slice(0, 50).map((p, i) => {
                        // Normalize to viewport
                        const x = ((p.lng + 20) / 75) * 100;
                        const y = ((35 - p.lat) / 70) * 100;
                        return (
                          <div
                            key={i}
                            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 opacity-70 ring-2 ring-red-200"
                            style={{ left: `${Math.max(5, Math.min(95, x))}%`, top: `${Math.max(5, Math.min(95, y))}%` }}
                            title={`${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 rounded bg-white/80 px-2 py-1 text-[10px] text-gray-500 backdrop-blur-sm">
                    {gpsPoints.length} {t('dataPoints')}
                  </div>
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30">
                  <div className="text-center">
                    <MapPin className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-400">{t('noGpsData')}</p>
                    <p className="text-[10px] text-gray-300">{t('noGpsDataHint')}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Curve ───────────────────────────────────── */}
          {showCurve && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('submissionTrend')}</h3>
              </div>

              {timeSeries.length > 1 ? (
                <div className="h-48">
                  {/* Simple bar chart */}
                  <div className="flex h-full items-end gap-1">
                    {timeSeries.map((point, i) => {
                      const maxVal = Math.max(...timeSeries.map((p) => p.count));
                      const height = maxVal > 0 ? (point.count / maxVal) * 100 : 0;
                      return (
                        <div key={point.date} className="group relative flex flex-1 flex-col items-center justify-end">
                          <div
                            className="w-full min-w-[4px] rounded-t bg-gradient-to-t from-amber-500 to-amber-400 transition-all hover:from-amber-600 hover:to-amber-500"
                            style={{ height: `${Math.max(4, height)}%` }}
                          />
                          {/* Tooltip */}
                          <div className="pointer-events-none absolute -top-10 hidden rounded bg-gray-900 px-2 py-1 text-[10px] text-white group-hover:block">
                            {point.date}: {point.count}
                          </div>
                          {/* X label (show every few) */}
                          {(i === 0 || i === timeSeries.length - 1 || i % Math.ceil(timeSeries.length / 5) === 0) && (
                            <p className="mt-1 text-[8px] text-gray-400 whitespace-nowrap">{point.date.slice(5)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : timeSeries.length === 1 ? (
                <div className="flex h-48 items-center justify-center text-center">
                  <div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{timeSeries[0].count}</p>
                    <p className="text-sm text-gray-400">{t('submissionsOn')} {timeSeries[0].date}</p>
                  </div>
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30">
                  <div className="text-center">
                    <TrendingUp className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-400">{t('noTimeData')}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 dark:border-gray-700">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15`, color }}>
        {icon}
      </span>
      <div>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-[10px] text-gray-400">{label}</p>
      </div>
    </div>
  );
}
