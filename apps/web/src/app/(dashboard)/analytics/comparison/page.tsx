'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useCountryComparison } from '@/lib/api/hooks';
import { KpiCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

interface MetricOption {
  value: string;
  label: string;
  format: (v: number) => string;
}

const METRIC_OPTIONS: MetricOption[] = [
  { value: 'outbreaks', label: 'Outbreaks', format: (v) => v.toLocaleString() },
  { value: 'vaccinationCoverage', label: 'Vaccination Coverage (%)', format: (v) => `${v.toFixed(1)}%` },
  { value: 'labCapacity', label: 'Lab Capacity', format: (v) => v.toLocaleString() },
  { value: 'qualityScore', label: 'Quality Score (%)', format: (v) => `${v.toFixed(1)}%` },
  { value: 'tradeVolume', label: 'Trade Volume', format: (v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toLocaleString() },
  { value: 'dataCompleteness', label: 'Data Completeness (%)', format: (v) => `${v.toFixed(1)}%` },
];

const RADAR_METRICS = [
  { key: 'vaccinationCoverage', label: 'Vaccination' },
  { key: 'labCapacity', label: 'Lab Capacity' },
  { key: 'qualityScore', label: 'Quality' },
  { key: 'dataCompleteness', label: 'Completeness' },
];

const RADAR_COLORS = ['#1B5E20', '#006064', '#E65100', '#C62828', '#4A148C', '#1565C0', '#AD1457', '#F57F17'];

export default function CountryComparisonPage() {
  const [selectedMetric, setSelectedMetric] = useState('outbreaks');
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(
    new Set(['KE', 'ET', 'NG', 'TZ', 'ZA']),
  );

  const { data, isLoading } = useCountryComparison({
    countries: Array.from(selectedCountries),
    metric: selectedMetric,
  });

  const rows = data?.data ?? [];

  const currentMetric = METRIC_OPTIONS.find((m) => m.value === selectedMetric) ?? METRIC_OPTIONS[0];

  const toggleCountry = (code: string) => {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  // Bar chart data filtered by selected countries
  const barData = useMemo(() => {
    return rows
      .filter((r) => selectedCountries.has(r.countryCode))
      .sort((a, b) => {
        const aVal = a[selectedMetric as keyof typeof a] as number;
        const bVal = b[selectedMetric as keyof typeof b] as number;
        return bVal - aVal;
      });
  }, [rows, selectedCountries, selectedMetric]);

  // Radar chart data
  const radarData = useMemo(() => {
    const filteredRows = rows.filter((r) => selectedCountries.has(r.countryCode));
    return RADAR_METRICS.map((metric) => {
      const point: Record<string, string | number> = { metric: metric.label };
      filteredRows.forEach((row) => {
        point[row.country] = row[metric.key as keyof typeof row] as number;
      });
      return point;
    });
  }, [rows, selectedCountries]);

  const radarCountries = useMemo(() => {
    return rows.filter((r) => selectedCountries.has(r.countryCode));
  }, [rows, selectedCountries]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/analytics"
          className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Country Comparison</h1>
          <p className="mt-1 text-sm text-gray-500">
            Compare metrics across AU Member States
          </p>
        </div>
      </div>

      {/* Metric selector + Country toggles */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Metric selector */}
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
            Metric
          </label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#1B5E20] focus:outline-none focus:ring-1 focus:ring-[#1B5E20]"
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Country toggles */}
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
            Countries
          </label>
          <div className="flex flex-wrap gap-2">
            {rows.map((row) => (
              <button
                key={row.countryCode}
                onClick={() => toggleCountry(row.countryCode)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                  selectedCountries.has(row.countryCode)
                    ? 'border-[#1B5E20] bg-[#1B5E20] text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                )}
              >
                {row.countryCode} - {row.country}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Bar Chart */}
          <div className="rounded-card border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              {currentMetric.label} by Country
            </h3>
            {barData.length === 0 ? (
              <div className="flex h-[350px] items-center justify-center">
                <p className="text-sm text-gray-400">Select at least one country</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={barData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="country"
                    width={100}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <Tooltip
                    formatter={(value: number) => [currentMetric.format(value), currentMetric.label]}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '13px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar
                    dataKey={selectedMetric}
                    fill="#1B5E20"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Radar Chart */}
          <div className="rounded-card border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Multi-Metric Radar
            </h3>
            {radarCountries.length === 0 ? (
              <div className="flex h-[350px] items-center justify-center">
                <p className="text-sm text-gray-400">Select at least one country</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                  />
                  {radarCountries.map((row, idx) => (
                    <Radar
                      key={row.countryCode}
                      name={row.country}
                      dataKey={row.country}
                      stroke={RADAR_COLORS[idx % RADAR_COLORS.length]}
                      fill={RADAR_COLORS[idx % RADAR_COLORS.length]}
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Data Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : (
        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              All Countries ({rows.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3 text-right">Outbreaks</th>
                  <th className="px-4 py-3 text-right">Vaccination (%)</th>
                  <th className="px-4 py-3 text-right">Lab Capacity</th>
                  <th className="px-4 py-3 text-right">Quality Score</th>
                  <th className="px-4 py-3 text-right">Trade Volume</th>
                  <th className="px-4 py-3 text-right">Completeness (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr
                    key={row.countryCode}
                    className={cn(
                      'hover:bg-gray-50 transition-colors',
                      selectedCountries.has(row.countryCode) && 'bg-[#1B5E20]/5',
                    )}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleCountry(row.countryCode)}
                        className="flex items-center gap-2 text-left"
                      >
                        <span
                          className={cn(
                            'inline-flex h-5 w-7 items-center justify-center rounded text-xs font-bold',
                            selectedCountries.has(row.countryCode)
                              ? 'bg-[#1B5E20] text-white'
                              : 'bg-gray-100 text-gray-500',
                          )}
                        >
                          {row.countryCode}
                        </span>
                        <span className="font-medium text-gray-900">
                          {row.country}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {row.outbreaks}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ScoreBadge value={row.vaccinationCoverage} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {row.labCapacity}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ScoreBadge value={row.qualityScore} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {row.tradeVolume.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ScoreBadge value={row.dataCompleteness} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      No comparison data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ value }: { value: number }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        value >= 95
          ? 'bg-green-100 text-green-700'
          : value >= 90
            ? 'bg-amber-100 text-amber-700'
            : 'bg-red-100 text-red-700',
      )}
    >
      {value.toFixed(1)}%
    </span>
  );
}
