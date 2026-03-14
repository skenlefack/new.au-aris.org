'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useAnalyticsTrends, type TimeRange } from '@/lib/api/hooks';
import { KpiCardSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';

const TIME_RANGES: { value: TimeRange; tKey: string }[] = [
  { value: '7d', tKey: 'timeRange7d' },
  { value: '30d', tKey: 'timeRange30d' },
  { value: '90d', tKey: 'timeRange90d' },
  { value: '1y', tKey: 'timeRange1y' },
];

const DOMAIN_OPTIONS = [
  { value: '', label: 'All Domains' },
  { value: 'animal-health', label: 'Animal Health' },
  { value: 'livestock', label: 'Livestock' },
  { value: 'fisheries', label: 'Fisheries' },
  { value: 'trade', label: 'Trade & SPS' },
  { value: 'wildlife', label: 'Wildlife' },
];

const COUNTRY_OPTIONS = [
  { value: '', label: 'All Countries' },
  { value: 'KE', label: 'Kenya' },
  { value: 'ET', label: 'Ethiopia' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'TZ', label: 'Tanzania' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'GH', label: 'Ghana' },
  { value: 'UG', label: 'Uganda' },
  { value: 'EG', label: 'Egypt' },
  { value: 'SN', label: 'Senegal' },
  { value: 'CD', label: 'DR Congo' },
];

interface LineConfig {
  key: string;
  tKey: string;
  color: string;
  defaultVisible: boolean;
}

const LINE_CONFIGS: LineConfig[] = [
  { key: 'outbreaks', tKey: 'outbreaks', color: '#C62828', defaultVisible: true },
  { key: 'vaccinations', tKey: 'vaccinations', color: '#1B5E20', defaultVisible: true },
  { key: 'labResults', tKey: 'labResults', color: '#006064', defaultVisible: true },
  { key: 'tradeFlows', tKey: 'tradeFlows', color: '#E65100', defaultVisible: true },
];

export default function TrendsAnalysisPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [domain, setDomain] = useState('');
  const [country, setCountry] = useState('');
  const [visibleLines, setVisibleLines] = useState<Set<string>>(
    new Set(LINE_CONFIGS.map((l) => l.key)),
  );
  const t = useTranslations('analytics');

  const { data, isLoading } = useAnalyticsTrends({
    range: timeRange,
    domain: domain || undefined,
    country: country || undefined,
  });

  const chartData = data?.data ?? [];

  const toggleLine = (key: string) => {
    setVisibleLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Prevent hiding all lines
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Compute summary statistics from the trend data
  const summaryStats = useMemo(() => {
    if (!chartData.length) return null;

    const totals = chartData.reduce(
      (acc, point) => ({
        outbreaks: acc.outbreaks + point.outbreaks,
        vaccinations: acc.vaccinations + point.vaccinations,
        labResults: acc.labResults + point.labResults,
        tradeFlows: acc.tradeFlows + point.tradeFlows,
      }),
      { outbreaks: 0, vaccinations: 0, labResults: 0, tradeFlows: 0 },
    );

    return {
      outbreaks: totals.outbreaks,
      vaccinations: totals.vaccinations,
      labResults: totals.labResults,
      tradeFlows: totals.tradeFlows,
      dataPoints: chartData.length,
    };
  }, [chartData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/analytics"
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('trendsAnalysis')}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {t('trendsContinentDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        {/* Time range */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.value}
              onClick={() => setTimeRange(tr.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                timeRange === tr.value
                  ? 'bg-[#1B5E20] text-white'
                  : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              {t(tr.tKey)}
            </button>
          ))}
        </div>

        {/* Domain filter */}
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#1B5E20] focus:outline-none focus:ring-1 focus:ring-[#1B5E20]"
        >
          {DOMAIN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Country filter */}
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#1B5E20] focus:outline-none focus:ring-1 focus:ring-[#1B5E20]"
        >
          {COUNTRY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Summary KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : summaryStats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label={t('totalOutbreaks')}
            value={summaryStats.outbreaks.toLocaleString()}
            color="#C62828"
            subLabel={t('acrossDataPoints', { points: summaryStats.dataPoints })}
          />
          <SummaryCard
            label={t('totalVaccinations')}
            value={summaryStats.vaccinations.toLocaleString()}
            color="#1B5E20"
            subLabel={t('acrossDataPoints', { points: summaryStats.dataPoints })}
          />
          <SummaryCard
            label={t('totalLabResults')}
            value={summaryStats.labResults.toLocaleString()}
            color="#006064"
            subLabel={t('acrossDataPoints', { points: summaryStats.dataPoints })}
          />
          <SummaryCard
            label={t('totalTradeFlows')}
            value={summaryStats.tradeFlows.toLocaleString()}
            color="#E65100"
            subLabel={t('acrossDataPoints', { points: summaryStats.dataPoints })}
          />
        </div>
      ) : null}

      {/* Line visibility toggles */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
          {t('show')}
        </span>
        {LINE_CONFIGS.map((line) => (
          <label
            key={line.key}
            className="flex cursor-pointer items-center gap-2"
          >
            <input
              type="checkbox"
              checked={visibleLines.has(line.key)}
              onChange={() => toggleLine(line.key)}
              className="h-3.5 w-3.5 rounded border-gray-300"
              style={{ accentColor: line.color }}
            />
            <span className="flex items-center gap-1.5 text-sm text-gray-700">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: line.color }}
              />
              {t(line.tKey)}
            </span>
          </label>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-card border border-gray-200 bg-white p-5">
        {isLoading ? (
          <div className="flex h-[400px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#1B5E20]" />
              <p className="mt-2 text-sm text-gray-400">{t('loadingChartData')}</p>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[400px] items-center justify-center">
            <p className="text-sm text-gray-400">{t('noTrendData')}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '13px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '13px', paddingTop: '16px' }}
              />
              {LINE_CONFIGS.map(
                (line) =>
                  visibleLines.has(line.key) && (
                    <Line
                      key={line.key}
                      type="monotone"
                      dataKey={line.key}
                      name={t(line.tKey)}
                      stroke={line.color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: line.color }}
                      activeDot={{ r: 5, fill: line.color }}
                    />
                  ),
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Raw data table */}
      {chartData.length > 0 && (
        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {t('dataPoints', { count: chartData.length })}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">{t('outbreaks')}</th>
                  <th className="px-4 py-3 text-right">{t('vaccinations')}</th>
                  <th className="px-4 py-3 text-right">{t('labResults')}</th>
                  <th className="px-4 py-3 text-right">{t('tradeFlows')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {chartData.map((row) => (
                  <tr key={row.date} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {row.date}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {row.outbreaks.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {row.vaccinations.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {row.labResults.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {row.tradeFlows.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  subLabel,
}: {
  label: string;
  value: string;
  color: string;
  subLabel: string;
}) {
  return (
    <div className="rounded-card border border-gray-200 bg-white p-card shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-kpi-label uppercase tracking-wider text-gray-500">
          {label}
        </span>
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <div className="mt-2 text-kpi text-gray-900">{value}</div>
      <div className="mt-3 text-sm text-gray-500">
        {subLabel}
      </div>
    </div>
  );
}
