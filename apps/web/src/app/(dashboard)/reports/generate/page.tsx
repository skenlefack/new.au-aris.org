'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  Download,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileBarChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReportTemplates, useGenerateReport } from '@/lib/api/hooks';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';

const TYPE_BADGE_COLORS: Record<string, string> = {
  wahis_6monthly: 'bg-blue-100 text-blue-700',
  wahis_annual: 'bg-indigo-100 text-indigo-700',
  continental_brief: 'bg-green-100 text-green-700',
  custom: 'bg-purple-100 text-purple-700',
};

const TYPE_LABELS: Record<string, string> = {
  wahis_6monthly: 'wahis6monthly',
  wahis_annual: 'wahisAnnual',
  continental_brief: 'continentalBrief',
  custom: 'custom',
};

const OUTPUT_FORMATS = [
  { value: 'pdf', tKey: 'formatPdf' },
  { value: 'xlsx', tKey: 'formatExcel' },
  { value: 'docx', tKey: 'formatWord' },
] as const;

export default function GenerateReportPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <GenerateReportContent />
    </Suspense>
  );
}

function GenerateReportContent() {
  const t = useTranslations('reports');
  const searchParams = useSearchParams();
  const templateParam = searchParams.get('template');

  const { data: templatesData, isLoading: templatesLoading } = useReportTemplates();
  const generateReport = useGenerateReport();

  const templates = templatesData?.data ?? [];

  // Form state
  const [templateId, setTemplateId] = useState(templateParam ?? '');
  const [country, setCountry] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [format, setFormat] = useState<'pdf' | 'xlsx' | 'docx'>('pdf');

  // Set template from URL param once templates load
  useEffect(() => {
    if (templateParam && templates.length > 0) {
      const found = templates.find((t) => t.id === templateParam);
      if (found) {
        setTemplateId(found.id);
        setFormat(found.outputFormat);
      }
    }
  }, [templateParam, templates]);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  function handleGenerate() {
    if (!templateId || !periodStart || !periodEnd) return;

    generateReport.mutate({
      templateId,
      country: country || undefined,
      periodStart,
      periodEnd,
      format,
    });
  }

  const canSubmit =
    !!templateId &&
    !!periodStart &&
    !!periodEnd &&
    !generateReport.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('backToReports')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {t('generateReportBtn')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('generateDesc')}
        </p>
      </div>

      {/* Selected template info */}
      {selectedTemplate && (
        <div className="rounded-card border border-aris-primary-200 bg-aris-primary-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aris-primary-100">
              <FileText className="h-5 w-5 text-aris-primary-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  {selectedTemplate.name}
                </h3>
                <span
                  className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                    TYPE_BADGE_COLORS[selectedTemplate.type] ?? 'bg-gray-100 text-gray-600',
                  )}
                >
                  {TYPE_LABELS[selectedTemplate.type] ? t(TYPE_LABELS[selectedTemplate.type]) : selectedTemplate.type}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                {selectedTemplate.description}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedTemplate.domains.map((d) => (
                  <span
                    key={d}
                    className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-inset ring-gray-200"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="rounded-card border border-gray-200 bg-white p-6">
        <h2 className="mb-5 text-sm font-semibold text-gray-900">
          {t('reportConfiguration')}
        </h2>

        <div className="space-y-5">
          {/* Template selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {t('reportTemplate')}
            </label>
            {templatesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  const tpl = templates.find((t) => t.id === e.target.value);
                  if (tpl) setFormat(tpl.outputFormat);
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
              >
                <option value="">{t('selectTemplate')}</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Country */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Country{' '}
              <span className="text-gray-400">{t('countryOptional')}</span>
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder={t('countryPlaceholder')}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
            />
          </div>

          {/* Period */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                {t('periodStart')}
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                {t('periodEnd')}
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
              />
            </div>
          </div>

          {/* Output format radio buttons */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              {t('outputFormat')}
            </label>
            <div className="flex flex-wrap gap-3">
              {OUTPUT_FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                    format === f.value
                      ? 'border-aris-primary-300 bg-aris-primary-50 text-aris-primary-700 ring-1 ring-aris-primary-200'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full border-2',
                      format === f.value
                        ? 'border-aris-primary-600'
                        : 'border-gray-300',
                    )}
                  >
                    {format === f.value && (
                      <span className="h-2 w-2 rounded-full bg-aris-primary-600" />
                    )}
                  </span>
                  {t(f.tKey)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Cancel
          </Link>
          <button
            onClick={handleGenerate}
            disabled={!canSubmit}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors',
              canSubmit
                ? 'bg-aris-primary-600 hover:bg-aris-primary-700'
                : 'cursor-not-allowed bg-gray-300',
            )}
          >
            {generateReport.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('statusGenerating')}...
              </>
            ) : (
              <>
                <FileBarChart className="h-4 w-4" />
                {t('generateReportBtn')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success message */}
      {generateReport.isSuccess && generateReport.data?.data && (
        <div className="rounded-card border border-green-200 bg-green-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-green-900">
                {t('generationStarted')}
              </h3>
              <p className="mt-1 text-sm text-green-700">
                {t('generationStartedDesc')}
              </p>
              {generateReport.data.data.downloadUrl && (
                <a
                  href={generateReport.data.data.downloadUrl}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <Download className="h-4 w-4" />
                  {t('downloadReport')}
                </a>
              )}
              {generateReport.data.data.status === 'pending' ||
              generateReport.data.data.status === 'generating' ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Status: {generateReport.data.data.status === 'generating'
                    ? 'Generating...'
                    : 'Pending...'}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {generateReport.isError && (
        <div className="rounded-card border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                {t('generationFailed')}
              </h3>
              <p className="mt-1 text-sm text-red-700">
                {generateReport.error instanceof Error
                  ? generateReport.error.message
                  : 'An unexpected error occurred. Please try again.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Validation hint */}
      {!templateId && !generateReport.isPending && !generateReport.isSuccess && (
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <p className="text-sm text-amber-700">
              {t('validationMsg')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
