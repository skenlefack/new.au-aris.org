'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileDown,
  FileSpreadsheet,
  FileText,
  Check,
  Loader2,
  Download,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExportBuilder, useExportableMetrics } from '@/lib/api/hooks';
import { KpiCardSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';

const FORMAT_OPTIONS: { value: 'csv' | 'xlsx' | 'pdf'; label: string; icon: React.ReactNode; descKey: string }[] = [
  { value: 'csv', label: 'CSV', icon: <FileText className="h-4 w-4" />, descKey: 'formatCsvDesc' },
  { value: 'xlsx', label: 'XLSX', icon: <FileSpreadsheet className="h-4 w-4" />, descKey: 'formatXlsxDesc' },
  { value: 'pdf', label: 'PDF', icon: <FileDown className="h-4 w-4" />, descKey: 'formatPdfDesc' },
];

const COUNTRY_OPTIONS = [
  { code: 'KE', name: 'Kenya' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'GH', name: 'Ghana' },
  { code: 'UG', name: 'Uganda' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SN', name: 'Senegal' },
  { code: 'CD', name: 'DR Congo' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CI', name: "Cote d'Ivoire" },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MA', name: 'Morocco' },
  { code: 'ML', name: 'Mali' },
  { code: 'NE', name: 'Niger' },
  { code: 'TD', name: 'Chad' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SO', name: 'Somalia' },
];

export default function ExportBuilderPage() {
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set());
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [format, setFormat] = useState<'csv' | 'pdf' | 'xlsx'>('csv');
  const t = useTranslations('analytics');

  const { data: metricsData, isLoading: metricsLoading } = useExportableMetrics();
  const exportMutation = useExportBuilder();

  const metrics = metricsData?.data ?? [];

  // Group metrics by domain
  const metricsByDomain = useMemo(() => {
    const grouped = new Map<string, typeof metrics>();
    metrics.forEach((m) => {
      const existing = grouped.get(m.domain) ?? [];
      existing.push(m);
      grouped.set(m.domain, existing);
    });
    return grouped;
  }, [metrics]);

  const toggleMetric = (id: string) => {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllMetrics = () => {
    if (selectedMetrics.size === metrics.length) {
      setSelectedMetrics(new Set());
    } else {
      setSelectedMetrics(new Set(metrics.map((m) => m.id)));
    }
  };

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

  const toggleAllCountries = () => {
    if (selectedCountries.size === COUNTRY_OPTIONS.length) {
      setSelectedCountries(new Set());
    } else {
      setSelectedCountries(new Set(COUNTRY_OPTIONS.map((c) => c.code)));
    }
  };

  const canExport =
    selectedMetrics.size > 0 &&
    selectedCountries.size > 0 &&
    periodStart !== '' &&
    periodEnd !== '';

  const handleExport = () => {
    if (!canExport) return;
    exportMutation.mutate({
      metrics: Array.from(selectedMetrics),
      countries: Array.from(selectedCountries),
      periodStart,
      periodEnd,
      format,
    });
  };

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
          <h1 className="text-2xl font-bold text-gray-900">{t('exportBuilder')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('exportBuilderDesc')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Metrics & Countries */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metrics Selection */}
          <div className="rounded-card border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                {t('selectMetrics', { count: selectedMetrics.size, total: metrics.length })}
              </h2>
              <button
                onClick={toggleAllMetrics}
                className="text-xs font-medium text-[#1B5E20] hover:underline"
              >
                {selectedMetrics.size === metrics.length ? t('deselectAll') : t('selectAll')}
              </button>
            </div>

            {metricsLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <KpiCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from(metricsByDomain.entries()).map(([domainName, domainMetrics]) => (
                  <div key={domainName}>
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                      {domainName}
                    </h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {domainMetrics.map((metric) => (
                        <label
                          key={metric.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                            selectedMetrics.has(metric.id)
                              ? 'border-[#1B5E20] bg-[#1B5E20]/5'
                              : 'border-gray-200 hover:border-gray-300',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMetrics.has(metric.id)}
                            onChange={() => toggleMetric(metric.id)}
                            className="h-4 w-4 rounded border-gray-300"
                            style={{ accentColor: '#1B5E20' }}
                          />
                          <span className="text-sm text-gray-700">{metric.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Country Selection */}
          <div className="rounded-card border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                {t('selectCountries', { count: selectedCountries.size, total: COUNTRY_OPTIONS.length })}
              </h2>
              <button
                onClick={toggleAllCountries}
                className="text-xs font-medium text-[#1B5E20] hover:underline"
              >
                {selectedCountries.size === COUNTRY_OPTIONS.length ? t('deselectAll') : t('selectAll')}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {COUNTRY_OPTIONS.map((country) => (
                <button
                  key={country.code}
                  onClick={() => toggleCountry(country.code)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    selectedCountries.has(country.code)
                      ? 'border-[#1B5E20] bg-[#1B5E20] text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                  )}
                >
                  {selectedCountries.has(country.code) && (
                    <Check className="h-3 w-3" />
                  )}
                  {country.code} - {country.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Config + Generate */}
        <div className="space-y-6">
          {/* Date Range */}
          <div className="rounded-card border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">
              {t('dateRange')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  {t('periodStart')}
                </label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#1B5E20] focus:outline-none focus:ring-1 focus:ring-[#1B5E20]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  {t('periodEnd')}
                </label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#1B5E20] focus:outline-none focus:ring-1 focus:ring-[#1B5E20]"
                />
              </div>
            </div>
          </div>

          {/* Format Selector */}
          <div className="rounded-card border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">
              {t('outputFormat')}
            </h2>
            <div className="space-y-2">
              {FORMAT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                    format === opt.value
                      ? 'border-[#1B5E20] bg-[#1B5E20]/5'
                      : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  <input
                    type="radio"
                    name="format"
                    value={opt.value}
                    checked={format === opt.value}
                    onChange={() => setFormat(opt.value)}
                    className="h-4 w-4 border-gray-300"
                    style={{ accentColor: '#1B5E20' }}
                  />
                  <span className="text-gray-400">{opt.icon}</span>
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      {opt.label}
                    </span>
                    <p className="text-xs text-gray-400">{t(opt.descKey)}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Summary + Generate */}
          <div className="rounded-card border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">
              {t('exportSummary')}
            </h2>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex justify-between">
                <span>{t('metrics')}</span>
                <span className="font-medium text-gray-900">
                  {selectedMetrics.size}
                </span>
              </li>
              <li className="flex justify-between">
                <span>{t('countries')}</span>
                <span className="font-medium text-gray-900">
                  {selectedCountries.size}
                </span>
              </li>
              <li className="flex justify-between">
                <span>{t('period')}</span>
                <span className="font-medium text-gray-900">
                  {periodStart && periodEnd
                    ? `${periodStart} to ${periodEnd}`
                    : 'Not set'}
                </span>
              </li>
              <li className="flex justify-between">
                <span>{t('format')}</span>
                <span className="font-medium text-gray-900 uppercase">
                  {format}
                </span>
              </li>
            </ul>

            <button
              onClick={handleExport}
              disabled={!canExport || exportMutation.isPending}
              className={cn(
                'mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                canExport && !exportMutation.isPending
                  ? 'bg-[#1B5E20] text-white hover:bg-[#1B5E20]/90'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed',
              )}
            >
              {exportMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  {t('generateExport')}
                </>
              )}
            </button>

            {!canExport && !exportMutation.isPending && (
              <p className="mt-2 text-xs text-gray-400 text-center">
                {t('exportValidation')}
              </p>
            )}
          </div>

          {/* Export Result */}
          {exportMutation.isSuccess && exportMutation.data?.data && (
            <div className="rounded-card border border-green-200 bg-green-50 p-5">
              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-green-800">
                    {t('exportReady')}
                  </p>
                  <p className="mt-1 text-xs text-green-700">
                    {exportMutation.data.data.fileName}
                  </p>
                  <a
                    href={exportMutation.data.data.downloadUrl}
                    download
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t('downloadFile')}
                  </a>
                </div>
              </div>
            </div>
          )}

          {exportMutation.isError && (
            <div className="rounded-card border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    {t('exportFailed')}
                  </p>
                  <p className="mt-1 text-xs text-red-700">
                    {t('exportErrorMsg')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
